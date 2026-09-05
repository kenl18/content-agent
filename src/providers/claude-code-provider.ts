import { spawn } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { homedir, tmpdir } from "node:os";
import { join } from "node:path";
import {
  ProviderError,
  type ModelInstructions,
  type ModelProvider,
  type ProviderFailureClass,
  type RawModelOutput
} from "./model-provider.js";

/**
 * ADR-0017 — the subscription-authenticated Claude Code provider.
 *
 * Generates through the locally installed Claude Code CLI in non-interactive mode (`claude -p`),
 * authenticated by the machine's stored Claude subscription login (claude.ai / Max). It never
 * touches the Anthropic Console API key path:
 *
 *   - every Console/API credential and endpoint override is REMOVED from the child environment
 *     (SCRUBBED_ENV_VARS) before the CLI is spawned, so the CLI cannot bill a pay-as-you-go key
 *     even if one is present in the parent process;
 *   - before generating, `claude auth status` must report a logged-in claude.ai account; any
 *     other auth method (API key, Bedrock/Vertex/Foundry) is REFUSED — fail closed, no fallback;
 *   - a usage-limit failure is classified CLAUDE_SUBSCRIPTION_LIMIT (retry later), never turned
 *     into a call on another provider.
 *
 * The rest of the pipeline is untouched: the CLI returns the same JSON object the Anthropic
 * provider would have produced (enforced with `--json-schema` from the instructions'
 * outputSchema), and Response Validation still runs on it.
 */

export const DEFAULT_CLAUDE_CODE_MODEL = "claude-sonnet-5";
export const DEFAULT_CLAUDE_CODE_EFFORT = "high";
export const DEFAULT_CLAUDE_CODE_TIMEOUT_MS = 150_000;

/**
 * Environment variables that must never reach the Claude Code child process. The first group is
 * every Console/API (pay-as-you-go) credential or endpoint override Claude Code honours; the
 * second is third-party provider routing (also non-subscription billing); the third is the
 * nested-session markers an interactive Claude Code session sets, removed so the child behaves
 * exactly as it does under the Windows scheduler, where none of them exist.
 */
export const SCRUBBED_ENV_VARS: readonly string[] = [
  "ANTHROPIC_API_KEY",
  "ANTHROPIC_AUTH_TOKEN",
  "CLAUDE_API_KEY",
  "ANTHROPIC_BASE_URL",
  "ANTHROPIC_API_URL",
  "ANTHROPIC_CUSTOM_HEADERS",
  "CLAUDE_CODE_API_KEY_HELPER_TTL_MS",
  "CLAUDE_CODE_USE_BEDROCK",
  "CLAUDE_CODE_USE_VERTEX",
  "CLAUDE_CODE_USE_FOUNDRY",
  "CLAUDE_CODE_SKIP_BEDROCK_AUTH",
  "CLAUDE_CODE_SKIP_VERTEX_AUTH",
  "CLAUDE_CODE_SKIP_FOUNDRY_AUTH",
  "ANTHROPIC_BEDROCK_BASE_URL",
  "ANTHROPIC_VERTEX_BASE_URL",
  "ANTHROPIC_FOUNDRY_BASE_URL",
  "AWS_BEARER_TOKEN_BEDROCK",
  "CLAUDECODE",
  "CLAUDE_CODE_ENTRYPOINT",
  "CLAUDE_CODE_SESSION_ID",
  "CLAUDE_CODE_CHILD_SESSION",
  "CLAUDE_CODE_MESSAGING_SOCKET",
  "CLAUDE_CODE_MESSAGING_TOKEN",
  "CLAUDE_AGENT_SDK_VERSION",
  "CLAUDE_PID"
];

/** The only auth method this provider accepts. Everything else fails closed. */
export const REQUIRED_AUTH_METHOD = "claude.ai";
export const REQUIRED_API_PROVIDER = "firstParty";

export interface ClaudeCodeInvocation {
  file: string;
  args: string[];
  stdin?: string;
  env: NodeJS.ProcessEnv;
  cwd: string;
  timeoutMs: number;
}

export interface ClaudeCodeProcessResult {
  exitCode: number | null;
  signal: string | null;
  stdout: string;
  stderr: string;
  timedOut: boolean;
  spawnError?: NodeJS.ErrnoException;
}

/** Runs one CLI invocation. Injectable so tests never spawn a real process. */
export type ClaudeCodeRunner = (invocation: ClaudeCodeInvocation) => Promise<ClaudeCodeProcessResult>;

export interface ClaudeCodeProviderOptions {
  /** Model passed to `--model`. Defaults to the same model the Anthropic provider defaults to. */
  model?: string;
  /** Effort level passed to `--effort`. */
  effort?: "low" | "medium" | "high" | "xhigh" | "max";
  /** Absolute path to the Claude Code binary. Defaults to resolveClaudeBinary(). */
  binaryPath?: string;
  /** Per-generation wall-clock limit; the child is killed on expiry. */
  timeoutMs?: number;
  /**
   * Directory the CLI runs in. Defaults to a private scratch directory containing no CLAUDE.md,
   * settings, hooks or MCP config, so nothing project-specific leaks into the generation.
   */
  workingDirectory?: string;
  /** Base environment (default process.env). It is scrubbed before use — never passed as-is. */
  env?: NodeJS.ProcessEnv;
  /** Preflight `claude auth status` before the first generation (default true). */
  verifyAuth?: boolean;
  runner?: ClaudeCodeRunner;
}

export interface ClaudeCodeAuthStatus {
  loggedIn: boolean;
  authMethod?: string;
  apiProvider?: string;
  subscriptionType?: string;
  email?: string;
}

/** Returns a copy of `base` with every SCRUBBED_ENV_VARS entry removed. */
export function buildClaudeCodeEnv(base: NodeJS.ProcessEnv = process.env): NodeJS.ProcessEnv {
  const env: NodeJS.ProcessEnv = { ...base };
  for (const name of SCRUBBED_ENV_VARS) delete env[name];
  return env;
}

/**
 * Locates the Claude Code binary: an explicit CLAUDE_CODE_BIN, then the native installer's
 * per-user location, then PATH. Only real executables are candidates — a `.cmd` shim would need
 * a shell, and this provider never spawns one.
 */
export function resolveClaudeBinary(env: NodeJS.ProcessEnv = process.env): string {
  const explicit = env.CLAUDE_CODE_BIN;
  if (explicit && existsSync(explicit)) return explicit;
  const home = env.USERPROFILE || env.HOME || homedir();
  const candidates =
    process.platform === "win32"
      ? [join(home, ".local", "bin", "claude.exe")]
      : [join(home, ".local", "bin", "claude"), "/usr/local/bin/claude", "/opt/homebrew/bin/claude"];
  for (const candidate of candidates) if (existsSync(candidate)) return candidate;
  return "claude";
}

const LIMIT_PATTERN =
  /usage limit|hit your limit|limit reached|out of (extra )?usage|rate.?limit|too many requests|resets? (at|in) |quota/i;
const AUTH_PATTERN =
  /not logged in|not authenticated|please (run )?\/?login|\blog ?in\b|authentication|unauthori[sz]ed|invalid (api key|token|credential)|oauth|token (has )?expired|credentials?/i;

export interface ClassifiedFailure {
  classification: ProviderFailureClass;
  /** ISO timestamp when the limit window is expected to reset, when the CLI says so. */
  resetsAt?: string;
}

/**
 * Classifies a failed CLI run from what the CLI said. HTTP status wins when known; otherwise
 * the message text decides. Anything unrecognised is a plain provider fault (retry now).
 */
export function classifyClaudeCodeFailure(input: {
  text: string;
  apiErrorStatus?: number | null;
}): ClassifiedFailure {
  const text = input.text || "";
  const status = input.apiErrorStatus ?? null;
  if (status === 429 || LIMIT_PATTERN.test(text)) {
    return { classification: "CLAUDE_SUBSCRIPTION_LIMIT", ...resetsAtFrom(text) };
  }
  if (status === 401 || status === 403 || AUTH_PATTERN.test(text)) {
    return { classification: "CLAUDE_AUTH_UNAVAILABLE" };
  }
  return { classification: "PROVIDER_FAULT" };
}

function resetsAtFrom(text: string): { resetsAt?: string } {
  // Claude Code reports a subscription limit as "... usage limit reached|<unix seconds>".
  const epoch = /limit reached\|(\d{9,13})/i.exec(text);
  if (epoch?.[1]) {
    const n = Number(epoch[1]);
    return { resetsAt: new Date(n < 1e11 ? n * 1000 : n).toISOString() };
  }
  return {};
}

function stripFences(text: string): string {
  const trimmed = text.trim();
  const fenced = /^```(?:json)?\s*([\s\S]*?)\s*```$/i.exec(trimmed);
  return fenced?.[1] ?? trimmed;
}

/** Default runner: spawn without a shell, pipe the prompt on stdin, kill on timeout. */
export const spawnClaudeCode: ClaudeCodeRunner = (invocation) =>
  new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let timedOut = false;
    let settled = false;
    const finish = (result: ClaudeCodeProcessResult) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    const child = spawn(invocation.file, invocation.args, {
      cwd: invocation.cwd,
      env: invocation.env,
      shell: false,
      windowsHide: true,
      stdio: ["pipe", "pipe", "pipe"]
    });
    const timer = setTimeout(() => {
      timedOut = true;
      try {
        child.kill();
      } catch {
        /* already gone */
      }
    }, invocation.timeoutMs);
    child.stdout.setEncoding("utf8");
    child.stderr.setEncoding("utf8");
    child.stdout.on("data", (chunk: string) => (stdout += chunk));
    child.stderr.on("data", (chunk: string) => (stderr += chunk));
    child.on("error", (error: NodeJS.ErrnoException) =>
      finish({ exitCode: null, signal: null, stdout, stderr, timedOut, spawnError: error })
    );
    child.on("close", (code, signal) => finish({ exitCode: code, signal, stdout, stderr, timedOut }));
    if (invocation.stdin !== undefined) child.stdin.end(invocation.stdin);
    else child.stdin.end();
  });

export class ClaudeCodeProvider implements ModelProvider {
  readonly name = "claude-code";
  readonly model: string;
  private readonly effort: string;
  private readonly binaryPath: string;
  private readonly timeoutMs: number;
  private readonly workingDirectory: string;
  private readonly env: NodeJS.ProcessEnv;
  private readonly verifyAuth: boolean;
  private readonly runner: ClaudeCodeRunner;
  private verifiedAuth: ClaudeCodeAuthStatus | null = null;

  constructor(options: ClaudeCodeProviderOptions = {}) {
    this.model = options.model ?? DEFAULT_CLAUDE_CODE_MODEL;
    this.effort = options.effort ?? DEFAULT_CLAUDE_CODE_EFFORT;
    this.env = buildClaudeCodeEnv(options.env ?? process.env);
    this.binaryPath = options.binaryPath ?? resolveClaudeBinary(this.env);
    this.timeoutMs = options.timeoutMs ?? DEFAULT_CLAUDE_CODE_TIMEOUT_MS;
    this.workingDirectory = options.workingDirectory ?? join(tmpdir(), "content-agent-claude-code");
    this.verifyAuth = options.verifyAuth ?? true;
    this.runner = options.runner ?? spawnClaudeCode;
  }

  /** The scrubbed environment the CLI actually receives (for callers that want to audit it). */
  get childEnv(): Readonly<NodeJS.ProcessEnv> {
    return this.env;
  }

  /**
   * Fail-closed auth gate: the CLI must report a logged-in claude.ai (subscription) account on
   * Anthropic's first-party endpoint. Cached per provider instance once it passes.
   */
  async ensureSubscriptionAuth(): Promise<ClaudeCodeAuthStatus> {
    if (this.verifiedAuth) return this.verifiedAuth;
    mkdirSync(this.workingDirectory, { recursive: true });
    const run = await this.runner({
      file: this.binaryPath,
      args: ["auth", "status"],
      env: this.env,
      cwd: this.workingDirectory,
      timeoutMs: Math.min(this.timeoutMs, 30_000)
    });
    if (run.spawnError) {
      throw new ProviderError(
        `Claude Code CLI could not be started (${run.spawnError.code ?? "spawn error"}): ${this.binaryPath}`,
        { cause: run.spawnError, details: { binaryPath: this.binaryPath } }
      );
    }
    let status: ClaudeCodeAuthStatus | null = null;
    try {
      status = JSON.parse(run.stdout) as ClaudeCodeAuthStatus;
    } catch {
      status = null;
    }
    if (!status || typeof status !== "object") {
      throw new ProviderError(
        "Claude Code auth status could not be read; refusing to generate without proof of subscription auth.",
        { classification: "CLAUDE_AUTH_UNAVAILABLE", details: { exitCode: run.exitCode, stderr: run.stderr.slice(0, 500) } }
      );
    }
    if (status.loggedIn !== true) {
      throw new ProviderError(
        "Claude Code is not logged in to a Claude subscription; run `claude auth login` as this user. No API fallback.",
        { classification: "CLAUDE_AUTH_UNAVAILABLE", details: { authMethod: status.authMethod ?? null } }
      );
    }
    if (
      status.authMethod !== REQUIRED_AUTH_METHOD ||
      (status.apiProvider !== undefined && status.apiProvider !== REQUIRED_API_PROVIDER)
    ) {
      throw new ProviderError(
        `Claude Code auth is "${status.authMethod}" on "${status.apiProvider}"; only ${REQUIRED_AUTH_METHOD} subscription auth on ${REQUIRED_API_PROVIDER} is permitted. Refusing (no pay-as-you-go path).`,
        {
          classification: "CLAUDE_AUTH_UNAVAILABLE",
          details: { authMethod: status.authMethod ?? null, apiProvider: status.apiProvider ?? null }
        }
      );
    }
    this.verifiedAuth = status;
    return status;
  }

  buildArgs(systemPromptFile: string, instructions: ModelInstructions): string[] {
    const args = [
      "-p",
      "--output-format",
      "json",
      "--model",
      this.model,
      "--effort",
      this.effort,
      // No tools, no persisted session, no project/local settings: a pure text generation.
      "--tools",
      "",
      "--no-session-persistence",
      "--setting-sources",
      "user",
      "--system-prompt-file",
      systemPromptFile
    ];
    if (instructions.outputSchema) args.push("--json-schema", JSON.stringify(instructions.outputSchema));
    return args;
  }

  async generate(instructions: ModelInstructions): Promise<RawModelOutput> {
    if (this.verifyAuth) await this.ensureSubscriptionAuth();
    mkdirSync(this.workingDirectory, { recursive: true });
    const scratch = mkdtempSync(join(this.workingDirectory, "gen-"));
    const systemPromptFile = join(scratch, "system-prompt.txt");
    let run: ClaudeCodeProcessResult;
    try {
      writeFileSync(systemPromptFile, instructions.system, "utf8");
      run = await this.runner({
        file: this.binaryPath,
        args: this.buildArgs(systemPromptFile, instructions),
        stdin: instructions.user,
        env: this.env,
        cwd: this.workingDirectory,
        timeoutMs: this.timeoutMs
      });
    } finally {
      rmSync(scratch, { recursive: true, force: true });
    }

    if (run.spawnError) {
      throw new ProviderError(
        `Claude Code CLI could not be started (${run.spawnError.code ?? "spawn error"}): ${this.binaryPath}`,
        { cause: run.spawnError, details: { binaryPath: this.binaryPath } }
      );
    }
    if (run.timedOut) {
      throw new ProviderError(`Claude Code generation timed out after ${this.timeoutMs}ms.`, {
        details: { timeoutMs: this.timeoutMs }
      });
    }

    let envelope: Record<string, unknown> | null = null;
    try {
      const parsed: unknown = JSON.parse(run.stdout);
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) envelope = parsed as Record<string, unknown>;
    } catch {
      envelope = null;
    }

    if (!envelope) {
      const text = `${run.stdout}\n${run.stderr}`.trim();
      const failure = classifyClaudeCodeFailure({ text });
      throw new ProviderError(
        `Claude Code did not return a result envelope (exit ${run.exitCode}): ${text.slice(0, 300) || "no output"}`,
        { classification: failure.classification, details: { exitCode: run.exitCode, ...failure } }
      );
    }

    const isError =
      envelope.is_error === true || (envelope.subtype !== undefined && envelope.subtype !== "success");
    const resultText = typeof envelope.result === "string" ? envelope.result : "";
    if (isError || (run.exitCode !== 0 && run.exitCode !== null)) {
      const apiErrorStatus = typeof envelope.api_error_status === "number" ? envelope.api_error_status : null;
      const failure = classifyClaudeCodeFailure({ text: `${resultText}\n${run.stderr}`, apiErrorStatus });
      throw new ProviderError(
        `Claude Code generation failed (${String(envelope.subtype ?? "error")}${apiErrorStatus ? `, HTTP ${apiErrorStatus}` : ""}): ${resultText.slice(0, 300) || run.stderr.slice(0, 300) || "no message"}`,
        {
          classification: failure.classification,
          details: { subtype: envelope.subtype ?? null, apiErrorStatus, exitCode: run.exitCode, ...failure }
        }
      );
    }

    const structured = envelope.structured_output;
    if (structured && typeof structured === "object") return { text: JSON.stringify(structured) };
    if (resultText.trim()) return { text: stripFences(resultText) };
    throw new ProviderError("Claude Code returned an empty result.", { details: { subtype: envelope.subtype ?? null } });
  }
}

export function createClaudeCodeProvider(options: ClaudeCodeProviderOptions = {}): ClaudeCodeProvider {
  return new ClaudeCodeProvider(options);
}
