# ADR-0010: Reserved Extension Points for Future Optimization Modules

## Status

Accepted.

## Context

The Content Agent's purpose is to optimize measurable business outcomes (see
[docs/principles.md](../principles.md)), and several capabilities that would directly serve that
purpose — SEO optimization, keyword research, readability scoring, conversion learning,
AdSense-aware generation, performance feedback loops — are explicitly out of scope for Version 1
(see [docs/future-vision.md](../future-vision.md)). Deferring them is a sequencing decision, not
a rejection: the core six-step pipeline needs to be proven out first. But if adding them later
required changing the public request/response contract, every integrated caller (Website
Builder, AstrologyManifest, EmailOps, future consumers) would need to change in lockstep with
this service's internal roadmap — a cost worth avoiding by designing for it now, while the
contract is still unimplemented.

## Decision

The architecture reserves the following extension points specifically so future optimization
modules can improve generation quality **without changing the public request/response contract**:

1. **Template registry growth** ([ADR-0008](0008-template-layer.md)) — new templates (e.g. an
   SEO-optimized variant of an existing `contentType`) are added as registry entries, not
   contract changes.
2. **Additional optional inputs to Instruction Generation** — `src/generation/build-instructions.ts`
   takes a validated request and a resolved template today; a future optimization module (a
   readability scorer, an SEO-intent analyzer) can be introduced as an additional, optional
   internal input to this stage without the caller ever knowing it exists or needing to supply
   anything new. This is also the landing point for future **Optimization Signals** — SEO,
   engagement, and monetization metrics supplied by a future Analytics/Intelligence Service (see
   [docs/future-vision.md](../future-vision.md) and
   [ADR-0013](0013-optimization-loop-positioning.md)) — once that system exists.
3. **An intentionally open `metadata` object** (see [docs/contracts.md](../contracts.md)) — V1
   defines a fixed set of required fields (`provider`, `model`, `templateId`, `schemaId`,
   `generatedAt`, `durationMs`); the object is designed to accept additional optional fields
   later (e.g. `metadata.readabilityScore`, `metadata.seoIntentScore`) without breaking existing
   callers who read known fields and ignore unknown ones.
4. **Open, additive business objective and business model vocabularies**
   ([ADR-0006](0006-business-objective-model.md), [ADR-0011](0011-open-business-objective-vocabulary.md),
   [ADR-0012](0012-business-model-context.md)) — new objective or revenue-stream values can be
   supplied by callers, or added to the documented canonical sets, at any time without a
   contract version bump.
5. **Provider abstraction** ([ADR-0001](0001-single-model-provider-v1.md)) — any future
   model-level improvement is already isolated behind `ModelProvider`.

These extension points also define the shape of the boundary described in
[ADR-0013](0013-optimization-loop-positioning.md): they let a future Analytics/Intelligence
Service's output improve generation quality *as supplied input*, without this service ever
becoming the thing that measures performance or decides what to optimize.

None of these extension points are implemented in V1. This ADR records that they are reserved —
i.e., the V1 architecture must not be built in a way that forecloses them — not that any of them
exist yet.

## Consequences

- Reviewers of future PRs adding an optimization module should check: does this change require
  bumping the request or response contract, or can it land as a template registry entry, an
  internal input to `generation/`, or an additional optional `metadata` field? If it requires a
  contract change, that's a signal the extension point either wasn't followed or was
  insufficiently reserved, and is worth re-examining against this ADR.
- This does not commit the project to building any of these modules on any timeline — it only
  constrains *how* they get built, if and when they do.
- If a genuinely new capability doesn't fit any of the five extension points above, that's a
  reason to write a new ADR proposing a contract change deliberately — not a reason to force-fit
  it into one of these mechanisms.

## Alternatives considered

- **Don't design for this now; handle contract changes if/when they're needed** — rejected: the
  cost of reserving these extension points now (mostly naming and structural decisions already
  being made in [ADR-0006](0006-business-objective-model.md),
  [ADR-0007](0007-content-type-schema-id-separation.md), and
  [ADR-0008](0008-template-layer.md)) is near zero, while retrofitting an open `metadata` object
  or an additive enum after V1 ships to real callers would be a breaking change coordinated across
  every consumer.
