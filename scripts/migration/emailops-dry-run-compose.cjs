'use strict';

// CLAUDE CODE PROVIDER MIGRATION — DRY-RUN DAILY COMPOSE (owner GO 2026-09-05, section 9).
//
//   node "<content-agent>/scripts/migration/emailops-dry-run-compose.cjs" --day 2026-09-07
//        [--plan config/daily-programme-2026-09-07.js] [--limit N] [--out <dir>]
//
// Runs the Daily Programme's COPY PATH for a full day's real allocation — the same
// winner-library brief enrichment, love-window pins, dailyProgrammeCompose.copyFor() (real
// brief, destination promise contract, CTA house style, persona/brand guard, completeness,
// V3 A-H scorecard, retry budget) and H1 PS attachment that main() performs — through
// EmailOps' REAL, switched transport (src/lib/contentServiceClient.js -> contentServiceBridge.mjs
// -> Content Agent -> Claude Code subscription provider).
//
// WHAT IT DOES NOT DO — by construction, not by flag:
//   - no plan file, no compose status, no shadow log, no run lock, no day state
//   - no ESP write: no ESP adapter is called; every outbound host this process contacts is
//     recorded and must be none (Claude Code runs in the bridge's child process)
//   - no Anthropic API: a CANARY key and an unroutable ANTHROPIC_BASE_URL are set in this
//     process, so any SDK call anywhere below would fail loudly and be recorded
//
// The allocation comes from the day's real composer-owned plan file (esp, hhmm, dest, class),
// so the sends are exactly the ones the programme scheduled for that day.

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const CONTENT_AGENT = process.env.CONTENT_SERVICE_DIR || 'C:/Internet Marketing Business/content-agent';
const EMAILOPS = process.env.EMAILOPS_DIR || 'C:/Internet Marketing Business/emailops';

const argOf = (f, d) => { const i = process.argv.indexOf(f); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const sgtDay = (offset = 0) => new Date(Date.now() + (8 * 3600e3) + offset * 86400e3).toISOString().slice(0, 10);
const DAY = argOf('--day', sgtDay(2));
const PLAN = argOf('--plan', `config/daily-programme-${DAY}.js`);
const LIMIT = Number(argOf('--limit', '0'));
const OUT = argOf('--out', path.join(CONTENT_AGENT, 'reports', `claude-code-migration-${sgtDay()}`, 'dry-run-compose'));

// --- CANARY + NETWORK SPY ---------------------------------------------------------------------
process.env.ANTHROPIC_API_KEY = 'sk-ant-CANARY-NOT-A-REAL-KEY-MUST-NEVER-BE-SENT';
process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9/';
const parentNetwork = [];
const hostOf = (a) => (typeof a === 'string' ? a : (a && (a.hostname || a.host || (a.url && String(a.url)))) || '?');
for (const mod of [http, https]) {
  const orig = mod.request;
  mod.request = function spied(...args) { parentNetwork.push(hostOf(args[0])); return orig.apply(this, args); };
}
if (typeof globalThis.fetch === 'function') {
  const origFetch = globalThis.fetch;
  globalThis.fetch = function spiedFetch(...args) { parentNetwork.push(hostOf(args[0])); return origFetch.apply(this, args); };
}

// --- RECORD (not replace) THE REAL TRANSPORT --------------------------------------------------
const clientPath = require.resolve(path.join(EMAILOPS, 'src', 'lib', 'contentServiceClient.js'));
const realClient = require(clientPath);
const calls = [];
function callContentService(request, opts) {
  const started = Date.now();
  try {
    const raw = realClient.callContentService(request, opts);
    calls.push({
      requestId: request.requestId, ms: Date.now() - started,
      provider: raw && raw.metadata ? raw.metadata.provider : null,
      model: raw && raw.metadata ? raw.metadata.model : null,
      error: raw && raw.error ? `${raw.error.code}: ${String(raw.error.message).slice(0, 160)}` : null,
    });
    return raw;
  } catch (e) {
    calls.push({ requestId: request.requestId, ms: Date.now() - started, transportError: String(e.message).slice(0, 300) });
    throw e;
  }
}
require.cache[clientPath].exports = { ...realClient, callContentService };

const compose = require(path.join(EMAILOPS, 'src', 'reporting', 'dailyProgrammeCompose.js'));
const winnerLibrary = require(path.join(EMAILOPS, 'src', 'lib', 'winnerLibrary.js'));
const loveWindowPilot = require(path.join(EMAILOPS, 'src', 'lib', 'loveWindowPilot.js'));
const ownedProductH1 = require(path.join(EMAILOPS, 'src', 'lib', 'ownedProductH1.js'));
const words = (s) => String(s || '').trim().split(/\s+/).filter(Boolean).length;

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const planPath = path.isAbsolute(PLAN) ? PLAN : path.join(EMAILOPS, PLAN);
  const plan = require(planPath);
  let sends = (plan.sends || []).map((s) => ({ esp: s.esp, hhmm: s.hhmm, dest: s.dest, class: s.class }));
  if (LIMIT > 0) sends = sends.slice(0, LIMIT);
  if (!sends.length) throw new Error(`no sends in ${planPath}`);

  const storePath = path.join(OUT, 'generated.json');
  let store = {};
  try { store = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch { /* first run */ }

  console.log(`DRY-RUN DAILY COMPOSE (copy path) — day ${DAY}, ${sends.length} sends from ${path.relative(EMAILOPS, planPath)}`);
  console.log('No plan file, no status, no shadow log, no lock, no ESP write. Real transport + switched bridge.\n');

  const wl = winnerLibrary.prepare(EMAILOPS);
  console.log(wl.available
    ? `winner library ACTIVE (${wl.candidates.length} archive candidates; fatigue window ${wl.history.days}d)`
    : `! WINNER LIBRARY UNAVAILABLE (${wl.reason}) — plain brief`);
  const lw = loveWindowPilot.applySlotPins(sends, DAY);
  console.log(lw.status === 'PINNED' ? `love-window pilot: ${lw.pinned} pinned` : `love-window pilot inert: ${lw.reason}`);

  for (const s of sends) {
    const key = `${s.esp}|${s.hhmm}|${s.dest}`;
    if (store[key] && store[key].copy) {
      if (wl.available) wl.sessionSubjects.push(store[key].copy.subject);
      console.log(`  ${s.hhmm} ${s.esp.padEnd(22)} ${String(s.dest).padEnd(20)} (kept from earlier run)`);
      continue;
    }
    process.stdout.write(`  ${s.hhmm} ${s.esp.padEnd(22)} ${String(s.dest).padEnd(20)} `);
    const enrich = wl.available
      ? winnerLibrary.buildBriefAddendum({ library: wl.library, history: wl.history, send: s, sessionSubjects: wl.sessionSubjects })
      : null;
    const before = calls.length;
    const started = Date.now();
    try {
      // eslint-disable-next-line no-await-in-loop
      const copy = await compose.copyFor(s, DAY, wl, enrich);
      const h1ps = ownedProductH1.psForSend({ dest: s.dest, day: DAY });
      if (h1ps) { copy.ps = h1ps.ps; copy.psSlice = h1ps.psSlice; }
      store[key] = {
        ...s, copy, attempts: calls.length - before, ms: Date.now() - started,
        calls: calls.slice(before), generated_at: new Date().toISOString(),
      };
      console.log(`${copy.copyQa ? copy.copyQa.summary : '?'}  ${words(`${copy.lede} ${copy.body}`)}w${copy.copyQaFallback ? '  QA_FALLBACK:' + copy.copyQaFallback : ''}${copy.ctaFallbackReason ? '  CTA_FALLBACK' : ''}${copy.formatFallback ? '  FORMAT_FALLBACK' : ''}  (${calls.length - before} call(s), ${Math.round((Date.now() - started) / 1000)}s)`);
    } catch (e) {
      const msg = String(e.message).slice(0, 800);
      store[key] = { ...s, error: msg, attempts: calls.length - before, ms: Date.now() - started, calls: calls.slice(before) };
      console.log(`FAILED — ${msg.slice(0, 200)}`);
    }
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  }

  const rows = sends.map((s) => store[`${s.esp}|${s.hhmm}|${s.dest}`]).filter(Boolean);
  const generated = rows.filter((r) => r.copy);
  const summary = {
    day: DAY, plan: path.relative(EMAILOPS, planPath), sends: sends.length,
    generated: generated.length, failed: rows.length - generated.length,
    qaClean: generated.filter((r) => r.copy.copyQa && r.copy.copyQa.ok).length,
    qaFallback: generated.filter((r) => r.copy.copyQaFallback).map((r) => `${r.esp} ${r.hhmm}: ${r.copy.copyQaFallback}`),
    ctaFallback: generated.filter((r) => r.copy.ctaFallbackReason).map((r) => `${r.esp} ${r.hhmm}: ${r.copy.ctaFallbackReason}`),
    formatFallback: generated.filter((r) => r.copy.formatFallback).map((r) => `${r.esp} ${r.hhmm}: ${r.copy.formatFallback}`),
    contentAgentCalls: calls.length,
    providersSeen: [...new Set(calls.map((c) => c.provider).filter(Boolean))],
    modelsSeen: [...new Set(calls.map((c) => c.model).filter(Boolean))],
    providerErrors: calls.filter((c) => c.error).map((c) => c.error),
    transportErrors: calls.filter((c) => c.transportError).map((c) => c.transportError),
    parentProcessNetworkHosts: parentNetwork,
    totalSeconds: Math.round(rows.reduce((a, r) => a + (r.ms || 0), 0) / 1000),
    wordBand: generated.length ? {
      min: Math.min(...generated.map((r) => words(`${r.copy.lede} ${r.copy.body}`))),
      max: Math.max(...generated.map((r) => words(`${r.copy.lede} ${r.copy.body}`))),
    } : null,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  const L = [];
  L.push(`# Dry-run daily compose via Claude Code provider — ${DAY}`, '');
  L.push(`Plan allocation: \`${summary.plan}\` (${summary.sends} sends). Generated ${summary.generated}, failed ${summary.failed}, V3 clean ${summary.qaClean}. Providers: ${summary.providersSeen.join(', ') || 'none'}; models: ${summary.modelsSeen.join(', ') || 'none'}; Content Agent calls ${summary.contentAgentCalls}; parent-process network hosts: ${summary.parentProcessNetworkHosts.length ? summary.parentProcessNetworkHosts.join(', ') : 'none'}. Word band observed ${summary.wordBand ? `${summary.wordBand.min}-${summary.wordBand.max}` : '-'}.`, '');
  L.push('| Slot | Account | Destination | Class | QA | Words | Calls | Time | Subject |', '|---|---|---|---|---|---|---|---|---|');
  for (const r of rows) {
    if (r.error) { L.push(`| ${r.hhmm} | ${r.esp} | ${r.dest} | ${r.class} | FAILED | | ${r.attempts} | ${Math.round(r.ms / 1000)}s | ${r.error.slice(0, 120)} |`); continue; }
    L.push(`| ${r.hhmm} | ${r.esp} | ${r.dest} | ${r.class} | ${r.copy.copyQa ? r.copy.copyQa.summary : '?'}${r.copy.copyQaFallback ? ' (QA fallback)' : ''}${r.copy.ctaFallbackReason ? ' (CTA fallback)' : ''} | ${words(`${r.copy.lede} ${r.copy.body}`)} | ${r.attempts} | ${Math.round(r.ms / 1000)}s | ${r.copy.subject} |`);
  }
  L.push('');
  fs.writeFileSync(path.join(OUT, 'dry-run.md'), L.join('\n'));
  console.log(`\ngenerated ${summary.generated}/${summary.sends} · V3 clean ${summary.qaClean} · QA fallback ${summary.qaFallback.length} · CTA fallback ${summary.ctaFallback.length} · format fallback ${summary.formatFallback.length}`);
  console.log(`providers ${summary.providersSeen.join(', ') || 'none'} · models ${summary.modelsSeen.join(', ') || 'none'} · calls ${summary.contentAgentCalls} · provider errors ${summary.providerErrors.length} · transport errors ${summary.transportErrors.length}`);
  console.log(`parent network hosts: ${parentNetwork.length ? parentNetwork.join(', ') : 'NONE'}`);
  console.log(`WROTE ${path.join(OUT, 'dry-run.md')}`);
  process.exit(summary.failed ? 1 : 0);
}

main().catch((e) => { console.error(e); process.exit(1); });
