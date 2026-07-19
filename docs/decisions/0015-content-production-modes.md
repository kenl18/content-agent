# ADR-0015: Content Production Modes (REFRESH / CREATE / VARIANT) and the Production Brief

## Status

**Superseded by [ADR-0016](0016-shared-content-conversion-service.md)**, which absorbed this
design as its approved Phase 1 scope (email production modes). The `production` block, mode
coherence rules, and `promotional-email-v2` described here were implemented under ADR-0016 with
minor refinements (additional v2 fields: `bodySections`, `testHypotheses`, variant fields). Read
ADR-0016 for the current decision; this document remains as design history.

## Context

EmailOps will become the primary operating window for the business and will call the Content
Service automatically. EmailOps owns all ESP integrations, retrieves historical campaigns and
performance data itself, and supplies the Content Agent with a curated request. The Content
Service's revised role is **Content Production Engine**: analyse a supplied historical reference,
preserve proven winning angles, improve quality, generate new copy when no suitable reference
exists, and generate controlled variants — returning structured content plus a rationale.

Hard boundaries (unchanged in kind from `docs/boundaries.md`, restated for email specifics): the
Content Agent never touches ESP authentication, ESP API keys, subscriber lists or
subscriber-level data, audience selection, offer/funnel selection, destination URLs, tracking
IDs, unsubscribe handling, scheduling, sending, or campaign performance *retrieval*. Performance
data reaches this service only as caller-supplied, aggregate-level request context — which is
exactly the "Optimization Signals" posture ADR-0013 predicted, arriving from EmailOps rather
than a dedicated Analytics Service.

### What the existing contracts already cover

Inspection of the current implementation (`src/domain/content-request.ts`,
`src/application/content-service.ts`, `src/templates/`, 42 passing tests) shows most of the
requested input contract already exists under existing names:

| Requested field | Existing mechanism | New? |
|---|---|---|
| `campaignObjective` | `primaryObjective` (+ `note`) | no |
| `audienceSummary` | `targetAudience` | no |
| `brandVoice` | `tone` (may be long-form voice description) | no |
| `funnelContext` | `context.funnelContext` (open `context` object) | no |
| `outputFormat` | `sections` — the caller already selects exactly which output fields it wants per request | no |
| `prohibitedClaims` | — | **yes** (extend `constraints`) |
| `mode` | — | **yes** |
| `referenceCampaigns` | — | **yes** |
| `performanceEvidence` | — | **yes** (attached to each reference) |
| `winningElementsToPreserve` | — | **yes** |
| `weaknessesToImprove` | — | **yes** |
| `requestedVariants` | — | **yes** |

The genuinely new concepts are all facets of one idea: **reference-based production**. They are
grouped into a single optional request block rather than scattered as top-level fields.

## Decision (proposed)

### 1. Request contract: one new optional `production` block

Named channel-neutrally (not email-specifically) so Funnel Builder and future consumers can use
the same mechanism (e.g. refreshing a proven landing page):

```jsonc
{
  // ...all existing ContentRequest fields, unchanged...

  "production": {                          // optional; absent => mode "create", today's behavior
    "mode": "refresh",                    // "refresh" | "create" | "variant"

    "referenceContent": [                  // max 5; aggregate data ONLY, never subscriber-level
      {
        "label": "2026-05 winner",        // optional caller-side identifier
        "fields": {                        // the reference's own content, keyed like sections
          "subjectLine": "…",
          "previewText": "…",
          "body": "…"
        },
        "performanceSummary": {            // optional; aggregate metrics as simple key/values
          "openRate": 0.41,
          "clickRate": 0.062,
          "audienceSizeBand": "10k-50k"
        }
      }
    ],

    "preserveElements": [                  // winningElementsToPreserve
      "the curiosity-gap subject angle",
      "the short second-person opening"
    ],
    "improveElements": [                   // weaknessesToImprove
      "stale mid-2025 phrasing",
      "weak transition into the CTA"
    ],

    "requestedVariants": {                 // required in variant mode, forbidden otherwise
      "count": 3,                          // 1-5
      "vary": ["subjectLine"],            // which fields vary; everything else held constant
      "hold": "angle, offer framing, CTA intent"  // optional explicit statement of what stays fixed
    }
  },

  "constraints": {
    // ...existing fields...
    "prohibitedClaims": [                  // semantic prohibitions (vs. forbiddenPhrases' literal strings)
      "guaranteed results",
      "medical or health outcomes"
    ]
  }
}
```

**Mode coherence rules (request validation, `VALIDATION_ERROR` on violation):**

- `refresh` requires ≥1 `referenceContent` entry — you cannot refresh nothing (ADR-0005: the
  service never invents the thing it's told to preserve).
- `variant` requires ≥1 `referenceContent` **and** `requestedVariants`.
- `create` forbids `referenceContent` — CREATE is only for when EmailOps has confirmed no
  suitable performer exists; supplying references in create mode is a caller error that forces
  honest mode selection.
- `production` absent ⇒ `create` semantics; every existing consumer and test is unaffected.

**Subscriber-data boundary:** `performanceSummary` is schema-constrained to flat
`Record<string, string | number>` aggregates. Semantic screening can't be automated at the
schema level; the rule is contractual (documented here and in `docs/contracts.md`), and template
guidance instructs the model to ignore and flag via `riskFlags` anything resembling
personal/subscriber-level data that leaks into a request.

### 2. Response contract: no structural change

`content` remains `Record<string, string>`; `metadata` remains the open object ADR-0010
reserved for exactly this moment. The requested output contract maps as follows:

| Requested output | Mechanism |
|---|---|
| `subjectLine`, `previewText`, `ctaLabel` | existing content fields |
| `bodySections` | content field: role-tagged blocks separated by `\n---\n`, each block starting `role: <hook\|context\|story\|proof\|objection\|cta-lead\|ps>` — line-based, no nested JSON escaping |
| `textOnlyVersion` | content field: the full ready-to-use plain-text email |
| `htmlContentStructure` | satisfied by `bodySections`' ordered semantic blocks — EmailOps maps roles to its own HTML components; the Content Agent never returns HTML markup, URLs, or tracking |
| `rationale` | content field (it is generated text the caller requested — a section like any other) |
| `changesFromReference` | content field, newline-delimited list; refresh/variant modes only |
| `riskFlags` | content field, newline-delimited list; may be requested in any mode |
| variant fields | content fields `subjectLineVariants`, `previewTextVariants`, `hookVariants`, `ctaLabelVariants`, `bodyVariants` — newline-delimited (bodies `\n---\n`-delimited), count per `requestedVariants.count` |
| `version` | existing `metadata` (`templateId`, `schemaId`, `generatedAt`) plus one new optional echo: `metadata.mode` |

**Explicitly never returned:** URLs, TIDs, ESP configuration, scheduling data. The schema simply
has no such fields, and template guidance forbids URLs inside copy.

### 3. Schema registry: `promotional-email-v2`

One new schema containing the full field union above, **all fields optional at the schema
level** — the caller's `sections` array marks what is required per run (a subject-variant run
requests only `subjectLineVariants` + `rationale`; a full refresh requests the whole set). This
keeps one contentType and one schema across all three modes. `promotional-email-v1` remains
registered and untouched for backward compatibility; the template repoints to v2.

### 4. Template layer: optional per-mode guidance overlay

`TemplateStrategy` gains one optional field:

```ts
modeGuidance?: {
  refresh?: string;   // e.g. preserve the reference's psychological angle; change only what improveElements names
  variant?: string;   // e.g. vary ONLY requestedVariants.vary; hold everything else constant
};
```

Instruction Generation appends the matching overlay (plus a rendering of the `production` block:
references, performance summaries, preserve/improve lists, prohibited claims, variant spec) to
the prompt. It remains a pure function of `(request, template)` — mode behavior is driven
entirely by request data, per ADR-0005. Template Selection is unchanged (still
`contentType → Template`, per ADR-0008).

### 5. Invocation and reuse (no change required)

The core is already transport-independent (ADR-0004): EmailOps calls `generateContent()` via a
direct local adapter today; an API transport later is a thin adapter in `src/transport/`, not a
core change. Provider abstraction (ADR-0001) is untouched. Funnel Builder and future consumers
use the identical contract — nothing in this ADR is email-only except the
`promotional-email-v2` schema fields themselves, which is what schemas are for.

## What this deliberately does NOT change

- The six-step pipeline, error codes, and statelessness (ADR-0002) — references arrive in the
  request; the service still retrieves and remembers nothing.
- The response envelope (`requestId`/`contentType`/`content`/`metadata`).
- `Record<string, string>` content values. Fallback recorded: if the delimiter conventions for
  lists/blocks prove error-prone in real generations, the next-smallest step is widening content
  values to `string | string[]` — a deliberate contract change requiring its own ADR, not part
  of this one.
- Business Model / Business Objective models, open vocabulary (ADR-0011/0012).
- Existing consumers: every current request shape remains valid byte-for-byte.

## Consequences

- EmailOps' twelve requested input fields are all representable: five map to existing fields,
  seven arrive via `production` + `constraints.prohibitedClaims`.
- REFRESH honors "preserve proven winning angles" structurally: the reference and the
  preserve-list are explicit inputs, so what must not change is stated, not guessed.
- The service gains its first designed use of caller-supplied performance evidence — the
  ADR-0013 optimization-signal posture — while still never measuring anything itself.
- Rationale/riskFlags as generated content fields means the model explains its own choices in
  the same validated envelope as the copy, with no pipeline changes.

## Implementation checklist (upon approval — est. small)

1. `content-request.ts`: `production` block schema + mode-coherence `superRefine`;
   `constraints.prohibitedClaims`.
2. `schema-registry.ts`: add `promotional-email-v2`.
3. `template.ts` + `template-registry.ts`: optional `modeGuidance`; author refresh/variant
   guidance for `promotional-email`; repoint template to v2.
4. `build-instructions.ts`: render `production` block + mode overlay into the prompt.
5. `content-service.ts`: echo `metadata.mode`.
6. Tests: mode-coherence validation, per-mode instruction rendering, v2 pipeline runs
   (refresh/create/variant), backward-compat run without `production`.
7. Docs sync: `contracts.md`, `docs/templates/promotional-email.md`, `boundaries.md` (ESP/email
   exclusions), `VERSION.md` log.
