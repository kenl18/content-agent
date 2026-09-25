import {
  EMOTIONAL_ENGINES,
  SUBJECT_STRUCTURES,
  type AngleId,
  type ArchitectureId,
  type CopyPlan,
  type CtaFamily,
  type EmotionalEngine,
  type HookFamily,
  type LedgerEntry,
  type LengthFamily,
  type SubjectStructure,
  type WordBand
} from "../domain/copy-plan.js";
import { ANGLES, ANGLE_LIST, type AngleSpec } from "./angles.js";
import { ARCHITECTURES, ARCHITECTURE_LIST, type ArchitectureSpec } from "./architectures.js";
import { LENGTH_FAMILY_SPECS, eligibleLengthFamilies, type EligibleLengthFamily } from "./length-families.js";
import type { DestinationPack } from "./destination-content.js";
import type { CtaRule, DestinationTruth } from "./strategy-parser.js";
import type { PersonaContract } from "../templates/persona-registry.js";
import { TICS } from "./tics.js";

/**
 * The planner (ADR-0018 §2–§4, §8): chooses the concept-level shape of ONE email — length
 * family, architecture, angle, engine, hook, subject structure, CTA family — from what is
 * ELIGIBLE (the destination's truth, the caller's hard band, the persona) and what is FRESH
 * (the account's recent ledger). Selection is weighted-random with a seed derived from the
 * requestId, so a given request plans the same way twice and a retry plans differently on
 * purpose. Nothing here rotates templates: eligibility and recency shape probabilities, the
 * draw decides.
 */
export interface PlannerInput {
  requestId: string;
  account: string | null;
  sendKey: string | null;
  attempt: number;
  persona: PersonaContract | null;
  destination: string | null;
  truth: DestinationTruth;
  pack: DestinationPack | null;
  cta: CtaRule | null;
  hardBand: WordBand | null;
  paragraphBand: { min: number; max: number } | null;
  recent: LedgerEntry[];
  priorAttempts: LedgerEntry[];
  preferredFrames: string[];
  /** Angles/architectures to exclude (a re-plan after corrective retries failed). */
  exclude?: { angles?: AngleId[]; architectures?: ArchitectureId[] };
  /**
   * A caller's explicit choice (request `context.diversity`), honoured only when eligible —
   * an ineligible forced value is ignored and noted, never obeyed.
   */
  force?: { lengthFamily?: LengthFamily; architecture?: ArchitectureId; angle?: AngleId };
}

export function hashSeed(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  return h >>> 0;
}

export function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pick<T extends { id: string }>(items: { item: T; weight: number }[], rng: () => number): T {
  const total = items.reduce((a, b) => a + Math.max(0, b.weight), 0);
  if (total <= 0) return items[0]!.item;
  let r = rng() * total;
  for (const it of items) {
    r -= Math.max(0, it.weight);
    if (r <= 0) return it.item;
  }
  return items[items.length - 1]!.item;
}

const countIn = <T extends string>(arr: T[], v: T) => arr.filter((x) => x === v).length;

function recencyPenalty(value: string, last: string[], all: Record<string, number>, strong = 0.25, mild = 0.85): number {
  const inLast = countIn(last, value);
  const total = all[value] ?? 0;
  return Math.pow(strong, inLast) * Math.pow(mild, Math.max(0, total - inLast));
}

function destinationFit(angle: AngleSpec, truth: DestinationTruth, pack: DestinationPack | null): number {
  const text = `${truth.headline ?? ""} ${truth.button ?? ""} ${pack?.page.title ?? ""} ${(pack?.page.headings ?? []).join(" ")}`.toLowerCase();
  const has = (re: RegExp) => re.test(text);
  switch (angle.id) {
    case "card_choice_invitation": return has(/choose|pick|which card/) ? 2.2 : 1;
    case "message_waiting": return has(/message|letter|note/) ? 1.6 : 0.9;
    case "past_connection_returns": return has(/past|ex\b|old|never sent|never did/) ? 1.7 : 0.8;
    case "future_arrival": return has(/future|soulmate|coming|closer|dreamed|manifest/) ? 1.6 : 0.7;
    case "timing_window": return has(/window|hour|turning point|retrograde/) ? 1.7 : 0.8;
    case "inherited_pattern": return has(/inherit|block/) ? 2 : 0.5;
    case "hidden_reason": return has(/why|reason|block|curse|working against/) ? 1.4 : 0.9;
    case "named_person_reveal": return has(/who|someone|person|lover|soulmate/) ? 1.3 : 0.8;
    case "someone_thinking_of_you": return has(/someone|thinking|manifest|mind/) ? 1.3 : 0.8;
    case "card_drawn_meaning": return has(/card|tarot|arcana|spread/) ? 1.4 : 0.6;
    case "count_specific": return has(/\(\d+\)|three|two|one message/) ? 1.4 : 0.6;
    case "page_voice_relay": return has(/reached for you|doesn't read for just anyone|set aside/) ? 1.8 : 0.3;
    case "reader_question_choice": return has(/question|ask/) ? 1.4 : 0.9;
    default: return 1;
  }
}

const FRAME_TO_ANGLE: Record<string, AngleId> = {
  "held-back-message-names-person": "message_waiting",
  "someone-opener": "someone_thinking_of_you",
  "contrast-lede": "named_person_reveal",
  "narrative-card-action": "card_drawn_meaning",
  "inherited-burden-frame": "inherited_pattern",
  "past-lover-nostalgia-moment": "past_connection_returns"
};

const ARCH_ANGLE_FIT: Partial<Record<ArchitectureId, Partial<Record<AngleId, number>>>> = {
  interaction_invitation: { card_choice_invitation: 4 },
  sparse_alert: { message_waiting: 1.6, count_specific: 1.4, timing_window: 1.3 },
  short_personal_note: { message_waiting: 1.4, page_voice_relay: 1.4, permission_relief: 1.3, gentle_warning: 1.2 },
  story_fragment_unresolved: { past_connection_returns: 1.6, someone_thinking_of_you: 1.5, card_drawn_meaning: 1.5, message_waiting: 1.2 },
  pattern_recognition_relevance: { pattern_in_reader: 2.2, inherited_pattern: 1.5, hidden_reason: 1.3, permission_relief: 1.3 },
  observation_unanswered_question: { hidden_reason: 1.6, count_specific: 1.4, card_drawn_meaning: 1.3, pattern_in_reader: 1.2 },
  question_tension_reveal: { reader_question_choice: 2, hidden_reason: 1.4, pattern_in_reader: 1.3, gentle_warning: 1.2 },
  explanatory_authority_note: { hidden_reason: 1.3, timing_window: 1.3, reader_question_choice: 1.2, inherited_pattern: 1.2 },
  observation_implication_reveal: { timing_window: 1.4, card_drawn_meaning: 1.3, count_specific: 1.3, future_arrival: 1.2 },
  reflective_letter: { permission_relief: 1.6, pattern_in_reader: 1.4, past_connection_returns: 1.3, gentle_warning: 1.2 }
};

function subjectStructureWeights(arch: ArchitectureSpec, persona: PersonaContract | null): Partial<Record<SubjectStructure, number>> {
  const plain = persona ? /eckhart|wren|oracle|venus_window|spiritual_oasis/.test(persona.id) : false;
  const base: Record<SubjectStructure, number> = { statement: 1, question: 0.6, fragment: 0.7, specific_observation: 1.1, restrained_curiosity: 0.8, ellipsis_loop: plain ? 0.05 : 0.25 };
  if (arch.id === "question_tension_reveal") base.question = 2.2;
  if (arch.id === "sparse_alert" || arch.id === "short_personal_note") base.fragment = 1.4;
  if (arch.id === "story_fragment_unresolved") { base.specific_observation = 1.8; base.ellipsis_loop *= 2; }
  if (arch.id === "observation_unanswered_question" || arch.id === "observation_implication_reveal") base.specific_observation = 1.8;
  if (arch.id === "explanatory_authority_note") base.statement = 1.6;
  return base;
}

export function planCopy(input: PlannerInput): CopyPlan {
  const rng = mulberry32(hashSeed(`${input.requestId}:${input.attempt}:${input.exclude ? "replan" : "plan"}`));
  const notes: string[] = [];
  const recentAll = input.recent;
  const last5 = recentAll.slice(0, 5);
  const counts = (key: keyof LedgerEntry) => { const m: Record<string, number> = {}; for (const e of recentAll) { const v = e[key]; if (v != null) m[String(v)] = (m[String(v)] || 0) + 1; } return m; };
  const angleCounts = counts("angle"), archCounts = counts("architecture"), lenCounts = counts("lengthFamily"), engineCounts = counts("emotionalEngine"), structCounts = counts("subjectStructure"), hookCounts = counts("hookFamily");
  const lastAngles = last5.map((e) => e.angle), lastArchs = last5.map((e) => e.architecture), lastLens = last5.map((e) => e.lengthFamily), lastEngines = last5.map((e) => e.emotionalEngine).filter((x): x is EmotionalEngine => Boolean(x)), lastStructs = recentAll.slice(0, 10).map((e) => e.subjectStructure), lastHooks = last5.map((e) => e.hookFamily);
  const priorAngles = input.priorAttempts.map((e) => e.angle), priorArchs = input.priorAttempts.map((e) => e.architecture);

  // ---- length families eligible under the caller's hard band
  const eligibleLens: EligibleLengthFamily[] = eligibleLengthFamilies(input.hardBand).filter((f) => {
    if (!input.paragraphBand) return true;
    const spec = LENGTH_FAMILY_SPECS[f.id];
    return spec.paragraphs.max >= input.paragraphBand.min && spec.paragraphs.min <= input.paragraphBand.max;
  });
  if (input.hardBand) notes.push(`caller hard band ${input.hardBand.min}-${input.hardBand.max} words: eligible length families ${eligibleLens.map((f) => `${f.id}${f.clipped ? "(clipped " + f.band.min + "-" + f.band.max + ")" : ""}`).join(", ") || "none"}`);
  const lensById = new Map(eligibleLens.map((f) => [f.id, f]));
  const fallbackLen: EligibleLengthFamily = lensById.get("standard") ?? eligibleLens[0] ?? { id: "standard", band: input.hardBand ?? LENGTH_FAMILY_SPECS.standard.band, clipped: Boolean(input.hardBand) };

  // ---- angles eligible under the destination truth
  const may = new Set(input.truth.may);
  const angleEligible = ANGLE_LIST.filter((a) => {
    if (input.exclude?.angles?.includes(a.id)) return false;
    if (!input.truth.established) return a.requiresClaims.length === 0 && !a.requiresAnyClaims;
    if (!a.requiresClaims.every((c) => may.has(c))) return false;
    if (a.requiresAnyClaims && !a.requiresAnyClaims.some((c) => may.has(c))) return false;
    return true;
  });
  if (!input.truth.established) notes.push("destination truth not established in the request: only claim-free angles are eligible (fail closed)");
  const frameBoost = new Map<AngleId, number>();
  for (const f of input.preferredFrames) { const id = FRAME_TO_ANGLE[f.replace(/\s*\(.*\)$/, "")]; if (id) frameBoost.set(id, (frameBoost.get(id) ?? 1) * 1.15); }
  const angleWeights = angleEligible.map((a) => ({
    item: a,
    weight: a.baseWeight * destinationFit(a, input.truth, input.pack) * recencyPenalty(a.id, lastAngles, angleCounts, 0.25, 0.85) * (frameBoost.get(a.id) ?? 1) * (input.attempt >= 3 && priorAngles.includes(a.id) ? 0.05 : 1)
  }));
  let angle = angleWeights.length ? pick(angleWeights, rng) : ANGLES.pattern_in_reader;
  if (input.force?.angle) {
    const forced = angleEligible.find((a) => a.id === input.force!.angle);
    if (forced) angle = forced; else notes.push(`forced angle ${input.force.angle} is not eligible here; ignored`);
  }

  // ---- architectures eligible under band, paragraphs, interaction, claims
  const archEligible = ARCHITECTURE_LIST.filter((s) => {
    if (input.exclude?.architectures?.includes(s.id)) return false;
    if (!s.lengthFamilies.some((lf) => lensById.has(lf))) return false;
    if (input.paragraphBand && (s.paragraphs.max < input.paragraphBand.min || s.paragraphs.min > input.paragraphBand.max)) return false;
    if (s.requiresInteraction && !(input.truth.interaction && s.requiresInteraction.includes(input.truth.interaction as "choose_card" | "enter_email"))) return false;
    if (s.requiresClaims && !s.requiresClaims.every((c) => may.has(c))) return false;
    return true;
  });
  const archWeights = archEligible.map((s) => ({
    item: s,
    weight: s.baseWeight * (ARCH_ANGLE_FIT[s.id]?.[angle.id] ?? 1) * recencyPenalty(s.id, lastArchs.slice(0, 3), archCounts, 0.3, 0.9) * (input.persona?.firstPerson === "no" && (s.id === "reflective_letter" || s.id === "short_personal_note") ? 0.5 : 1) * (input.attempt >= 3 && priorArchs.includes(s.id) ? 0.05 : 1)
  }));
  let architecture = archWeights.length ? pick(archWeights, rng) : ARCHITECTURES.observation_implication_reveal;
  if (input.force?.architecture) {
    const forced = archEligible.find((s) => s.id === input.force!.architecture);
    if (forced) architecture = forced; else notes.push(`forced architecture ${input.force.architecture} is not eligible here; ignored`);
  }
  notes.push(`eligible architectures: ${archEligible.map((s) => s.id).join(", ")}`);

  // ---- length family within the architecture
  const lenChoices = architecture.lengthFamilies.map((lf) => lensById.get(lf)).filter((x): x is EligibleLengthFamily => Boolean(x));
  const lenWeights = (lenChoices.length ? lenChoices : [fallbackLen]).map((f) => ({
    item: f,
    weight: LENGTH_FAMILY_SPECS[f.id].baseWeight * recencyPenalty(f.id, lastLens.slice(0, 3), lenCounts, 0.4, 0.92) * (f.id === "long_form" && (lastLens.slice(0, 3).includes("long_form") || (lenCounts.long_form ?? 0) >= 2) ? 0 : 1)
  }));
  let lengthFamily = pick(lenWeights, rng);
  if (input.force?.lengthFamily) {
    const forced = lenChoices.find((f) => f.id === input.force!.lengthFamily);
    if (forced) lengthFamily = forced; else notes.push(`forced length family ${input.force.lengthFamily} is not eligible for ${architecture.id} under the caller's band; ignored`);
  }
  const paragraphs = {
    min: Math.max(architecture.paragraphs.min, input.paragraphBand?.min ?? 0),
    max: Math.min(architecture.paragraphs.max, input.paragraphBand?.max ?? 99)
  };
  if (paragraphs.min > paragraphs.max) { paragraphs.min = paragraphs.max; }

  // ---- engine: intersection of angle and architecture preferences, avoiding the last three used
  const preferred = angle.engines.filter((e) => architecture.engines.includes(e));
  const enginePool = (preferred.length ? preferred : [...new Set([...angle.engines, ...architecture.engines])]).length ? (preferred.length ? preferred : [...new Set([...angle.engines, ...architecture.engines])]) : [...EMOTIONAL_ENGINES];
  const engine = pick(enginePool.map((e) => ({ item: { id: e }, weight: recencyPenalty(e, lastEngines.slice(0, 3), engineCounts, 0.2, 0.85) })), rng).id as EmotionalEngine;

  // ---- hook family: the architecture's, unless it is saturated in the last five
  let hookFamily: HookFamily = architecture.hook;
  if (countIn(lastHooks, hookFamily) >= 2) {
    const alternatives: HookFamily[] = ["event_past_tense", "object_image", "observation_statement", "direct_you", "count_number", "fragment"].filter((h) => h !== hookFamily && countIn(lastHooks, h) === 0) as HookFamily[];
    if (alternatives.length) hookFamily = alternatives[Math.floor(rng() * alternatives.length)]!;
  }
  if (hookFamily === "someone_opener" || (angle.id === "someone_thinking_of_you" && (hookCounts.someone_opener ?? 0) >= 3)) hookFamily = hookFamily === "someone_opener" ? "event_past_tense" : hookFamily;

  // ---- subject structure with a share cap over the last ten
  const sw = subjectStructureWeights(architecture, input.persona);
  const structWeights = SUBJECT_STRUCTURES.map((s) => {
    const share = lastStructs.length ? countIn(lastStructs, s) / lastStructs.length : 0;
    return { item: { id: s }, weight: (sw[s] ?? 0.5) * (share >= 0.4 ? 0.15 : share >= 0.25 ? 0.5 : 1) * recencyPenalty(s, lastStructs.slice(0, 2), structCounts, 0.5, 0.97) };
  });
  const subjectStructure = pick(structWeights, rng).id as SubjectStructure;

  // ---- CTA family: the angle's, constrained by the caller's intents and the truth
  const intents = new Set(input.cta?.intents ?? []);
  const ctaCandidates: CtaFamily[] = angle.ctaFamilies.filter((f) => (intents.size ? intents.has(f) : true) && (f !== "CHOOSE_CARD" || may.has("card_choice")));
  const ctaFamily: CtaFamily = ctaCandidates[0] ?? (intents.has("OPEN_READING") || !intents.size ? "OPEN_READING" : ([...intents][0] as CtaFamily));

  const avoidAngles = [...new Set(lastAngles)].filter((a) => a !== angle.id);
  const avoidArchs = [...new Set(lastArchs.slice(0, 3))].filter((a) => a !== architecture.id);
  const dominantStructs = SUBJECT_STRUCTURES.filter((s) => lastStructs.length >= 5 && countIn(lastStructs, s) / lastStructs.length >= 0.4 && s !== subjectStructure);
  const constructions = TICS.slice(0, 8).map((t) => t.label);

  return {
    version: "v4",
    account: input.account,
    persona: input.persona?.name ?? null,
    personaStatus: input.persona?.status ?? "UNKNOWN",
    destination: input.destination,
    lengthFamily: lengthFamily.id as LengthFamily,
    band: lengthFamily.band,
    bandSource: lengthFamily.clipped ? "family band clipped to the caller's hard band" : input.hardBand ? "family band within the caller's hard band" : "family band (no caller hard band)",
    paragraphs,
    architecture: architecture.id,
    angle: angle.id,
    hookFamily,
    emotionalEngine: engine,
    promiseType: angle.promiseType,
    ctaFamily,
    subjectStructure,
    avoid: {
      angles: avoidAngles,
      architectures: avoidArchs,
      subjectStructures: dominantStructs,
      engines: [...new Set(lastEngines.slice(0, 3))].filter((e) => e !== engine),
      openers: lastHooks.filter((h, i, a) => a.indexOf(h) === i),
      constructions,
      recentSubjects: recentAll.slice(0, 12).map((e) => e.subject).filter(Boolean)
    },
    attempt: input.attempt,
    sendKey: input.sendKey,
    seed: hashSeed(`${input.requestId}:${input.attempt}`),
    eligibility: {
      lengthFamilies: eligibleLens.map((f) => f.id),
      architectures: archEligible.map((s) => s.id),
      angles: angleEligible.map((a) => a.id),
      notes
    }
  };
}
