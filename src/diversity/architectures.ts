import type { ArchitectureId, ClaimClass, EmotionalEngine, HookFamily, LengthFamily } from "../domain/copy-plan.js";

/**
 * The architecture library (ADR-0018 §3). Each entry is a SHAPE the email can take — not a
 * template: the plan text tells the model what each paragraph must do, never what it says.
 * `fits` gates eligibility; the planner scores the rest against the account's recent ledger.
 */
export interface ArchitectureSpec {
  id: ArchitectureId;
  label: string;
  /** What each paragraph does, in order. Written for the model. */
  plan: string[];
  paragraphs: { min: number; max: number };
  lengthFamilies: LengthFamily[];
  /** Interaction types this shape requires, if any (e.g. a chooser page). */
  requiresInteraction?: ("choose_card" | "enter_email")[];
  /** Claim classes the destination must permit for this shape to be honest. */
  requiresClaims?: ClaimClass[];
  /** The persona may write in the first person in this shape (persona-signed accounts only). */
  firstPerson: boolean;
  /** Engines that suit the shape; others are allowed but scored lower. */
  engines: EmotionalEngine[];
  hook: HookFamily;
  /** Relative base weight when everything is eligible. */
  baseWeight: number;
}

export const ARCHITECTURES: Record<ArchitectureId, ArchitectureSpec> = {
  question_tension_reveal: {
    id: "question_tension_reveal",
    label: "direct question → tension → reveal",
    plan: [
      "Open with ONE direct question the reader can only half answer. No preamble.",
      "Name the tension the question exposes with one concrete detail from the reader's ordinary life.",
      "State plainly what the destination shows about it — the specific thing, not a description of a reading.",
      "CTA: the small action that answers the question."
    ],
    paragraphs: { min: 3, max: 4 },
    lengthFamilies: ["standard", "story"],
    firstPerson: false,
    engines: ["recognition", "mystery", "validation"],
    hook: "question",
    baseWeight: 1
  },
  observation_implication_reveal: {
    id: "observation_implication_reveal",
    label: "observation → implication → reveal",
    plan: [
      "Start with a concrete observation (an object, an hour, a repeated small event) stated as fact, not atmosphere.",
      "Say what that observation implies — one implication, one sentence of consequence.",
      "Say what the destination reveals about that implication, using the page's own terms.",
      "CTA: names the reveal."
    ],
    paragraphs: { min: 3, max: 4 },
    lengthFamilies: ["standard", "story"],
    firstPerson: false,
    engines: ["coincidence", "discovery", "anticipation", "mystery"],
    hook: "object_image",
    baseWeight: 1
  },
  short_personal_note: {
    id: "short_personal_note",
    label: "short personal note",
    plan: [
      "Two or three sentences from the sender to one reader. One fact, one reason it matters today.",
      "CTA in the sender's own words. Nothing else."
    ],
    paragraphs: { min: 1, max: 3 },
    lengthFamilies: ["short_note"],
    firstPerson: true,
    engines: ["comfort", "anticipation", "relief", "hope"],
    hook: "direct_you",
    baseWeight: 0.9
  },
  story_fragment_unresolved: {
    id: "story_fragment_unresolved",
    label: "story fragment → unresolved line → CTA",
    plan: [
      "Begin mid-scene: a specific moment already in motion (who, where, what object). Past tense.",
      "Let it develop one beat — something changes or is noticed.",
      "Stop on the line that is not resolved. Do not explain it.",
      "CTA: the place where that line resolves, in the destination's own terms."
    ],
    paragraphs: { min: 3, max: 5 },
    lengthFamilies: ["story", "long_form"],
    firstPerson: true,
    engines: ["mystery", "anticipation", "destiny", "coincidence"],
    hook: "event_past_tense",
    baseWeight: 0.9
  },
  interaction_invitation: {
    id: "interaction_invitation",
    label: "interaction / choose-a-card invitation",
    plan: [
      "Describe the actual mechanic the page offers (a spread, a card to choose, what appears after) as a small act the reader performs.",
      "One reason the choice matters today — grounded, not mystical filler.",
      "CTA: the act itself (choose / turn / pick), never 'visit'."
    ],
    paragraphs: { min: 2, max: 4 },
    lengthFamilies: ["short_note", "standard"],
    requiresInteraction: ["choose_card"],
    requiresClaims: ["card_choice"],
    firstPerson: false,
    engines: ["anticipation", "discovery", "coincidence"],
    hook: "instruction",
    baseWeight: 1.1
  },
  pattern_recognition_relevance: {
    id: "pattern_recognition_relevance",
    label: "pattern recognition → personal relevance",
    plan: [
      "Name a pattern the reader would recognise in their own behaviour, with one concrete instance (a habit, a time of day, a thing they re-read).",
      "Say why that pattern tends to mean something — briefly, plainly.",
      "Say what the destination adds that the reader cannot see alone.",
      "CTA: names that addition."
    ],
    paragraphs: { min: 3, max: 4 },
    lengthFamilies: ["standard", "story"],
    firstPerson: false,
    engines: ["recognition", "validation", "comfort"],
    hook: "direct_you",
    baseWeight: 1
  },
  explanatory_authority_note: {
    id: "explanatory_authority_note",
    label: "explanatory / authority note",
    plan: [
      "State what this kind of reading actually looks at, in one calm sentence, as someone who does this work.",
      "Explain the one mechanism that makes it useful — a real distinction, not a promise.",
      "Say what the reader gets from it today, concretely, in the page's terms.",
      "CTA: plain, service-like."
    ],
    paragraphs: { min: 3, max: 4 },
    lengthFamilies: ["standard"],
    firstPerson: false,
    engines: ["validation", "comfort", "discovery"],
    hook: "observation_statement",
    baseWeight: 0.7
  },
  sparse_alert: {
    id: "sparse_alert",
    label: "sparse one-paragraph alert",
    plan: [
      "One paragraph. What exists for the reader, why today, the action. Under 60 words. No second beat, no explanation."
    ],
    paragraphs: { min: 1, max: 1 },
    lengthFamilies: ["short_note"],
    firstPerson: false,
    engines: ["anticipation", "discovery"],
    hook: "fragment",
    baseWeight: 0.6
  },
  reflective_letter: {
    id: "reflective_letter",
    label: "reflective letter",
    plan: [
      "Open on something the sender noticed this week — one specific thing, in their own voice.",
      "Reflect on it honestly for two short paragraphs: what it tends to mean, what it does not.",
      "Turn to the reader: how this applies, without claiming to know their situation.",
      "Say what the destination holds for them, in the page's terms.",
      "CTA in the sender's voice, unhurried."
    ],
    paragraphs: { min: 4, max: 6 },
    lengthFamilies: ["long_form"],
    firstPerson: true,
    engines: ["comfort", "hope", "transformation", "validation"],
    hook: "practitioner_first_person",
    baseWeight: 0.6
  },
  observation_unanswered_question: {
    id: "observation_unanswered_question",
    label: "concrete observation → unanswered question",
    plan: [
      "A concrete observation, stated flat: a thing that happened, an object, a count where the page supports one.",
      "The question it leaves open — asked once, not answered.",
      "What the destination answers, named precisely and truthfully.",
      "CTA: the answer's name."
    ],
    paragraphs: { min: 3, max: 4 },
    lengthFamilies: ["standard", "story"],
    firstPerson: false,
    engines: ["mystery", "coincidence", "recognition"],
    hook: "observation_statement",
    baseWeight: 1
  }
};

export const ARCHITECTURE_LIST: ArchitectureSpec[] = Object.values(ARCHITECTURES);
