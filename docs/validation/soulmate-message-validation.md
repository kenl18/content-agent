# Architecture Validation #1 — Soulmate Message Funnel (AstrologyManifest)

**Type:** Validation exercise, not implementation. No code was changed.
**Question under test:** Could the frozen V1 Content Service generate all production copy for
this tool without changing the architecture?
**Verdict: YES** — with two template gaps and one already-recorded implementation gap. No
architecture gap found. Reasoning at the end.

## 1. The asset inspected

`astrology-manifest/src/pages/readings/soulmate-message/` — a live 3-step ClickBank affiliate
funnel, deliberately form-free ("read and tap"), modeled on a reference funnel
(past-lover-v3) that converts well:

- **Step 1 — Hook** (`index.astro`): headline, hero image, emotional hook copy (7 short
  paragraphs), CTA ×2, social-proof line.
- **Step 2 — Presell** (`reading.astro`): headline, two explainer sections, a 4-item
  resonance checklist, a "pattern detected" callout, CTA ×2.
- **Step 3 — Reveal + Offer + Article** (`results.astro`): reveal list, offer card
  (eyebrow/body/CTA/affiliate disclosure) pointing at a ClickBank link with funnel-specific
  `tid`, then a long-form SEO/AdSense article rendering a static catalog
  (`src/data/soulmate-message.mjs`): 8 "signs" (name+emoji+meaning), 9 numerology
  "connection archetypes," 4 "intentions" — plus a closing internal-link CTA to
  `/angel-numbers/`.
- **Images**: 2 assets governed by `creative-manifests/soulmate-message.json` (Creative
  Pipeline's domain).
- **Ads/analytics**: AdSense + GA wired in `FunnelLayout.astro`, not in page content.

## 2. Separation of concerns

### Business strategy (never Content Service — supplied or kept by the caller)

- The 3-step, zero-form-fields funnel structure and its rationale (modeled on a
  reference funnel whose traffic data shows it converts)
- Choice of ClickBank offer, hop link, and `tid` attribution (`astrosoulmatemessage`)
- The decision that step 3's reveal is identical for every visitor
- The decision that the article is generic SEO/AdSense surface, not personalization payoff
- The catalog *lists* themselves (which 8 signs, which 9 archetypes, which 4 intentions)
- Target audience, funnel narrative arc, per-step desired action
- Internal-link target (`/angel-numbers/`)

### Content (the Content Service's domain — all of it text)

Step 1: meta title/description, H1, hook body paragraphs, CTA label, social-proof line
wording.
Step 2: meta title/description, H1, 2 section headings, explainer paragraphs, 4 checklist
items, closing line, callout text, CTA label.
Step 3: meta title/description, H1, section heading, 4 reveal bullets, transition line,
offer eyebrow, offer body, offer CTA label, article intro, 4 article H2s, 3 section intros,
8 sign meanings, 9 archetype meanings, 4 intention deep-dives, closing paragraph, closing
subtitle, closing CTA label.

### Layout (Astro/Funnel Builder)

`FunnelLayout`, `funnel-shell`/`funnel-cta`/`funnel-card` etc. CSS classes, progress
indicators ("Step 1 of 3" — derived from funnel structure, mechanical), star-rating markup,
`rel="sponsored" target="_blank"` handling, canonical paths, routing.

### Logic (Funnel Builder / site)

Page sequencing, link wiring, AdSense/GA loading, asset-manifest resolution. (This funnel
deliberately has no interactive logic.)

### Images (Creative Pipeline)

Both webp assets, their prompts, alt text, and style guide — explicitly outside the Content
Service per `docs/boundaries.md`.

### Two deliberate ownership calls

- **Affiliate disclosure line** ("Affiliate link — if you purchase...") → **Funnel Builder,
  as fixed compliance copy.** Legal wording should not be regenerated per call; treating it
  as content invites drift in a sentence that exists for compliance, not conversion.
- **Catalog names/emoji** (e.g. "🔢 Repeating Numbers") → **Funnel Builder as curation**;
  the Content Service writes each entry's *meaning* text. The list is strategy; the prose is
  content.

## 3. How the funnel maps onto the frozen contracts

One `primaryObjective` per request (ADR-0006) → the funnel decomposes into **4 requests / 4
contentTypes**, exactly as the homepage design already established at section granularity:

| contentType | Covers | primaryObjective | secondary |
|---|---|---|---|
| `funnel-hook-page` | Step 1 copy | `advance_funnel_step` *(open vocab — see below)* | `reduce_bounce_rate` |
| `funnel-presell-page` | Step 2 copy | `advance_funnel_step` | `build_trust` |
| `funnel-offer-reveal` | Step 3 reveal + offer card | `improve_affiliate_click_through_rate` | — |
| `funnel-seo-article` | Step 3 long-form article | `increase_organic_traffic` | `increase_adsense_rpm`, `increase_time_on_page` |

`advance_funnel_step` is not in the canonical vocabulary — and doesn't need to be:
ADR-0011's open vocabulary accepts it as-is, with template fallback and verbatim
pass-through to the model. **This validates the open-vocabulary decision against a real
need on the first try.**

Generation is build-time: Funnel Builder calls the service when building/refreshing the
funnel and bakes responses into the site — a perfect fit for the stateless, synchronous
pipeline (ADR-0002). Nothing is generated per-visitor.

## 4. Example: the `funnel-hook-page` ContentRequest

Every field below is a frozen V1 contract field — nothing invented:

```jsonc
{
  "requestId": "3f9a...-hook",
  "consumer": "funnel-builder",
  "contentType": "funnel-hook-page",
  "businessModel": {
    "primaryRevenueStream": "affiliate_marketing",
    "secondaryRevenueStreams": ["advertising_revenue"],
    "note": "ClickBank soulmate-reading offer at funnel end; AdSense on the step-3 article"
  },
  "primaryObjective": {
    "type": "advance_funnel_step",
    "note": "Maximize tap-through from step 1 to step 2; read-and-tap flow, no form fields"
  },
  "secondaryObjectives": [{ "type": "reduce_bounce_rate" }],
  "targetAudience": "Adults interested in soulmate/twin-flame signs, arriving cold from ads or organic search",
  "desiredAction": "Tap the CTA to begin the reading (advance to step 2 of 3)",
  "sections": [
    { "key": "metaTitle",       "description": "SEO title tag, notification-style curiosity hook", "required": true },
    { "key": "metaDescription", "description": "SEO meta description echoing the signs motif",     "required": true },
    { "key": "headline",        "description": "H1 — the funnel's core curiosity hook",            "required": true },
    { "key": "hookBody",        "description": "5-7 short emotional paragraphs naming the signs the visitor has likely noticed and the question they keep asking", "required": true },
    { "key": "ctaLabel",        "description": "Tap-through button text",                          "required": true },
    { "key": "socialProofLine", "description": "One modest trust line; must not claim numbers or reviews not supplied in context", "required": true }
  ],
  "context": {
    "brandName": "Astrology Manifest",
    "funnelName": "Soulmate Message Reading",
    "stepNumber": 1,
    "totalSteps": 3,
    "funnelNarrative": "Step 1 hooks via signs already noticed; step 2 legitimizes the reading; step 3 reveals a pattern and presents the paid full reading",
    "signsMotif": ["a repeating number", "a song that keeps returning", "a stranger who feels familiar", "a recurring dream"],
    "conversionPattern": "read-and-tap; no form fields anywhere in the funnel"
  },
  "tone": "intimate, emotionally warm, mystical but plain-spoken; second person; never clinical",
  "constraints": {
    "forbiddenPhrases": ["guaranteed", "scientifically proven"]
  }
}
```

### Expected ContentResponse structure

```jsonc
{
  "requestId": "3f9a...-hook",
  "contentType": "funnel-hook-page",
  "content": {
    "metaTitle": "…",
    "metaDescription": "…",
    "headline": "…",
    "hookBody": "…",          // paragraphs joined with \n\n — see finding G-3
    "ctaLabel": "…",
    "socialProofLine": "…"
  },
  "metadata": {
    "provider": "anthropic",
    "model": "claude-sonnet-5",
    "templateId": "funnel-hook-page-v1",
    "schemaId": "funnel-hook-page-v1",
    "generatedAt": "…",
    "durationMs": 0
  }
}
```

The other three requests follow the identical pattern. The `funnel-seo-article` request is
the largest: its `sections` array enumerates one key per catalog entry the caller wants
written (e.g. `signMeaning-repeating-numbers`, …×8; `archetypeMeaning-1`…×9;
`intentionDeepDive-reunion`…×4; plus headings/intros/closings — ~30 sections), with the
catalog names/emoji supplied in `context` as curation facts.

## 5. Findings — everything that strained the contracts, classified

**G-1 (template gap, expected):** None of the four contentTypes exist in the template
registry, and none of their schemas exist in the schema registry. That is exactly what the
registries are for; adding entries is sanctioned growth (ADR-0010 §1), not change.

**G-2 (implementation gap, already recorded):** `Template` still carries a single
`guidance: string` rather than the ADR-0014 Strategy Layer structure. Deferred by that ADR
until the first production template lands — these four templates are precisely that moment.
Nothing about the frozen contracts blocks it.

**G-3 (observation, not a gap):** The response contract is a flat
`Record<string, string>`. Repeated structured collections (8 signs × meaning) are
represented by *enumerating keys in `sections`*, and multi-paragraph bodies by delimiter
convention (`\n\n`) inside one string. Both are workable and contract-legal; the cost is
that a schemaId encodes its item count (an article with 6 signs is a different schemaId or
a caller-side subset via optional fields). This is a template-design convention to document
when implementing — not a production blocker, so per the ground rules it does not justify
an architecture change.

**G-4 (observation, not a gap):** Cross-page narrative continuity (step 2's "your reading
has begun" paying off step 1's promise) has no cross-request memory to lean on — by design
(ADR-0002). It is achieved by the caller passing the same `funnelNarrative`/`tone` context
into all four requests. The burden sits with the Funnel Builder, which is where the frozen
architecture says it belongs.

**Architecture gaps: none.** Nothing in this funnel requires a contract field that doesn't
exist, an error code that doesn't exist, statefulness, a second objective slot per request,
or caller-supplied schemas.

## 6. The answer

> **Could the current Content Service generate all production copy for this tool without
> changing the architecture? — Yes.**

Why:

1. **Every piece of writing in the funnel is flat text** — headlines, paragraphs, labels,
   list items, meta tags. All of it fits `Record<string, string>` keyed by caller-defined
   sections, including the article's 21-entry catalog (via enumerated keys).
2. **Every section has a representable objective.** Three canonical objectives cover the
   offer and article pages; the one genuinely new objective (`advance_funnel_step`) is
   absorbed by the open vocabulary without any schema change — the first real-world proof
   that ADR-0011 was the right call.
3. **Every business fact flows through `context`** — funnel narrative, step position, signs
   motif, brand, catalog names. Nothing the model needs is unrepresentable, and nothing it
   must not invent (trust claims, offer terms, the catalog lists) needs to be invented.
4. **Everything that isn't text stays outside cleanly**: images (Creative Pipeline), links
   and `tid` (Funnel Builder), layout and ads (Astro/FunnelLayout), compliance copy
   (Funnel Builder), the no-form-fields strategy itself (the business).
5. **The gaps found are the two kinds the architecture predicted**: new registry entries
   (template gap) and the deferred ADR-0014 restructure (implementation gap). The freeze
   survives contact with production.

**Next step when implementation is requested:** add the four templates + schemas above,
restructure `Template` per ADR-0014 in the same change, and have the Funnel Builder issue
the four requests at build time.
