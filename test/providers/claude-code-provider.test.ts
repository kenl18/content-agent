import { describe, expect, it } from "vitest";
import {
  ClaudeCodeProvider,
  SCRUBBED_ENV_VARS,
  buildClaudeCodeEnv,
  classifyClaudeCodeFailure,
  type ClaudeCodeInvocation,
  type ClaudeCodeProcessResult,
  type ClaudeCodeRunner
} from "../../src/providers/claude-code-provider.js";
import { ProviderError } from "../../src/providers/model-provider.js";

const LOGGED_IN = JSON.stringify({
  loggedIn: true,
  authMethod: "claude.ai",
  apiProvider: "firstParty",
  subscriptionType: "max"
});

function ok(stdout: string, extra: Partial<ClaudeCodeProcessResult> = {}): ClaudeCodeProcessResult {
  return { exitCode: 0, signal: null, stdout, stderr: "", timedOut: false, ...extra };
}

/** A runner that answers `auth status` with `auth` and every generation with `gen`. */
function fakeRunner(
  auth: ClaudeCodeProcessResult,
  gen: ClaudeCodeProcessResult | ((inv: ClaudeCodeInvocation) => ClaudeCodeProcessResult),
  seen: ClaudeCodeInvocation[] = []
): ClaudeCodeRunner {
  return async (invocation) => {
    seen.push(invocation);
    if (invocation.args[0] === "auth") return auth;
    return typeof gen === "function" ? gen(invocation) : gen;
  };
}

const successEnvelope = (structured: unknown) =>
  JSON.stringify({
    type: "result",
    subtype: "success",
    is_error: false,
    result: JSON.stringify(structured),
    structured_output: structured,
    modelUsage: { "claude-sonnet-5": { provider: "firstParty" } }
  });

describe("ClaudeCodeProvider", () => {
  it("scrubs every Console/API credential and override from the child environment", () => {
    const base: NodeJS.ProcessEnv = { PATH: "/bin", KEEP_ME: "1", CLAUDE_CONFIG_DIR: "/cfg" };
    for (const name of SCRUBBED_ENV_VARS) base[name] = "leak";
    const env = buildClaudeCodeEnv(base);
    for (const name of SCRUBBED_ENV_VARS) expect(env).not.toHaveProperty(name);
    expect(env.PATH).toBe("/bin");
    expect(env.KEEP_ME).toBe("1");
    // The subscription credential store location is legitimate and must survive.
    expect(env.CLAUDE_CONFIG_DIR).toBe("/cfg");
    expect(SCRUBBED_ENV_VARS).toEqual(
      expect.arrayContaining(["ANTHROPIC_API_KEY", "ANTHROPIC_AUTH_TOKEN", "CLAUDE_API_KEY", "ANTHROPIC_BASE_URL"])
    );
  });

  it("spawns the CLI with the scrubbed env, no tools, the schema, and the prompt on stdin", async () => {
    const seen: ClaudeCodeInvocation[] = [];
    const provider = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      env: { ANTHROPIC_API_KEY: "sk-leak", ANTHROPIC_BASE_URL: "http://evil", HOME: "/h" },
      runner: fakeRunner(ok(LOGGED_IN), ok(successEnvelope({ subjectLine: "S" })), seen)
    });
    const result = await provider.generate({
      system: "SYS",
      user: "USER",
      outputSchema: { type: "object", properties: { subjectLine: { type: "string" } }, required: ["subjectLine"], additionalProperties: false }
    });
    expect(result.text).toBe('{"subjectLine":"S"}');
    expect(seen).toHaveLength(2);
    expect(seen[0]!.args).toEqual(["auth", "status"]);
    const gen = seen[1]!;
    expect(gen.file).toBe("/fake/claude");
    expect(gen.stdin).toBe("USER");
    expect(gen.env).not.toHaveProperty("ANTHROPIC_API_KEY");
    expect(gen.env).not.toHaveProperty("ANTHROPIC_BASE_URL");
    expect(gen.args).toContain("-p");
    expect(gen.args).toContain("--no-session-persistence");
    expect(gen.args.slice(gen.args.indexOf("--tools"), gen.args.indexOf("--tools") + 2)).toEqual(["--tools", ""]);
    expect(gen.args.slice(gen.args.indexOf("--model"), gen.args.indexOf("--model") + 2)).toEqual(["--model", "claude-sonnet-5"]);
    expect(gen.args).toContain("--json-schema");
    expect(gen.args).not.toContain("--fallback-model");
    expect(gen.args).not.toContain("--bare");
    expect(gen.args).toContain("--system-prompt-file");
  });

  it("caches the auth preflight across generations", async () => {
    const seen: ClaudeCodeInvocation[] = [];
    const provider = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      runner: fakeRunner(ok(LOGGED_IN), ok(successEnvelope({ a: "1" })), seen)
    });
    await provider.generate({ system: "s", user: "u" });
    await provider.generate({ system: "s", user: "u" });
    expect(seen.filter((i) => i.args[0] === "auth")).toHaveLength(1);
  });

  it("fails closed when Claude Code is not logged in", async () => {
    const provider = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      runner: fakeRunner(ok(JSON.stringify({ loggedIn: false })), ok(successEnvelope({ a: "1" })))
    });
    const error = await provider.generate({ system: "s", user: "u" }).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ProviderError);
    expect((error as ProviderError).classification).toBe("CLAUDE_AUTH_UNAVAILABLE");
  });

  it("refuses API-key / third-party auth even when logged in", async () => {
    const apiKeyAuth = JSON.stringify({ loggedIn: true, authMethod: "apiKey", apiProvider: "firstParty" });
    const provider = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      runner: fakeRunner(ok(apiKeyAuth), ok(successEnvelope({ a: "1" })))
    });
    const error = await provider.generate({ system: "s", user: "u" }).catch((e: unknown) => e);
    expect((error as ProviderError).classification).toBe("CLAUDE_AUTH_UNAVAILABLE");

    const bedrock = JSON.stringify({ loggedIn: true, authMethod: "claude.ai", apiProvider: "bedrock" });
    const provider2 = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      runner: fakeRunner(ok(bedrock), ok(successEnvelope({ a: "1" })))
    });
    const error2 = await provider2.generate({ system: "s", user: "u" }).catch((e: unknown) => e);
    expect((error2 as ProviderError).classification).toBe("CLAUDE_AUTH_UNAVAILABLE");
  });

  it("classifies a subscription usage limit and carries the reset time", async () => {
    const envelope = JSON.stringify({
      type: "result",
      subtype: "error_during_execution",
      is_error: true,
      result: "Claude AI usage limit reached|1757100000",
      api_error_status: 429
    });
    const provider = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      runner: fakeRunner(ok(LOGGED_IN), ok(envelope, { exitCode: 1 }))
    });
    const error = (await provider.generate({ system: "s", user: "u" }).catch((e: unknown) => e)) as ProviderError;
    expect(error).toBeInstanceOf(ProviderError);
    expect(error.classification).toBe("CLAUDE_SUBSCRIPTION_LIMIT");
    expect(error.details?.resetsAt).toBe(new Date(1757100000 * 1000).toISOString());
  });

  it("classifies non-JSON CLI output by its text", async () => {
    const provider = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      runner: fakeRunner(ok(LOGGED_IN), ok("", { exitCode: 1, stderr: "You've hit your limit · resets 3pm" }))
    });
    const error = (await provider.generate({ system: "s", user: "u" }).catch((e: unknown) => e)) as ProviderError;
    expect(error.classification).toBe("CLAUDE_SUBSCRIPTION_LIMIT");
  });

  it("reports a missing binary as a plain provider fault (retry now), not an auth failure", async () => {
    const spawnError = Object.assign(new Error("spawn ENOENT"), { code: "ENOENT" });
    const runner: ClaudeCodeRunner = async () => ({
      exitCode: null,
      signal: null,
      stdout: "",
      stderr: "",
      timedOut: false,
      spawnError
    });
    const provider = new ClaudeCodeProvider({ binaryPath: "/missing/claude", runner });
    const error = (await provider.generate({ system: "s", user: "u" }).catch((e: unknown) => e)) as ProviderError;
    expect(error.classification).toBe("PROVIDER_FAULT");
    expect(error.message).toMatch(/could not be started/);
  });

  it("times out as a provider fault", async () => {
    const provider = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      timeoutMs: 5,
      runner: fakeRunner(ok(LOGGED_IN), ok("", { exitCode: null, timedOut: true }))
    });
    const error = (await provider.generate({ system: "s", user: "u" }).catch((e: unknown) => e)) as ProviderError;
    expect(error.classification).toBe("PROVIDER_FAULT");
    expect(error.message).toMatch(/timed out/);
  });

  it("falls back to the result text, unfenced, when no structured_output is present", async () => {
    const envelope = JSON.stringify({ type: "result", subtype: "success", is_error: false, result: '```json\n{"a":"1"}\n```' });
    const provider = new ClaudeCodeProvider({
      binaryPath: "/fake/claude",
      runner: fakeRunner(ok(LOGGED_IN), ok(envelope))
    });
    const result = await provider.generate({ system: "s", user: "u" });
    expect(JSON.parse(result.text)).toEqual({ a: "1" });
  });

  it("names itself and defaults its model", () => {
    const provider = new ClaudeCodeProvider({ binaryPath: "/fake/claude", runner: fakeRunner(ok(LOGGED_IN), ok("")) });
    expect(provider.name).toBe("claude-code");
    expect(provider.model).toBe("claude-sonnet-5");
  });
});

describe("classifyClaudeCodeFailure", () => {
  it("maps HTTP 429 and limit wording to CLAUDE_SUBSCRIPTION_LIMIT", () => {
    expect(classifyClaudeCodeFailure({ text: "", apiErrorStatus: 429 }).classification).toBe("CLAUDE_SUBSCRIPTION_LIMIT");
    expect(classifyClaudeCodeFailure({ text: "rate limit exceeded" }).classification).toBe("CLAUDE_SUBSCRIPTION_LIMIT");
    expect(classifyClaudeCodeFailure({ text: "You are out of extra usage" }).classification).toBe("CLAUDE_SUBSCRIPTION_LIMIT");
  });
  it("maps HTTP 401/403 and auth wording to CLAUDE_AUTH_UNAVAILABLE", () => {
    expect(classifyClaudeCodeFailure({ text: "", apiErrorStatus: 401 }).classification).toBe("CLAUDE_AUTH_UNAVAILABLE");
    expect(classifyClaudeCodeFailure({ text: "Not logged in. Please run /login" }).classification).toBe("CLAUDE_AUTH_UNAVAILABLE");
    expect(classifyClaudeCodeFailure({ text: "OAuth token has expired" }).classification).toBe("CLAUDE_AUTH_UNAVAILABLE");
  });
  it("leaves everything else as a provider fault", () => {
    expect(classifyClaudeCodeFailure({ text: "overloaded_error", apiErrorStatus: 529 }).classification).toBe("PROVIDER_FAULT");
    expect(classifyClaudeCodeFailure({ text: "" }).classification).toBe("PROVIDER_FAULT");
  });
});
