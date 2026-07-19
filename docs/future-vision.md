# Future Vision

This document lists capabilities deliberately **not** built in Version 1. They are recorded here
so they aren't forgotten, aren't accidentally built early, and can be evaluated on their own
merits when the time comes. Nothing in this document is scheduled or committed.

Each item below was excluded from V1 on purpose — see [docs/technical-design.md](technical-design.md)
and [docs/boundaries.md](boundaries.md) for why V1 stays this narrow.

## These are optimization modules, not scope creep

Several items below — SEO optimization, readability scoring, conversion learning, AdSense-aware
generation, performance feedback loops — are a direct extension of the service's purpose as a
*Business Content Optimization Service*, not unrelated features. They are deferred because V1
needs to prove out the core six-step pipeline first, not because they're a poor fit long-term.
The architecture reserves explicit extension points for them (template registry growth,
additional optional inputs to `generation/`, an open `metadata` object, an additive objective
vocabulary) so that adding them later improves generation quality **without changing the public
request/response contract**. See [docs/technical-design.md](technical-design.md), "Extension
points for future optimization modules," and [ADR-0010](decisions/0010-reserved-extension-points.md).

## Optimization Signals (future request context from an Analytics/Intelligence Service)

Not implemented in V1. Conceptually, a future version of this service might accept an additional,
optional block of **optimization signals** as part of a request — read-only, structured data
about real-world performance, supplied the same way `businessModel` and `primaryObjective` are
supplied today: explicitly, by the caller, never invented or fetched by this service itself.
Plausible categories:

- **SEO metrics** — current search ranking, impressions, click-through rate from a search
  console, matched vs. unmatched search intent.
- **Engagement metrics** — time on page, bounce rate, scroll depth, pages per session for the
  content being regenerated or for similar existing content.
- **Monetization metrics** — current AdSense RPM, ad viewability rate, affiliate click-through
  and conversion rate, email capture rate.
- **General analytics inputs** — any other measured signal a future Analytics/Intelligence
  Service produces that could usefully inform how content should be written.

The intended source of this data is a future, separate **Analytics/Intelligence Service** — see
[docs/technical-design.md](technical-design.md), "Position within a larger optimization loop,"
and [ADR-0013](decisions/0013-optimization-loop-positioning.md). That system would own measuring
performance and deciding what's worth optimizing next; this service would only ever receive the
resulting signals as supplied, read-only request context, structured no differently in kind from
`businessModel` or `primaryObjective` — the service still never decides *what to optimize* or
*computes the signal itself*. It only lets a caller tell it more about the situation the content
will be generated into.

**Explicitly not part of Version 1:**

- No analytics data is ingested, computed, or stored.
- No performance feedback loop exists — this service does not know if a previous response
  "worked."
- The Content Agent does not call out to any analytics API, search console, or ad platform.

When and if this is built, it should land as an additional optional input surface (see
[docs/technical-design.md](technical-design.md), "Extension points for future optimization
modules") — not as a reason to add persistence, analytics ownership, or experimentation logic to
this service.

**This is not the same thing as the Strategy Layer improving over time**
([ADR-0014](decisions/0014-templates-as-two-layer-playbooks.md)). Optimization Signals, if built,
would still only ever inform a content strategist's next *deliberate* edit to a template's
Strategy Layer — the same authored, reviewed, versioned process the template registry already
uses. They would never cause the service to automatically rewrite its own templates at runtime;
that would be exactly the kind of automatic conversion learning/experimentation this document
defers, not the accumulation of curated business knowledge principle 12 describes.

## Deferred capabilities

- **Database / persistence** — V1 is stateless. A future version might persist requests,
  responses, or generation history, but only once a concrete need (auditing, replay, analytics)
  justifies the added complexity and operational surface.
- **RAG / vector storage** — retrieval-augmented generation would let the service pull in prior
  content or knowledge-base facts. Deferred because it would blur the "must not silently invent
  the strategy" boundary — retrieved context is a form of invented strategy unless the caller
  explicitly supplies it.
- **Content performance analytics** — tracking how generated content performs (conversion,
  engagement) belongs to a future, separate Analytics/Intelligence Service, not to this
  stateless generation service — see "Optimization Signals" above and
  [ADR-0013](decisions/0013-optimization-loop-positioning.md).
- **SEO research APIs / keyword research / SEO opportunity discovery** — strategy decisions that
  belong upstream of this service, per the governing rule.
- **Publishing / deployment / Astro integration** — this service returns structured content; it
  will never write files, deploy, or otherwise reach into a consumer's site.
- **Queues / async processing** — V1 is synchronous by design. A future high-throughput or
  long-running-generation use case might justify async processing, but only as an addition to,
  not a replacement of, the synchronous contract.
- **Dashboards / admin UIs** — no operator-facing UI. This is a service other systems call.
- **Authentication / authorization** — V1 has none; access control is expected to be handled by
  whatever sits in front of this service (API gateway, internal network boundary, orchestrator).
  A future version may add this if the service is exposed more broadly.
- **Automatic experimentation** (A/B testing, multivariate generation) — decided by callers, not
  generated automatically by this service.
- **Brand voice learning** — learning a consumer's voice over time is a memory/learning capability
  that conflicts with V1's stateless design and the "must not silently invent the strategy" rule.
  Brand voice, if needed, is supplied explicitly via `context`/`tone` in the request.
- **Multilingual support** — V1 is single-language (whatever language the request's content is
  written in). Multilingual generation, translation, and locale-aware prompting are future work.
- **Content refresh automation** — automatically regenerating or updating previously generated
  content is a workflow/orchestration concern, not something this service initiates itself.
- **Multiple simultaneous model providers** — V1 wires up exactly one. A future version might add
  provider selection/fallback/routing, but the `ModelProvider` interface (ADR-0001) is designed
  so that becomes an additive change, not a rewrite.

## How to propose promoting an item

If a real, concrete need emerges for one of these:

1. Confirm it doesn't violate the governing rule ("must not silently invent the strategy").
2. Write an ADR describing the specific need, not just the general capability.
3. Confirm the addition doesn't require the other deferred items alongside it (e.g. don't pull in
   a database "just for this one feature" without evaluating whether that reopens statelessness
   as a whole).
4. Treat it as a new version, not a patch to V1's existing pipeline.
