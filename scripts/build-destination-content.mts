/**
 * Destination content pack builder (ADR-0018 §9).
 *
 *   npx tsx scripts/build-destination-content.mts <destinations.json> [--out data/destination-content]
 *
 * Input: a JSON object { slug: { url, label, interaction_type, primary_payoff, secondary_payoff,
 * allowed_claims } } — the caller's own destination record (EmailOps exports it from its promise
 * contract; any consumer can supply the same shape). The script fetches each FINAL page once,
 * directly (never through a click gateway or an affiliate link), with no script execution, and
 * extracts what the page actually says: headings, buttons, form presence, step markers, and short
 * text snippets. Everything stored is quoted from the page; nothing is inferred. The pack is a
 * source of truthful specificity for the brief; the caller's promise contract remains the
 * authority on what may be CLAIMED.
 */
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const input = process.argv[2];
const outIdx = process.argv.indexOf("--out");
const outDir = outIdx > 0 ? process.argv[outIdx + 1]! : join(process.cwd(), "data", "destination-content");
if (!input) {
  console.error("usage: build-destination-content.mts <destinations.json> [--out dir]");
  process.exit(2);
}
mkdirSync(outDir, { recursive: true });

const decode = (s: string) =>
  s
    .replace(/&nbsp;|&#160;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;|&rsquo;|&#8217;/g, "'")
    .replace(/&ldquo;|&rdquo;/g, '"')
    .replace(/&mdash;|&#8212;/g, "—")
    .replace(/&hellip;/g, "…")
    .replace(/&#\d+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
const strip = (html: string) => decode(html.replace(/<[^>]+>/g, " "));

function extract(html: string) {
  const noScripts = html.replace(/<(script|style|noscript)\b[^>]*>[\s\S]*?<\/\1>/gi, " ");
  const title = decode((/<title[^>]*>([\s\S]*?)<\/title>/i.exec(noScripts)?.[1] ?? ""));
  const headings: string[] = [];
  for (const m of noScripts.matchAll(/<h([1-4])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) {
    const t = strip(m[2]!);
    if (t && t.length <= 160 && !headings.includes(t)) headings.push(t);
  }
  const buttons: string[] = [];
  for (const m of noScripts.matchAll(/<(button|a)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = strip(m[2]!);
    if (t && t.length <= 60 && /[a-z]/i.test(t) && !buttons.includes(t) && /(reveal|read|see|show|tap|click|start|begin|choose|pick|unlock|unveil|get|find|discover|continue|next|yes|open|claim)/i.test(t)) buttons.push(t);
  }
  for (const m of noScripts.matchAll(/<input\b[^>]*type=["']?submit["']?[^>]*value=["']([^"']+)["']/gi)) {
    const t = decode(m[1]!);
    if (t && !buttons.includes(t)) buttons.push(t);
  }
  const paragraphs: string[] = [];
  for (const m of noScripts.matchAll(/<(p|li|h5|h6|span|div)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const t = strip(m[2]!);
    if (t.length >= 40 && t.length <= 240 && /[a-z]/.test(t) && !/cookie|privacy|terms|copyright|©|unsubscribe|all rights/i.test(t) && !paragraphs.includes(t)) paragraphs.push(t);
    if (paragraphs.length >= 14) break;
  }
  const hasEmailInput = /<input\b[^>]*type=["']?email["']?/i.test(noScripts) || /name=["']?email["']?/i.test(noScripts);
  const cardChoice = /(choose|pick|select|tap)\s+(one|a|your)\s+card|choose your card|card\s*\d\b/i.test(noScripts);
  const stepMarker = /step\s*(\d)\s*(of|\/)\s*(\d)/i.exec(strip(noScripts))?.[0] ?? null;
  const countdown = /(\d{1,2})[- ]hour|countdown|timer/i.test(noScripts);
  const images = (noScripts.match(/<img\b/gi) || []).length;
  return { title, headings: headings.slice(0, 12), buttons: buttons.slice(0, 8), paragraphs, mechanics: { hasEmailInput, cardChoice, stepMarker, countdown, images } };
}

const dests = JSON.parse(readFileSync(input, "utf8")) as Record<string, { url: string; label?: string; interaction_type?: string | null; primary_payoff?: string | null; secondary_payoff?: string | null; allowed_claims?: string[] }>;
const results: Record<string, unknown> = {};
for (const [slug, d] of Object.entries(dests)) {
  process.stdout.write(`${slug.padEnd(22)} ${d.url} `);
  try {
    const res = await fetch(d.url, { redirect: "follow", headers: { "user-agent": "Mozilla/5.0 (content-agent destination content pack; read-only)" }, signal: AbortSignal.timeout(20000) });
    const html = await res.text();
    const x = extract(html);
    const pack = {
      slug,
      label: d.label ?? slug,
      url: d.url,
      finalUrl: res.url,
      httpStatus: res.status,
      fetchedAt: new Date().toISOString(),
      // The caller's contract facts, carried so the pack is self-describing (never a substitute for the contract).
      contract: { interaction_type: d.interaction_type ?? null, primary_payoff: d.primary_payoff ?? null, secondary_payoff: d.secondary_payoff ?? null, allowed_claims: d.allowed_claims ?? [] },
      page: x,
      // Curated by a human later: concrete, true concepts the copy may draw on. Empty by default.
      sampleConcepts: [] as string[]
    };
    writeFileSync(join(outDir, `${slug}.json`), JSON.stringify(pack, null, 2));
    results[slug] = { status: res.status, headings: x.headings.length, buttons: x.buttons.length, paragraphs: x.paragraphs.length, mechanics: x.mechanics };
    console.log(`${res.status} h=${x.headings.length} b=${x.buttons.length} p=${x.paragraphs.length} email=${x.mechanics.hasEmailInput} card=${x.mechanics.cardChoice} step=${x.mechanics.stepMarker ?? "-"}`);
  } catch (e) {
    results[slug] = { error: (e as Error).message };
    console.log(`FAILED ${(e as Error).message}`);
  }
}
writeFileSync(join(outDir, "_index.json"), JSON.stringify({ builtAt: new Date().toISOString(), results }, null, 2));
