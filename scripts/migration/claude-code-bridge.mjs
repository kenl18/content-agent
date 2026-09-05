// Content Agent call bridge — Claude Code subscription provider (ADR-0017).
//
// Same contract as EmailOps' src/lib/contentServiceBridge.mjs (run under `npx tsx`,
// `<request.json> <output.json>`), with the provider swapped: generation goes through the
// locally installed Claude Code CLI authenticated by the machine's Claude subscription. This
// file is the reference implementation the migration QA harness spawns; once QA passes the
// same logic replaces EmailOps' bridge verbatim.
//
// WHAT IT NEVER DOES
//   - read ANTHROPIC_API_KEY (from any .env or the environment)
//   - import providers/anthropic-provider.ts or @anthropic-ai/sdk
//   - fall back to the Anthropic API when the subscription is unavailable or limited
//
// A missing/expired subscription login surfaces as CLAUDE_AUTH_UNAVAILABLE and a usage-window
// limit as CLAUDE_SUBSCRIPTION_LIMIT — both inside the normal ContentServiceError envelope, so
// the caller's existing "raw.error" handling sees them without new transport.

import { readFileSync, writeFileSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const CONTENT_SERVICE_DIR = process.env.CONTENT_SERVICE_DIR || 'C:/Internet Marketing Business/content-agent';

// Belt and braces: the provider scrubs its child environment itself, but this process must not
// hold a Console credential either — nothing in it has a use for one.
for (const name of ['ANTHROPIC_API_KEY', 'ANTHROPIC_AUTH_TOKEN', 'CLAUDE_API_KEY', 'ANTHROPIC_BASE_URL']) {
  delete process.env[name];
}

async function main() {
  const [, , requestPath, outputPath] = process.argv;
  if (!requestPath || !outputPath) {
    throw new Error('Usage: claude-code-bridge.mjs <request.json path> <output.json path>');
  }
  const rawRequest = JSON.parse(readFileSync(requestPath, 'utf8'));

  const load = (p) => import(pathToFileURL(`${CONTENT_SERVICE_DIR}/src/${p}`).href.replace(/\.js$/, '.ts'));
  const { generateContent } = await load('application/content-service.js');
  const { createClaudeCodeProvider } = await load('providers/claude-code-provider.js');

  const provider = createClaudeCodeProvider({
    model: process.env.CONTENT_AGENT_CLAUDE_MODEL || undefined,
    effort: process.env.CONTENT_AGENT_CLAUDE_EFFORT || undefined,
    // Below the caller's own 180 s child timeout, so a hung generation is reported by the
    // provider (classified) rather than by a killed bridge (unclassified).
    timeoutMs: 150000,
  });
  const result = await generateContent(rawRequest, { provider });
  writeFileSync(outputPath, JSON.stringify(result));
}

main().catch((err) => {
  process.stderr.write(String((err && err.stack) || err));
  process.exit(1);
});
