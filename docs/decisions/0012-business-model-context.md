# ADR-0012: Business Model (Monetization Model) as First-Class Request Context

## Status

Accepted.

## Context

Business objectives don't mean the same thing in isolation across every business. "Build trust"
for a business that monetizes primarily through affiliate marketing likely means something
specific — honest disclosure, credible framing around a recommended offer. "Build trust" for a
business that monetizes through paid subscriptions likely means something else — demonstrating
expertise worth paying for. Without knowing *how the business makes money*, the service (and the
model it calls) has to guess at what an objective actually implies for this piece of content,
which risks exactly the kind of silent invention [ADR-0005](0005-strategy-supplied-not-invented.md)
rules out — except this time inventing the interpretation of a correctly-supplied objective,
rather than the objective itself.

AstrologyManifest's own monetization is a hybrid: AdSense display advertising, ClickBank
affiliate offers, and an email list used as a secondary nurture/monetization channel, all
supporting the same SEO → engagement → RPM → email capture → affiliate conversion funnel. A
single "business model" isn't always one value — real businesses often combine revenue streams.

## Decision

Introduce `BusinessModel` as a first-class, required domain model on every `ContentRequest`:

```ts
interface BusinessModel {
  primaryRevenueStream: string;         // open vocabulary, required — see ADR-0011
  secondaryRevenueStreams?: string[];   // open vocabulary, optional, defaults to []
  note?: string;                        // optional caller elaboration
}
```

`businessModel` is required on every request — objectives are never interpreted in a
monetization vacuum. It is read by Template Selection (where a template's objective-affinity
logic may also condition on business model) and by Instruction Generation (where it directly
shapes how an objective is executed in the actual instructions sent to the model). See
[docs/technical-design.md](../technical-design.md) for the pipeline detail.

The revenue stream vocabulary follows the same open-vocabulary rule as
`BusinessObjective.type` (see [ADR-0011](0011-open-business-objective-vocabulary.md)): a
documented, recommended canonical set, not a closed enum.

## Consequences

- Every request now explicitly states how the calling business makes money, which the service
  can use to interpret objectives correctly without guessing — while never being the party that
  decides *how* the business makes money.
- Hybrid monetization (multiple simultaneous revenue streams, as with AstrologyManifest) is
  representable via `primaryRevenueStream` + `secondaryRevenueStreams`, mirroring the
  primary/secondary structure already used for `BusinessObjective` (see
  [ADR-0006](0006-business-objective-model.md)) for consistency.
- Templates and instruction generation logic may grow business-model-aware branches over time
  (e.g. an affiliate-aware trust-building variant vs. a subscription-aware one) without any
  contract change, since this is internal Template Selection / Instruction Generation logic
  reading an already-supplied field.
- This does not give the service any say in what a business's monetization strategy should be —
  it only lets already-decided monetization context correctly shape execution of an
  already-decided objective.

## Alternatives considered

- **Omit business model; let objectives stand alone** — rejected: leaves the service (and the
  model) to guess what an objective implies in the caller's specific monetization context,
  reintroducing a form of silent invention.
- **Fold business model into the free-form `context` object instead of a first-class field** —
  rejected: `context` is intentionally unstructured and not read deterministically by Template
  Selection or Instruction Generation; making business model first-class lets it actually drive
  pipeline behavior, per the user's explicit direction that objectives be interpreted *within*
  this context.
- **Single `revenueStream` value only, no primary/secondary distinction** — rejected: real
  businesses (including AstrologyManifest) commonly have hybrid monetization; forcing a single
  value would lose real information the service needs to interpret objectives correctly.
