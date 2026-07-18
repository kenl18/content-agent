# Homepage Template — Product Content Design (AstrologyManifest)

Status: **Design exercise, not implemented.** No code changes result from this document. This
follows [docs/reference-site-analysis-method.md](../reference-site-analysis-method.md), applied
to `individualogist.com` as the first reference site. Nothing here copies its wording — only its
underlying structural and psychological patterns, generalized and then re-applied to
AstrologyManifest's own tools and funnel. Each section in Part 4 is written as a
**Strategy Layer** (the durable asset — see
[ADR-0014](../decisions/0014-templates-as-two-layer-playbooks.md)) followed by a minimal
**Output Layer** note; the Strategy Layer, not the schema shape, is this document's real content.

---

## Part 1 — Reverse-engineering individualogist.com

What follows describes *structure and mechanism*, never their specific copy, quiz names, or
testimonial content.

### Information architecture & page hierarchy

The page is built as a single hub with escalating depth: hero → one flagship interactive hook →
a sequence of secondary engagement mechanisms, each different in kind → trust proof → conversion
close → ongoing-value ask (newsletter). Navigation submenus expose the same deep content
(archetypes, tarot spreads, compatibility variants) that the homepage only samples — the homepage
is a *tour*, not the full catalog.

### Section sequencing logic

The order is not arbitrary. It follows a classic attention → identity → value → trust →
commitment arc:

1. **Attention/identity hook** (hero + quiz pitch) — draws the visitor in with a promise about
   *them*, not about the product.
2. **Value sampling** (horoscope, tarot, compatibility) — lets the visitor experience something
   real before being asked for anything.
3. **Trust reinforcement** (authority claim, testimonials) — arrives *after* value has been
   demonstrated, not before.
4. **Commitment ask** (final CTA, newsletter) — arrives last, when accumulated trust and
   demonstrated value make the ask feel earned rather than presumptuous.

### Trust-building mechanics

Two distinct techniques, used together: a quantified authority claim ("more than N people
trust..."), and named, specific testimonials (first name, profession, short outcome-based quote).
The specificity is what does the work — a vague claim ("people love us") is far less persuasive
than an attributed, concrete one. Both are placed mid-to-late page, after value, not at the top.

### Engagement flow

Not one engagement mechanism — several, each exploiting a different psychological hook:
a self-discovery quiz (identity/curiosity), a daily-refreshing horoscope block
(habit-loop/recurrence), a card-reveal tool (curiosity gap via suspense), and a compatibility
test (relationship anxiety/curiosity, a near-universal concern). Offering multiple *different*
hooks means a visitor unmoved by one is still likely caught by another — this is what actually
drives pages-per-session, not any single mechanism alone.

### Conversion psychology

- **Commitment/consistency**: a free, immediate, low-effort quiz gets the visitor to invest
  effort before any ask is made, which primes receptiveness to a later ask.
- **Curiosity gap**: the tarot "tap to reveal" mechanic is built entirely around suspense before
  payoff.
- **Specificity heuristic**: testimonials work because they're concrete (named person,
  profession, specific outcome), not generic praise.
- **Bookending**: the closing CTA restates and intensifies the *same* core promise the hero
  opened with, delivered once trust and value have accumulated — not a new pitch, a returned one.
- **Habit formation**: daily-refreshing content (horoscope) gives a legitimate, non-manipulative
  reason to return tomorrow, compounding pageviews over time rather than relying on a single
  visit to do all the work.

### CTA placement

CTAs appear at multiple points, each pitched at a different commitment level: a low-commitment
quiz CTA up top, secondary tool CTAs at natural sampling points, and a high-commitment newsletter
ask that arrives last and is framed around a specific recurring benefit ("personalized daily,
weekly, monthly horoscopes"), not a generic "subscribe."

### Content depth

Section-level copy is short and scannable — headlines, one-line descriptions, brief feature-box
text. Depth is reserved for a separate content type entirely: long-form articles, which exist
specifically because *that's* where SEO ranking depends on substance, not the homepage.

### SEO strategy

Two distinct surfaces cover two distinct kinds of search intent: interactive tools capture
transactional/tool-seeking intent ("compatibility test," "daily horoscope"), while the articles
section captures informational intent that no tool answers ("what is [topic]," "meaning of
[topic]"). Together they cover far more keyword space than either alone. Expandable nav submenus
also function as an internal-linking structure, spreading link equity to deep pages, not just
convenience UX.

### User journey

Cold organic visitor → drawn in by an identity-relevant hook (not a feature list) → samples one
or two free interactive tools → encounters quantified trust + specific testimonials once they've
already formed a positive impression → is asked, once, for something (email) — with a second,
context-appropriate ask (newsletter) if they scroll to the very end.

---

## Part 2 — Reusable principles (brand-agnostic)

Extracted from the above, stated generally enough to apply to any content/tools business, not
just astrology sites:

1. **Lead with an identity or self-relevance hook, not a feature description.** "What does this
   say about *me*" outperforms "here's what our product does."
2. **Sequence commitment low → high.** A free, immediate, zero-risk action should come before any
   ask (email, purchase, deeper signup).
3. **Offer several distinct engagement mechanisms, not one.** Different hooks (curiosity,
   habit/recurrence, identity, relationship-relevance) catch different visitors; redundancy here
   increases the percentage of visitors who engage with *something*.
4. **Recurring/time-bound content builds habit loops.** Content that's legitimately different
   tomorrow gives a real reason to return, compounding pageviews rather than depending on a single
   session.
5. **Place trust signals after value, not before.** A trust claim made before anything has been
   demonstrated reads as generic marketing; the same claim made after reads as confirmation.
6. **Specificity beats vagueness in trust content.** Attributed, concrete claims outperform vague
   praise — but this only applies to *genuine* trust content (see the hard boundary below).
7. **Bookend the page.** Close with a restatement/intensification of the opening promise, once
   trust and value have accumulated — not a fresh, unrelated pitch.
8. **Keep homepage/hub sections short; reserve depth for a separate content surface.** Scannable
   copy at the hub level, substantive long-form copy at the article level — don't blend the two.
9. **Cover both transactional and informational search intent, via different content surfaces.**
   Tools/calculators serve one; articles serve the other.
10. **Ask for commitment (email, etc.) more than once, each time tied to a specific, concrete
    benefit** rather than repeating one generic ask.

## Part 3 — Applying these principles to AstrologyManifest

Comparing these principles against what's actually live at `tools.astrologymanifest.com` today
surfaces concrete gaps — not aesthetic ones, funnel ones:

| Principle | Current state | Gap / opportunity |
|---|---|---|
| Identity hook first | Hero reads "✦ Free Astrology Tools ✦ / Manifest Clarity, One Chart at a Time" — feature-framed | Reframe around self-discovery ("what your chart says about you"), which several existing tools (Birth Chart, Zodiac Personality) already deliver on substantively |
| Low→high commitment sequencing | All 19 tools presented flat, at once | A full 19-item grid up front is a choice-paradox risk; consider surfacing one flagship low-commitment tool before the full grid |
| Multiple distinct hooks | Already true in the *catalog* (chakra quiz = self-improvement, spirit animal = identity, lucky number = fortune/curiosity, affirmation generator = motivational) | Currently flattened into one undifferentiated grid — the variety exists but isn't sequenced or surfaced |
| Habit-loop/recurring content | Daily Horoscope and Daily Intention already exist as tools | Neither is *featured* — both are grid items, not a promoted "today's ___" spotlight the way a habit-loop mechanic needs to be visible to work |
| Trust signals after value | None present anywhere on the page | Clear, concrete gap — even a simple, real, quantified trust statement (once a real number exists) is currently missing entirely |
| Testimonials | None present | Same gap — and must be sourced from real users, never generated (see hard boundary below) |
| Bookended CTA | Only one CTA exists, at the top; nothing closes the page | Clear structural gap — add a closing CTA that restates the opening hook, once tools have been sampled |
| Multiple, benefit-specific asks | Single generic ask ("Send Me My Reading") | Could be strengthened by tying to a specific recurring benefit, and by adding a second ask at the page's end |
| SEO surface: tools vs. articles | Homepage has zero article/blog surface (a separate blog subdomain exists but isn't linked from here) | Opportunity to surface blog content on the tools homepage, capturing informational intent this page currently doesn't touch |
| Scannable hub copy | Existing tool descriptions are already ≤10 words — good discipline | Preserve this for any new section; do not let new sections drift long-form |

---

## Part 4 — Homepage sections as Strategy Layer + Output Layer

Per [ADR-0014](../decisions/0014-templates-as-two-layer-playbooks.md), each section below is
written as its future template's **Strategy Layer** first — the durable, curated reasoning that
should improve over time and is this exercise's actual deliverable — followed by a compact
**Output Layer** note (schema shape), which is comparatively disposable and will be revised far
more casually than the reasoning above it.

As established previously, the frozen architecture gives one `primaryObjective` per request
([ADR-0006](../decisions/0006-business-objective-model.md)), so each section below is its own
`contentType`, independently requested and assembled by Website Builder into one page — that
structural point still stands and is restated at the end for your sign-off; it isn't being
relitigated here.

### A. Hero

- **Business purpose:** Earn the next ten seconds. An SEO visitor who arrived searching "free
  birth chart" has zero established trust in this brand yet; the hero's entire job is to signal
  relevance and credibility before anything else is asked of them.
- **Visitor psychology:** Self-relevance/identity bias — people pay far more attention to content
  that promises insight about *them* specifically than to a product description.
- **Conversion reasoning:** A visitor who doesn't feel "seen" in the first few seconds bounces
  before any funnel stage downstream gets a chance to act on them.
- **Reference principles:** Part 2 principle 1 (identity hook over feature description); principle
  7 (bookending — this section is what Final CTA will later restate).
- **Information hierarchy:** Stage 1 (attention/identity) of the arc in Part 1 — first thing seen,
  sets expectation for everything after.
- **Objections:** *"Is this another generic/spammy astrology site?"* — addressed by specific,
  credible, non-hyperbolic language rather than an overpromising headline.
- **Desired user progression:** Keep scrolling into the engagement sections.
- **Monetization contribution:** Indirect on every stage — a failed hero means zero downstream
  engagement, RPM, email capture, or affiliate conversion; it's the gate everything else passes
  through.
- **Guidance for future AI models:** Write headline/subheadline around who the visitor is
  (identity/self-discovery framing), not what the product is. Avoid generic "free tools" framing.
  Stay credible, not hyperbolic.

**Output Layer:** `homepage-hero` / `homepage-hero-v1` — `headline`, `subheadline`, `introBody`,
`ctaLabel`.

### B. Lead Capture Bar

- **Business purpose:** Capture the visitor who won't scroll further — the earliest possible
  email-capture moment.
- **Visitor psychology:** Low-friction reciprocity — a free, specific, low-effort exchange (email
  for a reading) feels safe when it doesn't feel gating.
- **Conversion reasoning:** Positioned immediately after the hero, before any hard commitment is
  asked, it catches visitors at the moment credibility just started forming and before they've
  decided whether to invest further.
- **Reference principles:** Principle 10 (benefit-specific, repeated asks); this section is the
  deliberate early exception to "ask after value" (Part 1) — it's designed to be a low-cost,
  easy-to-ignore ask, not the page's hard sell.
- **Information hierarchy:** Still stage 1/early stage 2 — appears before any tool has actually
  demonstrated value.
- **Objections:** *"Will I get spammed?" / "What do I actually get?"* — addressed by tying the ask
  to one specific, concrete deliverable, never a vague "join our newsletter."
- **Desired user progression:** Submit email now, or scroll past comfortably without feeling
  blocked.
- **Monetization contribution:** Directly serves email capture; indirectly enables downstream
  affiliate conversion via a future nurture sequence (EmailOps' domain, not this page's).
- **Guidance for future AI models:** Tie the ask to one concrete, specific benefit. Keep it short.
  It must read as optional, never gating.

**Output Layer:** `homepage-lead-capture` / `homepage-lead-capture-v1` — `formHeading`,
`supportingText`, `ctaLabel`.

### C. Tools Grid

- **Business purpose:** Convert passive SEO arrivals into active users — AstrologyManifest's core
  engagement engine.
- **Visitor psychology:** Variety-of-hooks — different visitors respond to different angles
  (self-improvement, identity, curiosity/fortune, motivation); offering many increases the odds
  any given visitor finds one relevant.
- **Conversion reasoning:** Every tool click is a pageview and an ad impression; repeated tool use
  within a session is what makes pages-per-session and RPM real rather than aspirational.
- **Reference principles:** Principle 3 (multiple distinct engagement mechanisms).
- **Information hierarchy:** Stage 2 (value sampling) — the visitor's first real interaction with
  the product, right after the identity hook has earned attention.
- **Objections:** *"Is this going to ask for payment or a credit card?"* — addressed by
  descriptions that clearly signal free, no-commitment access.
- **Desired user progression:** Click into at least one tool.
- **Monetization contribution:** The single biggest lever on the page for engagement and RPM;
  indirectly builds the trust the later email ask depends on.
- **Guidance for future AI models:** One line per tool, benefit-framed, ~10 words max. Vary the
  psychological angle across adjacent cards rather than repeating the same hook.

**Output Layer:** `homepage-tools-grid` / `homepage-tools-grid-v1` — `heading` + one description
per tool card (Website Builder supplies the tool catalog as `sections`).

### D. Featured Daily Content Block

- **Business purpose:** Promote an existing but under-surfaced asset (Daily Horoscope/Intention)
  into the page's habit-loop mechanic.
- **Visitor psychology:** Habit formation via time-bound content — the same mechanic as daily
  puzzles or horoscope apps: a legitimate reason to return tomorrow.
- **Conversion reasoning:** A single session can only do so much; recurring visits compound RPM
  and retention far beyond what any one-time visit delivers.
- **Reference principles:** Principle 4 (recurring/time-bound content builds habit loops).
- **Information hierarchy:** Stage 2, alongside the Tools Grid as a second, distinct sampling
  opportunity.
- **Objections:** *"Is this actually updated, or static content pretending to be fresh?"* —
  addressed by genuinely date/sign-driven copy, regenerated per call, not reused verbatim.
- **Desired user progression:** Read today's excerpt, click through to the full horoscope, or form
  a habit of checking back tomorrow.
- **Monetization contribution:** Directly matches high-frequency, time-sensitive search intent
  (SEO); compounds RPM over time via repeat visits more than any other section on the page.
- **Guidance for future AI models:** Write as if today specifically matters — reference the
  supplied date/sign directly. Never write generic, date-agnostic horoscope filler.

**Output Layer:** `homepage-daily-spotlight` / `homepage-daily-spotlight-v1` — `heading`,
`subheading`, `todayExcerpt`, `ctaLabel`; date/sign supplied as request `context`, never invented.

### E. Compatibility / Relationship Spotlight

- **Business purpose:** Broaden the visitor base beyond people who already self-identify as "into
  astrology," via a near-universal hook.
- **Visitor psychology:** Relationship-compatibility curiosity/anxiety — a concern most people
  have regardless of astrology interest.
- **Conversion reasoning:** A second, distinct hook catches visitors the Tools Grid's framing
  didn't register with.
- **Reference principles:** Principle 3 (multiple distinct hooks); principle 9 (covering distinct
  search intent).
- **Information hierarchy:** Stage 2, a parallel value-sampling opportunity alongside the Tools
  Grid and Daily Spotlight.
- **Objections:** *"Is this actually about MY relationship, or generic?"* — addressed by framing
  tied to a real relationship type (partner, friendship, coworker), not abstract theory.
- **Desired user progression:** Try the compatibility tool.
- **Monetization contribution:** Same mechanism as the Tools Grid — more tool visits, more
  impressions — plus matches compatibility-specific search queries the grid doesn't.
- **Guidance for future AI models:** Frame around relationship-specific curiosity/anxiety, not
  generic compatibility theory.

**Output Layer:** `homepage-compatibility-spotlight` / `homepage-compatibility-spotlight-v1` —
`heading`, `description`, per-variant `label` + `description`.

### F. Trust & Authority

- **Business purpose:** Close AstrologyManifest's clearest current gap — nothing on the page today
  signals anyone else trusts it.
- **Visitor psychology:** Social proof / specificity heuristic — a quantified, specific claim
  persuades where vague praise doesn't, but only once value has already been demonstrated;
  unearned trust claims read as generic marketing.
- **Conversion reasoning:** Placed after tool sampling, this reduces skepticism right before the
  page's strongest ask — sequencing is what makes the same claim land here vs. ring hollow at the
  top of the page.
- **Reference principles:** Principle 5 (trust after value, not before); principle 6 (specificity
  beats vagueness — bounded by the hard boundary below).
- **Information hierarchy:** Stage 3 (trust reinforcement) — deliberately after stage 2's
  value-sampling sections, before stage 4's commitment ask.
- **Objections:** *"Is this trust claim even real?"* — addressed by requiring the figure be a
  real, supplied fact, never invented or creatively rounded.
- **Desired user progression:** Arrive at Final CTA with reduced skepticism.
- **Monetization contribution:** Indirect — primes the visitor for the ask that follows; reduces
  bounce/hesitation rather than driving pageviews itself.
- **Guidance for future AI models:** Use the exact supplied trust figure verbatim. Never imply a
  number that wasn't explicitly given, and never generate testimonial-style content in this
  section (see the hard boundary below).

**Output Layer:** `homepage-trust-authority` / `homepage-trust-authority-v1` — `trustHeadline`
(must incorporate supplied `context.trustedByCount`), three `heading` + `body` benefit blurbs.

**Hard boundary retained:** the specificity heuristic that makes trust content work only applies
to genuine trust content. This section must never contain fabricated names, professions, or
quotes — only real, supplied statistics.

### G. Testimonials — excluded

Unchanged from the prior pass: real customer testimonials are factual claims about real people
and must never be generated. If AstrologyManifest wants this section, it needs a real source of
reviews; the Content Service has no role — Strategy Layer or Output Layer — in producing them.

### H. Final CTA

- **Business purpose:** Bookend the page — AstrologyManifest currently has no closing ask at all.
- **Visitor psychology:** Bookending — restating the opening promise once trust and value have
  accumulated makes it land as a natural conclusion, not a fresh pitch.
- **Conversion reasoning:** This is the moment accumulated trust converts into action — the
  highest-leverage single ask on the page, precisely because everything before it was designed to
  earn it.
- **Reference principles:** Principle 7 (bookending); principle 10 (benefit-specific, repeated
  asks).
- **Information hierarchy:** Stage 4 (commitment ask) — the last section, deliberately.
- **Objections:** *"Why act now instead of later?"* — addressed by restating the specific benefit
  from the hero, not introducing a new, unrelated pitch at the last moment.
- **Desired user progression:** Submit email, or (if the business decides) proceed to an offer.
- **Monetization contribution:** The strongest single lever for whichever objective it's pointed
  at — email capture or affiliate conversion (see open question 3).
- **Guidance for future AI models:** Restate and intensify the hero's core promise. Do not
  introduce a new angle this late in the page.

**Output Layer:** `homepage-final-cta` / `homepage-final-cta-v1` — `headline`, `body`, `ctaLabel`.

### I. Latest Articles (optional)

- **Business purpose:** Second SEO surface — catch informational-intent search traffic no tool
  page answers.
- **Visitor psychology:** Depth-seeking — visitors who've exhausted tool interest but haven't left
  may still want to read.
- **Conversion reasoning:** Extends session depth for a different visitor segment than the Tools
  Grid serves, on entirely different content.
- **Reference principles:** Principle 8 (scannable hub, deep content elsewhere); principle 9
  (covering informational intent).
- **Information hierarchy:** Late stage 2 / into stage 3 — a secondary, lower-priority sampling
  opportunity, not core to the page's main arc.
- **Objections:** *"Is this just more tool marketing?"* — addressed by clearly signaling genuine
  editorial content, not another sales pitch.
- **Desired user progression:** Click through to an article.
- **Monetization contribution:** Its entire purpose is SEO; also extends pageviews/RPM for
  visitors who've exhausted the tools.
- **Guidance for future AI models:** Heading and intro line only — never invent article titles or
  excerpts; that's sourced CMS content, not generated.

**Output Layer:** `homepage-articles-intro` / `homepage-articles-intro-v1` — `heading`, optional
`introLine`, `viewAllCtaLabel`.

---

## What never belongs to the Content Service (unchanged, restated briefly)

Layout, interactive tool logic, images/icons/illustrations, real business facts and figures
(supplied as `context`, never invented), testimonials (never generated, under any framing),
CTA destination routing, and article/testimonial data assembly. Full reasoning for each is in
Part 4 above rather than repeated as a separate table this time.

## Open questions (carried forward, still unanswered)

1. **Multi-`contentType` structure** — still the one structural point requiring your explicit
   sign-off: each section above as its own independently-requested `contentType`, assembled by
   Website Builder.
2. **Which one ships first** — `homepage-hero` (simplest, closest to the existing docs example)
   or `homepage-tools-grid` (closest to the site's actual current engagement engine)?
3. **Where ClickBank conversion actually belongs** — still no obvious on-homepage affiliate
   touchpoint identified in either site studied; likely lives downstream (tool result pages,
   email sequences), unless you want Final CTA (H) to point at an offer directly.
4. **Articles Intro (I)** — worth building now, or deprioritized until blog/CMS integration
   exists?
