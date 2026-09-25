import type { CopyPlan, LedgerEntry, WordBand } from "../domain/copy-plan.js";
import { ANGLES, primaryAngle } from "./angles.js";
import { ARCHITECTURES } from "./architectures.js";
import { CLAIM_LABELS, detectBanned, detectClaims } from "./claims.js";
import { detectTics, firstSentence, paragraphRhythm, type TicReport } from "./tics.js";
import type { CtaRule, DestinationTruth } from "./strategy-parser.js";
import type { PersonaContract } from "../templates/persona-registry.js";
import { jaccard, tokens } from "./subjects.js";

/**
 * Content-agent-side draft review (ADR-0018 §1, §6, §7). Runs INSIDE the generation loop so a
 * rejected draft is corrected with a precise instruction rather than blindly regenerated. It
 * mirrors the caller's hard rules (band, paragraphs, claim classes, banned patterns, sibling
 * brands) and adds the diversity rules (tic budget, planned angle, repeated promise). The
 * caller's own gate stays the authority; this loop just makes it rarely needed.
 */
export interface Draft {
  subject: string;
  preheader: string;
  body: string;
  cta: string;
  postscript?: string;
}

export interface QaFinding {
  code: string;
  severity: "reject" | "warn";
  detail: string;
  fix: string;
}

export interface QaContext {
  plan: CopyPlan;
  truth: DestinationTruth;
  cta: CtaRule | null;
  persona: PersonaContract | null;
  siblingBrands: string[];
  hardBand: WordBand | null;
  paragraphBand: { min: number; max: number } | null;
  recent: LedgerEntry[];
}

export interface QaReview {
  ok: boolean;
  score: number;
  findings: QaFinding[];
  words: number;
  paragraphs: string[];
  tics: TicReport;
  detectedAngle: string;
  draft: Draft;
}

const wordsOf = (s: string) => s.trim().split(/\s+/).filter(Boolean).length;
const sentencesOf = (t: string) => t.replace(/\s+/g, " ").split(/(?<=[.!?])\s+/).map((s) => s.trim()).filter((s) => s.length > 2);

const PROMISE_TOKENS: Record<string, RegExp> = {
  person: /\b(names? (the|a|this|that|who|them|him|her)|who (it|this) (is|points)|the person|a specific person|identif)/i,
  message: /\bmessage\b/i,
  reason: /\b(reason|why)\b/i,
  timing: /\b(window|when|period|stretch)\b/i,
  card: /\bcard\b/i,
  card_choice: /\b(choose|pick|tap|select)\b/i,
  number: /\b(one|two|three|\(1\)|twice)\b/i,
  outcome: /\b(next|resolve|ends?)\b/i,
  reading: /\breading\b/i
};

const FILLER_OPENERS = /^(you (may|might) have (been )?(feeling|noticed|sensed)|you have probably noticed|something has been shifting|the universe has been|this is not random|it is no coincidence|you do not need to do anything|there is something you need to know)/i;

/** Remove a trailing sign-off the caller appends itself (a valediction, a persona or brand name on its own line). */
export function stripSignoff(body: string, names: string[]): string {
  const lines = body.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const norm = (s: string) => s.replace(/^[\s—–-]+/, "").replace(/[\s.,!]+$/, "").toLowerCase();
  const nameSet = new Set(names.map(norm).filter(Boolean));
  while (lines.length > 1) {
    const last = lines[lines.length - 1]!;
    if (nameSet.has(norm(last)) || /^(with (warmth|love|care)|warmly|yours|until (next time|then)|take care|go gently|with so much love),?$/i.test(norm(last)) || /^[—–-]\s*[A-Z][\w' .]{1,40}$/.test(last)) lines.pop();
    else break;
  }
  return lines.join("\n\n");
}

export function reviewDraft(input: Draft, ctx: QaContext): QaReview {
  const findings: QaFinding[] = [];
  const names = [ctx.persona?.name ?? "", ctx.persona?.brand ?? "", ...(ctx.plan.persona ? [ctx.plan.persona] : [])];
  const body = stripSignoff(String(input.body ?? ""), names);
  // The caller prefixes "P.S." itself at render time; a postscript that already carries it would ship as "P.S. P.S.".
  const postscript = input.postscript ? String(input.postscript).trim().replace(/^\s*p\.?\s?s\.?\s*[—–:-]?\s*/i, "").trim() : "";
  const draft: Draft = { subject: String(input.subject ?? "").trim(), preheader: String(input.preheader ?? "").trim(), body, cta: String(input.cta ?? "").replace(/[→↓✨💫🔮]/g, "").replace(/[.\s]+$/, "").trim(), ...(postscript ? { postscript } : {}) };
  const paragraphs = body.split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const text = `${draft.preheader} ${paragraphs.join(" ")}`;
  const words = wordsOf(text);
  const all = `${draft.subject} ${text} ${draft.cta}`;

  // --- length (the caller measures preheader + body)
  if (ctx.hardBand && (words < ctx.hardBand.min || words > ctx.hardBand.max)) {
    findings.push({ code: "LENGTH_OUTSIDE_HARD_BAND", severity: "reject", detail: `${words} words; the caller accepts ${ctx.hardBand.min}-${ctx.hardBand.max}`, fix: words > ctx.hardBand.max ? `Cut to under ${ctx.hardBand.max} words (preheader + body). Remove the paragraph that restates the promise; keep the hook and the CTA.` : `Add one concrete beat (an object, a moment, a count the page supports) to reach at least ${ctx.hardBand.min} words. Do not pad with reassurance.` });
  } else if (words < ctx.plan.band.min * 0.85 || words > ctx.plan.band.max * 1.15) {
    findings.push({ code: "LENGTH_OFF_FAMILY", severity: "warn", detail: `${words} words vs ${ctx.plan.lengthFamily} guidance ${ctx.plan.band.min}-${ctx.plan.band.max}`, fix: words > ctx.plan.band.max ? "Trim the least necessary paragraph." : "Length follows the idea; only extend if a real beat is missing." });
  }
  if (ctx.paragraphBand && (paragraphs.length < ctx.paragraphBand.min || paragraphs.length > ctx.paragraphBand.max)) {
    findings.push({ code: "PARAGRAPHS_OUTSIDE_CALLER_RANGE", severity: "reject", detail: `${paragraphs.length} paragraphs; the caller accepts ${ctx.paragraphBand.min}-${ctx.paragraphBand.max}`, fix: paragraphs.length > ctx.paragraphBand.max ? "Merge the two shortest adjacent paragraphs." : `Split the longest paragraph at its natural turn so there are at least ${ctx.paragraphBand.min}.` });
  } else if (paragraphs.length < ctx.plan.paragraphs.min || paragraphs.length > ctx.plan.paragraphs.max) {
    findings.push({ code: "PARAGRAPHS_OFF_ARCHITECTURE", severity: "warn", detail: `${paragraphs.length} paragraphs vs ${ctx.plan.architecture} plan ${ctx.plan.paragraphs.min}-${ctx.plan.paragraphs.max}`, fix: "Follow the paragraph plan." });
  }

  // --- truth: claim classes the destination does not support, banned patterns, sibling brands
  const may = new Set(ctx.truth.may);
  for (const hit of detectClaims(all)) {
    if (!may.has(hit.cls)) findings.push({ code: `UNSUPPORTED_${hit.cls.toUpperCase()}_CLAIM`, severity: "reject", detail: `"${hit.quote}"`, fix: `The page does not offer ${CLAIM_LABELS[hit.cls]}. Keep the hook; rewrite that sentence around what the page does offer${ctx.truth.may.length ? ` (${ctx.truth.may.map((c) => CLAIM_LABELS[c]).join("; ")})` : ""}.` });
  }
  for (const b of detectBanned(all)) findings.push({ code: b.code, severity: "reject", detail: `"${b.quote}"`, fix: b.fix });
  for (const brand of ctx.siblingBrands) if (brand && new RegExp(`\\b${brand.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\b`, "i").test(all)) findings.push({ code: "SIBLING_BRAND_MENTION", severity: "reject", detail: brand, fix: `Remove "${brand}"; this email is from ${ctx.persona?.brand ?? "its own brand"} only.` });

  // --- one idea said once
  const promiseRe = PROMISE_TOKENS[ctx.plan.promiseType] ?? PROMISE_TOKENS.reading!;
  const sents = sentencesOf(paragraphs.join(" "));
  const promiseSentences = sents.map((s, i) => (promiseRe.test(s) && /\b(reading|it|this|page|card|message)\b/i.test(s) ? i + 1 : 0)).filter(Boolean);
  if (promiseSentences.length >= 3) {
    findings.push({ code: "REPEATED_PROMISE", severity: "reject", detail: `the ${ctx.plan.promiseType} promise is asserted in sentences ${promiseSentences.join(", ")}`, fix: `Keep sentence ${promiseSentences[0]} as the one statement of the promise. Replace the others with a concrete observation (an object, a moment, a count the page supports) or cut them.` });
  }

  // --- fingerprint budget
  const tics = detectTics(paragraphs.join("\n"), draft.subject);
  if (tics.distinctOver >= 2 || tics.score >= 3) {
    findings.push({ code: "STYLE_FINGERPRINT", severity: "reject", detail: tics.hits.map((h) => `${h.label} ×${h.count}`).join("; "), fix: tics.hits.map((h) => `${h.fix} (${h.examples[0] ?? ""})`).join(" ") });
  } else if (tics.distinctOver === 1) {
    findings.push({ code: "STYLE_FINGERPRINT", severity: "warn", detail: tics.hits.map((h) => `${h.label} ×${h.count}`).join("; "), fix: tics.hits[0]!.fix });
  }
  const opener = firstSentence(paragraphs[0] ?? "");
  if (FILLER_OPENERS.test(opener) && !/\b(card|table|page|line|hour|week|phone|photograph|song|name|number|letter|note)\b/i.test(opener)) {
    findings.push({ code: "GENERIC_FILLER_OPENER", severity: "reject", detail: `"${opener}"`, fix: "Open on a concrete particular — an object, a moment, a count the page supports — not on a feeling the reader 'may have noticed'." });
  }
  const rhythm = paragraphRhythm(paragraphs);
  if (rhythm.uniform) findings.push({ code: "UNIFORM_PARAGRAPH_RHYTHM", severity: "warn", detail: `paragraph lengths nearly identical (cv ${rhythm.cv.toFixed(2)})`, fix: "Let one paragraph be a single sentence and one carry the weight." });

  // --- the planned concept, not the house default
  const detectedAngle = primaryAngle(`${draft.subject} ${text}`);
  if (detectedAngle !== ctx.plan.angle && ctx.plan.avoid.angles.includes(detectedAngle) && ANGLES[ctx.plan.angle].requiresClaims.every((c) => may.has(c))) {
    findings.push({ code: "PLANNED_ANGLE_NOT_WRITTEN", severity: "reject", detail: `the draft pitches "${ANGLES[detectedAngle].label}", which this account used recently; the plan was "${ANGLES[ctx.plan.angle].label}"`, fix: `Write the planned concept: ${ANGLES[ctx.plan.angle].concept} Keep the voice and length; change the idea, not the wording.` });
  }
  if (ctx.plan.architecture === "question_tension_reveal" && !/\?/.test(paragraphs[0] ?? "")) findings.push({ code: "ARCHITECTURE_NOT_FOLLOWED", severity: "warn", detail: "question architecture without an opening question", fix: ARCHITECTURES.question_tension_reveal.plan[0]! });
  if (ctx.plan.architecture === "interaction_invitation" && !/\b(choose|pick|tap|select|turn)\b/i.test(`${paragraphs.join(" ")} ${draft.cta}`)) findings.push({ code: "ARCHITECTURE_NOT_FOLLOWED", severity: "reject", detail: "interaction invitation without the interaction", fix: "Name the act the page asks for (choose one card) in the body and the CTA." });

  // --- preheader
  const pj = jaccard(new Set(tokens(draft.subject)), new Set(tokens(draft.preheader)));
  if (pj >= 0.5) findings.push({ code: "PREHEADER_ECHOES_SUBJECT", severity: "reject", detail: `overlap ${pj.toFixed(2)}`, fix: "Write a preheader that adds a second idea the subject did not say." });
  if (!draft.preheader) findings.push({ code: "PREHEADER_MISSING", severity: "reject", detail: "empty", fix: "Add a preheader under 100 characters that advances the subject." });

  // --- CTA
  const ctaWords = draft.cta.split(/\s+/).filter(Boolean);
  if (!draft.cta) findings.push({ code: "CTA_EMPTY", severity: "reject", detail: "no CTA", fix: "Write a 3-8 word CTA that names the payoff." });
  else {
    if (ctx.cta?.verbs.length && !ctx.cta.verbs.some((v) => new RegExp(`\\b${v}\\b`, "i").test(draft.cta))) findings.push({ code: "CTA_NO_ACTION_VERB", severity: "reject", detail: draft.cta, fix: `Start the CTA with one of: ${ctx.cta.verbs.join(", ")}.` });
    if (ctx.cta?.maxChars && draft.cta.length > ctx.cta.maxChars) findings.push({ code: "CTA_TOO_LONG", severity: "reject", detail: `${draft.cta.length} chars`, fix: `Cut the CTA to under ${ctx.cta.maxChars} characters, 3-8 words.` });
    if (ctaWords.length < 3 || ctaWords.length > 8) findings.push({ code: "CTA_SHAPE", severity: "reject", detail: `${ctaWords.length} words`, fix: "Make the CTA 3-8 words: verb + the specific payoff." });
    if (ctx.cta?.bannedLabels.some((b) => draft.cta.toLowerCase().replace(/[^a-z ]/g, "").includes(b.replace(/[^a-z ]/g, "")))) findings.push({ code: "CTA_GENERIC", severity: "reject", detail: draft.cta, fix: "Replace the generic destination label with the specific payoff of this email." });
    // The caller's derivation guard ignores container nouns and CTA verbs ("open the message",
    // "reveal who it names" share nothing meaningful); the overlap must be on a word from THIS
    // email's own story.
    const CTA_GENERIC = new Set(["message", "messages", "reading", "readings", "card", "cards", "page", "name", "names", "who", "one", "open", "see", "reveal", "read", "find", "discover", "meet", "hear", "choose", "select", "waiting", "full", "yours", "today", "now"]);
    const ctaLemmas = new Set(tokens(draft.cta).filter((w) => !CTA_GENERIC.has(w)));
    const bodyLemmas = new Set(tokens(`${draft.subject} ${text}`));
    const overlap = [...ctaLemmas].some((w) => bodyLemmas.has(w));
    if (!overlap) findings.push({ code: "CTA_NOT_DERIVED", severity: "reject", detail: draft.cta, fix: "Re-use one concrete word from this email's own subject or body in the CTA (the object, the message, the card, the person) so the CTA closes the loop this email opened." });
    if (/\b(choose|pick|tap|select)\b/i.test(draft.cta) && !may.has("card_choice")) findings.push({ code: "CTA_INTERACTION_NOT_SUPPORTED", severity: "reject", detail: draft.cta, fix: "This page has nothing to choose; make the CTA a reveal or open, not a choice." });
  }

  const rejects = findings.filter((f) => f.severity === "reject").length;
  const warns = findings.length - rejects;
  return { ok: rejects === 0, score: rejects * 10 + warns + tics.score * 0.5, findings, words, paragraphs, tics, detectedAngle, draft };
}

/** The corrective instruction block for a retry (ADR-0018 §7). */
export function renderRevision(review: QaReview, plan: CopyPlan, attemptNo: number): string {
  const lines: string[] = [];
  lines.push(`REVISION ${attemptNo} — the previous draft was reviewed and must be corrected, not paraphrased.`);
  lines.push("Keep what works: the voice, the planned concept and architecture, the subject unless a finding names it.");
  lines.push("Findings and the exact correction for each:");
  let n = 1;
  for (const f of review.findings.filter((x) => x.severity === "reject")) lines.push(`  ${n++}. ${f.code}: ${f.detail}. FIX: ${f.fix}`);
  for (const f of review.findings.filter((x) => x.severity === "warn")) lines.push(`  ${n++}. (advisory) ${f.code}: ${f.detail}. ${f.fix}`);
  lines.push("");
  lines.push("Previous draft:");
  lines.push(`  Subject: ${review.draft.subject}`);
  lines.push(`  Preheader: ${review.draft.preheader}`);
  for (const p of review.paragraphs) lines.push(`  ${p}`);
  lines.push(`  CTA: ${review.draft.cta}`);
  lines.push("");
  lines.push(`Return the complete corrected email as JSON again (${plan.band.min}-${plan.band.max} words including the preheader, ${plan.paragraphs.min}-${plan.paragraphs.max} paragraphs).`);
  return lines.join("\n");
}
