/**
 * Copy System V4 — the plan a promotional email is written to, and the ledger entry it leaves
 * behind (ADR-0018). Every value here is a CONCEPT-level label: two emails with different
 * wording but the same angle carry the same angle id, which is what the diversity ledger
 * compares. Nothing in this file is prompt text.
 */

export const LENGTH_FAMILIES = ["short_note", "standard", "story", "long_form"] as const;
export type LengthFamily = (typeof LENGTH_FAMILIES)[number];

export interface WordBand {
  min: number;
  max: number;
}

export const ARCHITECTURE_IDS = [
  "question_tension_reveal",
  "observation_implication_reveal",
  "short_personal_note",
  "story_fragment_unresolved",
  "interaction_invitation",
  "pattern_recognition_relevance",
  "explanatory_authority_note",
  "sparse_alert",
  "reflective_letter",
  "observation_unanswered_question"
] as const;
export type ArchitectureId = (typeof ARCHITECTURE_IDS)[number];

export const ANGLE_IDS = [
  "someone_thinking_of_you",
  "message_waiting",
  "named_person_reveal",
  "past_connection_returns",
  "future_arrival",
  "hidden_reason",
  "timing_window",
  "card_choice_invitation",
  "card_drawn_meaning",
  "pattern_in_reader",
  "inherited_pattern",
  "count_specific",
  "reader_question_choice",
  "gentle_warning",
  "permission_relief",
  "page_voice_relay"
] as const;
export type AngleId = (typeof ANGLE_IDS)[number];

export const HOOK_FAMILIES = [
  "someone_opener",
  "event_past_tense",
  "object_image",
  "direct_you",
  "question",
  "fragment",
  "instruction",
  "observation_statement",
  "practitioner_first_person",
  "count_number",
  "other"
] as const;
export type HookFamily = (typeof HOOK_FAMILIES)[number];

export const EMOTIONAL_ENGINES = [
  "mystery",
  "coincidence",
  "recognition",
  "validation",
  "warning",
  "hope",
  "relief",
  "anticipation",
  "discovery",
  "destiny",
  "transformation",
  "comfort"
] as const;
export type EmotionalEngine = (typeof EMOTIONAL_ENGINES)[number];

/** Claim classes as the destination promise contract names them (EmailOps V3). */
export const CLAIM_CLASSES = [
  "date",
  "timing_window",
  "person",
  "number",
  "card_choice",
  "sign_choice",
  "card",
  "message",
  "reason",
  "outcome"
] as const;
export type ClaimClass = (typeof CLAIM_CLASSES)[number];

export const PROMISE_TYPES = ["person", "message", "reason", "timing", "card", "card_choice", "number", "outcome", "reading"] as const;
export type PromiseType = (typeof PROMISE_TYPES)[number];

/** CTA intent families, aligned with EmailOps' CTA taxonomy keys. */
export const CTA_FAMILIES = [
  "REVEAL_PERSON",
  "REVEAL_MESSAGE",
  "REVEAL_CARD",
  "REVEAL_TIMING",
  "REVEAL_REASON",
  "REVEAL_OUTCOME",
  "SEE_WHAT_CHANGED",
  "SEE_WHAT_IS_WAITING",
  "CHOOSE_CARD",
  "OPEN_READING"
] as const;
export type CtaFamily = (typeof CTA_FAMILIES)[number];

export const SUBJECT_STRUCTURES = [
  "statement",
  "question",
  "fragment",
  "specific_observation",
  "restrained_curiosity",
  "ellipsis_loop"
] as const;
export type SubjectStructure = (typeof SUBJECT_STRUCTURES)[number];

export type PersonaStatus = "RESOLVED" | "OWNER_DECISION_REQUIRED" | "UNKNOWN";

export interface CopyPlan {
  version: "v4";
  /** Ledger key: the sending account/list this email is for (null when unresolvable). */
  account: string | null;
  persona: string | null;
  personaStatus: PersonaStatus;
  destination: string | null;
  lengthFamily: LengthFamily;
  /** The effective word band for THIS email: the family band clipped to the caller's hard band. */
  band: WordBand;
  bandSource: string;
  paragraphs: { min: number; max: number };
  architecture: ArchitectureId;
  angle: AngleId;
  hookFamily: HookFamily;
  emotionalEngine: EmotionalEngine;
  promiseType: PromiseType;
  ctaFamily: CtaFamily;
  subjectStructure: SubjectStructure;
  /** What this email must steer away from, derived from the account's recent ledger. */
  avoid: {
    angles: AngleId[];
    architectures: ArchitectureId[];
    subjectStructures: SubjectStructure[];
    engines: EmotionalEngine[];
    openers: string[];
    constructions: string[];
    recentSubjects: string[];
  };
  attempt: number;
  sendKey: string | null;
  seed: number;
  eligibility: {
    lengthFamilies: LengthFamily[];
    architectures: ArchitectureId[];
    angles: AngleId[];
    notes: string[];
  };
}

export interface LedgerEntry {
  at: string;
  consumer: string | null;
  requestId: string;
  sendKey: string | null;
  attempt: number;
  account: string;
  persona: string | null;
  destination: string | null;
  lengthFamily: LengthFamily;
  architecture: ArchitectureId;
  angle: AngleId;
  hookFamily: HookFamily;
  emotionalEngine: EmotionalEngine | null;
  promiseType: PromiseType;
  ctaFamily: CtaFamily;
  subjectStructure: SubjectStructure;
  subject: string;
  words: number;
  paragraphs: number;
  ticScore: number;
  qaOk: boolean;
  qaFindings: string[];
  generations: number;
  source: "generated" | "seed";
}
