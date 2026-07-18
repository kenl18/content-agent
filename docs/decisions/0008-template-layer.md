# ADR-0008: Template Layer as a Distinct Pipeline Stage

## Status

Accepted.

## Context

Once `contentType` and `schemaId` are separated ([ADR-0007](0007-content-type-schema-id-separation.md)),
something needs to own the mapping between them, plus any structural/rhetorical guidance specific
to that kind of content (e.g. "this is an AIDA-style hero," "this is a search-intent-matching
intro paragraph," "this is a trust-building explainer"). That guidance is a distinct concern from
both "what schema must the output satisfy" (a `domain` concern) and "what exact instructions do
we send the model" (a `generation` concern) — it sits between them.

Folding this resolution silently into Instruction Generation would hide an important decision
point (which structural approach was chosen, and why) inside a function whose job is to produce
final model instructions, making it harder to reason about, test, or extend independently (e.g.
by adding objective-aware template variants later).

## Decision

Introduce an explicit **Template layer** as its own pipeline stage, between request validation
and instruction generation:

```
Request → Template Selection → Instruction Generation → AI Provider → Response Validation → Structured Response
```

- A **`Template`** is a server-owned definition: it associates a `contentType` (and optionally,
  business objective context) with a `schemaId` and structural/rhetorical guidance for how that
  kind of content should be framed.
- **Template Selection** (`src/templates/select-template.ts`) is a pure function:
  `(contentType, objectives) -> Template`, backed by a **template registry**
  (`src/templates/template-registry.ts`). An unresolvable `contentType` produces
  `UNKNOWN_CONTENT_TYPE` at this stage, before any model call.
- **Instruction Generation** (`src/generation/build-instructions.ts`) then takes the validated
  request *and* the resolved `Template` as its only inputs, and produces model instructions.

## Consequences

- Adding a new kind of content, or a new structural variant of an existing one, means adding a
  registry entry in `templates/` — not editing instruction-generation logic directly.
- Different objectives can route the same `contentType` to different templates (e.g. a
  `build_trust`-primary request for a `landing-page-hero` might resolve to a more explainer-heavy
  template than an `increase_email_capture`-primary request for the same `contentType`), without
  Instruction Generation needing to contain that branching logic itself.
- The pipeline gains a named, testable seam for "what structural approach did we choose and why,"
  independent of "what exact words did we tell the model."
- This is also the primary reserved extension point for future template growth (SEO-aware
  templates, readability-optimized templates, etc.) — see
  [ADR-0010](0010-reserved-extension-points.md) and [future-vision.md](../future-vision.md).

## Alternatives considered

- **Fold template resolution into Instruction Generation** — rejected: conflates "which
  structural approach" with "which exact words," making both harder to test and extend
  independently, and hides the `contentType` → `schemaId` resolution the wrong layer needs to own.
- **Fold template resolution into request validation** — rejected: template resolution isn't
  input validation (the request can be perfectly well-formed and still fail to resolve a
  template if the registry doesn't yet cover that `contentType`); keeping it a distinct stage
  keeps `VALIDATION_ERROR` and `UNKNOWN_CONTENT_TYPE` semantically distinct.
