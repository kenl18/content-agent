import type { AngleId, ClaimClass, CtaFamily, EmotionalEngine, PromiseType } from "../domain/copy-plan.js";

/**
 * Angle families (ADR-0018 §4) — the CONCEPT an email pitches, independent of wording. "Someone
 * is thinking about you" and "a person has you on their mind" are one angle. Each angle names
 * the claim classes the destination must permit for the pitch to be truthful, so the planner
 * can never choose an angle the promise contract forbids.
 */
export interface AngleSpec {
  id: AngleId;
  label: string;
  /** One sentence the model is given as the concept to execute freshly. */
  concept: string;
  requiresClaims: ClaimClass[];
  /** Any one of these permits the angle (used where a page supports several soft classes). */
  requiresAnyClaims?: ClaimClass[];
  promiseType: PromiseType;
  ctaFamilies: CtaFamily[];
  engines: EmotionalEngine[];
  /** Detector for classifying arbitrary copy (subject + preheader + body) into this angle. */
  detect: RegExp;
  /** Relative base weight when everything is eligible. Lower for angles the estate over-uses. */
  baseWeight: number;
  /** A claim shape the angle must avoid even where its class is allowed. */
  caution?: string;
}

export const ANGLES: Record<AngleId, AngleSpec> = {
  someone_thinking_of_you: {
    id: "someone_thinking_of_you",
    label: "an absent person's attention",
    concept: "Someone the reader knows has been holding them in mind — an act the reader cannot see, already happening.",
    requiresClaims: ["person"],
    promiseType: "person",
    ctaFamilies: ["REVEAL_PERSON", "SEE_WHAT_CHANGED"],
    engines: ["mystery", "anticipation", "recognition"],
    detect: /\b(someone|somebody|a person|they)\b[^.]{0,80}\b(thought (about|of) you|thinking (about|of|toward) you|on (their|someone's) mind|has you on|almost (reached|said|called|wrote)|paused before|kept you|circled back|thought of calling)\b/i,
    baseWeight: 0.6
  },
  message_waiting: {
    id: "message_waiting",
    label: "a message that already exists",
    concept: "A message for the reader already exists — held, unopened or unsent — and the click is the act of finally reading it.",
    requiresClaims: ["message"],
    promiseType: "message",
    ctaFamilies: ["REVEAL_MESSAGE", "SEE_WHAT_IS_WAITING"],
    engines: ["anticipation", "mystery", "hope"],
    detect: /\b(message|letter|note|line|words?)\b[^.]{0,60}\b(waiting|held|kept|unopened|unsent|never sent|unread|set aside|ready)\b|\b(held back|kept back|never pressed send)\b/i,
    baseWeight: 0.7
  },
  named_person_reveal: {
    id: "named_person_reveal",
    label: "the reading identifies who",
    concept: "The destination identifies a specific person — the reader learns WHO, not a type.",
    requiresClaims: ["person"],
    promiseType: "person",
    ctaFamilies: ["REVEAL_PERSON"],
    engines: ["mystery", "discovery", "validation"],
    detect: /\b(names? (the|a|this|that) person|names (who|them|him|her)|reveal(s)? who|who (it|this) (is|points to)|identif(y|ies) (a|the) (specific )?person|the (identity|name) of)\b/i,
    baseWeight: 0.6
  },
  past_connection_returns: {
    id: "past_connection_returns",
    label: "a past connection resurfacing",
    concept: "Someone from the reader's past has resurfaced — unfinished on at least one side — and the reading concerns that person.",
    requiresClaims: ["person"],
    promiseType: "person",
    ctaFamilies: ["REVEAL_PERSON", "SEE_WHAT_CHANGED", "REVEAL_MESSAGE"],
    engines: ["recognition", "mystery", "hope"],
    detect: /\b(past lover|from your past|old flame|ex\b|former|unfinished|never (got|had) a (proper )?(close|goodbye|ending)|came back|circl(ed|ing) back|returned|resurfac)/i,
    baseWeight: 0.7
  },
  future_arrival: {
    id: "future_arrival",
    label: "someone approaching",
    concept: "A person not yet met is moving toward the reader; the reading concerns that arrival.",
    requiresClaims: ["person"],
    promiseType: "person",
    ctaFamilies: ["REVEAL_PERSON", "REVEAL_OUTCOME"],
    engines: ["hope", "anticipation", "destiny"],
    detect: /\b(not yet met|about to (meet|arrive)|getting closer|is coming|on (their|the) way|future soulmate|soulmate (is|has)|dreamed of you|before you meet)/i,
    baseWeight: 0.8
  },
  hidden_reason: {
    id: "hidden_reason",
    label: "the reason behind a pattern",
    concept: "Something keeps happening to the reader, and the destination explains WHY — the reason is the payoff.",
    requiresClaims: ["reason"],
    promiseType: "reason",
    ctaFamilies: ["REVEAL_REASON"],
    engines: ["recognition", "relief", "discovery"],
    detect: /\b(the reason (behind|it|this|why)|why (it|this|that) (keeps|happens|happened|returns|shows up)|what('s| is) behind (it|this)|explains? why)\b/i,
    baseWeight: 0.9
  },
  timing_window: {
    id: "timing_window",
    label: "an open window of time",
    concept: "A period is open now for the reader — the destination shows what it covers and how long it lasts.",
    requiresClaims: ["timing_window"],
    promiseType: "timing",
    ctaFamilies: ["REVEAL_TIMING"],
    engines: ["anticipation", "warning", "hope"],
    detect: /\b(window (is|has|opened|opens|open)|\d+-hour|for the next (few|\d+)|a (short|brief|small) (window|stretch|period)|while it lasts|before it (closes|narrows|passes))\b/i,
    baseWeight: 0.8,
    caution: "Never state a date, a day of the week or a calendar reference; only the window the page itself describes."
  },
  card_choice_invitation: {
    id: "card_choice_invitation",
    label: "choose a card",
    concept: "The reader chooses a card themselves and receives the message attached to it — the act of choosing is the hook.",
    requiresClaims: ["card_choice"],
    promiseType: "card_choice",
    ctaFamilies: ["CHOOSE_CARD"],
    engines: ["anticipation", "discovery", "coincidence"],
    detect: /\b(choose|pick|tap|select|turn over)\b[^.]{0,30}\b(card|one)\b/i,
    baseWeight: 1.1
  },
  card_drawn_meaning: {
    id: "card_drawn_meaning",
    label: "a card already drawn",
    concept: "A card has already turned up for the reader — what it shows, and what it is answering, is the payoff.",
    requiresClaims: ["card"],
    promiseType: "card",
    ctaFamilies: ["REVEAL_CARD"],
    engines: ["mystery", "coincidence", "discovery"],
    detect: /\b(card|cards|spread|deck)\b[^.]{0,60}\b(turned|drawn|came up|surfaced|kept (surfacing|landing)|would not|wouldn't|stayed|landed)\b/i,
    baseWeight: 0.9
  },
  pattern_in_reader: {
    id: "pattern_in_reader",
    label: "a pattern the reader recognises in themselves",
    concept: "A specific, recognisable habit or repetition in the reader's own days — and what the destination adds to it.",
    requiresClaims: [],
    promiseType: "reading",
    ctaFamilies: ["OPEN_READING", "REVEAL_REASON", "SEE_WHAT_CHANGED"],
    engines: ["recognition", "validation", "comfort"],
    detect: /\b(you (keep|re-read|reread|check|go back|find yourself|have been|notice|catch yourself)|the same (time|hour|thing|thought) (each|every)|again and again|for the (third|second) time)\b/i,
    baseWeight: 1
  },
  inherited_pattern: {
    id: "inherited_pattern",
    label: "a pattern that began before the reader",
    concept: "A block or repetition that started earlier than the reader's own choices — and the destination shows where it began.",
    requiresClaims: ["reason"],
    promiseType: "reason",
    ctaFamilies: ["REVEAL_REASON"],
    engines: ["relief", "recognition", "transformation"],
    detect: /\b(inherited|never yours|not yours to (fix|carry|begin)|family line|before you (were|did|began)|began before|generations?)\b/i,
    baseWeight: 0.6
  },
  count_specific: {
    id: "count_specific",
    label: "a specific count",
    concept: "A precise count the page genuinely offers (one message, three placements) is the concrete hook.",
    requiresClaims: ["number"],
    promiseType: "number",
    ctaFamilies: ["REVEAL_MESSAGE", "REVEAL_CARD", "OPEN_READING"],
    engines: ["coincidence", "discovery"],
    detect: /\b(\(1\)|one message|three (placements|cards)|twice|two (charts|people)|the (second|third) (time|card))\b/i,
    baseWeight: 0.8
  },
  reader_question_choice: {
    id: "reader_question_choice",
    label: "the reader's own question",
    concept: "The reader brings one question of their own; the destination is where it gets a specific answer.",
    requiresClaims: [],
    promiseType: "reading",
    ctaFamilies: ["OPEN_READING", "REVEAL_REASON"],
    engines: ["validation", "discovery", "relief"],
    detect: /\b(one question|your own question|the question you|ask (it|one thing|the question)|bring (the|your) question)\b/i,
    baseWeight: 0.8
  },
  gentle_warning: {
    id: "gentle_warning",
    label: "something to notice before it passes",
    concept: "Something worth noticing is easy to miss right now — calm, no threat, no urgency invented.",
    requiresClaims: [],
    promiseType: "reading",
    ctaFamilies: ["OPEN_READING", "SEE_WHAT_CHANGED", "REVEAL_REASON"],
    engines: ["warning", "recognition"],
    detect: /\b(easy to miss|before (it|this) (passes|slips|closes)|worth noticing|don't (miss|overlook)|the part (people|most) (miss|skip))\b/i,
    baseWeight: 0.7,
    caution: "No threat, surveillance, deadline or loss framing. The only stake is missing something useful."
  },
  permission_relief: {
    id: "permission_relief",
    label: "permission to set something down",
    concept: "The reader has been carrying something they were never asked to; the destination is the moment that gets said plainly.",
    requiresClaims: [],
    promiseType: "reading",
    ctaFamilies: ["OPEN_READING", "REVEAL_REASON", "REVEAL_MESSAGE"],
    engines: ["relief", "comfort", "transformation"],
    detect: /\b(allowed to|permission|set (it|this) down|stop carrying|you don't have to (keep|carry|hold)|no longer (yours|need))\b/i,
    baseWeight: 0.7
  },
  page_voice_relay: {
    id: "page_voice_relay",
    label: "the page's own claim, relayed",
    concept: "Relay the destination's own headline claim as the page makes it — attributed to the page, never to a person watching this reader.",
    requiresClaims: [],
    requiresAnyClaims: ["message", "card", "reason"],
    promiseType: "reading",
    ctaFamilies: ["OPEN_READING", "SEE_WHAT_IS_WAITING"],
    engines: ["mystery", "anticipation"],
    detect: /\b(doesn't read for just anyone|reached for you|set aside for|a smaller group)\b/i,
    baseWeight: 0.4,
    caution: "Attribute the claim to the page or reading, not to a named individual acting on this subscriber."
  }
};

export const ANGLE_LIST: AngleSpec[] = Object.values(ANGLES);

/** Concept-level classification of arbitrary copy: every angle whose detector fires. */
export function detectAngles(text: string): AngleId[] {
  const hits: AngleId[] = [];
  for (const a of ANGLE_LIST) if (a.detect.test(text)) hits.push(a.id);
  return hits;
}

/** The single best angle label for a piece of copy (first detector hit in priority order), else pattern_in_reader. */
export function primaryAngle(text: string): AngleId {
  const order: AngleId[] = [
    "card_choice_invitation",
    "timing_window",
    "inherited_pattern",
    "past_connection_returns",
    "future_arrival",
    "someone_thinking_of_you",
    "named_person_reveal",
    "message_waiting",
    "card_drawn_meaning",
    "count_specific",
    "hidden_reason",
    "reader_question_choice",
    "permission_relief",
    "gentle_warning",
    "page_voice_relay",
    "pattern_in_reader"
  ];
  for (const id of order) if (ANGLES[id].detect.test(text)) return id;
  return "pattern_in_reader";
}
