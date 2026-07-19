# Content Agent

A standalone, reusable **Business Content Optimization Service**.

The Content Agent is **not** a generic AI copywriter and **not** an orchestrator. Its purpose
is not to produce text — it's to generate content that moves a measurable business outcome the
caller specifies: more organic traffic, better search-intent matching, more time on page, higher
ad viewability and RPM, more email captures, better affiliate click-through and conversion, more
trust, better retention. Given a structured, validated request describing *what* content is
needed, *why it exists* (its business objective), and for whom, the service decides *how* to
write toward that objective and returns a structured, validated response. Nothing more. See
[docs/principles.md](docs/principles.md) for the full, immutable statement of this purpose.

## What this service does

1. Receives a structured content request — including its business model and primary business
   objective — from a calling system.
2. Validates the request against a schema.
3. Resolves a Template for the requested content type (Template Selection).
4. Generates model instructions from the request and resolved template (Instruction Generation).
5. Calls one configured AI model provider.
6. Parses and validates the model's output against the template's output schema.
7. Returns a structured success response, or a structured, machine-readable error.

That's the entire Version 1 scope. See [docs/technical-design.md](docs/technical-design.md) for
the full design and [docs/boundaries.md](docs/boundaries.md) for what is explicitly out of scope.

## Who calls this service

Consumers are orchestrators and business systems, not end users. Known/expected consumers:

- **AstrologyManifest**
- **Website Builder** (the primary orchestrator across consumers)
- **EmailOps**
- Future websites and businesses

The Content Agent has no knowledge of any specific consumer's domain, funnel, or monetization
stack. AstrologyManifest's SEO → engagement → RPM → email capture → affiliate conversion funnel
motivated this service's business-objective vocabulary, but that vocabulary is general-purpose —
any consumer supplies its own objectives the same way. See [docs/boundaries.md](docs/boundaries.md)
for the consumer-neutrality rule.

## Core architectural rule

> The Content Agent may transform supplied strategy into content, but it must not silently
> invent the strategy.

The caller is always responsible for deciding how the business makes money (its business model),
the business objective(s) content must serve, target audience, desired user action, required
sections/fields, and relevant business context. The Content Agent is responsible only for
turning that supplied strategy into well-formed, objective-aligned written content. See
[docs/principles.md](docs/principles.md) for the full set of immutable engineering principles
this implies.

## Part of a larger optimization loop, but not the loop itself

The Content Agent is one execution component within a larger, future loop where a
(not-yet-built) Analytics/Intelligence Service measures real-world performance and decides what's
worth optimizing next. This service never measures performance, never decides what to optimize,
and never learns across requests — it only executes whatever strategy and (eventually)
optimization signals a single request gives it. See
[docs/technical-design.md](docs/technical-design.md), "Position within a larger optimization
loop."

## Version 1 properties

Version 1 is intentionally simple. It is:

- **Outcome-oriented** — every request carries a primary business objective (and optionally
  secondary objectives) that the generated content is optimized toward, not just "well-written."
- **Stateless** — no persistence between requests.
- **Synchronous** — request in, response out, no queues or async callbacks.
- **Provider-agnostic** — one AI model provider is wired up in V1, fully isolated behind an
  interface so it can be swapped later without touching domain logic.
- **Schema-driven** — every request and response is defined and enforced by a schema (Zod).
- **Transport-independent at its core** — the generation pipeline has no hard dependency on
  HTTP, and can be invoked directly or wrapped by any transport later.
- **Consumer-neutral** — no consumer-specific logic, naming, or assumptions live in this service.
- **Text-only** — no image, audio, or other media generation.

## What this service will never do

- Edit Astro files or any consumer repository.
- Publish content or deploy websites.
- Decide marketing strategy, offers, keywords, or SEO opportunities.
- Decide *which* business objective a piece of content should serve, or *how* the business makes
  money — only execute the strategy it's given.
- Perform content performance analytics, experimentation, or decide what to optimize next.
- Store long-term memory, brand voice models, or RAG/vector data.

See [docs/boundaries.md](docs/boundaries.md) for the full inside/outside boundary list.

## Documentation

- [docs/principles.md](docs/principles.md) — the immutable engineering principles of this service.
- [docs/technical-design.md](docs/technical-design.md) — architecture, pipeline, folder structure.
- [docs/boundaries.md](docs/boundaries.md) — what is inside vs. outside the service.
- [docs/contracts.md](docs/contracts.md) — request/response/error schemas, including the Business
  Objective model.
- [docs/future-vision.md](docs/future-vision.md) — capabilities explicitly deferred beyond V1,
  including reserved extension points for future optimization modules.
- [docs/decisions/](docs/decisions/) — architecture decision records (ADRs).

## Status

**Released: v1.0.0 (`content-agent-v1.0.0`, 2026-07-19) — architecture frozen, feature
complete for Phase 1.** Formerly named "Content Service"; renamed to **Content Agent** as part
of AI Marketing Operating System terminology standardization (identity only — package name,
directory, APIs, and contracts are unchanged). The service integrates with EmailOps via `createContentClient()`,
generates production-quality promotional emails under the product-quality Strategy Layer,
supports `refresh` / `create` / `variant` production modes (ADR-0016), and passed a live
end-to-end proof against a real historical winner. See [VERSION.md](VERSION.md) and
[CHANGELOG.md](CHANGELOG.md). No HTTP transport is wired up yet by design (see
[docs/technical-design.md](docs/technical-design.md), "Resolved decisions").

## Running it

```
npm install
npm run typecheck
npm test
```

Set `ANTHROPIC_API_KEY` (see `.env.example`) to actually call `createAnthropicProvider` against
the real API; tests use an injected fake provider/client and make no network calls.

## Stack

- TypeScript / Node.js
- [Zod](https://github.com/colinhacks/zod) for runtime validation
- [Vitest](https://vitest.dev/) for tests
- [`@anthropic-ai/sdk`](https://github.com/anthropics/anthropic-sdk-typescript) — the sole V1
  model provider, isolated behind a `ModelProvider` interface
