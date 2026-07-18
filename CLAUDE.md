# CLAUDE.md

Instructions for Claude Code (or any AI agent) working in this repository.

**RELEASED v1.0.0 · ARCHITECTURE FROZEN (V1 + approved ADR-0016 Phase 1) — see
[VERSION.md](VERSION.md) and [CHANGELOG.md](CHANGELOG.md).** The V1
architecture plus the owner-approved email production modes
([ADR-0016](docs/decisions/0016-shared-content-conversion-service.md): `refresh`/`create`/
`variant`, `promotional-email-v2`, local `createContentClient`) are the approved surface.
Permitted work: preserve the architecture, answer implementation questions within the approved
design, fix bugs, implement approved features, and update documentation only when implementation
requires it. ADR-0016's deferred items (JourneyBrief, lineage storage, strategy outputs, funnel
modes, JOURNEY_ALIGNMENT) must NOT be built unless the owner explicitly requests them.

**PRODUCT QUALITY MODE (owner directive, 2026-07-19, after successful end-to-end proof):** from
this point, prioritize better emails over new architecture. The service's one job is
production-quality email content for EmailOps — the success test is "I would confidently send
this," never "decent AI copy." Quality standards live in the promotional-email Strategy Layer
(see [docs/templates/promotional-email.md](docs/templates/promotional-email.md), "Production
quality standards"): word discipline, emotional-engine variety, pacing, anti-AI-poetry, every
CTA earns itself, single-hypothesis variants. Quality improvements = Strategy Layer curation
(template guidance + this doc, kept in sync), not new code surface.

## What this repository is

`content-service` is a standalone **Business Content Optimization Service** — it generates
structured written content for other systems (AstrologyManifest, Website Builder, EmailOps, and
future consumers), optimized toward a business objective the caller supplies. It is **not** a
generic copywriter, **not** an orchestrator, **not** a publisher, and **not** a strategy engine.
Read [README.md](README.md), [docs/principles.md](docs/principles.md),
[docs/technical-design.md](docs/technical-design.md), and [docs/boundaries.md](docs/boundaries.md)
before making architectural changes.

## The rules that override all others

> The Content Service may transform supplied strategy into content, but it must not silently
> invent the strategy.

> The Content Service optimizes business outcomes, not writing quality alone.

If a request is missing information the service would need to guess (business model, business
objective, audience, required sections, business facts), the correct behavior is to return a
validation error — never to invent, assume, or default that information silently. This applies
with equal force to `businessModel` and `primaryObjective`: the service must never infer,
default, or guess either from `contentType`, `consumer`, or any other field. Note that
`BusinessObjective.type` and the business model's revenue stream types are **open vocabularies**,
not closed enums (see
[docs/decisions/0011-open-business-objective-vocabulary.md](docs/decisions/0011-open-business-objective-vocabulary.md))
— don't add code that rejects an unrecognized value outright; unrecognized values fall back to
default template behavior but are still passed through to the model verbatim. See
[docs/principles.md](docs/principles.md) for the full list of immutable principles,
[docs/decisions/0006-business-objective-model.md](docs/decisions/0006-business-objective-model.md),
and
[docs/decisions/0012-business-model-context.md](docs/decisions/0012-business-model-context.md).

The service is also, by design, one execution component within a larger future optimization loop
(see [docs/decisions/0013-optimization-loop-positioning.md](docs/decisions/0013-optimization-loop-positioning.md)).
Never add analytics collection, experimentation/A-B-test orchestration, or "decide what to
optimize next" logic here, even if it would make the service more useful in isolation — that
belongs to a future, separate Analytics/Intelligence Service.

## Hard boundaries — do not implement these here

Do not add, even incidentally, in service of some other task:

- Database or any persistence layer
- RAG or vector storage
- Analytics or content performance learning
- SEO research or keyword APIs
- Publishing, deployment, or Astro file editing
- Queues, background jobs, or async workflows
- Dashboards or admin UIs
- Authentication/authorization
- Automatic experimentation (A/B testing, etc.)
- Brand voice learning
- Multilingual support
- Content refresh automation
- Image, audio, or other non-text generation

These are documented in [docs/future-vision.md](docs/future-vision.md) as deliberately deferred —
several of them (SEO scoring, readability scoring, conversion learning, AdSense optimization) are
natural extensions of this service's purpose, not unrelated features, but they are explicitly
reserved for later and must not be built into V1. If a task seems to require one of these, stop
and flag it rather than building around it.

## Version 1 scope discipline

Version 1 is exactly: validate request → Template Selection → Instruction Generation → call one
model provider → Response Validation → return response. Resist scope creep in either direction:

- Don't add a second provider "for flexibility" — one provider, isolated behind
  `ModelProvider` interface, per [ADR-0001](docs/decisions/0001-single-model-provider-v1.md).
- Don't add caching, retries-with-backoff-and-circuit-breakers, or persistence "for robustness."
  Basic error propagation is enough for V1.
- Don't couple the generation pipeline to any specific transport (HTTP framework, CLI, etc.) —
  see [ADR-0004](docs/decisions/0004-transport-independent-core.md).
- Don't add consumer-specific branches (`if consumer === 'astrology-manifest'`). The service is
  consumer-neutral; differences belong in the request payload (including its objective fields),
  not in code branches.
- Don't let a caller supply `schemaId` directly, and don't let `contentType` double as the
  schema identifier — they are deliberately separate, see
  [ADR-0007](docs/decisions/0007-content-type-schema-id-separation.md).
- Don't skip Template Selection as a distinct step, even if it feels like it could be folded into
  instruction generation — it's a named stage on purpose, see
  [ADR-0008](docs/decisions/0008-template-layer.md).

## Working conventions

- TypeScript, Node.js, Zod for schemas/validation, Vitest for tests.
- Schemas are the source of truth for both request and response shapes — see
  [docs/contracts.md](docs/contracts.md). Update the contract doc and relevant ADR alongside any
  schema change; do not let code and docs drift.
- Module layout and naming (per [ADR-0009](docs/decisions/0009-module-renames.md)):
  `domain/` (types, schemas, business objective vocabulary), `templates/` (Template Selection),
  `validation/`, `generation/` (instruction generation — not `prompt/`), `providers/`,
  `application/` (pipeline orchestration — not `service/`), `transport/`.
- Domain/template/validation/generation/provider logic must not import transport-layer code
  (e.g. no `express`/`http` imports inside `src/domain`, `src/templates`, `src/validation`,
  `src/generation`, or `src/providers`).
- All errors returned to callers must be machine-readable (a stable `code`, a human `message`,
  optional structured `details`) — see [docs/contracts.md](docs/contracts.md) for the shape.
- The response `metadata` object is intentionally open to additional optional fields over time
  (future optimization scores, etc.) — don't lock it down to a closed/strict schema.
- New architectural decisions (new provider, schema versioning approach, transport choice, new
  objective types, etc.) should get an ADR in `docs/decisions/`, following the existing numbering
  and format.

## Current status

Version 1 is scaffolded and implemented per `docs/technical-design.md`: `domain/`, `templates/`,
`validation/`, `generation/`, `providers/` (Anthropic), and `application/` are all real code with
Vitest coverage (`npm test`), and `npx tsc --noEmit` is clean. `transport/http/server.ts` is an
intentional placeholder — no HTTP transport yet. The `Template` type carries the ADR-0014
Strategy Layer structure (`TemplateStrategy`; only `modelGuidance` reaches the model). The
template registry holds the `landing-page-hero` reference template plus the first production
template, `promotional-email` (Strategy Layer authored in
`docs/templates/promotional-email.md` — keep doc and registry in sync when editing either).
Further templates (Homepage family, Soulmate Message funnel contentTypes) are designed in
`docs/templates/` and `docs/validation/` but not implemented — scope them against an actual
consumer request when asked, never speculatively.
