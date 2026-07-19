# ADR-0005: Strategy Is Always Supplied, Never Invented

## Status

Accepted.

## Context

An AI-backed content generation service has an obvious failure mode: when a request is missing
information the model would need (audience, objective, business facts), it's easy for the model —
or for convenience logic wrapped around it — to quietly fill the gap with a plausible guess. That
guess is invisible to the caller, hard to audit, and turns the service from a content executor
into an undisclosed strategy-maker. This directly conflicts with the service's purpose: callers
(orchestrators like Website Builder) own strategy; this service owns craft.

## Decision

The Content Agent enforces, structurally, that it never invents strategy:

- `primaryObjective`, `targetAudience`, `desiredAction`, and `sections` are **required** fields in
  the request contract (see [docs/contracts.md](../contracts.md)). None have defaults.
  `primaryObjective` in particular is a first-class, structured field (see
  [ADR-0006](0006-business-objective-model.md)) precisely so "why does this content exist" gets
  the same required-field treatment as "who is it for" and "what should they do" — it is never
  left implicit or defaulted from `contentType`.
- The instruction generator (`src/generation/build-instructions.ts`) is a pure function of the
  validated request and its resolved template — it must not read from any store of prior
  requests, assumed defaults, or hard-coded business context to fill gaps.
- Missing required strategy fields — including a missing or unrecognized `primaryObjective.type`
  — fail request validation (`VALIDATION_ERROR`) before any model call is made — the model is
  never given a request with a gap it might paper over.
- Optional fields (`secondaryObjectives`, `context`, `tone`, `constraints`) are explicitly
  optional *inputs*, not places where the service infers its own defaults about business intent.
  Omitting them means "the caller chose not to specify this," and the service must not compensate
  by guessing intent.

## Consequences

- Callers must do real strategic work before calling this service — there is no convenience path
  where the service "figures out" a reasonable audience or objective on the caller's behalf.
- This rules out several tempting future features from ever being V1-compatible additions without
  a governing-rule change: brand voice learning, RAG-based context retrieval, and automatic
  experimentation all involve the service deciding something the caller didn't explicitly supply.
  They stay in [future-vision.md](../future-vision.md) for this reason, not just for complexity
  reasons.
- Instruction generation is deterministic and auditable: given a logged request, the exact
  instructions sent to the model can be reproduced without needing any other system state.

## Alternatives considered

- **Sensible defaults for missing strategy fields** — rejected: defaults are a form of invented
  strategy, even if labeled as fallbacks. A validation error is more honest and keeps the
  responsibility boundary clear.
