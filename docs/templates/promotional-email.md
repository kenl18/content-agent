# Promotional Email Template — Strategy Layer (Production)

**Status: Implemented.** `contentType: promotional-email`, template
`promotional-email-generic-v2`, schema `promotional-email-v2` (v1 remains registered for
backward compatibility). Requested by EmailOps as the first production template; extended under
[ADR-0016](../decisions/0016-shared-content-conversion-service.md) with production modes
(`refresh` / `create` / `variant`) and a mode-aware v2 schema. This document is the authored
home of the template's Strategy Layer (ADR-0014); the registry entry in
[src/templates/template-registry.ts](../../src/templates/template-registry.ts) must be kept in
sync with it — edit both together, deliberately.

**Production modes (ADR-0016):** requests may carry a `production` block. `refresh` supplies a
proven historical email as `referenceContent` and preserves its winning angle while improving
what `improveElements` names; `create` is for when EmailOps confirms no suitable reference
exists (references are forbidden in this mode); `variant` generates 1–5 controlled variants
varying only `requestedVariants.vary` while holding strategy constant. Mode-specific guidance
lives in the template's `strategy.modeGuidance` — curated Strategy Layer content, kept in sync
here. The v2 schema is all-optional: each run's `sections` selects which fields it needs
(e.g. a subject-variant run requests only `subjectLineVariants` + `rationale`). New v2 fields
beyond v1: `bodySections` (role-tagged `\n---\n` blocks: hook/context/story/proof/objection/
cta-lead/ps), `textOnlyVersion`, `rationale`, `changesFromReference`, `riskFlags`,
`testHypotheses` (correlational language only — hypotheses, never causal claims), and the five
`*Variants` fields (newline-delimited; bodies `---`-delimited).

**Local invocation:** EmailOps calls `createContentClient({ apiKey })` (or passes its own
`ModelProvider`) from `src/transport/local.ts` — consumer-agnostic, reusable by Funnel Builder
later. The client never reads the environment; the caller owns its credentials.

**Deliberately generic.** This template serves *all* future affiliate campaigns. Everything
campaign-specific — the offer, its promise, the audience's subscription origin, brand name —
arrives per-request via `context`. Nothing about any single campaign (including the one that
prompted this request) is encoded in the template.

## Strategy Layer

- **Business purpose:** Convert an opted-in email subscriber into a click on an affiliate offer
  link. The email's one job is the click; the offer page does the selling.
- **Audience psychology:** The recipient already trusts the sender enough to have subscribed,
  but reads in a crowded inbox with seconds of attention. The subject/preview pair wins or loses
  the open; the body must reward that open quickly. Curiosity and self-relevance drive opens; a
  single clear promise sustains reading; hype or friction triggers deletion or spam-marking.
- **Conversion reasoning:** One email, one idea, one CTA. Every added ask or topic dilutes
  click-through. The body opens a specific curiosity gap or names a specific problem the offer
  resolves, then routes all momentum into a single CTA. A P.S. is among the most-read lines in
  an email and gets one final, differently-angled nudge to the same CTA — never a new topic.
- **Reference principles:** single benefit-specific ask (homepage analysis, Part 2 #10);
  curiosity gap (homepage analysis, Part 1); specificity beats vagueness (Part 2 #6). Honesty
  note: no email-specific reference analysis (per
  [docs/reference-site-analysis-method.md](../reference-site-analysis-method.md)) has been
  performed yet — these are adapted from the homepage analysis plus standard direct-response
  email practice. Running the method on one or more reference email sequences is the expected
  way this Strategy Layer improves.
- **Information hierarchy:** Subject + preview text (the open) → opening hook rewarding the open
  within two lines → short value/curiosity build → single CTA → optional P.S. re-angling the
  same CTA.
- **Objections:** "Why is this in my inbox?" (must connect to what the recipient subscribed
  for); "Is this spam or hype?" (no manipulative urgency, no invented claims); "What exactly do
  I get if I click?" (concrete, specific promise).
- **Desired progression:** Open the email, read to the CTA, click through to the offer page.
- **Monetization contribution:** The affiliate-conversion stage of the funnel: email capture has
  already happened upstream; this email converts list trust into offer clicks. Conversion on the
  offer page itself is outside the email's control.
- **Model guidance:** (verbatim in the registry — the one field Instruction Generation consumes)
  one offer, one topic, one CTA; honest curiosity-driven subject free of spam-pattern phrasing;
  preview complements rather than repeats; short `\n\n`-separated paragraphs, second person;
  never invent prices, discounts, guarantees, deadlines, testimonials, or statistics — absent
  facts must not be implied; CTA label is specific action phrasing; optional one-sentence P.S.
  re-angling the same CTA.

## Production quality standards (owner review, 2026-07-19)

Adopted after the first live end-to-end run (REFRESH + 3 variants of the GR3 "Psychic Message"
winner). These are Strategy Layer curation — encoded verbatim in the registry's `modelGuidance`
and `modeGuidance`; this section is their authored home.

**The success test:** every returned email should make the owner feel *"I would confidently
send this"* — never *"this is decent AI copy."* The standard is professional affiliate email
marketing. Clicks are primary; beautiful prose is secondary.

**Kept from the first run:** preserving historical winning mechanisms and emotional engines,
explaining changes, controlled A/B variants, crafted preheaders, escalating second CTAs.

**Quality rules added:**

1. **Word discipline** — no leaning on signature words (an atmospheric word used more than
   twice reads as AI); repetition only when the winning mechanism depends on it.
2. **Emotional variety** — one primary emotional engine per email, chosen from the style
   library below; deliberately different from recently used engines.
3. **Pacing** — alternate short/long sentences; sequence curiosity → emotion → CTA; never one
   poetic rhythm throughout.
4. **Reduce "AI poetry"** — clarity over ornament; natural writing converts better than
   beautiful writing; cut sentences that exist only to sound beautiful.
5. **Every CTA earns itself** — each CTA introduces a NEW reason to click; first = core
   curiosity, second = escalation (proof / objection handled / what stays unknown), P.S. = a
   different final angle.
6. **Variants test ONE hypothesis** — never blend two psychological mechanisms in one variant;
   otherwise the test result attributes to nothing.
7. **Production-ready only** — no placeholders, no filler, nothing that couldn't be sent as-is.

## Emotional engine style library (internal)

A classification used inside the Strategy Layer to prevent style fatigue — **not exposed in
output** unless a requested section explicitly asks for it:

Mystery · Coincidence · Recognition · Validation · Warning · Hope · Relief · Anticipation ·
Unexpected discovery · Destiny · Transformation · Comfort

**Statelessness convention:** the service cannot remember which engines past campaigns used
(ADR-0002). To rotate engines across campaigns, EmailOps supplies either recent reference
emails (the model detects their dominant engine and avoids it) or an explicit list in
`context.recentEmotionalEngines` (e.g. `["mystery", "destiny"]`). Absent both, the model simply
picks the engine that best fits the objective — variety across campaigns is only guaranteed
when the caller supplies that context.

## Output Layer

Schema `promotional-email-v1`:

| Field | Required | Notes |
|---|---|---|
| `subjectLine` | ✅ | Honest to the body's actual content |
| `previewText` | ✅ | Inbox snippet; complements the subject |
| `body` | ✅ | Multi-paragraph, `\n\n`-joined (flat-string-map convention, validation report G-3) |
| `ctaLabel` | ✅ | Text only — EmailOps wraps it in the tracked link |
| `postscript` | optional | One sentence, same CTA, different angle |

## What stays with EmailOps (never this service)

Sending, list segmentation, send timing, from-name/reply-to, the affiliate link URL and
tracking parameters, unsubscribe mechanics and the compliance footer (CAN-SPAM et al. —
fixed compliance copy, same reasoning as the affiliate disclosure in the Soulmate Message
validation), suppression handling, and deliverability. The Content Agent returns text
fields only.

## Example request (EmailOps → Content Agent)

```jsonc
{
  "requestId": "…",
  "consumer": "emailops",
  "contentType": "promotional-email",
  "businessModel": {
    "primaryRevenueStream": "affiliate_marketing",
    "secondaryRevenueStreams": ["email_list_monetization"]
  },
  "primaryObjective": { "type": "improve_affiliate_click_through_rate" },
  "secondaryObjectives": [{ "type": "build_trust", "note": "Protect list trust — no hype" }],
  "targetAudience": "Subscribers who opted in for free astrology readings",
  "desiredAction": "Click the CTA through to the affiliate offer page",
  "sections": [
    { "key": "subjectLine", "description": "Curiosity-driven subject, honest to the body", "required": true },
    { "key": "previewText", "description": "Inbox preview complementing the subject", "required": true },
    { "key": "body", "description": "Short body, \\n\\n paragraphs, one idea, one CTA", "required": true },
    { "key": "ctaLabel", "description": "Specific action phrasing for the offer link", "required": true },
    { "key": "postscript", "description": "One-sentence P.S. re-angling the same CTA", "required": false }
  ],
  "context": {
    "brandName": "…",
    "offerName": "…",
    "offerPromise": "…",              // the one concrete thing the reader gets by clicking
    "subscriberRelationship": "…"     // what the recipient originally subscribed for
  },
  "tone": "warm, personal, curious; never hypey"
}
```

Campaign-to-campaign variation is *entirely* in `context`, `targetAudience`, `tone`, and
`constraints` — the template and schema stay fixed.
