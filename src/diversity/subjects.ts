import type { CopyPlan, SubjectStructure } from "../domain/copy-plan.js";
import { detectClaims } from "./claims.js";
import { subjectStructureOf } from "./ledger.js";
import type { CtaRule, DestinationTruth } from "./strategy-parser.js";
import type { PersonaContract } from "../templates/persona-registry.js";

/**
 * Subject/preheader candidate ranking (ADR-0018 §8). The model returns its primary subject plus
 * structurally different candidates in one call; this picks the one that is truthful, novel
 * against the account's recent subjects at CONCEPT level, in the planned structure where
 * possible, and inside the caller's length rule. A rejected candidate is never patched — it is
 * simply not chosen.
 */
export interface SubjectCandidate {
  subject: string;
  preheader: string;
  structure?: string;
}

export interface RankedSubject extends SubjectCandidate {
  detectedStructure: SubjectStructure;
  score: number;
  rejected: string | null;
  notes: string[];
}

export interface RankContext {
  plan: CopyPlan;
  truth: DestinationTruth;
  cta: CtaRule | null;
  persona: PersonaContract | null;
  recentSubjects: string[];
  recentStructures: SubjectStructure[];
  maxChars?: number;
  rng?: () => number;
}

const STOP = new Set("a an the and or but so if then than that this these those of in on at to for with from by as is are was were be been it its you your i me my we our they them their he she his her not no do does did have has had will would can could may might there here what when where who which why how all any some one".split(" "));
export const tokens = (s: string) => s.toLowerCase().replace(/[^a-z0-9' ]/g, " ").split(/\s+/).filter((w) => w && !STOP.has(w));
export const jaccard = (a: Set<string>, b: Set<string>) => { if (!a.size || !b.size) return 0; let i = 0; for (const x of a) if (b.has(x)) i++; return i / (a.size + b.size - i); };

function conceptKey(s: string): string {
  // Collapse the estate's synonym clusters so "someone is thinking about you" and "a person has you on their mind" compare equal.
  return s.toLowerCase()
    .replace(/\b(somebody|a person|they|a stranger)\b/g, "someone")
    .replace(/\b(thinking (about|of|toward) you|on (their|someone's) mind|has you on their mind|thought (about|of) you|crossed their mind)\b/g, "thinking_of_you")
    .replace(/\b(message|note|letter|line|words?)\b/g, "message")
    .replace(/\b(held back|kept back|waiting|unopened|unsent|never sent|set aside|withheld)\b/g, "held")
    .replace(/\b(names?|identifies|reveals? who|who it is)\b/g, "names")
    .replace(/\b(past lover|from your past|old flame|ex)\b/g, "past_person")
    .replace(/\b(window|stretch|period)\b/g, "window");
}

export function rankSubjects(cands: SubjectCandidate[], ctx: RankContext): { chosen: RankedSubject | null; ranked: RankedSubject[] } {
  const maxChars = ctx.maxChars ?? 58;
  const recentKeys = ctx.recentSubjects.map((s) => new Set(tokens(conceptKey(s))));
  const recentFirst3 = new Set(ctx.recentSubjects.map((s) => tokens(s).slice(0, 3).join(" ")));
  const someoneShare = ctx.recentSubjects.length ? ctx.recentSubjects.filter((s) => /^(someone|somebody)\b/i.test(s)).length / ctx.recentSubjects.length : 0;
  const structShare = (st: SubjectStructure) => (ctx.recentStructures.length ? ctx.recentStructures.filter((x) => x === st).length / ctx.recentStructures.length : 0);
  const may = new Set(ctx.truth.may);
  const rng = ctx.rng ?? Math.random;

  const ranked: RankedSubject[] = cands
    .filter((c) => c && typeof c.subject === "string" && c.subject.trim())
    .map((c) => {
      const subject = c.subject.trim();
      const preheader = String(c.preheader ?? "").trim();
      const notes: string[] = [];
      let score = 1;
      let rejected: string | null = null;
      const detectedStructure = subjectStructureOf(subject);
      if (subject.length > maxChars) rejected = `over ${maxChars} characters`;
      if (subject.length < 12) rejected = rejected ?? "too short";
      for (const hit of detectClaims(`${subject} ${preheader}`)) if (!may.has(hit.cls)) rejected = rejected ?? `unsupported ${hit.cls} claim`;
      if (/[$€£%]|act now|last chance|urgent/i.test(subject)) rejected = rejected ?? "spam-pattern phrasing";
      if (/[A-Z]{4,}/.test(subject.replace(/[^A-Za-z]/g, "")) && /\b[A-Z]{4,}\b/.test(subject)) rejected = rejected ?? "all-caps word";
      const key = new Set(tokens(conceptKey(subject)));
      const maxSim = Math.max(0, ...recentKeys.map((r) => jaccard(key, r)));
      if (maxSim >= 0.5) rejected = rejected ?? `near-duplicate of a recent subject (concept overlap ${maxSim.toFixed(2)})`;
      else if (maxSim >= 0.34) { score *= 0.5; notes.push(`close to a recent subject (${maxSim.toFixed(2)})`); }
      if (recentFirst3.has(tokens(subject).slice(0, 3).join(" ")) && tokens(subject).length >= 3) { score *= 0.4; notes.push("same opening words as a recent subject"); }
      if (/^(someone|somebody)\b/i.test(subject)) { score *= someoneShare >= 0.3 ? 0.15 : someoneShare >= 0.15 ? 0.5 : 0.9; if (someoneShare >= 0.15) notes.push(`"Someone…" already ${Math.round(someoneShare * 100)}% of recent subjects`); }
      if (/^the\b/i.test(subject)) { score *= 0.6; notes.push("'The…' opener (measured loser)"); }
      if (/^(what|why|how|who)\b/i.test(subject) && !/\?\s*$/.test(subject)) { score *= 0.5; notes.push("question-word opener without a question"); }
      if (subject.length > 42) { score *= 0.8; notes.push("over 42 characters"); }
      const share = structShare(detectedStructure);
      if (share >= 0.4) { score *= 0.35; notes.push(`${detectedStructure} already ${Math.round(share * 100)}% of recent subjects`); }
      // A question subject is a strong flavour: two in the account's last five is enough.
      if (detectedStructure === "question" && ctx.recentStructures.slice(0, 5).filter((s) => s === "question").length >= 2) { score *= 0.2; notes.push("two of the last five subjects were already questions"); }
      if (detectedStructure === ctx.plan.subjectStructure) { score *= 1.6; notes.push("matches planned structure"); }
      if (ctx.plan.avoid.subjectStructures.includes(detectedStructure)) score *= 0.4;
      if (detectedStructure === "ellipsis_loop" && ctx.persona && /eckhart|wren|oracle|venus_window|spiritual_oasis/.test(ctx.persona.id)) { score *= 0.2; notes.push("ellipsis does not suit this voice"); }
      // preheader must advance, not echo
      const pj = jaccard(new Set(tokens(subject)), new Set(tokens(preheader)));
      if (!preheader) { score *= 0.5; notes.push("no preheader"); }
      else if (pj >= 0.5) { score *= 0.3; notes.push("preheader echoes the subject"); }
      else if (pj < 0.2) score *= 1.15;
      if (preheader.length > 100) { score *= 0.7; notes.push("preheader over 100 characters"); }
      // persona case expectations
      if (ctx.persona) {
        const words = subject.split(/\s+/).filter((w) => /^[A-Za-z]/.test(w));
        const titleCase = words.length >= 3 && words.filter((w) => /^[A-Z]/.test(w)).length / words.length > 0.75;
        const wantsTitle = ctx.persona.subjectCase === "title" && ctx.plan.account !== "resend_divinepathway";
        if (wantsTitle !== titleCase) { score *= 0.8; notes.push(wantsTitle ? "voice uses Title Case subjects" : "voice uses sentence case subjects"); }
        const hasEmoji = /[\u{1F300}-\u{1FAFF}\u{2600}-\u{27BF}]/u.test(subject);
        if (hasEmoji && !ctx.persona.emojiInSubject) { score *= 0.5; notes.push("voice does not use emoji"); }
      }
      score *= 0.9 + rng() * 0.2;
      return { subject, preheader, structure: c.structure, detectedStructure, score: rejected ? 0 : score, rejected, notes };
    })
    .sort((a, b) => b.score - a.score);
  const chosen = ranked.find((r) => !r.rejected) ?? null;
  return { chosen, ranked };
}
