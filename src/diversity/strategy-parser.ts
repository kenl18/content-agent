import type { ClaimClass, WordBand } from "../domain/copy-plan.js";

/**
 * Reads the structured facts a caller embeds in `context.strategy` prose (ADR-0018). The
 * parser is tolerant: every field is optional and a block that is absent or reworded simply
 * yields nothing — the planner then FAILS CLOSED (no precision claims, no persona-specific
 * voice) and the caller's own text is still passed to the model verbatim. Nothing here invents
 * a fact that is not in the text.
 */
export interface DestinationTruth {
  headline: string | null;
  button: string | null;
  interaction: string | null;
  may: ClaimClass[];
  mayNot: ClaimClass[];
  subjectMatter: string[];
  /** true when the contract block was found and parsed; false means fail closed. */
  established: boolean;
  unverifiedReason: string | null;
}

export interface CtaRule {
  verbs: string[];
  maxChars: number | null;
  intents: string[];
  bannedLabels: string[];
  interactionAllowed: boolean;
}

export interface ParsedStrategy {
  truth: DestinationTruth;
  cta: CtaRule | null;
  brand: string | null;
  signoff: string | null;
  fromNames: string[];
  siblingBrands: string[];
  voice: string | null;
  avoidSubjects: string[];
  preferredFrames: string[];
  loserStructures: string[];
  recentFrameHistory: string | null;
  hardBand: WordBand | null;
  paragraphBand: { min: number; max: number } | null;
  retryNote: string | null;
  /** Text outside the recognised blocks, kept for verbatim pass-through. */
  otherText: string;
  blocksFound: string[];
}

const CLAIM_BY_LABEL: [RegExp, ClaimClass][] = [
  [/exact date|calendar day/i, "date"],
  [/timing window|period, or when/i, "timing_window"],
  [/identity or name of a specific person/i, "person"],
  [/specific count or number/i, "number"],
  [/choosing\/picking\/tapping a card|choosing, picking or tapping a card/i, "card_choice"],
  [/choosing a zodiac sign/i, "sign_choice"]
];
const SOFT_CLASSES: ClaimClass[] = ["card", "message", "reason", "outcome"];

function section(text: string, startRe: RegExp, endRes: RegExp[]): string | null {
  const m = startRe.exec(text);
  if (!m) return null;
  const start = m.index;
  let end = text.length;
  for (const re of endRes) {
    const r = new RegExp(re.source, re.flags.replace("g", ""));
    const rest = text.slice(start + m[0].length);
    const e = r.exec(rest);
    if (e && start + m[0].length + e.index < end) end = start + m[0].length + e.index;
  }
  return text.slice(start, end);
}

const BLOCK_STARTS = {
  winner: /WINNER LIBRARY GUIDANCE/i,
  promise: /DESTINATION PROMISE CONTRACT/i,
  v3: /EMAILOPS COPY STANDARD V\d/i,
  cta: /CTA RULE \(/i
};
const ALL_STARTS = Object.values(BLOCK_STARTS);

export function parseStrategy(strategy: string | undefined | null): ParsedStrategy {
  const text = String(strategy ?? "");
  const found: string[] = [];
  const winner = section(text, BLOCK_STARTS.winner, ALL_STARTS.filter((r) => r !== BLOCK_STARTS.winner));
  const promise = section(text, BLOCK_STARTS.promise, ALL_STARTS.filter((r) => r !== BLOCK_STARTS.promise));
  const v3 = section(text, BLOCK_STARTS.v3, ALL_STARTS.filter((r) => r !== BLOCK_STARTS.v3));
  const ctaBlock = section(text, BLOCK_STARTS.cta, ALL_STARTS.filter((r) => r !== BLOCK_STARTS.cta));
  if (winner) found.push("winner-library");
  if (promise) found.push("promise-contract");
  if (v3) found.push("v3-standard");
  if (ctaBlock) found.push("cta-rule");

  // --- destination truth
  const truth: DestinationTruth = { headline: null, button: null, interaction: null, may: [], mayNot: [], subjectMatter: [], established: false, unverifiedReason: null };
  if (promise) {
    truth.established = true;
    const nv = /TRUTH IS NOT ESTABLISHED \(([^)]*)\)/i.exec(promise);
    if (nv) {
      truth.unverifiedReason = nv[1] ?? "unverified";
      truth.mayNot = ["date", "timing_window", "person", "number", "card_choice", "sign_choice"];
      truth.may = [];
    } else {
      truth.headline = /Its own headline:\s*"([^"\n]+)"/i.exec(promise)?.[1] ?? null;
      truth.button = /Its own button:\s*"([^"\n]+)"/i.exec(promise)?.[1] ?? null;
      truth.interaction = /Interaction it asks for:\s*([a-z_]+)/i.exec(promise)?.[1] ?? null;
      const mayBlock = /YOU MAY refer to[^\n]*\n([\s\S]*?)(?=\n\s*YOU MAY NOT|\n\s*The page's own subject|\n\s*The CTA obeys|$)/i.exec(promise)?.[1] ?? "";
      const mayNotBlock = /YOU MAY NOT claim[^\n]*\n([\s\S]*?)(?=\n\s*The page's own subject|\n\s*The CTA obeys|$)/i.exec(promise)?.[1] ?? "";
      for (const [re, cls] of CLAIM_BY_LABEL) {
        if (re.test(mayBlock)) truth.may.push(cls);
        if (re.test(mayNotBlock)) truth.mayNot.push(cls);
      }
      const subj = /subject matter includes:\s*([^\n.]+)/i.exec(promise)?.[1];
      if (subj) truth.subjectMatter = subj.split(/,\s*/).map((s) => s.trim().toLowerCase()).filter(Boolean);
      for (const s of SOFT_CLASSES) if (truth.subjectMatter.includes(s)) truth.may.push(s);
      // Precision classes never mentioned either way are treated as forbidden (fail closed).
      for (const [, cls] of CLAIM_BY_LABEL) if (!truth.may.includes(cls) && !truth.mayNot.includes(cls)) truth.mayNot.push(cls);
      if (truth.interaction === "choose_card" && !truth.may.includes("card_choice")) truth.may.push("card_choice");
    }
  }

  // --- CTA rule
  let cta: CtaRule | null = null;
  if (ctaBlock) {
    const verbs = /action verbs:\s*([^\n.]+)/i.exec(ctaBlock)?.[1]?.split(/,\s*/).map((v) => v.trim().toLowerCase()).filter(Boolean) ?? [];
    const maxChars = Number(/under (\d+) characters/i.exec(ctaBlock)?.[1] ?? "") || null;
    const intents = [...ctaBlock.matchAll(/\b([A-Z_]{6,})\s*\(/g)].map((m) => m[1]!).filter((v, i, a) => a.indexOf(v) === i);
    const bannedLine = /generic destination label:\s*([^\n]+)/i.exec(ctaBlock)?.[1] ?? "";
    const bannedLabels = [...bannedLine.matchAll(/"([^"]+)"/g)].map((m) => m[1]!.toLowerCase());
    const interactionAllowed = /genuinely offers/i.test(ctaBlock) && !/Do NOT ask the reader to choose/i.test(ctaBlock);
    cta = { verbs, maxChars, intents, bannedLabels, interactionAllowed };
  }

  // --- winner library / identity
  let brand: string | null = null, signoff: string | null = null, voice: string | null = null, recentFrameHistory: string | null = null;
  let fromNames: string[] = [], siblingBrands: string[] = [], avoidSubjects: string[] = [], preferredFrames: string[] = [], loserStructures: string[] = [];
  const src = winner ?? text;
  brand = /This email is from\s*"([^"]+)"/i.exec(src)?.[1] ?? null;
  signoff = /Its sign-off \("([^"]+)"\)/i.exec(src)?.[1] ?? null;
  fromNames = (/Approved sender identities:\s*([^\n.]+)/i.exec(src)?.[1] ?? "").split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  siblingBrands = (/any other brand in this estate:\s*([^\n.]+)/i.exec(src)?.[1] ?? "").split(/,\s*/).map((s) => s.trim()).filter(Boolean);
  voice = /VOICE \([^)]*\):\s*([^\n]+)/i.exec(src)?.[1]?.trim() ?? null;
  const avoidLine = /Do not echo or paraphrase any of these recent subjects:\s*([^\n]+)/i.exec(src)?.[1] ?? "";
  avoidSubjects = [...avoidLine.matchAll(/"([^"]+)"/g)].map((m) => m[1]!);
  preferredFrames = [...src.matchAll(/^\s*\*\s*\[(PROVEN|PROMISING)\]\s*([a-z0-9-]+):/gim)].map((m) => `${m[2]} (${m[1]})`);
  const avoidBlock = /AVOID these structures[^\n]*\n((?:\s*-[^\n]*\n?)+)/i.exec(src)?.[1] ?? "";
  loserStructures = [...avoidBlock.matchAll(/^\s*-\s*([^\n]+?)(?:\s*->[^\n]*)?$/gm)].map((m) => m[1]!.trim());
  recentFrameHistory = /Recent frame history[^:]*:\s*([^\n]+)/i.exec(src)?.[1]?.trim() ?? null;

  // --- bands
  let hardBand: WordBand | null = null;
  const hb = /(\d{2,3})-(\d{2,3}) words total/i.exec(v3 ?? text);
  if (hb) hardBand = { min: Number(hb[1]), max: Number(hb[2]) };
  let paragraphBand: { min: number; max: number } | null = null;
  const pb = /(\d)-(\d) paragraphs/i.exec(v3 ?? text);
  if (pb) paragraphBand = { min: Number(pb[1]), max: Number(pb[2]) };

  const retryNote = /Previous attempt was rejected:\s*([^\n]+)/i.exec(text)?.[1]?.trim() ?? null;

  let otherText = text;
  for (const b of [winner, promise, v3, ctaBlock]) if (b) otherText = otherText.replace(b, "");
  otherText = otherText.replace(/Previous attempt was rejected:[^\n]*/i, "").replace(/^\s*Destination [a-z0-9-]+\. Single idea, single CTA\.\s*/i, "").trim();

  return { truth, cta, brand, signoff, fromNames, siblingBrands, voice, avoidSubjects, preferredFrames, loserStructures, recentFrameHistory, hardBand, paragraphBand, retryNote, otherText, blocksFound: found };
}

/** The gateway slug or funnel key at the end of a destination URL, else null. */
export function destinationSlugFromUrl(url: unknown): string | null {
  if (typeof url !== "string") return null;
  const m = /\/([a-z0-9][a-z0-9-]*)\/?(?:[?#].*)?$/i.exec(url.trim());
  return m ? m[1]!.toLowerCase() : null;
}

/**
 * The account key for the diversity ledger. Preferred: an explicit `context.account` or
 * `context.sender.account`. Compatibility: EmailOps' requestId shape
 * `emailops-daily-<day>-<esp>-<hhmm>-<attempt>` (documented in ADR-0018 as a shim while the
 * caller cannot yet pass the field). Fallback: the brand named in the strategy text.
 */
export function resolveAccount(request: { requestId: string; context: Record<string, unknown> }, parsed: ParsedStrategy): { account: string | null; sendKey: string | null; attempt: number } {
  const ctx = request.context;
  const explicit = typeof ctx.account === "string" ? ctx.account : typeof (ctx.sender as { account?: unknown } | undefined)?.account === "string" ? String((ctx.sender as { account: string }).account) : null;
  const m = /^([a-z]+)-daily-(\d{4}-\d{2}-\d{2})-([a-z0-9_]+)-(\d{4})-(\d+)$/i.exec(request.requestId);
  if (m) return { account: explicit ?? m[3]!, sendKey: `${m[1]}-daily-${m[2]}-${m[3]}-${m[4]}`, attempt: Number(m[5]) };
  const attempt = Number(/-(\d+)$/.exec(request.requestId)?.[1] ?? "1") || 1;
  return { account: explicit ?? (parsed.brand ? parsed.brand.toLowerCase().replace(/\s+/g, "_") : null), sendKey: null, attempt };
}
