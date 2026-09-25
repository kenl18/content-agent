import type { LengthFamily, WordBand } from "../domain/copy-plan.js";

/**
 * Length families (ADR-0018 §2). Guidance bands, never padding targets: "length follows the
 * idea". A caller may impose a HARD band (EmailOps' V3 gate rejects outside 80–160 today); a
 * family is eligible only where it overlaps that band by at least MIN_OVERLAP words, and its
 * effective band is the overlap.
 */
export interface LengthFamilySpec {
  id: LengthFamily;
  label: string;
  band: WordBand;
  /** Relative frequency the planner aims for when every family is eligible. */
  baseWeight: number;
  paragraphs: { min: number; max: number };
  guidance: string;
}

export const LENGTH_FAMILY_SPECS: Record<LengthFamily, LengthFamilySpec> = {
  short_note: {
    id: "short_note",
    label: "SHORT NOTE",
    band: { min: 55, max: 85 },
    baseWeight: 0.2,
    paragraphs: { min: 1, max: 3 },
    guidance: "One idea, said once, stopped early. No build-up, no second beat."
  },
  standard: {
    id: "standard",
    label: "STANDARD",
    band: { min: 90, max: 130 },
    baseWeight: 0.45,
    paragraphs: { min: 3, max: 4 },
    guidance: "Hook, one development, CTA. The idea earns every sentence."
  },
  story: {
    id: "story",
    label: "STORY / OPEN LOOP",
    band: { min: 130, max: 180 },
    baseWeight: 0.25,
    paragraphs: { min: 3, max: 5 },
    guidance: "A moment in motion with one unresolved line; the CTA is where it resolves."
  },
  long_form: {
    id: "long_form",
    label: "LONG-FORM LETTER",
    band: { min: 180, max: 230 },
    baseWeight: 0.1,
    paragraphs: { min: 4, max: 6 },
    guidance: "Occasional. A letter with a reason to be long: a genuine narrative or a real explanation, never restatement."
  }
};

export const MIN_OVERLAP_WORDS = 20;

export interface EligibleLengthFamily {
  id: LengthFamily;
  band: WordBand;
  clipped: boolean;
}

export function overlapBand(a: WordBand, b: WordBand): WordBand | null {
  const min = Math.max(a.min, b.min);
  const max = Math.min(a.max, b.max);
  return max - min >= 0 ? { min, max } : null;
}

/** Families whose band overlaps the caller's hard band enough to be honest guidance. */
export function eligibleLengthFamilies(hard: WordBand | null): EligibleLengthFamily[] {
  const out: EligibleLengthFamily[] = [];
  for (const spec of Object.values(LENGTH_FAMILY_SPECS)) {
    if (!hard) {
      out.push({ id: spec.id, band: spec.band, clipped: false });
      continue;
    }
    const o = overlapBand(spec.band, hard);
    if (o && o.max - o.min + 1 >= MIN_OVERLAP_WORDS) {
      out.push({ id: spec.id, band: o, clipped: o.min !== spec.band.min || o.max !== spec.band.max });
    }
  }
  return out;
}

export function lengthFamilyForWords(words: number): LengthFamily {
  if (words < 88) return "short_note";
  if (words <= 130) return "standard";
  if (words <= 180) return "story";
  return "long_form";
}
