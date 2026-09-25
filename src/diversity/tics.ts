/**
 * The "one Claude" fingerprint (ADR-0018 §6). Measured on the estate's real copy on 2026-09-05:
 * em-dashes in 95% of V3 emails, "not X, but Y" in 66%, "not a general / not a type" in 39%,
 * "your reading names…" in 24%, "the part worth…" in 22%, staccato "Not a name. Not a date."
 * in 10%, "specific/exact/particular" asserted in 54%. A single occurrence is not a defect; the
 * budget is per email and the feedback names the sentence so the model can fix that one line.
 */
export interface TicSpec {
  id: string;
  label: string;
  pattern: RegExp;
  /** Occurrences allowed per email before it counts against the budget. */
  allow: number;
  /** Corrective instruction, written for the model. */
  fix: string;
}

export const TICS: TicSpec[] = [
  { id: "em_dash", label: "em-dash", pattern: /—|(?<=\w)\s--\s(?=\w)/g, allow: 1, fix: "Use at most one em-dash in the whole email; replace the others with a full stop, a comma or a colon." },
  { id: "not_x_but_y", label: "'not X, but/— Y' contrast", pattern: /\bnot (a|an|the|just|only|because|about)\b[^.;:]{2,60}(,|—)\s*(but|it is|it's|rather|a |an |the )/gi, allow: 1, fix: "Say the thing directly instead of defining it by what it is not." },
  { id: "not_a_general", label: "'not a general / not a type / not a vague'", pattern: /\bnot a (general|generic|type|vague|maybe|theme|mood|shape)\b/gi, allow: 0, fix: "Remove the 'not a general/type' construction; show the specific thing itself." },
  { id: "staccato_negation", label: "staccato 'Not X. Not Y.'", pattern: /\bNot [^.!?]{2,40}\.\s+Not [^.!?]{2,40}\./g, allow: 0, fix: "Replace the 'Not X. Not Y.' pair with one positive sentence." },
  { id: "the_part_worth", label: "'the part worth / the part that…'", pattern: /\bthe part (worth|that|people|most|readers)\b/gi, allow: 0, fix: "Cut 'the part worth…' and state what that part is." },
  { id: "reading_names", label: "'your reading names / doesn't leave it vague'", pattern: /\b(your|the|this) reading (names|doesn'?t (leave|dress|guess)|does not (leave|dress)|won'?t (leave|guess)|isn'?t vague)\b/gi, allow: 1, fix: "Say what the reading contains once; do not describe the reading describing itself." },
  { id: "asserted_specificity", label: "asserted specificity ('specific/exact/precise/particular')", pattern: /\b(specific|exact|exactly|precise|precisely|particular)\b/gi, allow: 1, fix: "Do not say 'specific' or 'exact'; be specific instead — name the object, count or line." },
  { id: "there_is_opener", label: "'There is / There's' as the opening sentence", pattern: /^\s*(There('s| is| are| was))\b/i, allow: 0, fix: "Open on the thing itself, not on 'There is'." },
  { id: "most_some_opener", label: "'Most / Some…' generalisation opener", pattern: /^\s*(Most|Some|Not every|Not everyone)\b/i, allow: 0, fix: "Open on a concrete particular, not a generalisation about most people or most readings." },
  { id: "already_written", label: "'already written / already waiting / sitting there'", pattern: /\b(already (written|waiting|there|sitting|prepared|underway|on the page)|still sitting there)\b/gi, allow: 1, fix: "Say what is waiting once, concretely." },
  { id: "worth_reading", label: "'worth reading / worth a second look'", pattern: /\bworth (reading|seeing|a second look|looking at|pausing)\b/gi, allow: 0, fix: "Cut 'worth reading'; the CTA carries the invitation." },
  { id: "the_kind_of", label: "'the kind of/that…'", pattern: /\bthe kind (of|that)\b/gi, allow: 1, fix: "Name the thing rather than 'the kind of' thing it is." },
  { id: "you_dont_need_to", label: "'you don't need/have to…'", pattern: /\byou (don'?t|do not) (need|have) to\b/gi, allow: 1, fix: "Drop the reassurance clause unless it carries information." },
  { id: "quietly_gently", label: "'quietly / gently / softly'", pattern: /\b(quietly|gently|softly)\b/gi, allow: 1, fix: "Cut the atmospheric adverb." }
];

export interface TicHit {
  id: string;
  label: string;
  count: number;
  over: number;
  examples: string[];
  fix: string;
}

export interface TicReport {
  hits: TicHit[];
  /** Sum of occurrences over allowance, weighted; 0 is clean. */
  score: number;
  /** Distinct constructions over allowance. */
  distinctOver: number;
}

export function detectTics(text: string, subject = ""): TicReport {
  const hits: TicHit[] = [];
  const body = text;
  for (const t of TICS) {
    const scope = /opener$/.test(t.id) ? firstSentence(body) : body;
    const flags = t.pattern.flags.includes("g") ? t.pattern.flags : t.pattern.flags + "g";
    const re = new RegExp(t.pattern.source, flags);
    const matches = [...scope.matchAll(re)];
    const count = matches.length;
    if (count > t.allow) {
      hits.push({ id: t.id, label: t.label, count, over: count - t.allow, examples: matches.slice(0, 3).map((m) => sentenceAround(scope, m.index ?? 0)), fix: t.fix });
    }
  }
  const subjectSomeone = /^(someone|somebody)\b/i.test(subject);
  const score = hits.reduce((a, h) => a + h.over, 0) + (subjectSomeone ? 0 : 0);
  return { hits, score, distinctOver: hits.length };
}

export function firstSentence(text: string): string {
  const t = text.trim();
  const m = /^[\s\S]*?[.!?](\s|$)/.exec(t);
  return (m ? m[0] : t).trim();
}

function sentenceAround(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf(".", index - 1) + 1);
  const endIdx = text.indexOf(".", index);
  const end = endIdx === -1 ? text.length : endIdx + 1;
  return text.slice(start, end).trim().slice(0, 160);
}

/** Paragraph-rhythm sameness: coefficient of variation of paragraph lengths below this reads as a template. */
export function paragraphRhythm(paragraphs: string[]): { cv: number; uniform: boolean } {
  const lens = paragraphs.map((p) => p.trim().split(/\s+/).filter(Boolean).length);
  if (lens.length < 3) return { cv: 1, uniform: false };
  const mean = lens.reduce((a, b) => a + b, 0) / lens.length;
  const sd = Math.sqrt(lens.reduce((a, b) => a + (b - mean) ** 2, 0) / lens.length);
  const cv = mean ? sd / mean : 0;
  return { cv, uniform: cv < 0.18 };
}
