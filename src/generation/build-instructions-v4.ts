import type { ContentRequest } from "../domain/content-request.js";
import type { CopyPlan, LedgerEntry } from "../domain/copy-plan.js";
import type { Template } from "../templates/template.js";
import type { JsonObjectSchema, ModelInstructions } from "../providers/model-provider.js";
import { ANGLES } from "../diversity/angles.js";
import { ARCHITECTURES } from "../diversity/architectures.js";
import { CLAIM_LABELS } from "../diversity/claims.js";
import { LENGTH_FAMILY_SPECS } from "../diversity/length-families.js";
import { renderPackBrief, type DestinationPack } from "../diversity/destination-content.js";
import type { ParsedStrategy } from "../diversity/strategy-parser.js";
import { TICS } from "../diversity/tics.js";
import { renderVoiceContract, type PersonaContract } from "../templates/persona-registry.js";
import { buildOutputSchema } from "./build-instructions.js";

/**
 * Copy System V4 instruction layout (ADR-0018 §13). The creative brief comes first and is
 * short; the hard rules are a compact block the caller's own gate will enforce anyway; every
 * caller rule the parser could not classify is appended verbatim so nothing binding is lost.
 * Outcomes are described, phrasings are not quoted — quoted phrasings are what the model copies.
 */
export interface V4Inputs {
  plan: CopyPlan;
  parsed: ParsedStrategy;
  pack: DestinationPack | null;
  persona: PersonaContract | null;
  recent: LedgerEntry[];
  /** A corrective REVISION block (ADR-0018 §7) when this is a retry of a reviewed draft. */
  revision?: string;
}

const HOOK_DESCRIPTIONS: Record<string, string> = {
  someone_opener: "an unnamed person's act toward the reader, stated as an event",
  event_past_tense: "something that happened, in the past tense, with an object in it",
  object_image: "a concrete object the reader can picture, doing something",
  direct_you: "the reader addressed directly about a feeling or habit they would recognise",
  question: "one real question the reader can only half answer",
  fragment: "a short fragment — three to five words — that withholds the rest",
  instruction: "a small instruction the reader can act on",
  observation_statement: "a flat, specific observation stated as fact",
  practitioner_first_person: "the sender's own observation, first person",
  count_number: "a count the page genuinely supports, stated plainly",
  other: "a concrete particular"
};

const CTA_SHAPES: Record<string, string> = {
  REVEAL_PERSON: "reveal who this points to",
  REVEAL_MESSAGE: "open the message waiting for you",
  REVEAL_CARD: "see what the card showed",
  REVEAL_TIMING: "see which period stands out",
  REVEAL_REASON: "see what is behind it",
  REVEAL_OUTCOME: "see how this resolves",
  SEE_WHAT_CHANGED: "see what changed between you",
  SEE_WHAT_IS_WAITING: "see what is waiting for you",
  CHOOSE_CARD: "choose your card and read its message",
  OPEN_READING: "open your reading"
};

export function buildInstructionsV4(request: ContentRequest, template: Template, v: V4Inputs): ModelInstructions {
  const { plan, parsed, pack, persona } = v;
  const arch = ARCHITECTURES[plan.architecture];
  const angle = ANGLES[plan.angle];
  const family = LENGTH_FAMILY_SPECS[plan.lengthFamily];
  const brand = persona?.brand ?? parsed.brand ?? "the sender";

  // ---------------------------------------------------------------- SYSTEM
  const voice = persona
    ? renderVoiceContract(persona, plan.account)
    : `VOICE — ${brand}. ${parsed.voice ?? "Plain, warm, direct; second person; no hype."} Never write in the first person as a named individual.`;
  const mayLabels = parsed.truth.may.map((c) => CLAIM_LABELS[c]);
  const mayNotLabels = parsed.truth.mayNot.map((c) => CLAIM_LABELS[c]);
  const ctaRule = parsed.cta;
  const styleAvoid = [
    ...TICS.filter((t) => ["em_dash", "not_x_but_y", "not_a_general", "staccato_negation", "the_part_worth", "reading_names", "asserted_specificity", "there_is_opener", "most_some_opener"].includes(t.id)).map((t) => t.label),
    ...(persona?.avoid ?? [])
  ];
  // The words the caller's guard reads as a claim of each forbidden class. Naming them is what
  // stops a "window" or a "who" slipping into copy for a page that offers neither.
  const FORBIDDEN_WORDS: Partial<Record<string, string>> = {
    timing_window: "'window', 'timing', 'turning point', 'the period ahead', 'how soon', 'when it arrives/begins/closes'",
    person: "'who it is', 'who they are', 'their name', 'names them', 'the name of', 'identifies the person'",
    date: "any weekday or month name, 'exact/specific day', 'the day it arrives', 'marked in your reading'",
    number: "'how many', a count of messages/cards/signs/names/days, '(1)', 'exactly two'",
    card_choice: "'choose/pick/tap/select a card', 'which card is yours'",
    sign_choice: "'choose/select your sign'"
  };
  const forbiddenWordLine = parsed.truth.mayNot.map((c) => FORBIDDEN_WORDS[c]).filter(Boolean).join("; ");
  const system = [
    `You write one promotional email at a time for ${brand}, to readers who opted in. The email's only job is one qualified click to a page that genuinely delivers what the email promised. A click bought with a promise the page cannot keep is a loss, not a win.`,
    "",
    voice,
    "",
    `EMAIL SHAPE — ${arch.label.toUpperCase()} · ${family.label} · ${plan.band.min}-${plan.band.max} words counting the preheader and body together · ${plan.paragraphs.min === plan.paragraphs.max ? plan.paragraphs.min : `${plan.paragraphs.min}-${plan.paragraphs.max}`} paragraph${plan.paragraphs.max > 1 ? "s" : ""}.`,
    `Length follows the idea: stop when it is said. ${family.guidance} Never pad to reach a count; never restate the promise to fill space.`,
    ...arch.plan.map((line, i) => `  ${i + 1}. ${line}`),
    "",
    "HARD RULES — the caller rejects any email that breaks one:",
    `  - Promise only what the page delivers. ${mayLabels.length ? `You may refer to: ${mayLabels.join("; ")}.` : "The page's own subject matter is the only promise available."} ${mayNotLabels.length ? `Never claim ${mayNotLabels.join("; ")}.` : ""}${forbiddenWordLine ? ` The caller's guard reads these words as such claims, so do not use them at all, even about the reader's life: ${forbiddenWordLine}.` : ""}`,
    "  - Never invent an event, a deadline, scarcity, a health or body claim, a testimonial, a statistic, or anyone watching or tracking this reader.",
    "  - One idea, said once. Each paragraph adds something the previous ones did not; no atmosphere-only paragraph.",
    `  - This email is from ${brand} only.${parsed.siblingBrands.length ? ` Never name or write as: ${parsed.siblingBrands.join(", ")}.` : ""} Do not write a sign-off, valediction or sender name; end on the final full sentence. No URLs.`,
    "  - The preheader adds a second idea; it never restates the subject.",
    ctaRule
      ? `  - CTA: 3-8 words, under ${ctaRule.maxChars ?? 48} characters, starts with one of ${ctaRule.verbs.join(", ")}; names THIS email's specific payoff with a word from its own subject or body.${ctaRule.bannedLabels.length ? ` Never a generic label such as ${ctaRule.bannedLabels.slice(0, 3).map((b) => `"${b}"`).join(", ")}.` : ""}${!parsed.truth.may.includes("card_choice") ? " Nothing on this page is chosen or tapped, so the CTA is a reveal or an open, never a choice." : ""}`
      : "  - CTA: 3-8 words, a verb and the specific payoff, never a generic label.",
    "",
    "STYLE — these constructions mark copy as machine-written across this estate; use none of them more than once, and most not at all:",
    `  ${styleAvoid.join(" · ")}.`,
    "  Vary sentence length on purpose. Let one paragraph be a single sentence. Be specific by naming things, not by calling them specific.",
    "",
    "OUTPUT — a single JSON object and nothing else. Keys:",
    ...request.sections.map((s) => `  "${s.key}"${s.required ? "" : " (optional)"}: ${s.description}`),
    `  "subjectCandidates": exactly 3 alternatives to "subjectLine", each structurally DIFFERENT from the others and from subjectLine, each with its own "preheader" and a "structure" label from: statement, question, fragment, specific_observation, restrained_curiosity, ellipsis_loop. Every candidate must be true to the body and under 58 characters.`
  ].join("\n");

  // ---------------------------------------------------------------- USER
  const recentAngles = countLabels(v.recent.slice(0, 10).map((e) => ANGLES[e.angle]?.label ?? e.angle));
  const recentArchs = countLabels(v.recent.slice(0, 10).map((e) => ARCHITECTURES[e.architecture]?.label ?? e.architecture));
  const recentSubjects = [...new Set([...plan.avoid.recentSubjects, ...parsed.avoidSubjects])].slice(0, 40);
  const truth = parsed.truth;
  const destinationLines = [
    `DESTINATION — ${pack?.label ?? plan.destination ?? "the linked page"}${plan.destination ? ` (${plan.destination})` : ""}.`,
    truth.headline ? `  Its own headline: "${truth.headline}"` : null,
    truth.button ? `  Its own button: "${truth.button}"` : null,
    truth.interaction ? `  What the reader does there: ${truth.interaction === "choose_card" ? "chooses a card" : truth.interaction === "enter_email" ? "enters an email address to receive the reading" : "reads"}.` : null,
    truth.unverifiedReason ? `  THIS DESTINATION'S TRUTH IS NOT ESTABLISHED (${truth.unverifiedReason}): make no precision claim of any kind.` : null,
    truth.subjectMatter.length ? `  The page's own subject matter: ${truth.subjectMatter.join(", ")}.` : null,
    renderPackBrief(pack)
  ].filter((x): x is string => Boolean(x));

  const user = [
    `READER: ${request.targetAudience}`,
    `DESIRED ACTION: ${request.desiredAction}`,
    request.tone ? `TONE (caller): ${request.tone}` : null,
    "",
    `RECENT HISTORY ON THIS LIST — do not repeat these concepts, whatever the wording:`,
    `  Angles in the last ${Math.min(10, v.recent.length)} sends: ${recentAngles || "none recorded"}.`,
    `  Shapes in the last ${Math.min(10, v.recent.length)} sends: ${recentArchs || "none recorded"}.`,
    plan.avoid.engines.length ? `  Emotional engines used most recently: ${plan.avoid.engines.join(", ")} — use a different one.` : null,
    parsed.recentFrameHistory ? `  Caller's frame history: ${parsed.recentFrameHistory}` : null,
    recentSubjects.length ? `  Recent subjects (never echo or paraphrase): ${recentSubjects.map((s) => `"${s}"`).join(" | ")}` : null,
    "",
    ...destinationLines,
    "",
    "THIS EMAIL'S PLAN:",
    `  Angle — ${angle.label}: ${angle.concept}${angle.caution ? ` ${angle.caution}` : ""}`,
    `  Emotional engine: ${plan.emotionalEngine}. Do not name it in the copy.`,
    `  Hook: ${HOOK_DESCRIPTIONS[plan.hookFamily] ?? plan.hookFamily}.`,
    `  Subject: ${plan.subjectStructure.replace(/_/g, " ")} structure, under 42 characters preferred, never over 58.${plan.avoid.subjectStructures.length ? ` Avoid ${plan.avoid.subjectStructures.join(", ")} — this list has had too many.` : ""}${parsed.loserStructures.length ? ` Measured losers on this estate: ${parsed.loserStructures.join("; ")}.` : ""}`,
    `  CTA intent: ${plan.ctaFamily} (shape like "${CTA_SHAPES[plan.ctaFamily] ?? "open your reading"}", but in this email's own words).`,
    `  The payoff the click delivers: ${plan.promiseType === "reading" ? "the reading itself" : CLAIM_LABELS[(plan.promiseType === "timing" ? "timing_window" : plan.promiseType) as keyof typeof CLAIM_LABELS] ?? plan.promiseType}.`,
    "",
    parsed.preferredFrames.length ? `CALLER'S EVIDENCE PRIORS (what has worked on this estate; priors, not mandates — and this email's planned angle takes precedence): ${parsed.preferredFrames.join("; ")}.` : null,
    request.constraints?.forbiddenPhrases?.length ? `NEVER USE THESE LITERAL WORDS: ${request.constraints.forbiddenPhrases.map((p) => `"${p}"`).join(", ")}.` : null,
    parsed.otherText ? `OTHER CALLER GUIDANCE (binding):\n${parsed.otherText}` : null,
    parsed.retryNote ? `CALLER NOTE: the previous attempt was rejected — ${parsed.retryNote}` : null,
    v.revision ? `\n${v.revision}` : null
  ]
    .filter((x): x is string => x !== null)
    .join("\n");

  const base = buildOutputSchema(request);
  const outputSchema: JsonObjectSchema = {
    ...base,
    properties: {
      ...base.properties,
      subjectCandidates: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            subject: { type: "string", minLength: 8, maxLength: 80 },
            preheader: { type: "string", minLength: 1, maxLength: 140 },
            structure: { type: "string", enum: ["statement", "question", "fragment", "specific_observation", "restrained_curiosity", "ellipsis_loop"] }
          },
          required: ["subject", "preheader", "structure"],
          additionalProperties: false
        }
      }
    },
    required: [...base.required, "subjectCandidates"]
  };
  void template;
  return { system, user, outputSchema };
}

/** Keys the V4 layout adds at the provider boundary that must never reach Response Validation. */
export const V4_INTERNAL_KEYS = ["subjectCandidates"] as const;

function countLabels(labels: string[]): string {
  const m = new Map<string, number>();
  for (const l of labels) m.set(l, (m.get(l) ?? 0) + 1);
  return [...m.entries()].sort((a, b) => b[1] - a[1]).map(([k, n]) => `${k} ×${n}`).join(", ");
}
