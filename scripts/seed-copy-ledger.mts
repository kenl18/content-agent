/**
 * Seed the concept diversity ledger (ADR-0018 §4) from a caller's own send history, so the
 * planner has recent context on its first live day instead of a cold start.
 *
 *   npx tsx scripts/seed-copy-ledger.mts <plan.js|plan.json ...> [--ledger data/copy-ledger] [--days 14]
 *
 * Input shape (EmailOps daily plan files export it; any consumer can supply the same):
 *   { day: "YYYY-MM-DD", sends: [{ esp, hhmm, dest, subject, lede, body, bodyParas?, cta }] }
 * Each send is classified into concept labels (angle, architecture, hook, promise, CTA family,
 * length family, subject structure) by the same detectors production uses. Bodies are never
 * stored. Re-running is safe: an entry already present for the same day/account/slot is skipped.
 */
import { createRequire } from "node:module";
import { existsSync, readFileSync } from "node:fs";
import { resolve } from "node:path";
import { CopyLedger, classifyCopy } from "../src/diversity/ledger.js";
import type { LedgerEntry } from "../src/domain/copy-plan.js";

const require = createRequire(import.meta.url);
const args = process.argv.slice(2);
const opt = (f: string, d: string) => { const i = args.indexOf(f); return i >= 0 ? args[i + 1]! : d; };
const ledgerDir = resolve(opt("--ledger", "data/copy-ledger"));
const days = Number(opt("--days", "14"));
const files = args.filter((a, i) => !a.startsWith("--") && (i === 0 || !args[i - 1]!.startsWith("--")));
if (!files.length) { console.error("usage: seed-copy-ledger.mts <plan files...> [--ledger dir] [--days N]"); process.exit(2); }

const ledger = new CopyLedger({ dir: ledgerDir });
const cutoff = Date.now() - days * 86400e3;
let added = 0, skipped = 0;
for (const f of files) {
  const p = resolve(f);
  if (!existsSync(p)) { console.log(`missing ${p}`); continue; }
  const plan = p.endsWith(".json") ? JSON.parse(readFileSync(p, "utf8")) : require(p);
  const day: string = plan.day;
  if (!day || new Date(`${day}T00:00:00+08:00`).getTime() < cutoff) { console.log(`skip ${f} (older than ${days} days)`); continue; }
  const existing = new Map<string, Set<string>>();
  for (const s of plan.sends ?? []) {
    const account: string = s.esp;
    if (!existing.has(account)) existing.set(account, new Set(ledger.recent(account, 60).map((e) => e.requestId)));
    const requestId = `seed-${day}-${account}-${s.hhmm}`;
    if (existing.get(account)!.has(requestId)) { skipped++; continue; }
    const labels = classifyCopy({ subject: s.subject, lede: s.lede, body: s.body, paragraphs: s.bodyParas, cta: s.cta });
    const entry: LedgerEntry = {
      at: new Date(`${day}T${String(s.hhmm).slice(0, 2)}:${String(s.hhmm).slice(2, 4)}:00+08:00`).toISOString(),
      consumer: "emailops",
      requestId,
      sendKey: `emailops-daily-${day}-${account}-${s.hhmm}`,
      attempt: 1,
      account,
      persona: null,
      destination: s.dest ?? null,
      lengthFamily: labels.lengthFamily,
      architecture: labels.architecture,
      angle: labels.angle,
      hookFamily: labels.hookFamily,
      emotionalEngine: null,
      promiseType: labels.promiseType,
      ctaFamily: labels.ctaFamily,
      subjectStructure: labels.subjectStructure,
      subject: s.subject,
      words: labels.words,
      paragraphs: labels.paragraphs,
      ticScore: labels.ticScore,
      qaOk: true,
      qaFindings: [],
      generations: 0,
      source: "seed"
    };
    ledger.append(entry);
    existing.get(account)!.add(requestId);
    added++;
  }
}
console.log(`seeded ${added} entries into ${ledgerDir} (${skipped} already present)`);
