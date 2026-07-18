# Reference Site Analysis Method

A repeatable workflow for turning a reference website into Content Service templates without
copying its wording or proprietary content. Use this whenever a reference site is supplied for a
new template or a redesign of an existing one.

This method exists because of a specific framing decision: for Version 1, the Content Service
should be *briefed* like an elite conversion copywriter and content strategist would brief a
piece of content — not treated as an autonomous engine that measures and optimizes on its own.
Measuring outcomes is a future Analytics Service's job (see
[ADR-0013](decisions/0013-optimization-loop-positioning.md)); producing the highest-quality
content given a supplied strategy is this service's whole job. The quality of that strategy —
the reasoning about why a section exists, what it should make a visitor think/feel/do, and how it
serves a funnel — is what this method is for capturing, before any schema gets written.

## The eight steps

1. **Reverse engineer the site's content strategy** — not what it says, but why it's arranged
   the way it is: information architecture, page hierarchy, section sequencing, trust-building
   mechanics, engagement flow, conversion psychology, CTA placement, content depth, SEO strategy,
   user journey.
2. **Identify the underlying business and conversion patterns** — what job each section is doing
   in service of a business outcome, independent of the specific niche.
3. **Separate reusable principles from brand-specific implementation** — a principle
   ("sequence trust signals after value is demonstrated, not before") is reusable; a specific
   headline, quiz name, or testimonial is not and must never be copied.
4. **Explain what makes the content effective** — ground each principle in an actual persuasion
   or content-strategy mechanism (commitment/consistency, curiosity gap, specificity heuristic,
   habit loops, etc.), not just a description of what's on the page.
5. **Recommend how those principles should be adapted** to the business at hand — its actual
   product/tool catalog, funnel, and business model, not the reference site's.
6. **Design reusable Content Service templates from those learnings, as two layers** (see
   [ADR-0014](decisions/0014-templates-as-two-layer-playbooks.md)): a **Strategy Layer** —
   business purpose, visitor psychology, conversion reasoning, the specific reference principle(s)
   from steps 2–4 this section traces back to, information hierarchy, anticipated objections,
   desired user progression, and monetization contribution — and an **Output Layer** —
   `contentType`, `schemaId`, and field shape. The Strategy Layer is the durable deliverable of
   this whole exercise; the Output Layer is comparatively disposable and will be revised far more
   often as fields get added or renamed.
7. **Never copy wording or proprietary content** — no headlines, quiz names, testimonial text, or
   distinctive phrasing from the reference site may appear in any template, guidance text, or
   generated output.
8. **Return original content based on the extracted principles** — the Content Service always
   generates AstrologyManifest-specific, original copy; the reference site only ever informs
   *structure and strategy*, never *substance*.

## Where this connects to the architecture

Steps 1–5 are strategy work and produce no code or contract changes — they're the reasoning a
human content strategist would do. Step 6 is where that reasoning becomes concrete: it fills in a
`Template`'s **Strategy Layer** (see
[ADR-0014](decisions/0014-templates-as-two-layer-playbooks.md)), which is the durable, curated
knowledge asset this whole method exists to produce — including the "guidance for future AI
models" field that's actually handed to Instruction Generation and, from there, to the model. In
other words: **the quality of steps 1–5 directly determines the quality of the Strategy Layer a
Template carries, which directly determines how well the model executes the objective it's
given.** This is the mechanism by which "think like an elite copywriter" becomes real, rather than
aspirational — it's encoded in the Template's Strategy Layer, not left to the model's own judgment
at generation time. The Output Layer (schema, field shape) that step 6 also produces is
comparatively disposable — see principle 12 in [docs/principles.md](principles.md).

This method does not change any part of the frozen architecture (`docs/technical-design.md`,
`docs/contracts.md`, the ADRs). It's a content-strategy workflow that feeds the existing
`contentType` → `Template` → `schemaId` mechanism with better-reasoned inputs.
