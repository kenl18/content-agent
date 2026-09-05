# ADR-0017: Claude Code Subscription Provider for Unattended Email Generation

## Status

**Accepted (owner GO, 2026-09-05).** Implemented in `src/providers/claude-code-provider.ts`;
EmailOps' scheduled composition switched to it the same day. Extends [ADR-0001](0001-single-model-provider-v1.md)
without reopening the V1 architecture: the pipeline, contracts, templates and Response Validation
are unchanged; only the concrete `ModelProvider` used by EmailOps changes.

## Context

EmailOps' Daily Programme generates every email through this service via a child-process bridge
that constructed `createAnthropicProvider({ apiKey })` from `ANTHROPIC_API_KEY` in this
repository's `.env` — Anthropic Console pay-as-you-go billing. On 2026-09-05 that key ran out of
credit mid-run: the first Copy System V3 QA sample lost eight of ten generations and the
programme's copy path had no working provider. The owner directed that unattended EmailOps copy
generation move off the Console key entirely and onto the machine's Claude Max subscription,
through the locally installed Claude Code CLI, with no separate API billing — and that the
editorial system (Copy System V3, destination promise contract, every guard, the 80–160 word
band, retry logic) stay exactly as it is.

Two properties were non-negotiable: **no PAYG leakage** (a run must not be able to bill the
Console key, even accidentally) and **fail closed** (if subscription auth is unavailable or its
usage window is exhausted, stop and report — never fall back to the API, never buy credit,
never switch provider silently).

## Decision

### A second concrete provider, same interface

`ClaudeCodeProvider` (`name: "claude-code"`) implements `ModelProvider` by spawning the Claude
Code CLI in non-interactive mode:

```
claude -p --output-format json --model <model> --effort <effort> --tools ""
       --no-session-persistence --setting-sources user
       --system-prompt-file <tmp> --json-schema <outputSchema>      (prompt on stdin)
```

- The system prompt travels in a temp file and the user prompt on stdin, so prompt length is
  never bounded by the Windows command-line limit. No shell is involved (`spawn` with
  `shell: false`, `windowsHide: true`); the binary is resolved from `CLAUDE_CODE_BIN`, then the
  native installer's per-user path, then `PATH`.
- The CLI runs in a private scratch directory with no `CLAUDE.md`, hooks, MCP servers or project
  settings, with all tools disabled and no session persisted: a pure text generation.
- `--json-schema` carries the new optional `ModelInstructions.outputSchema`, built by
  Instruction Generation from the request's `sections` (the same shape `buildContentSchema`
  validates). The provider returns `structured_output` re-serialised as the raw text the
  pipeline already expects, so Response Validation runs unchanged. Providers that cannot use
  the schema ignore it; the Anthropic provider does.
- Default model is `claude-sonnet-5`, the same default the Anthropic provider has, so the
  provider swap is not also a model change. Effort defaults to `high` (the API default).

### Hard block on PAYG leakage

Before spawning, the provider copies the parent environment and deletes every Console/API
credential and endpoint override Claude Code honours (`ANTHROPIC_API_KEY`,
`ANTHROPIC_AUTH_TOKEN`, `CLAUDE_API_KEY`, `ANTHROPIC_BASE_URL`, custom headers, the
Bedrock/Vertex/Foundry switches and URLs) plus the nested-session markers an interactive Claude
Code session sets — the full list is `SCRUBBED_ENV_VARS`. `--bare` is never used (it restricts
auth to API keys). `--fallback-model` is never used.

### Fail closed

Before its first generation a provider instance runs `claude auth status` in that scrubbed
environment and requires `loggedIn: true`, `authMethod: "claude.ai"` and
`apiProvider: "firstParty"`. Anything else — logged out, API-key auth, a third-party provider —
throws `ProviderError` classified `CLAUDE_AUTH_UNAVAILABLE`. There is no code path from this
provider, or from the EmailOps bridge, to the Anthropic SDK.

### Failure classification on the wire

`ProviderError` gains a `classification` (`PROVIDER_FAULT` default,
`CLAUDE_SUBSCRIPTION_LIMIT`, `CLAUDE_AUTH_UNAVAILABLE`) and structured `details`. The
application layer maps a non-default classification to a new error code of the same name, so
the error contract gains two codes ([docs/contracts.md](../contracts.md)):

| Code | Meaning | Caller's correct response |
|---|---|---|
| `CLAUDE_SUBSCRIPTION_LIMIT` | The subscription's usage window is exhausted (HTTP 429 or the CLI's limit wording; `details.resetsAt` when the CLI reports it). | Stop the run, keep whatever plan state exists, retry later within a bounded schedule. Never retry on a paid path. |
| `CLAUDE_AUTH_UNAVAILABLE` | No usable subscription login (not logged in, expired token, API-key or third-party auth). | Stop; an operator must run `claude auth login` as the scheduled user. Never fall back. |

Transient faults (timeouts, overloads, a missing binary, unparseable CLI output) stay
`PROVIDER_ERROR`, which existing callers already retry after a short pause.

### What did not change

The pipeline, templates, Strategy Layer, schemas, request/response contracts, the Anthropic
provider (still available to any caller that supplies its own key), and `createContentClient`.
EmailOps' Copy System V3 and all of its guards are untouched: the provider changed, the
editorial system did not.

## Consequences

- Scheduled EmailOps composition no longer reads `ANTHROPIC_API_KEY` from anywhere; the key
  is not needed by any automatic path and can be revoked at the owner's discretion.
- Generation latency is higher than a direct API call (CLI start-up plus an auth preflight,
  ~30–40 s per email measured) — acceptable for a nightly compose of ~31 emails.
- The provider depends on a per-user Claude Code installation and login on the machine that
  runs the scheduled task. Both were proven from a non-interactive Node subprocess and from a
  Windows Task Scheduler task under the same user and launcher as the live Daily Programme
  (2026-09-05). If the task's principal is ever moved to S4U, re-run
  `scripts/claude-code-auth-probe.mts` through it before relying on it.
- Two providers now exist behind `ModelProvider`. This is still not routing or fallback
  (ADR-0001's deferral stands): each caller chooses one provider explicitly, and neither
  provider knows the other exists.
