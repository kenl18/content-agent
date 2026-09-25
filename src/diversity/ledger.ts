import { appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import type { AngleId, ArchitectureId, CtaFamily, EmotionalEngine, HookFamily, LedgerEntry, LengthFamily, PromiseType, SubjectStructure } from "../domain/copy-plan.js";
import { primaryAngle } from "./angles.js";
import { lengthFamilyForWords } from "./length-families.js";
import { detectTics } from "./tics.js";

/**
 * The concept diversity ledger (ADR-0018 §4, §11): one append-only JSONL file per account,
 * holding CONCEPT labels (angle, architecture, hook, engine, promise, CTA family, length
 * family, subject structure) for every email the service produced — never bodies. The planner
 * reads the recent window before composing; the caller may join entries to delivery and revenue
 * later by requestId. Owner-approved exception to the V1 "no persistence" boundary: a flat file,
 * no database, no query engine, no cross-request state beyond these labels.
 */
export interface LedgerOptions {
  dir: string;
  now?: () => Date;
}

export const DEFAULT_LEDGER_DIR = join(process.cwd(), "data", "copy-ledger");

const safe = (s: string) => s.replace(/[^a-z0-9_.-]/gi, "_").slice(0, 80);

export class CopyLedger {
  private readonly dir: string;
  private readonly now: () => Date;

  constructor(options: LedgerOptions) {
    this.dir = options.dir;
    this.now = options.now ?? (() => new Date());
  }

  file(account: string): string {
    return join(this.dir, `${safe(account)}.jsonl`);
  }

  append(entry: LedgerEntry): void {
    mkdirSync(this.dir, { recursive: true });
    appendFileSync(this.file(entry.account), JSON.stringify(entry) + "\n", "utf8");
  }

  /** Entries for one account within the last `days`, newest first. */
  recent(account: string, days = 14): LedgerEntry[] {
    const f = this.file(account);
    if (!existsSync(f)) return [];
    const cutoff = this.now().getTime() - days * 86400e3;
    const out: LedgerEntry[] = [];
    for (const line of readFileSync(f, "utf8").split("\n")) {
      if (!line.trim()) continue;
      try {
        const e = JSON.parse(line) as LedgerEntry;
        if (new Date(e.at).getTime() >= cutoff) out.push(e);
      } catch {
        /* skip corrupt line */
      }
    }
    return out.sort((a, b) => (a.at < b.at ? 1 : -1));
  }

  /** Entries recorded for the same send (earlier attempts), newest first. */
  attemptsFor(account: string, sendKey: string, days = 3): LedgerEntry[] {
    return this.recent(account, days).filter((e) => e.sendKey === sendKey);
  }

  accounts(): string[] {
    if (!existsSync(this.dir)) return [];
    return readdirSync(this.dir).filter((f) => f.endsWith(".jsonl")).map((f) => f.replace(/\.jsonl$/, ""));
  }
}

/** Counts of each concept label in a window, plus the last few in order. */
export interface RecentProfile {
  n: number;
  angles: Record<string, number>;
  architectures: Record<string, number>;
  hooks: Record<string, number>;
  engines: Record<string, number>;
  lengthFamilies: Record<string, number>;
  subjectStructures: Record<string, number>;
  ctaFamilies: Record<string, number>;
  promiseTypes: Record<string, number>;
  lastAngles: AngleId[];
  lastArchitectures: ArchitectureId[];
  lastEngines: EmotionalEngine[];
  lastSubjectStructures: SubjectStructure[];
  lastLengthFamilies: LengthFamily[];
  recentSubjects: string[];
  recentOpeners: string[];
}

export function profileOf(entries: LedgerEntry[], last = 5): RecentProfile {
  const count = (key: keyof LedgerEntry) => {
    const m: Record<string, number> = {};
    for (const e of entries) {
      const v = e[key];
      if (v == null) continue;
      m[String(v)] = (m[String(v)] || 0) + 1;
    }
    return m;
  };
  const head = entries.slice(0, last);
  return {
    n: entries.length,
    angles: count("angle"),
    architectures: count("architecture"),
    hooks: count("hookFamily"),
    engines: count("emotionalEngine"),
    lengthFamilies: count("lengthFamily"),
    subjectStructures: count("subjectStructure"),
    ctaFamilies: count("ctaFamily"),
    promiseTypes: count("promiseType"),
    lastAngles: head.map((e) => e.angle),
    lastArchitectures: head.map((e) => e.architecture),
    lastEngines: head.map((e) => e.emotionalEngine).filter((x): x is EmotionalEngine => Boolean(x)),
    lastSubjectStructures: head.map((e) => e.subjectStructure),
    lastLengthFamilies: head.map((e) => e.lengthFamily),
    recentSubjects: entries.slice(0, 30).map((e) => e.subject).filter(Boolean),
    recentOpeners: []
  };
}

// ---------------------------------------------------------------------------------------------
// Classification of arbitrary finished copy into concept labels (used to seed the ledger from a
// caller's history and to label what a caller's own retries produced).
// ---------------------------------------------------------------------------------------------
export interface CopyLabels {
  angle: AngleId;
  architecture: ArchitectureId;
  hookFamily: HookFamily;
  promiseType: PromiseType;
  ctaFamily: CtaFamily;
  subjectStructure: SubjectStructure;
  lengthFamily: LengthFamily;
  words: number;
  paragraphs: number;
  ticScore: number;
}

export function hookFamilyOf(subject: string): HookFamily {
  const s = subject.trim();
  if (/^(someone|somebody)\b/i.test(s)) return "someone_opener";
  if (/\?\s*$/.test(s)) return "question";
  if (/^(i|we|my|she|he)\b/i.test(s)) return "practitioner_first_person";
  if (/^(read|open|choose|pick|turn|look|start|ask|say)\b/i.test(s)) return "instruction";
  if (/\b(one|two|three|twice|\d+)\b/i.test(s) && /\b(card|message|placement|name|day|hour|night)s?\b/i.test(s)) return "count_number";
  if (/^(you|your)\b/i.test(s)) return "direct_you";
  if (/^(a|an|the|one) [a-z' -]*?(card|message|reading|name|line|page|question|number|hour|day|week|night|window|sketch|letter)\b/i.test(s)) return "object_image";
  if (/\b(came|kept|held|left|went|stopped|turned|moved|paused|arrived|changed|shifted|started|circled|ended|surfaced|returned|opened)\b/i.test(s)) return "event_past_tense";
  if (/^[^.?!]{1,30}$/.test(s) && s.split(/\s+/).length <= 4) return "fragment";
  if (/^(there|something|most|some|not|it |in |when |every|this)\b/i.test(s)) return "observation_statement";
  return "other";
}

export function subjectStructureOf(subject: string): SubjectStructure {
  const s = subject.trim();
  if (/\?\s*$/.test(s)) return "question";
  if (/(\.\.\.|…)\s*$/.test(s)) return "ellipsis_loop";
  if (s.split(/\s+/).length <= 4) return "fragment";
  if (/\b(one|two|three|twice|\d+|card|table|page|line|hour|week|night|phone|photograph|song)\b/i.test(s) && /\b(came|kept|held|left|stopped|turned|moved|paused|arrived|circled|surfaced|returned|opened|read)\b/i.test(s)) return "specific_observation";
  if (/\b(worth|might|tends|usually|easy to miss|before)\b/i.test(s)) return "restrained_curiosity";
  return "statement";
}

export function promiseTypeOf(text: string): PromiseType {
  if (/\b(choose|pick|tap|select)\b[^.]{0,20}\bcard\b/i.test(text)) return "card_choice";
  if (/\bwindow\b|\d+-hour|\bwhen (it|this)\b/i.test(text)) return "timing";
  if (/\bnames? (the|this|that|a) (specific )?person|\bwho (it|this) (is|points)|\breveal(s)? who|\bnames (who|them)\b/i.test(text)) return "person";
  if (/\bmessage\b/i.test(text)) return "message";
  if (/\bcard\b/i.test(text)) return "card";
  if (/\b(reason|why)\b/i.test(text)) return "reason";
  if (/\b(what happens|how (it|this) (ends|resolves)|outcome)\b/i.test(text)) return "outcome";
  return "reading";
}

export function ctaFamilyOf(cta: string): CtaFamily {
  const c = cta.toLowerCase();
  if (/\b(choose|pick|tap|select|turn over)\b/.test(c)) return "CHOOSE_CARD";
  if (/\bwho\b|\bperson\b|\bname\b/.test(c)) return "REVEAL_PERSON";
  if (/\bmessage\b|\bwrote\b|\bsent\b|\bleft\b/.test(c)) return "REVEAL_MESSAGE";
  if (/\bcard\b/.test(c)) return "REVEAL_CARD";
  if (/\bwhen\b|\bwindow\b|\bperiod\b|\bday\b|\btiming\b/.test(c)) return "REVEAL_TIMING";
  if (/\bwhy\b|\breason\b|\bbehind\b/.test(c)) return "REVEAL_REASON";
  if (/\bchanged\b|\bbetween\b|\bshifted\b/.test(c)) return "SEE_WHAT_CHANGED";
  if (/\bwaiting\b|\bready\b/.test(c)) return "SEE_WHAT_IS_WAITING";
  if (/\b(next|happens|ends|resolves)\b/.test(c)) return "REVEAL_OUTCOME";
  return "OPEN_READING";
}

export function architectureOf(subject: string, paragraphs: string[], words: number): ArchitectureId {
  const first = paragraphs[0] ?? "";
  const all = paragraphs.join(" ");
  if (/\b(choose|pick|tap|select)\b[^.]{0,30}\bcard\b/i.test(all)) return "interaction_invitation";
  if (paragraphs.length <= 1 && words < 70) return "sparse_alert";
  if (words < 90 && paragraphs.length <= 3) return "short_personal_note";
  if (/^\s*[^.?!]*\?/.test(first)) return "question_tension_reveal";
  if (/\b(I|I've|I'm|my)\b/.test(all) && words >= 170) return "reflective_letter";
  if (/\b(she|he|they|someone)\b[^.]{0,40}\b(turned|paused|stopped|set aside|wrote|typed|walked|sat)\b/i.test(first) || /^(someone|somebody)\b/i.test(subject)) return "story_fragment_unresolved";
  if (/^\s*(what|how|why)\b[^.]*\b(reading|looks at|looks for)\b/i.test(subject) || /\b(a|this) (kind of|type of) reading (looks|works|does)\b/i.test(all)) return "explanatory_authority_note";
  if (/\byou (keep|find yourself|have been|notice|re-read|check)\b/i.test(first)) return "pattern_recognition_relevance";
  if (/\?/.test(all)) return "observation_unanswered_question";
  return "observation_implication_reveal";
}

export function classifyCopy(copy: { subject: string; lede?: string; body: string; paragraphs?: string[]; cta?: string }): CopyLabels {
  const paragraphs = copy.paragraphs && copy.paragraphs.length ? copy.paragraphs : String(copy.body).split(/\n+/).map((s) => s.trim()).filter(Boolean);
  const text = `${copy.lede ?? ""} ${paragraphs.join(" ")}`;
  const words = text.trim().split(/\s+/).filter(Boolean).length;
  return {
    angle: primaryAngle(`${copy.subject} ${text}`),
    architecture: architectureOf(copy.subject, paragraphs, words),
    hookFamily: hookFamilyOf(copy.subject),
    promiseType: promiseTypeOf(`${copy.subject} ${text} ${copy.cta ?? ""}`),
    ctaFamily: ctaFamilyOf(copy.cta ?? ""),
    subjectStructure: subjectStructureOf(copy.subject),
    lengthFamily: lengthFamilyForWords(words),
    words,
    paragraphs: paragraphs.length,
    ticScore: detectTics(text, copy.subject).score
  };
}
