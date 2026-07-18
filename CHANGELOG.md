# Changelog

## v1.0.0 — 2026-07-19 · "Production email generation"

First release. Feature complete for Phase 1; architecture frozen (see
[VERSION.md](VERSION.md), ADR-0001–ADR-0016).

### Capabilities

- **Six-step stateless pipeline**: request validation → Template Selection → Instruction
  Generation → AI provider call → response validation → structured response. Never throws
  across its public boundary; six stable machine-readable error codes.
- **Contracts (Zod)**: `ContentRequest` / `ContentResponse` / `ContentServiceError`; Business
  Model + Business Objective models with open vocabularies; consumer-neutral by construction.
- **Production modes (ADR-0016)**: `refresh` (improve a proven historical winner while
  preserving its winning mechanism), `create` (new email when no suitable reference exists),
  `variant` (1–5 controlled single-hypothesis variants) — with validation-enforced mode
  coherence. Channel-neutral mode design for future Funnel Builder reuse.
- **`promotional-email-v2` schema**: subject/preview/body, role-tagged `bodySections`,
  `textOnlyVersion`, `rationale`, `changesFromReference`, `riskFlags`, `testHypotheses`,
  and per-field variant outputs. All fields schema-optional; each request's `sections`
  selects its run shape.
- **Two-layer templates (ADR-0014)**: durable, curated Strategy Layer (including per-mode
  guidance) + disposable Output Layer. Product-quality standards encoded from the owner's
  live-run review: word discipline, emotional-engine style library, pacing rules,
  anti-AI-poetry, CTA escalation, single-hypothesis variants.
- **Provider abstraction (ADR-0001)**: Anthropic (Claude) behind a `ModelProvider` interface;
  injectable client; no network calls in tests.
- **Local transport**: `createContentClient()` — consumer-agnostic; EmailOps integrates today,
  HTTP transport remains a thin later addition (ADR-0004).
- **Boundaries held**: no ESP/AdSense/ClickBank credentials, no subscriber data, no URLs/TIDs
  in outputs, no scheduling/sending/deployment, no persistence (stateless, ADR-0002).

### Verification at release

- 63/63 Vitest tests passing; `tsc --noEmit` clean; build emit successful.
- Live end-to-end proof (2026-07-19): real GetResponse historical winner (169 opens /
  76 clicks / ~45% CTOR) → REFRESH + 3 single-hypothesis variants, schema-valid, delivered for
  owner review. Owner verdict: "This is the architecture we want."

### Explicitly out of scope (deferred, ADR-0016)

JourneyBrief, lineage/experiment storage, strategy outputs, funnel modes, JOURNEY_ALIGNMENT,
HTTP transport.
