'use strict';

// CLAUDE CODE PROVIDER MIGRATION — V3 QUALITY PROOF (owner GO 2026-09-05, section 6).
//
//   node "<content-agent>/scripts/migration/emailops-v3-qa-sample.cjs" [--n 10] [--out <dir>]
//
// Generates the SAME representative 10-email mix that EmailOps' own copyQaSample.js uses,
// through the SAME real generator (dailyProgrammeCompose.copyFor — real brief, real retry
// budget, real A-H gate, destination promise contract, CTA / persona / completeness guards),
// with ONE substitution: the Content Agent call is routed to the Claude Code subscription
// bridge instead of the Anthropic API bridge. Nothing in EmailOps is modified — the
// substitution is a require-cache override of src/lib/contentServiceClient.js in THIS process.
//
// PROOFS RECORDED PER RUN
//   - every generation's metadata.provider (must be "claude-code")
//   - a CANARY Anthropic API key + unroutable ANTHROPIC_BASE_URL are set in this process: any
//     Anthropic SDK call anywhere below would fail loudly, so 10 successes = 0 SDK calls
//   - every outbound http(s)/fetch host this process contacts (must be none — no ESP, no API)
//   - V3 scorecard per email: criteria A-H, material failures, words, paragraphs, CTA, persona
//
// WRITES NOTHING TO AN ESP, no campaign, no schedule, no plan file, nothing under EmailOps.
// Output goes to <content-agent>/reports/claude-code-migration-<day>/qa-sample/.

const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const https = require('node:https');

const CONTENT_AGENT = process.env.CONTENT_SERVICE_DIR || 'C:/Internet Marketing Business/content-agent';
const EMAILOPS = process.env.EMAILOPS_DIR || 'C:/Internet Marketing Business/emailops';
const BRIDGE = path.join(CONTENT_AGENT, 'scripts', 'migration', 'claude-code-bridge.mjs');

const argOf = (f, d) => { const i = process.argv.indexOf(f); return i > 0 && process.argv[i + 1] ? process.argv[i + 1] : d; };
const N = Number(argOf('--n', '10'));
const sgtDay = () => new Date(Date.now() + 8 * 3600e3).toISOString().slice(0, 10);
const DAY = sgtDay();
const OUT = argOf('--out', path.join(CONTENT_AGENT, 'reports', `claude-code-migration-${DAY}`, 'qa-sample'));

// --- CANARY: the API path must be unreachable and unused -------------------------------------
process.env.ANTHROPIC_API_KEY = 'sk-ant-CANARY-NOT-A-REAL-KEY-MUST-NEVER-BE-SENT';
process.env.ANTHROPIC_BASE_URL = 'http://127.0.0.1:9/';

// --- NETWORK SPY: this process must contact nobody -------------------------------------------
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

// --- ROUTE THE CONTENT AGENT CALL THROUGH THE CLAUDE CODE BRIDGE ------------------------------
// Real EmailOps transport (shell-free spawn via npx-cli.js, temp request/response files), real
// resolveNpx; only the bridge script path differs. Installed in require.cache BEFORE anything
// requires the composer, so its destructured `callContentService` is this one.
const clientPath = require.resolve(path.join(EMAILOPS, 'src', 'lib', 'contentServiceClient.js'));
const realClient = require(clientPath);
const { execFileSync } = require('node:child_process');
const os = require('node:os');
const calls = [];
function callContentService(request, { timeoutMs = 180000 } = {}) {
  const tmpDir = fs.mkdtempSync(path.join(os.tmpdir(), 'emailops-cs-cc-'));
  const requestPath = path.join(tmpDir, 'request.json');
  const outputPath = path.join(tmpDir, 'response.json');
  const started = Date.now();
  try {
    fs.writeFileSync(requestPath, JSON.stringify(request));
    const npx = realClient.resolveNpx();
    try {
      execFileSync(npx.file, [...npx.pre, 'tsx', BRIDGE, requestPath, outputPath], {
        shell: false, timeout: timeoutMs, stdio: ['ignore', 'ignore', 'pipe'],
      });
    } catch (err) {
      const stderr = (err.stderr && err.stderr.toString().trim()) || err.message;
      calls.push({ requestId: request.requestId, ms: Date.now() - started, transportError: stderr.slice(0, 300) });
      throw new Error(`Content Service call failed: ${stderr}`);
    }
    const raw = JSON.parse(fs.readFileSync(outputPath, 'utf8'));
    calls.push({
      requestId: request.requestId, ms: Date.now() - started,
      provider: raw && raw.metadata ? raw.metadata.provider : null,
      model: raw && raw.metadata ? raw.metadata.model : null,
      error: raw && raw.error ? `${raw.error.code}: ${String(raw.error.message).slice(0, 160)}` : null,
    });
    return raw;
  } finally {
    fs.rmSync(tmpDir, { recursive: true, force: true });
  }
}
require.cache[clientPath].exports = { ...realClient, callContentService };

// EmailOps' own sample machinery: the representative MIX and the composer-identical scorer.
const sample = require(path.join(EMAILOPS, 'src', 'reporting', 'copyQaSample.js'));
const compose = require(path.join(EMAILOPS, 'src', 'reporting', 'dailyProgrammeCompose.js'));
const V3 = require(path.join(EMAILOPS, 'src', 'lib', 'copySystemV3.js'));

function criteriaTable(score) {
  return Object.entries(score.criteria).map(([k, v]) => `${k}:${v.status || (v.pass ? 'P' : 'F')}`).join(' ');
}
// The owner's named columns, read off the same scorecard the composer gates on.
function verdicts(score) {
  const c = score.criteria;
  const fails = (score.materialFailures || []).map((f) => `${f.criterion}/${f.name}: ${f.reasons.join('; ')}`);
  const has = (re) => fails.filter((f) => re.test(f));
  return {
    qa: score.ok ? 'PASS' : 'FAIL',
    truth: (c.A && c.A.pass !== false) && (c.F && c.F.pass !== false) && (c.H && c.H.pass !== false) ? 'PASS' : 'FAIL',
    repetition: c.B && c.B.pass !== false ? 'PASS' : 'FAIL',
    filler: c.C && c.C.pass !== false ? 'PASS' : 'FAIL',
    cta: c.E && c.E.pass !== false ? 'PASS' : 'FAIL',
    persona: c.F && c.F.pass !== false ? 'PASS' : 'FAIL',
    failures: fails,
    truthFailures: has(/^A\/|^F\/|^H\/|UNSUPPORTED|BANNED|FABRICAT/i),
    repetitionFailures: has(/^B\/|REPEAT/i),
    fillerFailures: has(/^C\/|FILLER/i),
    ctaFailures: has(/^E\/|CTA/i),
  };
}

async function main() {
  fs.mkdirSync(OUT, { recursive: true });
  const storePath = path.join(OUT, 'generated.json');
  let store = {};
  try { store = JSON.parse(fs.readFileSync(storePath, 'utf8')); } catch { /* first run */ }

  console.log(`CLAUDE CODE PROVIDER — V3 QA SAMPLE (${DAY} SGT). Bridge: ${BRIDGE}`);
  console.log(`Read-only for EmailOps. Output: ${OUT}\n`);
  for (const m of sample.MIX.slice(0, N)) {
    const key = `${m.esp}>${m.dest}`;
    if (store[key] && store[key].copy) { console.log(`  ${m.esp.padEnd(22)} -> ${m.dest.padEnd(20)} (kept from earlier run)`); continue; }
    process.stdout.write(`  ${m.esp.padEnd(22)} -> ${m.dest.padEnd(20)} `);
    const callsBefore = calls.length;
    const started = Date.now();
    try {
      // eslint-disable-next-line no-await-in-loop
      const copy = await compose.copyFor({ ...m, dead: null }, DAY, null, null);
      const score = sample.scoreOne(m, copy);
      store[key] = {
        ...m, copy, score, verdicts: verdicts(score), payoff: sample.payoffOf(m.dest),
        attempts: calls.length - callsBefore, ms: Date.now() - started,
        calls: calls.slice(callsBefore), generated_at: new Date().toISOString(),
      };
      console.log(`${V3.summarise(score)}  (${calls.length - callsBefore} call(s), ${Math.round((Date.now() - started) / 1000)}s)`);
    } catch (e) {
      const msg = String(e.message).slice(0, 600);
      store[key] = { ...m, error: msg, attempts: calls.length - callsBefore, ms: Date.now() - started, calls: calls.slice(callsBefore) };
      console.log(`FAILED — ${msg.slice(0, 160)}`);
    }
    fs.writeFileSync(storePath, JSON.stringify(store, null, 2));
  }

  const generated = sample.MIX.slice(0, N).map((m) => store[`${m.esp}>${m.dest}`]).filter(Boolean);
  const okCount = generated.filter((g) => g.score && g.score.ok).length;
  const providers = [...new Set(calls.map((c) => c.provider).filter(Boolean))];
  const models = [...new Set(calls.map((c) => c.model).filter(Boolean))];

  // Baseline: the existing API-generated V3 sample (what the Anthropic API path produced
  // before its credit ran out) plus the V2 estate comparison EmailOps already computed.
  let baseline = null;
  try {
    const bl = JSON.parse(fs.readFileSync(path.join(EMAILOPS, 'reports', `copy-qa-v3-${DAY}`, 'generated.json'), 'utf8'));
    baseline = Object.values(bl).map((g) => ({ esp: g.esp, dest: g.dest, ok: g.score ? g.score.ok : null, summary: g.score ? V3.summarise(g.score) : g.error, words: g.score ? g.score.metrics.bodyWords : null }));
  } catch { /* none */ }

  const summary = {
    day: DAY, bridge: BRIDGE, n: generated.length, passed: okCount,
    providersSeen: providers, modelsSeen: models,
    contentAgentCalls: calls.length,
    transportErrors: calls.filter((c) => c.transportError).length,
    providerErrors: calls.filter((c) => c.error).map((c) => c.error),
    parentProcessNetworkHosts: parentNetwork,
    canaryApiKeyUnused: calls.every((c) => c.provider === 'claude-code' || c.error || c.transportError),
    baselineApiSample: baseline,
  };
  fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(OUT, 'sample.md'), renderMd(generated, summary));
  console.log(`\nV3 sample via Claude Code : ${okCount}/${generated.length} passed every A-H criterion`);
  console.log(`providers seen            : ${providers.join(', ') || 'none'} · models ${models.join(', ') || 'none'}`);
  console.log(`content-agent calls       : ${calls.length} (transport errors ${summary.transportErrors})`);
  console.log(`parent network hosts      : ${parentNetwork.length ? parentNetwork.join(', ') : 'NONE'}`);
  console.log(`\nWROTE ${path.join(OUT, 'sample.md')}`);
}

function renderMd(generated, s) {
  const L = [];
  L.push(`# Claude Code provider — V3 QA sample (${s.day} SGT)`, '');
  L.push('Generated through EmailOps\' real generator (`dailyProgrammeCompose.copyFor`: real brief,');
  L.push('destination promise contract, CTA house style, persona/brand guard, completeness guard, V3 A-H');
  L.push('scorecard, real retry budget) with the Content Agent call routed to the Claude Code');
  L.push('subscription bridge. No ESP write, no campaign, no plan file. EmailOps unmodified.', '');
  L.push(`**${s.passed}/${s.n} passed every A-H criterion.** Providers seen: ${s.providersSeen.join(', ') || 'none'}; models: ${s.modelsSeen.join(', ') || 'none'}; Content Agent calls: ${s.contentAgentCalls}; parent-process network hosts: ${s.parentProcessNetworkHosts.length ? s.parentProcessNetworkHosts.join(', ') : 'none'}; canary API key unused: ${s.canaryApiKeyUnused}.`, '');
  L.push('| # | Account | Destination | QA | Truth | Repetition | Filler | CTA | Persona | Words/paras | Calls | Time |');
  L.push('|---|---|---|---|---|---|---|---|---|---|---|---|');
  generated.forEach((g, i) => {
    if (g.error) { L.push(`| ${i + 1} | ${g.esp} | ${g.dest} | FAILED | | | | | | | ${g.attempts} | ${Math.round(g.ms / 1000)}s |`); return; }
    const v = g.verdicts;
    L.push(`| ${i + 1} | ${g.esp} | ${g.dest} | ${v.qa} | ${v.truth} | ${v.repetition} | ${v.filler} | ${v.cta} | ${v.persona} | ${g.score.metrics.bodyWords}/${g.score.metrics.paragraphs} | ${g.attempts} | ${Math.round(g.ms / 1000)}s |`);
  });
  L.push('');
  for (const g of generated) {
    L.push(`## ${g.esp} → ${g.dest}`, '');
    if (g.error) { L.push(`**REFUSED / FAILED:** ${g.error}`, ''); continue; }
    const p = g.payoff || {};
    L.push('| | |', '|---|---|');
    L.push(`| **Subject** | ${g.copy.subject} |`);
    L.push(`| **Preheader** | ${g.copy.lede} |`);
    L.push(`| **CTA** | ${g.copy.cta}${g.copy.ctaFallbackReason ? ` _(fallback: ${g.copy.ctaFallbackReason})_` : ''} (${g.copy.ctaTaxonomy || '-'}) |`);
    L.push(`| **Destination** | \`${g.dest}\` — ${p.status || '?'}${p.interaction ? `, ${p.interaction}` : ''} |`);
    L.push(`| **Destination's stated payoff** | ${p.payoff ? `"${p.payoff}"` : '_unverified — every precision claim forbidden_'} |`);
    L.push(`| **Claims supported** | ${(p.allowed || []).length ? p.allowed.join(', ') : '_none_'} |`);
    L.push(`| **Words (preheader + body)** | ${g.score.metrics.bodyWords} in ${g.score.metrics.paragraphs} paragraphs |`);
    L.push(`| **QA** | ${V3.summarise(g.score)} — ${criteriaTable(g.score)} |`);
    L.push(`| **Persona / sign-off** | ${g.verdicts.persona}${g.copy.copyQaFallback ? ` · copyQaFallback: ${g.copy.copyQaFallback}` : ''} |`);
    L.push(`| **Provider** | ${[...new Set(g.calls.map((c) => c.provider).filter(Boolean))].join(', ') || '?'} · ${[...new Set(g.calls.map((c) => c.model).filter(Boolean))].join(', ')} · ${g.attempts} call(s) |`);
    L.push('', '```');
    for (const para of (g.copy.bodyParas || String(g.copy.body).split(/\n+/))) L.push(para, '');
    L.push('```');
    if (g.verdicts.failures.length) { L.push('**Criteria not met:**'); for (const f of g.verdicts.failures) L.push(`- ${f}`); }
    L.push('');
  }
  if (s.baselineApiSample) {
    L.push('## Baseline: the API-generated V3 sample (Anthropic API path, before its credit ran out)', '');
    L.push('| Account | Destination | QA | Words |', '|---|---|---|---|');
    for (const b of s.baselineApiSample) L.push(`| ${b.esp} | ${b.dest} | ${b.summary} | ${b.words ?? '-'} |`);
    L.push('');
  }
  return L.join('\n');
}

main().catch((e) => { console.error(e); process.exit(1); });
