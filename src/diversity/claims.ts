import type { ClaimClass } from "../domain/copy-plan.js";

/**
 * Pre-generation-gate claim detection (ADR-0018 §1/§7). This is NOT the authority — the
 * caller's destination promise contract and its V3 gate remain the truth guards. It exists so
 * an unsupported claim is caught and corrected INSIDE the generation loop with a precise
 * instruction, instead of costing a blind external retry. Patterns are deliberately narrow
 * (a claim a reader would hold us to), mirroring the calibrated shapes in the caller's
 * contract; a miss here is still caught downstream.
 */
export interface ClaimHit {
  cls: ClaimClass;
  quote: string;
}

const CLAIM_PATTERNS: Record<Exclude<ClaimClass, "card" | "message" | "reason" | "outcome">, RegExp[]> = {
  date: [
    /\b(exact|precise|specific|actual)\s+(date|day|calendar\s+day|moment)\b/i,
    /\bthe\s+(exact|precise)\s+(day|date|moment)\b/i,
    /\bthe\s+day\s+(it|they|he|she|this)\s+(arrives?|begins?|happens?|comes?|returns?|lands?|ends?)\b/i,
    /\b(date|day)\s+(is\s+)?marked\b/i,
    /\bmarked\s+(in|on)\s+(your|the)\s+(reading|chart|calendar)\b/i,
    /\b(point|day)\s+on\s+(the|your)\s+calendar\b/i,
    /\bcalendar\s+(date|day)\b/i,
    /\b(monday|tuesday|wednesday|thursday|friday|saturday|sunday)\b/i,
    /\b(january|february|march|april|june|july|august|september|october|november|december)\s+\d{1,2}\b/i
  ],
  // Mirrors the caller's calibrated shapes (config/destination-promise.yaml, 2026-09-05) so an
  // email is corrected here for the same reason the caller would reject it.
  timing_window: [
    /\b(a|the|this|your)\s+(\d+|two|three|four|five|six|seven|nine|ten)[- ](hour|day|week)\s+(window|stretch|period)\b/i,
    /\b(the|a|this|your)\s+window\b/i,
    /\bwindow\s+(opens?|closes?|is\s+open|stays?\s+open|has\s+opened|just\s+opened|narrows)\b/i,
    /\b(your|the)\s+[a-z]{0,12}\s?timing\b/i,
    /\btiming\s+(of|in)\s+(your|the|this)\b/i,
    /\b(exact|precise|specific)\s+timing\b/i,
    /\b(shows?|reveals?|names?|marks?|tells?|pinpoints?)\s+[^.]{0,30}\b(timing|window)\b/i,
    /\bwhat\s+shifts?\s+next\b/i,
    /\bthe\s+moment\s+when\b/i,
    /\bwhen\s+(it|they|he|she|this|the\s+shift|the\s+change)\s+(begins?|opens?|closes?|arrives?|happens?|changes?|returns?|lands?|settles?|starts?)\b/i,
    /\bhow\s+soon\b/i,
    /\bthe\s+(period|stretch|phase)\s+(ahead|that|when)\b/i,
    /\bturning\s+point\b/i,
    /\bwhich (week|days?|period|window) (stands out|matters|to watch)\b/i
  ],
  person: [
    /\bnames? (the|this|that|a) (specific )?(person|man|woman|name)\b/i,
    /\bnames? (who|them|him|her|whose|the\s+person)\b/i,
    /\b(reveal|identify|identifies|shows?) (exactly )?who (it|this|that|they) (is|are|points to)\b/i,
    /\bwho\s+(they|he|she|it)\s+(is|are|was|will\s+be)\b/i,
    /\bwho (wrote|sent|left|it names)\b/i,
    /\b(their|his|her)\s+(name|initial|identity)\b/i,
    /\bthe\s+name\s+of\s+(the|this|that)\b/i,
    /\bfirst\s+initial\b/i,
    /\bidentif(y|ies)\s+(them|him|her|the\s+person)\b/i
  ],
  number: [
    /\b(exact|precise|specific)\s+number\b/i,
    /\bhow\s+many\b/i,
    /\b(the|your)\s+number\s+(is|that|they|which)\b/i,
    /\b\d+\s+(messages?|cards?|signs?|names?|reasons?|dates?|days?|blocks?)\b/i,
    /\(\s*\d+\s*\)/,
    /\bexactly (two|three|four|five)\b/i
  ],
  card_choice: [/\b(choose|pick|select|tap|turn over)\s+(one|a|your|the|any|1)\s+(card|of the cards)\b/i, /\bwhich\s+card\s+(is|calls|speaks)\b/i, /\bchoose\s+one\s+to\b/i, /\bchoose your card\b/i],
  sign_choice: [/\b(choose|select|pick|tap|enter)\s+(your|a|the)\s+(zodiac\s+)?sign\b/i]
};

const BANNED: { code: string; pattern: RegExp; fix: string }[] = [
  { code: "FABRICATED_EVENT", pattern: /\bsomeone (sent|paid|bought|mailed|posted|left|requested|ordered|booked) (you|your|for (you|a|the))\b|\b(two|three|\d+) people (requested|asked for|paid for)\b|\bsent you \$?\d/i, fix: "Remove the invented event; nothing was sent, paid or requested by anyone." },
  { code: "FAKE_URGENCY", pattern: /\b(last (chance|hour|day)|expires? (tonight|today|at midnight)|only \d+ (left|remaining)|closes (tonight|at midnight)|before midnight|act now|hurry)\b/i, fix: "Remove the invented deadline or scarcity." },
  { code: "HEALTH_CLAIM", pattern: /\b(kidney|liver|heart attack|cancer|cure|symptom|diagnos|biofield|toxin|hormone)\b/i, fix: "Remove the health or body claim entirely." },
  { code: "SURVEILLANCE", pattern: /\b(watching you|watch your back|kept tabs on|has been tracking|is tracking you|reviewed your (chart|file|reading) personally|personally (reviewed|watched|checked) your)\b/i, fix: "Remove the surveillance framing; no one is watching or tracking this reader." },
  { code: "GUARANTEE", pattern: /\b(guarantee[ds]?|100%|proven to|scientifically)\b/i, fix: "Remove the guarantee or certainty claim." }
];

export function detectClaims(text: string): ClaimHit[] {
  const hits: ClaimHit[] = [];
  const t = text.replace(/\s+/g, " ");
  for (const [cls, patterns] of Object.entries(CLAIM_PATTERNS) as [ClaimClass, RegExp[]][]) {
    let found = false;
    for (const re of patterns) {
      // Every occurrence is examined: a denial earlier in the text ("not a date") must not hide a
      // real claim later in it.
      const g = new RegExp(re.source, re.flags.includes("g") ? re.flags : re.flags + "g");
      for (const m of t.matchAll(g)) {
        const before = t.slice(Math.max(0, m.index - 40), m.index);
        // A denial or hypothetical is not a claim ("not a date", "doesn't hand you a name", "whether it names them").
        if (/\b(not|no|never|isn'?t|doesn'?t|won'?t|without|rather than|instead of|nor|whether)\b[^.]{0,25}$/i.test(before)) continue;
        hits.push({ cls, quote: sentenceAround(t, m.index) });
        found = true;
        break;
      }
      if (found) break;
    }
  }
  return hits;
}

export function detectBanned(text: string): { code: string; quote: string; fix: string }[] {
  const t = text.replace(/\s+/g, " ");
  const out: { code: string; quote: string; fix: string }[] = [];
  for (const b of BANNED) {
    const m = b.pattern.exec(t);
    if (m) out.push({ code: b.code, quote: sentenceAround(t, m.index ?? 0), fix: b.fix });
  }
  return out;
}

function sentenceAround(text: string, index: number): string {
  const start = Math.max(0, text.lastIndexOf(".", index - 1) + 1);
  const endIdx = text.indexOf(".", index);
  const end = endIdx === -1 ? text.length : endIdx + 1;
  return text.slice(start, end).trim().slice(0, 180);
}

export const CLAIM_LABELS: Record<ClaimClass, string> = {
  date: "an exact date or calendar day",
  timing_window: "a timing window, period, or when something shifts",
  person: "the identity or name of a specific person",
  number: "a specific count or number",
  card_choice: "choosing, picking or tapping a card",
  sign_choice: "choosing a zodiac sign",
  card: "a card and what it shows",
  message: "a message that exists for the reader",
  reason: "the reason behind something",
  outcome: "what happens next"
};
