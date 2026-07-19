# ADR-0016: Email Production Modes (Phase 1 of the Shared Content & Conversion Service)

## Status

**Accepted (reduced scope, 2026-07-19) — Phase 1 approved and implemented.**

An earlier draft of this ADR proposed the full Shared Content & Conversion Service migration
(JourneyBrief, lineage storage, strategy outputs, funnel modes, journey alignment). The owner
reduced scope to the immediate business objective: **improve email quality and speed using
proven historical campaigns.** This revision records the reduced decision; deferred capabilities
are summarized at the end without design commitment. Supersedes and absorbs
[ADR-0015](0015-content-production-modes.md), whose design this Phase 1 implements.

## Context

EmailOps operates the business through one window and calls the Content Agent automatically.
EmailOps owns all ESP integrations, retrieves historical campaigns and performance itself, and
supplies a curated request. The Content Agent's job in this phase: produce better promotional
emails, faster, grounded in proven historical winners — nothing else.

## Decision

### Scope of Phase 1 (all implemented)

1. **`promotional-email` generation** — existing contentType, now on schema
   `promotional-email-v2`.
2. **`refresh` mode** — improve a supplied proven historical email while preserving its winning
   angle.
3. **`create` mode** — new email (e.g. for a new funnel) only when EmailOps confirms no suitable
   historical reference exists. Funnel context arrives via the existing open `context` field —
   no new contract surface needed.
4. **`variant` mode** — controlled subject/hook/CTA/body variants holding strategy constant.
5. **Local invocation** — `createContentClient()` in `src/transport/local.ts`, the documented
   surface EmailOps' adapter calls; an API transport remains a thin later addition (ADR-0004).

### The `production` request block (optional; absent = today's behavior)

```jsonc
"production": {
  "mode": "refresh",                       // "refresh" | "create" | "variant"
  "referenceContent": [                     // max 5; aggregate data only, never subscriber-level
    {
      "label": "2026-05 winner",
      "fields": { "subjectLine": "…", "previewText": "…", "body": "…" },
      "performanceSummary": { "openRate": 0.41, "clickRate": 0.062 }
    }
  ],
  "preserveElements": ["the curiosity-gap subject angle"],
  "improveElements": ["stale phrasing", "weak CTA transition"],
  "requestedVariants": { "count": 3, "vary": ["subjectLine"], "hold": "angle, offer framing" }
},
"constraints": { "prohibitedClaims": ["guaranteed results"] }   // semantic, vs forbiddenPhrases' literals
```

Mode coherence (request validation, `VALIDATION_ERROR`):

- `refresh` requires ≥1 `referenceContent` — you cannot refresh nothing (ADR-0005).
- `variant` requires ≥1 `referenceContent` **and** `requestedVariants`.
- `create` forbids `referenceContent` — forces honest mode selection.
- `requestedVariants` is forbidden outside `variant` mode.

### Output: `promotional-email-v2`

All fields schema-optional; the caller's `sections` marks what each run requires (a
subject-variant run requests only `subjectLineVariants` + `rationale`). Fields: `subjectLine`,
`previewText`, `body`, `bodySections` (role-tagged blocks separated by `\n---\n`, roles like
`hook:`/`story:`/`cta-lead:`/`ps:` — EmailOps maps them to its own HTML components), `ctaLabel`,
`textOnlyVersion`, `postscript`, `rationale`, `changesFromReference` (newline list;
refresh/variant), `riskFlags` (newline list), `testHypotheses` (newline list, correlational
language only), and `subjectLineVariants` / `previewTextVariants` / `hookVariants` /
`ctaLabelVariants` / `bodyVariants` (newline-delimited; bodies `\n---\n`-delimited).
`promotional-email-v1` stays registered; the template repoints to v2. Response envelope
unchanged; `metadata` gains an optional `mode` echo.

Never returned (no schema fields exist): URLs, TIDs, ESP configuration, scheduling data, HTML
markup.

### Template layer

`TemplateStrategy` gains optional `modeGuidance?: { refresh?: string; variant?: string }` —
curated per-mode instructions appended by Instruction Generation, which remains a pure function
of `(request, template)`. `create` uses the base `modelGuidance` unmodified.

### Designed for Funnel Builder reuse — without building it

- Mode names are **channel-neutral** (`refresh`/`create`/`variant`, not `EMAIL_*`): the channel
  is carried by `contentType`, so a future `funnel-landing-page` contentType uses the identical
  `production` block and modes with zero contract change.
- `referenceContent.fields` is an open string map — a reference landing page fits it as readily
  as a reference email.
- `createContentClient()` is consumer-agnostic; Funnel Builder later calls the same function
  with its own contentTypes.

## What this phase deliberately does NOT include

Per owner direction — deferred, not designed-in, no code or contract surface reserved beyond
what's noted:

- **JourneyBrief** — the shared cross-channel brief. Current needs are met by existing fields +
  `context`.
- **Lineage/experiment storage** — would amend statelessness (ADR-0002); not needed to generate
  better emails. EmailOps keeps its own campaign records.
- **Strategy outputs** (campaign strategy, funnel positioning) — would reframe ADR-0005;
  excluded. `rationale`/`testHypotheses` explain the produced copy and propose tests of it; they
  do not select strategy.
- **Funnel modes / funnel optimization / JOURNEY_ALIGNMENT** — future phases, only on owner
  request; the Soulmate Message validation (`docs/validation/`) remains the groundwork.
- **HTTP transport** — later, per ADR-0004.

## Consequences

- Both frozen principles that the expansive draft would have amended — statelessness (ADR-0002)
  and strategy-never-invented (ADR-0005) — remain fully intact. No principle changes were
  needed at this scope.
- Backward compatible: `production` absent reproduces prior behavior; `promotional-email-v1`
  requests keep validating; all pre-existing tests pass unmodified except the template's
  schemaId assertion (v1 → v2).
- Evidence stays caller-supplied aggregates (`performanceSummary`) — the ADR-0013 posture,
  arriving from EmailOps. The service still retrieves and remembers nothing.
- Measurability: EmailOps can now A/B its own historical winner against a `refresh` of it, and
  run `variant` packs, attributing results in its own analytics — the service's contribution to
  "measurable improvement" is producing the variants and refreshes fast, with rationale and
  test hypotheses attached.
