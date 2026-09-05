# Technical Design — Version 1

## Purpose

The Content Agent is a **Business Content Optimization Service**. It does not exist to
produce text — it exists to generate content that moves a measurable business outcome the
caller has specified: more organic traffic, better search-intent matching, longer time on page,
higher ad viewability and RPM, more email captures, better affiliate click-through and
conversion, more trust, better retention. Writing quality is in service of that outcome, not the
goal itself. See [docs/principles.md](principles.md) for the full, immutable statement of this.

The caller always supplies the business objective(s) driving a request (see
[ADR-0006](decisions/0006-business-objective-model.md)) and the business model — how the
business generates revenue — that gives those objectives their meaning (see
[ADR-0012](decisions/0012-business-model-context.md)); the service never infers or invents
either. Given that supplied strategy, the service decides *how* to write toward it and returns a
structured, validated response. This document describes the Version 1 architecture: the
generation pipeline, module boundaries, and proposed folder structure. It does not describe
implementation code — none exists yet.

This service is also, by design, one execution component within a larger optimization loop that
extends beyond V1 and beyond this repository — see "Position within a larger optimization loop"
below.

## Design goals

- **Optimize for business outcomes, not prose alone.** Every pipeline stage — template
  selection, instruction generation, response validation — is aware of the request's business
  objective(s) and treats them as the thing being optimized for.
- **Simplicity first.** Version 1 is a single synchronous pipeline with no hidden state.
- **Provider isolation.** The AI model provider is swappable without touching domain logic.
- **Schema-driven correctness.** Every boundary (request in, response out, provider output) is
  validated against an explicit schema, not assumed to be well-formed.
- **Transport independence.** The generation pipeline is a plain function/class the transport
  layer calls — it does not know it is being called over HTTP (or anything else).
- **No silent invention.** Anything the pipeline doesn't have enough information to do
  deterministically from the request — including *why* the content exists — results in a
  validation error, not a guess.
- **Room to grow without breaking callers.** Future optimization modules (SEO scoring,
  readability scoring, conversion learning, AdSense-aware generation) must be addable later
  without changing the public request/response contract. See "Extension points" below.

## The pipeline

Six steps, in order, per request:

```
1. Receive & validate request  →  a structured ContentRequest (see docs/contracts.md)
2. Template Selection           →  resolve a Template from contentType (+ objective context)
3. Instruction Generation       →  deterministic model instructions from request + template
4. AI Provider call              →  exactly one ModelProvider implementation
5. Response Validation           →  parse + validate provider output against the template's schemaId
6. Structured Response           →  a ContentResponse, or a structured error
```

Nothing in this pipeline persists state across requests. Two identical requests should produce
independently valid (though not necessarily byte-identical, given model non-determinism)
responses.

### Step detail

**1. Receive & validate request**
The transport adapter (e.g. an HTTP handler) deserializes the incoming payload and hands it to
the service core as a plain object. The service core validates it against the `ContentRequest`
Zod schema — including the required `businessModel` (see
[ADR-0012](decisions/0012-business-model-context.md)) and the required `primaryObjective` plus
optional `secondaryObjectives` (see [ADR-0006](decisions/0006-business-objective-model.md)) —
before doing anything else. Validation failure short-circuits the pipeline and returns a
`VALIDATION_ERROR`.

**2. Template Selection**
A new, explicit stage (see [ADR-0008](decisions/0008-template-layer.md)). Given the validated
request's `contentType` (and, where relevant, its business objective), this stage resolves a
`Template` — a server-owned definition of how this kind of content should be structurally and
rhetorically framed (e.g. an AIDA-style hero, a search-intent-matching intro paragraph, a
trust-building explainer) — from a template registry. The resolved `Template` carries the
`schemaId` that the final output must satisfy. This is also where an unknown `contentType`
becomes an `UNKNOWN_CONTENT_TYPE` error, before any model call is made.

Every `Template` is explicitly modeled as two layers with different lifecycles (see
[ADR-0014](decisions/0014-templates-as-two-layer-playbooks.md)): a durable, deliberately curated
**Strategy Layer** (business purpose, visitor psychology, conversion reasoning, reference
principles, information hierarchy, objections, desired user progression, monetization
contribution, and guidance for future AI models) that is the service's most valuable and
longest-lived asset; and a disposable **Output Layer** (the request/response schema shape and the
generated content itself) that changes freely on every call. Templates are business playbooks,
not just schema lookups — see [docs/principles.md](principles.md), principle 12.

**3. Instruction Generation** (module: `generation/`, formerly `prompt/`)
Turns the validated request plus the resolved template into model instructions. It is a pure
function of its inputs: same request + template in, same instructions out. It must not pull in
facts, tone, objectives, business model, or strategy not present in the request — this is the
enforcement point for "must not silently invent the strategy" (including business objectives and
the business model context they're interpreted within). The business model is what tells this
stage, for example, that a `build_trust` objective for an `affiliate_marketing`-driven business
likely means emphasizing honest disclosure and credibility around an affiliate offer, whereas the
same objective for a `subscription_revenue`-driven business likely means something else entirely
— without the service ever deciding that mapping is "the strategy" rather than an execution
detail of writing toward caller-supplied strategy.

**4. AI Provider call**
The service depends on a `ModelProvider` interface, not a concrete SDK. V1 wires up exactly one
concrete implementation. Provider-specific concerns (auth, request/response shape, retries at the
transport level) live entirely inside the provider implementation and never leak into domain code.

**5. Response Validation**
The raw provider output (expected to be JSON matching the `schemaId` resolved in step 2) is
parsed and validated. If the model returns malformed or incomplete output, this is a
`PROVIDER_OUTPUT_ERROR`, not a best-effort pass-through.

**6. Structured Response**
On success, a `ContentResponse` is returned including generation metadata (provider, model,
template, schema, timing). On any failure at any step, a structured error matching the error
contract is returned instead. The pipeline has exactly two possible outcomes — success or
structured error — never a partial or ambiguous shape.

## Module boundaries

| Module | Responsibility | Must not depend on |
|---|---|---|
| `domain` | Request/response/objective types, Zod schemas, error types, schema registry | providers, transport |
| `templates` | Template registry + Template Selection logic | providers, transport |
| `validation` | Applies domain schemas to raw input/output | providers, transport |
| `generation` | Builds model instructions from a validated request + resolved template | providers, transport |
| `providers` | `ModelProvider` interface + concrete implementations (Anthropic SDK, ADR-0001; Claude Code CLI, ADR-0017). No routing or fallback between them. | transport |
| `application` | Orchestrates the six-step pipeline | transport |
| `transport` | Adapts an external interface (HTTP, CLI, direct call) to the service | — (leaf) |

The dependency direction is one-way: `transport → application → {domain, templates, validation,
generation, providers}`. Nothing below `application` may import from `transport`.

`generation/` and `application/` are renamed from the earlier `prompt/` and `service/` naming
(see [ADR-0009](decisions/0009-module-renames.md)) — the new names reflect that instruction
generation is objective-aware content generation, not merely prompt string-templating, and that
`application/` is the orchestration/use-case layer in a more conventional sense.

## Business objectives and business model drive the pipeline, not just the response

`businessModel` (required), `primaryObjective` (required), and `secondaryObjectives` (optional)
are not passive metadata carried along for logging. They are read by:

- **Template Selection** — different objectives (interpreted within the supplied business model)
  can favor different templates for the same `contentType` (e.g. a "build trust" objective may
  select a more explainer-heavy template than an "increase email capture" objective for the same
  landing-page section; a `build_trust` objective for an affiliate-driven business model might
  favor a template emphasizing disclosure language that a subscription-driven business wouldn't
  need).
- **Instruction Generation** — the objective(s) *and* the business model are included in the
  model instructions explicitly, so the model is told *why* it's writing and *how the business
  makes money*, not just *what* to write.

Both vocabularies (recognized objective types, recognized revenue stream types) are documented,
recommended starting sets owned by the service as shared, consumer-neutral domain language — see
[ADR-0006](decisions/0006-business-objective-model.md),
[ADR-0011](decisions/0011-open-business-objective-vocabulary.md), and
[ADR-0012](decisions/0012-business-model-context.md) — but they are **open vocabularies, not
closed enums**: a caller can supply a value outside the documented set (see
[docs/contracts.md](contracts.md), "Open vocabulary fields") without a contract change. Which
objective(s) and business model apply to a given request is always caller-supplied, never
inferred from `contentType`, `consumer`, or any other field.

## Position within a larger optimization loop

The Content Agent is deliberately narrow. It is one execution component within a larger,
future optimization loop that this repository does not own and must never absorb:

```
Analytics / Intelligence Service (future, separate system)
   │  measures real-world performance: SEO rankings, engagement, RPM, conversions, retention
   │  decides what to optimize next (future — NEVER this service)
   ▼
Website Builder (or another orchestrator)
   │  translates business strategy + optimization signals into a structured ContentRequest
   ▼
Content Agent (this repository)
   │  executes: writes content optimized toward the supplied objective(s) and business model,
   │  informed by whatever optimization signals it's given
   ▼
Structured ContentResponse
   │
   ▼
Website Builder — publishes/deploys (never this service)
   │
   ▼
Live website generates new performance data
   │
   └──────────────────────────────────────────────────────────────────► loop closes back to
                                                                          Analytics/Intelligence
                                                                          Service (future)
```

The Content Agent's role in this loop is strictly **execution**: it consumes supplied business
strategy (`businessModel`, `primaryObjective`, `secondaryObjectives`, `targetAudience`,
`desiredAction`, `sections`, `context`) and, in the future, supplied **optimization signals**
(see [docs/future-vision.md](future-vision.md), "Optimization Signals") from an
Analytics/Intelligence Service — but it:

- **Never measures performance itself.** No analytics collection, no tracking pixels, no
  dashboards.
- **Never decides what to optimize next.** No experimentation, no A/B test orchestration, no
  "try variant B because A underperformed" logic.
- **Never learns from past requests.** Stateless, no long-term memory, no request history (see
  [ADR-0002](decisions/0002-stateless-synchronous-service.md)).
- **Only consumes what a single, self-contained request gives it.** Whatever informs a
  generation decision must arrive as part of that request — never fetched, inferred, or recalled
  by the service on its own initiative.

See [ADR-0013](decisions/0013-optimization-loop-positioning.md) for the full reasoning, and
[docs/principles.md](principles.md) for how this constrains future work.

## Extension points for future optimization modules

Version 1 does not implement SEO optimization, keyword research, readability scoring, conversion
learning, AdSense-aware optimization, or performance feedback loops (see
[docs/future-vision.md](future-vision.md)). The architecture reserves explicit points where such
modules could be added later **without changing the public request/response contract**:

- **Template registry growth.** New templates optimized for specific objectives or content types
  can be added to `templates/` at any time — this is pure data/config growth, not a contract
  change. A future "SEO-optimized blog intro" template is just a new registry entry.
- **Instruction Generation inputs.** `generation/` already accepts the resolved `Template` and
  validated `ContentRequest` as its only inputs. A future optimization module (e.g. a readability
  scorer, an SEO-intent analyzer) could compute additional *internal* guidance and pass it into
  this stage as an extra, optional input — without changing what the request or response
  contract look like from the caller's side. This is also the landing point for future
  **Optimization Signals** supplied by an Analytics/Intelligence Service — see
  [docs/future-vision.md](future-vision.md) and
  [ADR-0013](decisions/0013-optimization-loop-positioning.md) — once that system exists; V1
  ingests none.
- **`metadata` is intentionally open.** The response's `metadata` object (see
  [docs/contracts.md](contracts.md)) carries a fixed set of required fields in V1 (provider,
  model, template, schema, timing) but is designed to accept additional optional fields later
  (e.g. `metadata.readabilityScore`, `metadata.seoIntentScore`) as future modules are added,
  without requiring existing callers to change how they parse a response.
- **Objective and revenue-stream vocabularies are open, not closed.** New business objective or
  revenue-stream values — recognized/tuned or not — can be supplied by callers or added to the
  documented canonical sets at any time (see
  [ADR-0011](decisions/0011-open-business-objective-vocabulary.md)) without a contract version
  bump.
- **Provider abstraction already isolates model-level change.** Any future model-side
  improvement (fine-tuning, a different provider, provider-side optimization features) is
  contained entirely behind `ModelProvider` (see [ADR-0001](decisions/0001-single-model-provider-v1.md)).

None of this is built in V1. It is reserved architecture, not implemented capability — see
[ADR-0010](decisions/0010-reserved-extension-points.md).

## Version 1 folder structure (implemented)

This was a proposal in earlier drafts of this document; the pipeline described below is now
implemented and covered by Vitest (`npm test`), with `npx tsc --noEmit` clean.
`src/templates/template.ts` now carries the explicit Strategy Layer structure from
[ADR-0014](decisions/0014-templates-as-two-layer-playbooks.md) (`TemplateStrategy`, nine fields,
of which only `modelGuidance` is consumed at runtime) — the restructure landed with the first
production template, `promotional-email` (see
[docs/templates/promotional-email.md](templates/promotional-email.md)).

```
content-service/
├── README.md
├── CLAUDE.md
├── package.json
├── tsconfig.json
├── vitest.config.ts
├── .env.example
├── src/
│   ├── index.ts                      # composition root / library entry point
│   ├── domain/
│   │   ├── content-request.ts        # ContentRequest type + Zod schema
│   │   ├── content-response.ts       # ContentResponse type + Zod schema
│   │   ├── business-objective.ts     # BusinessObjective type + Zod schema (open vocabulary)
│   │   ├── business-model.ts         # BusinessModel type + Zod schema (open vocabulary)
│   │   ├── open-vocabulary.ts        # shared open-vocabulary shape rule (ADR-0011)
│   │   ├── errors.ts                 # machine-readable error types + error codes
│   │   └── schema-registry.ts        # maps schemaId -> output content schema
│   ├── templates/
│   │   ├── template.ts               # Template type: Strategy Layer + Output Layer (ADR-0014)
│   │   ├── template-registry.ts      # contentType (+ objective) -> Template entries
│   │   └── select-template.ts        # Template Selection logic
│   ├── validation/
│   │   ├── validate-request.ts
│   │   └── validate-response.ts
│   ├── generation/
│   │   └── build-instructions.ts     # (request, template) -> model instructions (pure function)
│   ├── providers/
│   │   ├── model-provider.ts         # ModelProvider interface
│   │   ├── anthropic-provider.ts     # V1 concrete implementation (ADR-0001)
│   │   └── claude-code-provider.ts   # Claude Code subscription provider (ADR-0017)
│   ├── application/
│   │   └── content-service.ts        # orchestrates the 6-step pipeline
│   └── transport/
│       └── http/
│           └── server.ts             # placeholder only — no HTTP transport in V1
├── test/
│   ├── fixtures.ts
│   ├── domain/
│   ├── templates/
│   ├── generation/
│   ├── providers/
│   └── application/
└── docs/
    ├── principles.md
    ├── technical-design.md
    ├── boundaries.md
    ├── contracts.md
    ├── future-vision.md
    ├── reference-site-analysis-method.md
    ├── templates/
    │   └── homepage.md               # first production template design (in progress)
    └── decisions/
        ├── 0001-single-model-provider-v1.md
        ├── 0002-stateless-synchronous-service.md
        ├── 0003-schema-driven-contracts.md
        ├── 0004-transport-independent-core.md
        ├── 0005-strategy-supplied-not-invented.md
        ├── 0006-business-objective-model.md
        ├── 0007-content-type-schema-id-separation.md
        ├── 0008-template-layer.md
        ├── 0009-module-renames.md
        ├── 0010-reserved-extension-points.md
        ├── 0011-open-business-objective-vocabulary.md
        ├── 0012-business-model-context.md
        ├── 0013-optimization-loop-positioning.md
        └── 0014-templates-as-two-layer-playbooks.md
```

Notes:

- `transport/http/server.ts` is an intentional placeholder — no HTTP transport ships in V1 (see
  "Resolved decisions" below).
- The template registry holds the reference template (`landing-page-hero`, from the docs' own
  examples) plus the first production template (`promotional-email`, see
  [docs/templates/promotional-email.md](templates/promotional-email.md)).
- No `db`, `queue`, `cache`, `auth`, or `analytics` directories exist, intentionally.

## Resolved decisions

1. **AI model provider for V1: Anthropic (Claude).** Wired up as the single concrete
   `ModelProvider` implementation behind the provider interface (see
   [ADR-0001](decisions/0001-single-model-provider-v1.md)).
2. **HTTP transport: deferred.** V1 ships the directly-callable `application/content-service.ts`
   function only. `src/transport/http/` exists as a placeholder; the real adapter is built once
   an actual caller (Website Builder) defines what it needs from the HTTP boundary (see
   [ADR-0004](decisions/0004-transport-independent-core.md)).

## Open decisions requiring approval

3. **Canonical objective and revenue-stream vocabularies.** The sets proposed in
   [docs/contracts.md](contracts.md) are recommended starting points, not closed enums (see
   [ADR-0011](decisions/0011-open-business-objective-vocabulary.md)) — callers can supply values
   outside these sets from day one. Confirm the starting sets are still reasonable defaults for
   template tuning, even though they no longer gate what's accepted.
4. **Initial template registry contents.** V1 needs at least one real template per supported
   `contentType` to be usable; the specific initial templates are not yet defined and should be
   scoped with the first real consumer request (likely AstrologyManifest).

See [docs/contracts.md](docs/contracts.md) for the concrete request/response/error shapes and
[docs/decisions/](docs/decisions/) for the reasoning behind the settled decisions.
