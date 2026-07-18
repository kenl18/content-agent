# Engineering Principles

These are the immutable principles of the Content Service. Unlike ADRs (which record a decision
made under current constraints and can be revisited if those constraints change) and
`future-vision.md` (which lists capabilities deliberately deferred, not forbidden), the
principles below are not expected to change as the service evolves. Any proposal that conflicts
with one of these should be treated as a proposal to build a different service, not an extension
of this one.

1. **The Content Service optimizes business outcomes, not writing quality alone.**
   Content is generated to move a measurable business objective — more organic traffic, higher
   RPM, more email captures, better affiliate conversion, more trust, better retention — not
   merely to read well. Quality of prose is in service of the objective, not the goal itself.

2. **The caller owns business strategy.**
   Business objective, target audience, desired action, required sections, and business context
   are always supplied by the caller. The service never decides what a piece of content is
   supposed to achieve.

3. **The Content Service owns language execution.**
   Given a supplied strategy, the service is responsible for turning it into well-formed,
   schema-valid, objective-aligned written content. This is the service's entire craft.

4. **The Content Service never edits consumer repositories.**
   It has no access to and no knowledge of any consumer's file system, codebase, or Astro
   components. It returns data; it does not write files anywhere.

5. **The Content Service never publishes content.**
   Publishing, deployment, and going-live decisions belong entirely to the caller (or whatever
   the caller delegates to, e.g. Website Builder). This service has no publish action.

6. **The Content Service is stateless.**
   No request, response, or generation history persists between calls. Every request is handled
   independently, with no memory of prior requests from any caller.

7. **Every AI response must be validated.**
   Raw model output is never returned to a caller. It is always parsed and validated against the
   resolved output schema before being returned; invalid or malformed model output produces a
   structured error, not a best-effort pass-through.

8. **The service returns structured, schema-driven responses.**
   Both requests and responses are defined by explicit schemas (Zod). Nothing crosses either
   boundary without being validated against one.

9. **The service remains provider-agnostic.**
   Domain, validation, template, and generation logic depend only on a `ModelProvider`
   interface, never on a specific vendor SDK. Exactly one concrete provider is wired up in V1,
   fully swappable without touching the rest of the service.

10. **The core remains transport-independent.**
    The generation pipeline is directly callable and has no dependency on HTTP or any other
    transport. Transports are thin adapters layered on top, never load-bearing for the pipeline's
    correctness.

11. **The Content Service is one execution component within a larger optimization loop — it
    never owns analytics, experimentation, or the decision of what to optimize.**
    A future Analytics/Intelligence Service may one day measure real-world performance and
    decide what's worth trying next, supplying the result as optimization signals in a request.
    This service only ever executes: it consumes whatever business strategy and optimization
    signals a single, self-contained request gives it, and never measures, decides, or learns on
    its own behalf. See [docs/technical-design.md](technical-design.md), "Position within a
    larger optimization loop," and [ADR-0013](decisions/0013-optimization-loop-positioning.md).

12. **Templates are reusable business playbooks, not disposable output schemas.**
    Every production template has two layers with different lifecycles: a **Strategy Layer**
    (business purpose, visitor psychology, conversion reasoning, reference principles,
    information hierarchy, objections, desired user progression, monetization contribution, and
    guidance for future AI models) that accumulates as a permanent, deliberately curated
    knowledge asset; and an **Output Layer** (request schema, response schema, generated content)
    that may change freely with every generation. The Strategy Layer is the service's most
    valuable and longest-lived asset — protect and improve it deliberately; treat the Output
    Layer as disposable by comparison. See
    [ADR-0014](decisions/0014-templates-as-two-layer-playbooks.md).

## Derived corollaries

These follow directly from the principles above and are worth stating explicitly:

- **The service must never invent a business objective or a business model.** If a request
  doesn't specify why a piece of content exists, or how the business makes money (principle 2),
  the correct response is a validation error, never a guessed default (see
  [ADR-0005](decisions/0005-strategy-supplied-not-invented.md),
  [ADR-0006](decisions/0006-business-objective-model.md), and
  [ADR-0012](decisions/0012-business-model-context.md)).
- **The service must remain consumer-neutral.** Optimizing for AstrologyManifest's funnel today
  does not mean AstrologyManifest's funnel is encoded anywhere in this service — business
  objectives are a caller-supplied, general-purpose vocabulary, not a per-consumer special case
  (see [docs/boundaries.md](boundaries.md)).
- **Future optimization capabilities must not compromise these principles to ship.** SEO scoring,
  conversion learning, or any other future module (see [docs/future-vision.md](future-vision.md))
  must be built as an addition that preserves statelessness, validation, provider-agnosticism,
  and transport-independence — not an exception to them.
- **A growing Strategy Layer (principle 12) does not conflict with statelessness (principle 6).**
  The Strategy Layer improves through deliberate, versioned human curation of the template
  registry — the same mechanism the schema registry already uses — never through the service
  automatically learning from request outcomes at runtime. Even once a future
  Analytics/Intelligence Service exists (principle 11), its output informs a content strategist's
  next deliberate edit; it never triggers the service to rewrite its own templates.
