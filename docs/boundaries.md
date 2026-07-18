# Boundaries

This document is the definitive answer to "does that belong in the Content Service?" When in
doubt, check here before adding a capability.

## The governing rule

> The Content Service may transform supplied strategy into content, but it must not silently
> invent the strategy.

Everything below follows from this. The caller supplies strategy — including **how the business
generates revenue** (see [ADR-0012](decisions/0012-business-model-context.md)), the **business
objective** the content must serve (see [ADR-0006](decisions/0006-business-objective-model.md)),
audience, action, sections, and business context. The service supplies craft: turning that
supplied strategy into well-formed, objective-aligned written content. The service never fills
strategy gaps on its own judgment, never decides *why* a piece of content exists on the caller's
behalf, and never decides *how the business makes money* — it only interprets objectives within
whatever business model the caller supplies.

## Not a generic copywriting engine

The Content Service is a **Business Content Optimization Service**, not a generic text generator.
Every request exists to move a measurable business outcome the caller specifies (see the
Business Objective model in [docs/contracts.md](contracts.md)) — more traffic, more time on page,
higher RPM, more email captures, better affiliate conversion, more trust, better retention. The
service treats "does this serve the stated objective" as part of what it optimizes for, not just
"is this well-written." What counts as a valid objective for a given business — and how heavily
to weight it — is never decided by this service; only the *vocabulary* of recognized objective
types is service-owned, as consumer-neutral shared language, not as a per-consumer special case.

## Inside the service

The Content Service owns:

- **Request validation** — enforcing the request schema; rejecting malformed or incomplete
  requests with machine-readable errors.
- **Content request and response domain models** — the typed, schema-backed shapes both sides of
  the service agree on.
- **Template Selection** — resolving which structural/rhetorical template, and therefore which
  output schema (`schemaId`), a given `contentType` (and objective context) should use. Each
  template's Strategy Layer (business purpose, visitor psychology, conversion reasoning, etc. —
  see [ADR-0014](decisions/0014-templates-as-two-layer-playbooks.md)) is itself a service-owned,
  deliberately curated knowledge asset, not caller-supplied and not automatically learned.
- **Instruction generation** — deterministically turning a validated request plus its resolved
  template into model instructions.
- **Model-provider abstraction** — calling exactly one configured AI model provider through a
  stable interface.
- **Structured response parsing** — turning the model's raw output into a typed structure.
- **Response validation** — verifying parsed output matches the expected schema before it is
  returned.
- **Machine-readable errors** — every failure mode returns a stable error code, not just a string.
- **Generation metadata** — provider/model identifiers, timing, and similar operational metadata
  attached to a successful response.

## Outside the service

The Content Service does not own, and must never absorb:

- **Website architecture** — how any site is structured, routed, or organized.
- **Astro components and files** — the service never reads or writes Astro source.
- **Publishing and deployment** — the service returns content; it never ships it anywhere.
- **Marketing strategy** — deciding what to say, to whom, and why is the caller's job.
- **Offer selection** — which product/offer/promotion to feature is decided upstream.
- **Keyword research** — no keyword tooling or keyword-driven content decisions.
- **SEO opportunity discovery** — no SEO analysis; the service writes what it's told to write.
- **Image generation** — text-only, no other media.
- **Creative Pipeline** — a separate system; the Content Service is not part of it and does not
  call into it.
- **Email sending** — EmailOps sends email; the Content Service only ever returns content to it.
- **Content performance analytics** — no tracking or measuring of how generated content
  performs; that belongs to a future, separate Analytics/Intelligence Service (see "Execution
  only" below).
- **Experimentation and deciding what to optimize next** — no A/B test orchestration, no
  "try a different approach because the last one underperformed" logic. Deciding what to
  optimize next is an intelligence/strategy decision that stays outside this service, even once
  an Analytics/Intelligence Service exists to make it.
- **Long-term memory** — no memory of past requests, consumers, or generated content.

## Consumer neutrality

The service must have zero consumer-specific logic. `AstrologyManifest`, `Website Builder`, and
`EmailOps` are callers like any other — the service does not branch on which one is calling, does
not special-case their domains, and does not accumulate consumer-specific schemas baked into code
paths named after a consumer. If a consumer needs a new *kind* of content, that is a new
`contentType` in the template registry, not a consumer-specific code path.

The same applies to business objectives: AstrologyManifest's SEO → engagement → RPM → email
capture → affiliate conversion funnel is what motivated the objective vocabulary, but the
vocabulary itself (`increase_email_capture`, `build_trust`, etc.) is general-purpose language any
consumer's funnel can use. Nothing in the service encodes AstrologyManifest's specific funnel,
offers, or monetization stack — those are supplied per-request via `context` and the objective
fields, like any other caller's would be.

## Orchestration stays with Website Builder

Website Builder is the orchestrator across consumers and use cases. The Content Service is a
capability Website Builder (or another caller) invokes — it does not orchestrate multi-step
workflows, does not call other services, and does not sequence work on a caller's behalf.

## Execution only: the Content Service is not the optimization loop

The Content Service is one execution component within a larger, future optimization loop — see
[docs/technical-design.md](technical-design.md), "Position within a larger optimization loop,"
and [ADR-0013](decisions/0013-optimization-loop-positioning.md). A future Analytics/Intelligence
Service may eventually measure real-world performance (SEO rankings, engagement, RPM, affiliate
conversion, retention) and decide what to try next, supplying that as **optimization signals**
in future requests (see [docs/future-vision.md](future-vision.md)). Even then:

- The Content Service never measures performance itself.
- The Content Service never decides what to optimize next — it only executes whatever
  objective, business model, and (eventually) optimization signals it is given in a single,
  self-contained request.
- The Content Service never retains what it learns from one request to inform another — no
  cross-request memory, however that memory might otherwise be justified.

This boundary holds regardless of how sophisticated the calling orchestrator or a future
Analytics/Intelligence Service becomes.

## Quick test for new requests

Before adding anything to this service, ask:

1. Does it require the service to persist something between requests? → Outside (see
   [future-vision.md](future-vision.md)).
2. Does it require the service to decide strategy — including *which business objective* a piece
   of content should serve — rather than execute strategy/objectives it was given? → Outside.
3. Does it require touching a consumer's files, deployment, or infrastructure? → Outside.
4. Does it require knowledge of a specific consumer's domain? → Outside — express it as request
   data instead.

If the answer to all four is "no," it may belong inside. If any answer is "yes," it does not
belong in this service, in this version or any future one, unless the governing rule itself
changes.
