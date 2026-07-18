# ADR-0014: Templates as Two-Layer Business Playbooks (Strategy Layer + Output Layer)

## Status

Accepted — and implemented in code as of the first production template (`promotional-email`,
requested by EmailOps): `src/templates/template.ts` now defines `TemplateStrategy` with the nine
Strategy Layer fields, and only `modelGuidance` is consumed by Instruction Generation at runtime,
as this ADR specified.

## Context

[ADR-0008](0008-template-layer.md) defined `Template` as `{ id, contentType, schemaId,
guidance }` — a single string standing in for "how this kind of content should be structurally
and rhetorically framed." In practice, designing the first real template (Homepage, see
[docs/templates/homepage.md](../templates/homepage.md)) surfaced that this reasoning is much
richer than one string can honestly hold: business purpose, visitor psychology, conversion
reasoning, principles traced back to a reference-site analysis
([docs/reference-site-analysis-method.md](../reference-site-analysis-method.md)), where a section
sits in the page's information hierarchy, anticipated visitor objections, the desired user
progression, and explicit linkage to which funnel stage(s) it serves.

This surfaced a more important realization than any schema detail: **the accumulated strategic
reasoning behind a template — not the generated copy, and not even the output schema — is the
Content Service's most valuable and longest-lived asset.** Copy is regenerated every call. Output
schemas get revised as fields are added or renamed. The reasoning about *why* a section exists and
*how* it's supposed to work on a visitor is what a content strategist spends real effort
developing, and it should accumulate and compound — not get rewritten carelessly every time a
field is renamed, and not be treated as disposable alongside things that actually are disposable.

## Decision

Every production `Template` is explicitly modeled as two layers with different lifecycles:

**Strategy Layer** — durable, curated, versioned business knowledge. Improves deliberately over
time; changes rarely, and only through reviewed edits:

- **Business purpose** — why this section exists at all.
- **Visitor psychology** — what the visitor should think or feel, and which psychological
  mechanism (identity relevance, curiosity gap, commitment/consistency, specificity heuristic,
  habit formation, etc.) is being used.
- **Conversion reasoning** — the causal chain from this content choice to the outcome it's meant
  to produce.
- **Reference principles** — which reusable principle(s) (per
  [docs/reference-site-analysis-method.md](../reference-site-analysis-method.md)) this section's
  design traces back to, and from which reference-site analysis.
- **Information hierarchy** — where this section sits in the overall page/journey sequencing, and
  why that position matters.
- **Objections** — the hesitations a visitor is likely to have at this point, and how the
  section's content should address them.
- **Desired user progression** — what the visitor should do next as a direct result of this
  section.
- **Monetization contribution** — explicit linkage to the funnel stage(s) it serves (SEO,
  engagement, AdSense RPM, email capture, affiliate conversion).
- **Guidance for future AI models** — the operational instructions that Instruction Generation
  (`src/generation/build-instructions.ts`) actually consumes at runtime. This is the one Strategy
  Layer field with a direct runtime consumer; the rest exist to justify and inform it.

**Output Layer** — disposable, regenerated freely, changes on every call:

- The request schema fields (`sections`, `context`, etc., per
  [docs/contracts.md](../contracts.md)).
- The response schema (`schemaId` and its field shape, per
  [domain/schema-registry.ts](../../src/domain/schema-registry.ts)).
- The generated structured content itself.

The Strategy Layer is not new architecture — it's what `Template.guidance` was always meant to
hold (see ADR-0008), made explicit and structured instead of an unstructured string, so it can be
authored deliberately, reviewed, and improved without being confused with the parts of a template
that are genuinely disposable.

## Consequences

- `docs/templates/*.md` documents (starting with `docs/templates/homepage.md`) are the Strategy
  Layer's primary authored home. When a template is implemented, its Strategy Layer content
  populates the `Template` definition in code; the doc and the code should be kept in sync
  deliberately, the same discipline already applied to ADRs and contracts.
- The `Template` type in `src/templates/template.ts` will need a structured Strategy Layer object
  in place of today's single `guidance: string` when the first production template is
  implemented. **This ADR does not make that code change** — it records the decision so the
  change is deliberate when it happens, not incidental.
- Every future production template should have all nine Strategy Layer fields made explicit before
  it's considered ready to implement — a template with only "guidance" written and the rest
  skipped should be treated as incomplete, not merely terse.
- Revising a template's Output Layer (adding a field, renaming a schema) should not require
  revisiting or re-deriving its Strategy Layer — that's precisely the point of separating them.
- This does not conflict with statelessness ([ADR-0002](0002-stateless-synchronous-service.md)):
  the Strategy Layer accumulates through deliberate, versioned human curation — the same
  mechanism the schema registry and template registry already use — never through automatic
  learning from request outcomes. Even once a future Analytics/Intelligence Service exists
  ([ADR-0013](0013-optimization-loop-positioning.md)), its output would inform a content
  strategist's next deliberate edit to the Strategy Layer, not trigger the service to rewrite its
  own templates.

## Alternatives considered

- **Keep `guidance` as a single free-text string** — rejected: undersells its importance, invites
  inconsistent quality across templates, and gives no structural checklist ensuring every
  dimension (objections, progression, monetization linkage, etc.) was actually considered rather
  than skipped.
- **Keep this reasoning only in docs, never in the `Template` the code loads** — rejected: the
  reasoning has to reach Instruction Generation at runtime to matter; a doc no running code reads
  can't do that. The Strategy Layer must live in (or be mechanically derivable into) the code's
  `Template` definition, not only in prose alongside it.
