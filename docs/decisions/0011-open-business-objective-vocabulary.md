# ADR-0011: Open, Extensible Business Objective (and Revenue Stream) Vocabulary

## Status

Accepted. Supersedes the closed-enum proposal in the original draft of
[ADR-0006](0006-business-objective-model.md).

## Context

[ADR-0006](0006-business-objective-model.md) established `BusinessObjective` as a first-class,
structured, required field, originally proposed as a closed Zod enum of recognized objective
types (increase organic traffic, build trust, etc.). A closed enum has a real cost: every new
objective — including one that's perfectly reasonable for a specific consumer's business but not
yet anticipated by this service — would require a service-side schema change and release before
any caller could use it. That directly conflicts with two things this project already commits
to:

- **Consumer neutrality** ([docs/boundaries.md](../boundaries.md)) — the service shouldn't be a
  bottleneck every consumer has to queue behind just to describe their own business intent in
  new-but-reasonable terms.
- **Not silently inventing strategy** ([ADR-0005](0005-strategy-supplied-not-invented.md)) — if
  a caller's actual objective doesn't fit the closed enum, the caller is forced to either misuse
  an existing value (a form of the service failing to represent the true supplied strategy) or be
  blocked entirely.

The same reasoning applies to the revenue stream types used in the
[Business Model](0012-business-model-context.md) field.

## Decision

`BusinessObjective.type` and the Business Model's revenue stream type fields are **open
vocabularies**, not closed enums:

- The service documents a **canonical, recommended set of values** (see
  [docs/contracts.md](../contracts.md)) that templates may have specific tuning for.
- The Zod schema validates these fields as well-formed strings (non-empty, lowercase
  `snake_case`, matching `/^[a-z][a-z0-9_]*$/`) — a shape check, not a membership check against
  the canonical list.
- A caller may supply any well-formed value, whether or not it appears in the documented
  canonical set.

When a supplied value isn't one Template Selection has specific tuning for, Template Selection
falls back to the `contentType`'s default template rather than failing the request. Instruction
Generation always passes the caller's exact value (and any `note`) into the model instructions
regardless of whether it's a canonical, tuned value — so the model is always told the real
objective/business model, even without bespoke service-side handling for it.

## Consequences

- New objectives or revenue streams can be used by any caller immediately, without waiting on a
  schema change or release of this service.
- The canonical vocabulary lists in [docs/contracts.md](../contracts.md) are living documentation
  of *what the service has been specifically tuned for*, not *what's allowed* — they can grow
  independently of what callers are permitted to send.
- Consistency of phrasing across callers for the "same" objective is no longer enforced by the
  schema. If this causes template-tuning fragmentation in practice (many near-duplicate values
  each getting default/untuned handling), that's a signal to expand the canonical set and add
  template tuning for the emerging pattern — not to reintroduce a closed enum.
- Template Selection and Instruction Generation must be written to handle unrecognized values
  gracefully (default-template fallback), not to throw or treat them as invalid input.

## Alternatives considered

- **Closed enum, revisited only via ADR + release** — rejected: too slow for a service meant to
  serve multiple consumers with distinct, evolving businesses; see Context above.
- **Two-tier system: a separate "custom objective" escape-hatch field alongside a closed enum for
  known ones** — rejected as unnecessary complexity: a single open-vocabulary field with a
  documented canonical set achieves the same flexibility without a second field or a caller
  needing to know which tier their objective belongs to.
