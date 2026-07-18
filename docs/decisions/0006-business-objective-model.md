# ADR-0006: Business Objective as a First-Class, Caller-Supplied Model

## Status

Accepted. The vocabulary question originally left open here — whether recognized objective types
form a closed enum or an open vocabulary — was resolved by
[ADR-0011](0011-open-business-objective-vocabulary.md) in favor of an open vocabulary. Everything
in this ADR about `BusinessObjective` being a first-class, structured, required, caller-supplied
model (as opposed to free text) remains as decided below; read it together with ADR-0011 for the
final vocabulary rule, and with [ADR-0012](0012-business-model-context.md) for how objectives are
interpreted within a supplied business model.

## Context

The Content Service exists to move measurable business outcomes, not just to produce text (see
[docs/principles.md](../principles.md)). Earlier drafts of the request contract captured "why
this content exists" as a single free-text `businessObjective` string. A free-text field can't be
read by the pipeline itself — Template Selection and Instruction Generation can't reason about
"increase organic traffic" as a string the way they can reason about a structured, recognized
type. It also can't be validated: any string, including an empty or vague one, would pass.

At the same time, the specific set of objectives that matter (increase organic traffic, improve
search-intent matching, increase time on page, reduce bounce rate, increase pages per session,
increase ad viewability, increase AdSense RPM, encourage tool usage, increase email capture,
improve affiliate click-through rate, improve affiliate conversion rate, build trust, improve
user retention) is general business language, not specific to any one consumer's funnel — it
should not be hardcoded per-consumer, but it is reasonable for the service to own as shared
vocabulary, the same way it owns the schema registry.

## Decision

Introduce `BusinessObjective` as a first-class domain model:

```ts
interface BusinessObjective {
  type: BusinessObjectiveType; // one of a recognized, service-owned vocabulary of string literals
  note?: string;               // optional caller elaboration, not interpreted by the service
}
```

Every `ContentRequest` requires exactly one `primaryObjective: BusinessObjective` and may include
`secondaryObjectives: BusinessObjective[]` (optional, defaults to empty). See
[docs/contracts.md](../contracts.md) for the full field-level contract and the proposed V1
vocabulary.

The vocabulary of recognized `type` values is owned and versioned by this service (as
consumer-neutral shared domain language, per [ADR-0003](0003-schema-driven-contracts.md)'s
server-ownership precedent) and is designed to grow additively over time. **Which** objective(s)
apply to a specific request is always caller-supplied — the service never infers this from
`contentType`, `consumer`, historical requests, or any other signal.

`primaryObjective` and `secondaryObjectives` are not passive metadata: Template Selection and
Instruction Generation both read them (see [docs/technical-design.md](../technical-design.md)).

## Consequences

- Request validation can reject a request with no clear business objective
  (`VALIDATION_ERROR`), the same way it already rejects a request with no audience or no desired
  action.
- Template Selection and Instruction Generation gain a structured, machine-readable signal to
  reason about, instead of parsing free text.
- Adding a new recognized objective type later is a backward-compatible, additive schema change —
  existing requests and integrations are unaffected.
- This directly supersedes the earlier flat `businessObjective: string` field described in the
  original draft of [ADR-0005](0005-strategy-supplied-not-invented.md); that ADR's underlying
  rule (strategy is supplied, never invented) is unchanged and now applies to this richer model.

## Alternatives considered

- **Keep `businessObjective` as free text** — rejected: unreadable by the pipeline, unvalidatable,
  and doesn't support the "one primary + optional secondary" structure the business asked for.
- **Closed enum of recognized objective types** — this was V1's original proposal in this ADR,
  rejected before implementation and superseded by [ADR-0011](0011-open-business-objective-vocabulary.md):
  a closed enum would force every new objective (even a business-specific one no other consumer
  needs) through a service-side release before a caller could use it, which conflicts with
  keeping the service consumer-neutral and quick to extend. See ADR-0011 for the resolution.
