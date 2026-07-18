import type { Template } from "./template.js";

/**
 * Template registry. Each entry's Strategy Layer is authored in docs/templates/*.md (ADR-0014)
 * and kept in sync here — edit both together, deliberately. Strategy Layer text must stay
 * consumer-neutral: business facts (brand names, offers, figures) arrive per-request via
 * `context`, never hardcoded in a template.
 */
const templateRegistry = new Map<string, Template>([
  [
    // Reference template proving the pipeline end-to-end (from the docs' own examples) —
    // not a production content catalog entry.
    "landing-page-hero",
    {
      id: "landing-hero-generic-v1",
      contentType: "landing-page-hero",
      schemaId: "hero-headline-subheadline-v1",
      strategy: {
        businessPurpose:
          "Minimal landing hero whose job is to earn attention and set up the page's desired action.",
        audiencePsychology:
          "A cold visitor deciding within seconds whether the page is relevant; responds to " +
          "self-relevant benefit framing over product description.",
        conversionReasoning:
          "A hero that earns the scroll makes every downstream section possible; one that " +
          "doesn't ends the session before any other objective can act.",
        referencePrinciples: [
          "identity/benefit hook over feature description (docs/templates/homepage.md, Part 2, principle 1)"
        ],
        informationHierarchy: "First section seen; sets expectations for everything below it.",
        objections: ["Is this relevant to what I searched for?"],
        desiredProgression: "Keep reading / scroll into the next section.",
        monetizationContribution:
          "Indirect gate for every downstream funnel stage — engagement, RPM, email capture.",
        modelGuidance:
          "Write a short, benefit-driven headline followed by one supporting subheadline that " +
          "builds curiosity toward the desired action. Frame both around the request's primary " +
          "business objective, interpreted within the supplied business model."
      }
    }
  ],
  [
    // First production template (requested by EmailOps). Deliberately generic across all
    // affiliate campaigns — offer specifics arrive via request context, never here.
    "promotional-email",
    {
      id: "promotional-email-generic-v2",
      contentType: "promotional-email",
      schemaId: "promotional-email-v2",
      strategy: {
        businessPurpose:
          "Convert an opted-in email subscriber into a click on an affiliate offer link. The " +
          "email's one job is the click; the offer page does the selling.",
        audiencePsychology:
          "The recipient already trusts the sender enough to have subscribed, but reads in a " +
          "crowded inbox with seconds of attention. The subject/preview pair wins or loses the " +
          "open; the body must reward that open quickly. Curiosity and self-relevance drive " +
          "opens; a single clear promise sustains reading; hype or friction triggers deletion " +
          "or spam-marking.",
        conversionReasoning:
          "One email, one idea, one CTA. Every added ask or topic dilutes click-through. The " +
          "body opens a specific curiosity gap or names a specific problem the offer resolves, " +
          "then routes all momentum into a single CTA. A P.S. is among the most-read lines in " +
          "an email and gets one final, differently-angled nudge to the same CTA — never a new " +
          "topic.",
        referencePrinciples: [
          "single benefit-specific ask (docs/templates/homepage.md, Part 2, principle 10)",
          "curiosity gap (docs/templates/homepage.md, Part 1, conversion psychology)",
          "specificity beats vagueness (docs/templates/homepage.md, Part 2, principle 6)",
          "owner production-quality review of the first live run, 2026-07-19 (docs/templates/" +
            "promotional-email.md, 'Production quality standards') — word discipline, pacing, " +
            "emotional-engine variety, CTA escalation, single-hypothesis variants"
        ],
        informationHierarchy:
          "Subject + preview text (the open) → opening hook rewarding the open within two " +
          "lines → short value/curiosity build → single CTA → optional P.S. re-angling the " +
          "same CTA.",
        objections: [
          "Why is this in my inbox? (must connect to what the recipient subscribed for)",
          "Is this spam or hype? (no manipulative urgency, no invented claims)",
          "What exactly do I get if I click? (concrete, specific promise)"
        ],
        desiredProgression: "Open the email, read to the CTA, click through to the offer page.",
        monetizationContribution:
          "Affiliate-conversion stage of the funnel: email capture has already happened " +
          "upstream; this email converts list trust into offer clicks. Conversion on the offer " +
          "page itself is outside the email's control.",
        modelGuidance:
          "You are a senior affiliate email copywriter, not a literary author. The success test " +
          "for every email: a professional marketer reads it and thinks 'I would confidently " +
          "send this' — never 'this is decent AI copy'. Clicks are primary; beautiful prose is " +
          "secondary. Clarity beats ornament: cut any sentence that exists only to sound " +
          "beautiful. Write one email for one specific offer using only the facts supplied in " +
          "context. One topic, one core curiosity engine. " +
          "EMOTIONAL ENGINE: choose exactly one primary emotional engine for the email — " +
          "mystery, coincidence, recognition, validation, warning, hope, relief, anticipation, " +
          "unexpected discovery, destiny, transformation, or comfort — whichever best fits the " +
          "objective and audience. If context lists recently used engines, or the supplied " +
          "references clearly share one dominant engine you were not told to preserve, pick a " +
          "different one so campaigns don't feel emotionally identical. Never name this " +
          "classification in any output field unless a section explicitly asks for it. " +
          "PACING: alternate short sentences with long ones; sequence beats as curiosity, then " +
          "emotion, then CTA; never hold one poetic rhythm from start to finish. " +
          "WORD DISCIPLINE: do not lean on a small set of signature words — using any " +
          "atmospheric word (e.g. 'morning', 'quiet', 'stillness', 'energy') more than twice " +
          "reads as AI. Repeat a word or image only when the winning mechanism genuinely " +
          "depends on that repetition. " +
          "CTAs: every CTA must earn itself with a NEW reason to click — never restate the " +
          "same curiosity twice. First CTA: the core curiosity. Second CTA: escalation — a " +
          "proof beat, an objection handled, or what stays unknown if they don't look. P.S.: a " +
          "different final angle on the same action. CTA labels are specific action phrasing, " +
          "never 'click here'. " +
          "Subject line: specific, honest curiosity — never bait the body doesn't pay off, " +
          "free of spam-pattern phrasing (all-caps, currency symbols, 'act now'). Preview text " +
          "complements the subject rather than repeating it. Body: short paragraphs separated " +
          "by \\n\\n, second person, conversational; reward the open within the first two " +
          "lines. Never invent prices, discounts, guarantees, deadlines, testimonials, or " +
          "statistics — if scarcity or deadline facts are not in context, do not imply them. " +
          "Respect every prohibited claim in constraints as a semantic rule, not just literal " +
          "wording. Never include URLs, links, or tracking parameters in any field. Return " +
          "production-ready copy only — no placeholders, no filler, nothing that couldn't be " +
          "sent as-is. " +
          "Field formats when requested: bodySections = blocks separated by a line containing " +
          "only ---, each block starting 'role: ' with roles hook, context, story, proof, " +
          "objection, cta-lead, or ps; textOnlyVersion = the complete ready-to-send plain-text " +
          "email; rationale = short prose explaining the key choices; changesFromReference, " +
          "riskFlags, and testHypotheses = one item per line. testHypotheses must use " +
          "correlational language ('X may correlate with Y — test Z'), never causal claims.",
        modeGuidance: {
          refresh:
            "REFRESH mode: a proven historical email is supplied as reference content. Never " +
            "destroy the winning mechanism — preserve its emotional trigger, curiosity engine, " +
            "and narrative structure, plus every element listed under 'Elements to preserve', " +
            "in spirit, not necessarily verbatim. Improve freshness, readability, pacing, and " +
            "repeat fatigue, plus whatever 'Elements to improve' names. The refresh must read " +
            "as a NEW email to someone who received the original: no reused sentences, and echo " +
            "the original's signature vocabulary at most once — unless the mechanism genuinely " +
            "depends on that exact repetition. Do not change the offer framing or CTA intent. " +
            "If changesFromReference is requested, list every meaningful change, one per line, " +
            "each with a short reason.",
          variant:
            "VARIANT mode: generate exactly the requested number of variants, varying ONLY the " +
            "fields named in the variant request and holding everything else — angle, offer " +
            "framing, CTA intent, structure — constant, including anything named under " +
            "'Elements to preserve' and anything the variant request says to hold. Each variant " +
            "tests exactly ONE psychological hypothesis (e.g. question hook, specificity, " +
            "timing urgency, identity, validation, hope) — never blend two mechanisms in one " +
            "variant, or the test result attributes to nothing. Keep everything not under test " +
            "as close to the base as possible. Variants must be meaningfully different from " +
            "each other and from the reference, not trivial rewordings. If rationale is " +
            "requested, state each variant's single hypothesis. One variant per line in each " +
            "*Variants field (body variants separated by a line containing only ---)."
        }
      }
    }
  ]
]);

export function getTemplateForContentType(contentType: string): Template | undefined {
  return templateRegistry.get(contentType);
}

export function listRegisteredContentTypes(): string[] {
  return Array.from(templateRegistry.keys());
}
