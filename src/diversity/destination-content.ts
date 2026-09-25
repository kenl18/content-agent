import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

/**
 * Destination content packs (ADR-0018 §9): what a landing page actually says, quoted from the
 * page by scripts/build-destination-content.mts. The pack supplies SPECIFICITY (headings, the
 * mechanic, what the reading is called, what appears after the click); the caller's promise
 * contract still decides what may be CLAIMED. A missing pack is not an error — the brief simply
 * carries the contract facts alone.
 */
export interface DestinationPack {
  slug: string;
  label: string;
  url: string;
  fetchedAt: string;
  contract: { interaction_type: string | null; primary_payoff: string | null; secondary_payoff: string | null; allowed_claims: string[] };
  page: {
    title: string;
    headings: string[];
    buttons: string[];
    paragraphs: string[];
    mechanics: { hasEmailInput: boolean; cardChoice: boolean; stepMarker: string | null; countdown: boolean; images: number };
  };
  sampleConcepts: string[];
}

export const DEFAULT_PACK_DIR = join(process.cwd(), "data", "destination-content");

export function loadDestinationPack(slug: string | null, dir = DEFAULT_PACK_DIR): DestinationPack | null {
  if (!slug) return null;
  const f = join(dir, `${slug}.json`);
  if (!existsSync(f)) return null;
  try {
    return JSON.parse(readFileSync(f, "utf8")) as DestinationPack;
  } catch {
    return null;
  }
}

// Testimonials and boilerplate never reach the brief: the copy must not echo a reviewer's words
// or invent one, and a timer on the page is not a licence for urgency in an email.
const NOISE = /(privacy|cookie|terms|copyright|©|unsubscribe|all rights|disclaimer|entertainment purposes|results may vary|earnings|affiliate|^working\.{0,3}$|^["“]|["”]\s*[—–-]\s*[A-Z]|skeptical|gave me chills|\bI (almost|tried|was|needed|read)\b)/i;

/** A compact, quoted description of the page for the brief. Never more than ~900 characters. */
export function renderPackBrief(pack: DestinationPack | null): string | null {
  if (!pack) return null;
  const lines: string[] = [];
  const heads = pack.page.headings.filter((h) => !NOISE.test(h)).slice(0, 5);
  const buttons = pack.page.buttons.filter((b) => !NOISE.test(b)).slice(0, 3);
  const paras = pack.page.paragraphs.filter((p) => !NOISE.test(p)).slice(0, 4);
  lines.push(`What the page says about itself (quoted, ${pack.fetchedAt.slice(0, 10)}):`);
  if (pack.page.title) lines.push(`  Page title: "${pack.page.title}"`);
  for (const h of heads) lines.push(`  Heading: "${h}"`);
  for (const b of buttons) lines.push(`  Button: "${b}"`);
  for (const p of paras) lines.push(`  On the page: "${p.length > 180 ? p.slice(0, 177) + "…" : p}"`);
  const m = pack.page.mechanics;
  const mech: string[] = [];
  if (m.cardChoice) mech.push("the reader chooses a card");
  if (m.hasEmailInput) mech.push("the page asks for an email address before the reading");
  if (m.stepMarker) mech.push(`the page is marked "${m.stepMarker}" (a multi-step reading)`);
  if (!mech.length) mech.push("a reading page to read, nothing to choose or enter");
  lines.push(`  Mechanics: ${mech.join("; ")}.`);
  if (pack.sampleConcepts.length) lines.push(`  True concepts the copy may draw on: ${pack.sampleConcepts.join("; ")}`);
  const out = lines.join("\n");
  return out.length > 950 ? out.slice(0, 947) + "…" : out;
}
