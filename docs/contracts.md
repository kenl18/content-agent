# Contracts — Version 1

This document defines the request, success response, and error response contracts. These are
specifications to be implemented as Zod schemas in `src/domain/`; no code exists yet. Shapes here
are the basis for that implementation and for the related ADRs.

All contracts are JSON-serializable and transport-independent — they describe payload shape, not
HTTP status codes or headers (a transport adapter maps these onto whatever transport it uses).

## Design principles for these contracts

- Every field the caller supplies is **explicit strategy**, never inferred by the service —
  including *why* the content exists (the Business Objective model) and *how the business makes
  money* (the Business Model), both below.
- `contentType` and `schemaId` are deliberately separate (see
  [ADR-0007](decisions/0007-content-type-schema-id-separation.md)): `contentType` is the
  caller-supplied semantic label for what's being generated; `schemaId` is the resolved
  structural output contract, decided internally by Template Selection, and echoed back in
  response metadata for traceability. Callers never supply `schemaId` directly in V1.
- `context` is an intentionally open object: business facts the service needs to write accurately
  (brand name, offer details, constraints) without the service needing to understand or validate
  their domain meaning.
- Responses always carry `requestId` back so callers can correlate logs even though the call
  itself is synchronous.

## Open vocabulary fields

Two fields below — `BusinessObjective.type` and `BusinessModel`'s revenue stream types — use an
**open vocabulary** rather than a closed enum (see
[ADR-0011](decisions/0011-open-business-objective-vocabulary.md)): the service documents and
recommends a canonical set of values, and internal templates may carry specific tuning for those
canonical values, but the field itself accepts any well-formed string. This lets a caller
introduce a new objective or revenue stream this service hasn't seen tuned templates for yet,
without waiting on a contract change or a service-side release.

**Validation rule for open-vocabulary strings:** non-empty, lowercase `snake_case`, matching
`/^[a-z][a-z0-9_]*$/`. This is a shape check only — it does not restrict *which* specific values
are accepted.

**Practical consequence:** if a caller supplies a value outside the canonical list, Template
Selection falls back to the `contentType`'s default template (rather than an
objective/model-tuned variant), and Instruction Generation still passes the caller's exact value
(and `note`, if supplied) directly into the model instructions — the model is always told the
objective and business model verbatim, even without bespoke service-side tuning for it.

## Business Model

A first-class domain model describing how the calling business generates revenue (see
[ADR-0012](decisions/0012-business-model-context.md)). Business objectives are interpreted
*within* this context — e.g. `increase_ad_viewability` matters most to an
`advertising_revenue`-driven business, while `improve_affiliate_conversion_rate` matters most to
an `affiliate_marketing`-driven one. A business with a hybrid model (e.g. AstrologyManifest:
advertising + affiliate + email-list monetization) declares all of its relevant revenue streams.

```jsonc
{
  "primaryRevenueStream": "advertising_revenue",  // open-vocabulary string, required
  "secondaryRevenueStreams": [                    // open-vocabulary string[], optional, defaults to []
    "affiliate_marketing",
    "email_list_monetization"
  ],
  "note": "AdSense display ads plus ClickBank tarot/astrology affiliate offers, with the email list as a secondary nurture channel"
                                                   // string, optional
}
```

### Canonical revenue stream types (recommended, not exhaustive)

| value | Meaning |
|---|---|
| `advertising_revenue` | Revenue from on-page ad impressions/clicks (e.g. AdSense). |
| `affiliate_marketing` | Revenue from commissioned referral sales (e.g. ClickBank, Amazon Associates). |
| `email_list_monetization` | Revenue generated indirectly by growing and later monetizing an email list. |
| `lead_generation` | Revenue from capturing and selling/forwarding qualified leads. |
| `direct_product_sales` | Revenue from direct sale of products, info-products, or ecommerce. |
| `subscription_revenue` | Recurring revenue from paid memberships or subscriptions. |
| `service_bookings` | Revenue from booked consultations or services. |
| `sponsored_content` | Revenue from sponsored placements or brand partnerships. |

## Business Objective model

A first-class domain model, not a free-text field (see
[ADR-0006](decisions/0006-business-objective-model.md) and
[ADR-0011](decisions/0011-open-business-objective-vocabulary.md)):

```jsonc
{
  "type": "increase_email_capture",        // open-vocabulary string, required
  "note": "Specifically the free tarot reading opt-in, not the newsletter footer form"
                                            // string, optional — caller elaboration, not
                                            // interpreted or validated beyond being a string
}
```

### Canonical objective types (recommended, not exhaustive)

Consumer-neutral, general business language — not specific to any one consumer's funnel, and
open to new values without a contract change (see "Open vocabulary fields" above and
[ADR-0011](decisions/0011-open-business-objective-vocabulary.md)).

| `type` value | Meaning |
|---|---|
| `increase_organic_traffic` | Content should help attract more organic search visitors. |
| `improve_search_intent_matching` | Content should more precisely match what a searcher was looking for. |
| `increase_time_on_page` | Content should encourage the reader to stay and keep reading. |
| `reduce_bounce_rate` | Content should give the reader a reason not to leave immediately. |
| `increase_pages_per_session` | Content should encourage navigation to further pages. |
| `increase_ad_viewability` | Content structure should support ads being seen (e.g. sufficient length/pacing). |
| `increase_adsense_rpm` | Content should support higher ad revenue per thousand impressions. |
| `encourage_tool_usage` | Content should drive the reader to use an on-page tool/calculator/quiz. |
| `increase_email_capture` | Content should drive email signups. |
| `improve_affiliate_click_through_rate` | Content should drive clicks on an affiliate offer. |
| `improve_affiliate_conversion_rate` | Content should support the reader completing an affiliate purchase. |
| `build_trust` | Content should establish credibility/trustworthiness with the reader. |
| `improve_user_retention` | Content should encourage the reader to return in the future. |

## Request contract: `ContentRequest`

```jsonc
{
  // Caller-supplied correlation id. Echoed back on both success and error responses.
  "requestId": "b3f1c2a0-...",           // string, required, non-empty

  // Identifies the calling system. Used only for logging/metadata — never branched on.
  "consumer": "website-builder",          // string, required, non-empty

  // Semantic label for what's being generated. Selects a Template during Template Selection
  // (see docs/technical-design.md). Does NOT directly select an output schema — see schemaId.
  "contentType": "landing-page-hero",     // string, required, non-empty

  // How the calling business generates revenue. Provides the interpretive context for
  // primaryObjective/secondaryObjectives below. Required — objectives are never interpreted
  // in a monetization vacuum.
  "businessModel": {
    "primaryRevenueStream": "advertising_revenue",
    "secondaryRevenueStreams": ["affiliate_marketing", "email_list_monetization"],
    "note": "AdSense display ads plus ClickBank affiliate offers, email list as nurture channel"
  },                                       // BusinessModel, required

  // The measurable business outcome this content exists to move. Required — every request has
  // exactly one primary objective.
  "primaryObjective": {
    "type": "increase_email_capture",
    "note": "Free 3-card tarot reading opt-in"
  },                                       // BusinessObjective, required

  // Additional objectives this content should also support, in priority order after the
  // primary. Optional — most requests will have zero or a small number of these.
  "secondaryObjectives": [
    { "type": "build_trust" },
    { "type": "increase_time_on_page" }
  ],                                       // BusinessObjective[], optional, defaults to []

  // Who the content is for. Supplied by the caller; never inferred.
  "targetAudience": "Women 25-45 interested in tarot and self-reflection",
                                           // string, required, non-empty

  // What the reader/recipient should do after seeing this content.
  "desiredAction": "Click through to the email signup form",
                                           // string, required, non-empty

  // The structural pieces this content must contain. The service uses these keys/descriptions
  // to know what to produce; the schema resolved via schemaId defines the final structural
  // contract.
  "sections": [
    {
      "key": "headline",                  // string, required, non-empty, unique within request
      "description": "A short, benefit-driven headline",
                                           // string, required, non-empty
      "required": true                    // boolean, required
    },
    {
      "key": "subheadline",
      "description": "One supporting sentence building curiosity",
      "required": true
    }
  ],                                       // array, required, min length 1

  // Free-form business facts the model needs to write accurately. Not interpreted by the
  // service beyond passing it into the prompt — no schema imposed on its internal shape.
  "context": {
    "brandName": "Astrology Manifest",
    "offer": "Free 3-card tarot reading"
  },                                       // object, optional, defaults to {}

  // Optional tone guidance. Purely descriptive; the service does not maintain a tone taxonomy.
  "tone": "warm, encouraging, a little mystical",
                                           // string, optional

  // Optional hard constraints enforced during/after generation.
  "constraints": {
    "maxLength": 600,                     // number, optional — applies per rendered content, not per field
    "minLength": 0,                       // number, optional
    "forbiddenPhrases": ["guaranteed"],   // string array, optional — literal string prohibitions
    "requiredPhrases": [],                // string array, optional
    "prohibitedClaims": []                // string array, optional — semantic prohibitions (ADR-0016)
  },                                       // object, optional

  // Optional production block (ADR-0016): reference-based production modes. Absent => plain
  // "create" behavior. Mode coherence is validated: refresh requires >=1 reference; variant
  // requires >=1 reference AND requestedVariants; create forbids references; requestedVariants
  // is only allowed in variant mode. referenceContent carries aggregate performance data ONLY —
  // never subscriber-level data (contractual rule; cannot be schema-detected).
  "production": {
    "mode": "refresh",                    // "refresh" | "create" | "variant"
    "referenceContent": [                  // max 5
      {
        "label": "2026-05 winner",        // string, optional
        "fields": { "subjectLine": "…", "body": "…" },  // non-empty record of strings
        "performanceSummary": { "openRate": 0.41 }       // record of string|number, optional
      }
    ],
    "preserveElements": ["…"],            // string array, optional
    "improveElements": ["…"],             // string array, optional
    "requestedVariants": {                 // variant mode only
      "count": 3,                          // integer 1-5
      "vary": ["subjectLine"],            // min 1 field name
      "hold": "angle, offer framing"      // string, optional
    }
  }                                        // object, optional
}
```

### Request validation rules (V1)

- `requestId`, `consumer`, `contentType`, `targetAudience`, `desiredAction` are required
  non-empty strings.
- `businessModel` is required; `primaryRevenueStream` must be a well-formed open-vocabulary
  string (see "Open vocabulary fields" above). `secondaryRevenueStreams` is optional.
- `primaryObjective` is required and must have a `type` that is a well-formed open-vocabulary
  string. `secondaryObjectives` is optional; if present, each entry follows the same rule.
- `sections` must have at least one entry; `key` values must be unique within the request.
- `contentType` must resolve to a known `Template` in the template registry during Template
  Selection, or validation fails with `UNKNOWN_CONTENT_TYPE` rather than being passed through to
  the model unchecked. `schemaId` is never supplied by the caller — it is resolved from the
  matched template.
- `context` and `constraints` are optional and default to empty/absent; the service does not
  require the caller to know internal defaults beyond "omit if not applicable."
- No field is inferred from any other field. A missing required field — including
  `businessModel` or `primaryObjective` — is a validation error, not a default.

## Success response contract: `ContentResponse`

```jsonc
{
  "requestId": "b3f1c2a0-...",            // echoes the request's requestId
  "contentType": "landing-page-hero",     // echoes the request's contentType

  // Keyed by the section `key`s from the request. Shape is validated against the schema
  // identified by metadata.schemaId.
  "content": {
    "headline": "Your Story Is Already Written in the Stars",
    "subheadline": "Uncover what's next with a free 3-card tarot reading."
  },

  "metadata": {
    "provider": "anthropic",              // string — which ModelProvider implementation answered
    "model": "claude-sonnet-5",           // string — specific model identifier used
    "templateId": "landing-hero-email-capture-v1",
                                           // string — the Template resolved during Template Selection
    "schemaId": "hero-headline-subheadline-v1",
                                           // string — the output schema the content was validated against
    "generatedAt": "2026-07-18T00:00:00.000Z", // ISO 8601 timestamp
    "durationMs": 842                     // number — total pipeline time in milliseconds
    // additional optional fields (e.g. future readabilityScore, seoIntentScore) may be added
    // here over time without breaking existing callers — see docs/technical-design.md,
    // "Extension points for future optimization modules"
  }
}
```

### Response validation rules (V1)

- `content` must satisfy exactly the schema identified by `metadata.schemaId`; every `required:
  true` section from the request must be present and non-empty.
- If the model's raw output cannot be parsed as JSON, or does not satisfy the resolved schema,
  the pipeline returns an error response (`PROVIDER_OUTPUT_ERROR` or `RESPONSE_VALIDATION_ERROR`)
  instead of a partial or best-guess `ContentResponse`.
- `metadata`'s core fields (`provider`, `model`, `templateId`, `schemaId`, `generatedAt`,
  `durationMs`) are always present on success. `metadata` is intentionally open to additional
  optional fields in future versions without requiring a contract version bump.

## Error response contract: `ContentServiceError`

```jsonc
{
  "requestId": "b3f1c2a0-...",            // echoes the request's requestId if one was parseable, else null
  "error": {
    "code": "VALIDATION_ERROR",          // string, machine-readable, stable — see codes below
    "message": "primaryObjective is required and must have a well-formed type.",
                                           // string, human-readable, safe to log/display
    "details": [
      { "path": "primaryObjective.type", "issue": "required" }
    ]                                      // array|object, optional, structured detail (e.g. Zod issues)
  }
}
```

### V1 error codes

| Code | Meaning |
|---|---|
| `VALIDATION_ERROR` | The incoming request failed schema validation (including a missing/malformed `businessModel` or `primaryObjective`). |
| `UNKNOWN_CONTENT_TYPE` | `contentType` does not resolve to any registered Template during Template Selection. |
| `PROVIDER_ERROR` | The model provider call itself failed (network, transient provider-side error, timeout, unclassified failure). Callers may retry after a short pause. |
| `CLAUDE_SUBSCRIPTION_LIMIT` | The Claude Code subscription provider ([ADR-0017](decisions/0017-claude-code-subscription-provider.md)) hit the subscription usage limit. `details.classification` is `CLAUDE_SUBSCRIPTION_LIMIT`; `details.resetsAt` (ISO) is present when the CLI reported a reset time. Callers must stop, preserve state, and retry later — never on a paid API path. |
| `CLAUDE_AUTH_UNAVAILABLE` | The Claude Code subscription provider has no usable subscription login (logged out, expired, or a non-subscription auth method). Fail closed: an operator must re-authenticate; there is no fallback. |
| `PROVIDER_OUTPUT_ERROR` | The model returned output that could not be parsed as structured data. |
| `RESPONSE_VALIDATION_ERROR` | Parsed model output does not satisfy the resolved `schemaId`'s schema. |
| `INTERNAL_ERROR` | Any unexpected failure not covered above. |

Every failure mode in the pipeline maps to exactly one of these codes — the pipeline never
throws an unstructured exception across its own public boundary.

## Notes for implementers

- These are specifications, to be implemented as Zod schemas (`z.object({...})`) in
  `src/domain/content-request.ts`, `src/domain/content-response.ts`,
  `src/domain/business-objective.ts`, and `src/domain/business-model.ts` per the folder structure
  in [technical-design.md](technical-design.md).
- The set of `contentType` values and their resolved templates/schemas live in
  `src/templates/template-registry.ts` and `src/domain/schema-registry.ts` respectively —
  intentionally left open, expected to grow per real consumer need, not fully enumerated up
  front.
- The canonical objective and revenue-stream vocabularies in this document are recommended
  starting sets (see [ADR-0011](decisions/0011-open-business-objective-vocabulary.md)) — new
  values can be supplied by callers, and new canonical (template-tuned) values can be added to
  this document, at any time without a breaking contract change.
