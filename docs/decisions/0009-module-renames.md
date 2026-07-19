# ADR-0009: Module Renames — `prompt/` → `generation/`, `service/` → `application/`

## Status

Accepted.

## Context

The original folder structure (see the earliest draft of
[technical-design.md](../technical-design.md)) used `src/prompt/` for instruction building and
`src/service/` for pipeline orchestration. Two things changed since:

1. With the introduction of the [Template layer](0008-template-layer.md) and the
   [Business Objective model](0006-business-objective-model.md), the module that turns a request
   into model instructions is no longer simple prompt string-templating — it synthesizes a
   validated request, a resolved template, and one or more business objectives into instructions
   aimed at a measurable outcome. "Prompt" undersold what the module does and invited the
   assumption that it's a thin templating layer.
2. `service/` was ambiguous with "the Content Agent" (the repository/product as a whole) and
   didn't clearly communicate that this specific module is the orchestration/use-case layer that
   coordinates the other modules — a more conventional and precise name was available.

## Decision

Rename:

- `src/prompt/` → `src/generation/` (and `src/prompt/build-instructions.ts` →
  `src/generation/build-instructions.ts`)
- `src/service/` → `src/application/` (and `src/service/content-service.ts` →
  `src/application/content-service.ts`)

`test/prompt/` and `test/service/` are renamed to `test/generation/` and `test/application/`
correspondingly. No behavior changes as a result of this ADR — it is a naming/organization
change only, made before any implementation exists, to avoid ever having to rename real code and
tests later.

## Consequences

- All references to `src/prompt/*` and `src/service/*` across
  [technical-design.md](../technical-design.md), [contracts.md](../contracts.md), and other ADRs
  are updated to the new names.
- The module boundary table in [technical-design.md](../technical-design.md) reflects
  `generation` and `application` as the canonical names going forward.
- No functional or architectural change results from this ADR — see
  [ADR-0004](0004-transport-independent-core.md) and
  [ADR-0005](0005-strategy-supplied-not-invented.md), whose responsibilities are unchanged, only
  their module paths.

## Alternatives considered

- **Leave the original names** — rejected: since no code has been written yet, this is the
  cheapest possible time to fix a naming mismatch; waiting until after implementation would mean
  a real rename across source and tests instead of a documentation update.
