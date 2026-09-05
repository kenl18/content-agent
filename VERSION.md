# Project Status

```
STATUS:   RELEASED — architecture frozen
VERSION:  1.0.0
TAG:      content-agent-v1.0.0 (renamed from content-service-v1.0.0)
RELEASED: 2026-07-19
FROZEN:   2026-07-18 (V1) · reaffirmed at release
IDENTITY: Content Agent (AI Marketing Operating System standard naming, 2026-07-19)
```

**Content Agent v1.0 — production email generation.** Feature complete for Phase 1:
integrates with EmailOps via the local client, generates production-quality emails under the
product-quality Strategy Layer, supports REFRESH / CREATE / VARIANT, and has passed a live
end-to-end integration proof against a real historical winner. Release verification: 63/63
tests passing, `tsc --noEmit` clean, build emit successful. See [CHANGELOG.md](CHANGELOG.md).

The Content Agent architecture is **frozen** as Version 1. Do not expand the architecture,
documentation, or future vision unless the project owner explicitly reopens it.

## What the freeze covers

The approved V1 architecture, in full:

- The six-step pipeline: receive & validate request → Template Selection → Instruction
  Generation → AI Provider call → Response Validation → structured response
  ([docs/technical-design.md](docs/technical-design.md))
- The public contracts: `ContentRequest`, `ContentResponse`, `ContentServiceError`, the
  Business Model and Business Objective models, and the open-vocabulary rule
  ([docs/contracts.md](docs/contracts.md))
- The immutable engineering principles, 1–12 ([docs/principles.md](docs/principles.md))
- The inside/outside boundaries ([docs/boundaries.md](docs/boundaries.md))
- All architecture decision records, ADR-0001 through ADR-0014
  ([docs/decisions/](docs/decisions/)); ADR-0016 (Phase 1) and ADR-0017 (Claude Code
  subscription provider, owner GO 2026-09-05) are the approved post-freeze additions
- The deferred capabilities and Optimization Signals concept
  ([docs/future-vision.md](docs/future-vision.md)) — deferred means deferred; nothing there is
  to be built or further elaborated

## Permitted work from this point forward

- Preserve the existing architecture
- Answer implementation questions within the approved design
- Fix bugs
- Implement approved features
- Update documentation only when implementation requires it

Not permitted without the project owner explicitly reopening the architecture: new architectural
concepts, new abstractions, new future capabilities, or expansion of the docs beyond what
implementation requires.

## Implementation status at freeze

**Implemented and verified** (36 Vitest tests passing, `npx tsc --noEmit` clean):

- Domain models and Zod schemas: request, response, business objective, business model, errors,
  schema registry (`src/domain/`)
- Template Selection with one reference template, `landing-page-hero`, proving the pipeline
  end-to-end (`src/templates/`)
- Request/response validation (`src/validation/`)
- Instruction Generation as a pure function (`src/generation/`)
- `ModelProvider` interface + Anthropic implementation, injectable client, no network calls in
  tests (`src/providers/`)
- Pipeline orchestration; never throws across its public boundary — all failures map to the six
  error codes (`src/application/content-service.ts`)
- Library entry point (`src/index.ts`)

**Intentionally not implemented** (per the approved design, not omissions):

- HTTP transport — `src/transport/http/server.ts` is a placeholder; core is directly callable
- Everything in [docs/future-vision.md](docs/future-vision.md)

## Post-freeze implementation log

Approved work completed within the frozen architecture (no contract or pipeline changes):

- **Architecture validation #1** — Soulmate Message funnel
  ([docs/validation/soulmate-message-validation.md](docs/validation/soulmate-message-validation.md)).
  Verdict: frozen architecture sufficient; gaps were template-level only.
- **First production template: `promotional-email`** (requested by EmailOps) — generic across
  all affiliate campaigns; campaign specifics arrive via request `context`. Strategy Layer
  authored in [docs/templates/promotional-email.md](docs/templates/promotional-email.md),
  schema `promotional-email-v1`. Landed together with the ADR-0014 `Template` restructure
  (`TemplateStrategy`, nine fields, only `modelGuidance` consumed at runtime), which that ADR
  deferred to exactly this moment. 42 tests passing, typecheck clean.

- **ADR-0016 Phase 1: email production modes** (owner-approved reduced scope, 2026-07-19) —
  optional `production` request block with channel-neutral modes `refresh`/`create`/`variant`
  and validation-enforced coherence rules; `promotional-email-v2` all-optional schema
  (bodySections, textOnlyVersion, rationale, changesFromReference, riskFlags, testHypotheses,
  variant fields); per-mode `modeGuidance` overlays in the template Strategy Layer;
  `createContentClient()` local transport for EmailOps (consumer-agnostic, Funnel Builder
  reusable); `constraints.prohibitedClaims`. Deliberately NOT included per owner direction:
  JourneyBrief, lineage storage, strategy outputs, funnel modes, journey alignment — see
  ADR-0016's deferred list. Statelessness (ADR-0002) and strategy-never-invented (ADR-0005)
  remain fully intact. 63 tests passing, typecheck clean.

- **First live end-to-end proof (2026-07-19)** — real GR3 historical winner (169 opens /
  76 clicks / 45% CTOR) run through REFRESH + VARIANT with the production Anthropic provider;
  schema-valid output, review artifact delivered. Owner verdict: "This is the architecture we
  want."
- **Product quality mode (owner directive, 2026-07-19)** — quality principles from the live-run
  review encoded into the promotional-email Strategy Layer (word discipline, emotional-engine
  style library, pacing, anti-AI-poetry, CTA escalation, single-hypothesis variants). See
  docs/templates/promotional-email.md, "Production quality standards." No architecture changes;
  Strategy Layer curation only.

## Current milestone

**Product quality mode: prioritize better emails over new architecture. Next: EmailOps'
"prepare next week's emails" runs should feel written by a senior affiliate copywriter who knows
the audience, the historical winners, and the house style.**

Remaining designed-but-not-implemented work, when requested: the Homepage template family
([docs/templates/homepage.md](docs/templates/homepage.md)), with four open product questions
recorded at the end of that document:

1. Sign-off on the multi-`contentType` decomposition of the homepage
2. Which section ships first (`homepage-hero` vs `homepage-tools-grid`)
3. Where ClickBank conversion belongs relative to the homepage
4. Whether `homepage-articles-intro` is built now or deferred

Also designed and validated but not implemented: the four Soulmate Message funnel contentTypes
(`funnel-hook-page`, `funnel-presell-page`, `funnel-offer-reveal`, `funnel-seo-article`).
