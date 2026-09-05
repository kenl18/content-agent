/**
 * ADR-0017 unattended-auth probe.
 *
 *   npx tsx scripts/claude-code-auth-probe.mts [--no-generate] [--out <file.json>]
 *
 * Proves, from a NON-interactive Node subprocess (no TTY, no interactive Claude Code session),
 * that the Claude Code subscription provider can (1) find the CLI, (2) see a logged-in claude.ai
 * subscription with every Console/API credential scrubbed from the child environment, and
 * (3) complete one minimal structured generation. Exit codes:
 *   0 proven · 2 CLAUDE_AUTH_UNAVAILABLE · 3 CLAUDE_SUBSCRIPTION_LIMIT · 1 anything else
 *
 * The same script is what the temporary scheduled-task proof runs, so the interactive and
 * scheduled results are directly comparable.
 */
import { writeFileSync } from "node:fs";
import { userInfo } from "node:os";
import {
  SCRUBBED_ENV_VARS,
  createClaudeCodeProvider,
  resolveClaudeBinary
} from "../src/providers/claude-code-provider.js";
import { ProviderError } from "../src/providers/model-provider.js";

const argOf = (flag: string): string | undefined => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
};
const NO_GENERATE = process.argv.includes("--no-generate");
const OUT = argOf("--out");

const parentApiVars = Object.keys(process.env).filter((k) => /ANTHROPIC|CLAUDE/i.test(k));
const verdict: Record<string, unknown> = {
  at: new Date().toISOString(),
  user: userInfo().username,
  pid: process.pid,
  ppid: process.ppid,
  interactiveStdin: Boolean(process.stdin.isTTY),
  interactiveStdout: Boolean(process.stdout.isTTY),
  sessionName: process.env.SESSIONNAME ?? null,
  binary: resolveClaudeBinary(),
  parentEnvNamesMatchingAnthropicOrClaude: parentApiVars,
  scrubbedFromChild: parentApiVars.filter((k) => SCRUBBED_ENV_VARS.includes(k))
};

let exitCode = 0;
try {
  const provider = createClaudeCodeProvider({ timeoutMs: 90_000 });
  for (const name of SCRUBBED_ENV_VARS) {
    if (name in provider.childEnv) throw new Error(`scrub failed: ${name} still present in child env`);
  }
  verdict.childEnvHasApiKey = "ANTHROPIC_API_KEY" in provider.childEnv;
  const auth = await provider.ensureSubscriptionAuth();
  verdict.auth = {
    loggedIn: auth.loggedIn,
    authMethod: auth.authMethod,
    apiProvider: auth.apiProvider,
    subscriptionType: auth.subscriptionType,
    email: auth.email
  };
  if (!NO_GENERATE) {
    const started = Date.now();
    const out = await provider.generate({
      system: "You output only JSON that satisfies the schema. No prose.",
      user: 'Reply with ok=true and word="unattended".',
      outputSchema: {
        type: "object",
        properties: { ok: { type: "string" }, word: { type: "string" } },
        required: ["ok", "word"],
        additionalProperties: false
      }
    });
    verdict.generation = { ok: true, durationMs: Date.now() - started, text: out.text };
  }
  verdict.result = "PROVEN";
} catch (error) {
  const classification = error instanceof ProviderError ? error.classification : "UNEXPECTED";
  verdict.result = "FAILED";
  verdict.failure = { classification, message: (error as Error).message, details: (error as ProviderError).details ?? null };
  exitCode = classification === "CLAUDE_AUTH_UNAVAILABLE" ? 2 : classification === "CLAUDE_SUBSCRIPTION_LIMIT" ? 3 : 1;
}

const text = JSON.stringify(verdict, null, 2);
if (OUT) writeFileSync(OUT, text);
process.stdout.write(text + "\n");
process.exit(exitCode);
