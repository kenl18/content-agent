import { describe, expect, it } from "vitest";
import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { generateContent } from "../../src/application/content-service.js";
import { CopyLedger } from "../../src/diversity/ledger.js";
import { isContentServiceError } from "../../src/domain/errors.js";
import type { ModelInstructions, ModelProvider } from "../../src/providers/model-provider.js";
import { CLEAN_DAILYANGEL_OUTPUT, EMAILOPS_STRATEGY_DAILYANGEL, emailopsRequest } from "../fixtures-v4.js";

function scripted(outputs: unknown[]): { provider: ModelProvider; seen: ModelInstructions[] } {
  const seen: ModelInstructions[] = [];
  let i = 0;
  return {
    seen,
    provider: {
      name: "fake",
      model: "fake-model",
      generate: async (ins) => {
        seen.push(ins);
        const out = outputs[Math.min(i, outputs.length - 1)];
        i++;
        return { text: typeof out === "string" ? out : JSON.stringify(out) };
      }
    }
  };
}

const BAD_OUTPUT = {
  subjectLine: "There's a message waiting for you",
  previewText: "A message is waiting for you.",
  body:
    "There's a message that hasn't been opened yet — not a general one, not a type — and it names the person.\n\n" +
    "Not a name. Not a date. It's the part worth reading properly, and your reading names them — the specific line.\n\n" +
    "The message names who wrote it. The message is waiting. The message concerns a person.",
  ctaLabel: "Read your full reading",
  subjectCandidates: [{ subject: "There's a message waiting for you", preheader: "A message is waiting.", structure: "statement" }]
};

describe("generateContent — Copy System V4 loop (promotional-email)", () => {
  it("plans, lays out the V4 brief, strips internal keys, and records the plan in metadata and the ledger", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ledger-"));
    const { provider, seen } = scripted([CLEAN_DAILYANGEL_OUTPUT]);
    const result = await generateContent(emailopsRequest(EMAILOPS_STRATEGY_DAILYANGEL), { provider, ledger: new CopyLedger({ dir }), packDir: join(dir, "no-packs") });
    expect(isContentServiceError(result)).toBe(false);
    if (isContentServiceError(result)) return;
    expect(Object.keys(result.content).sort()).toEqual(["body", "ctaLabel", "previewText", "subjectLine"]);
    expect(result.content).not.toHaveProperty("subjectCandidates");
    const plan = result.metadata.copyPlan as Record<string, unknown>;
    expect(plan.version).toBe("v4");
    expect(plan.account).toBe("kit_mystic");
    // kit_mystic resolved to Raven Thorne (persona-signed, firstPerson "yes") in the owner's
    // 2026-09-06 ONE-ACCOUNT-ONE-PERSONA cutover, superseding the "Spiritual Oasis (house
    // voice)" brand contract this test originally pinned.
    expect(plan.persona).toBe("Raven Thorne");
    expect(["standard", "story"]).toContain(plan.lengthFamily);
    expect((plan.qa as { ok: boolean }).ok).toBe(true);
    // The brief: persona voice, shape, hard rules, destination truth, plan — and the caller's V3 block was restated, not dumped.
    const ins = seen[0]!;
    expect(ins.system).toMatch(/VOICE — Raven Thorne/);
    expect(ins.system).toMatch(/EMAIL SHAPE/);
    expect(ins.system).toMatch(/Never claim an exact date/);
    expect(ins.user).toMatch(/DESTINATION — /);
    expect(ins.user).toMatch(/Guardian Angel/);
    expect(ins.user).toMatch(/THIS EMAIL'S PLAN/);
    expect(ins.user).toMatch(/Recent subjects \(never echo or paraphrase\)/);
    expect(ins.user).not.toMatch(/EMAILOPS COPY STANDARD V3/);
    expect(ins.outputSchema?.properties).toHaveProperty("subjectCandidates");
    expect(ins.outputSchema?.required).toContain("subjectCandidates");
    const ledgerLines = readFileSync(join(dir, "kit_mystic.jsonl"), "utf8").trim().split("\n");
    expect(ledgerLines.length).toBe(1);
    const entry = JSON.parse(ledgerLines[0]!);
    expect(entry.requestId).toBe("emailops-daily-2026-09-08-kit_mystic-0000-1");
    expect(entry.angle).toBeDefined();
    expect(entry).not.toHaveProperty("body");
    rmSync(dir, { recursive: true, force: true });
  });

  it("feeds the exact rejection back, then re-plans after two failed corrective retries, and returns the best draft", async () => {
    const dir = mkdtempSync(join(tmpdir(), "ledger-"));
    const { provider, seen } = scripted([BAD_OUTPUT, BAD_OUTPUT, BAD_OUTPUT, CLEAN_DAILYANGEL_OUTPUT]);
    const result = await generateContent(emailopsRequest(EMAILOPS_STRATEGY_DAILYANGEL), { provider, ledger: new CopyLedger({ dir }), packDir: join(dir, "none") });
    expect(isContentServiceError(result)).toBe(false);
    if (isContentServiceError(result)) return;
    expect(seen.length).toBe(4);
    expect(seen[0]!.user).not.toMatch(/REVISION/);
    expect(seen[1]!.user).toMatch(/REVISION 1/);
    expect(seen[1]!.user).toMatch(/UNSUPPORTED_PERSON_CLAIM|REPEATED_PROMISE|CTA_GENERIC|STYLE_FINGERPRINT/);
    expect(seen[1]!.user).toMatch(/FIX:/);
    expect(seen[2]!.user).toMatch(/REVISION 2/);
    // Third failure -> a fresh plan (different angle/architecture), no REVISION block.
    expect(seen[3]!.user).not.toMatch(/REVISION/);
    const plan1 = /Angle — ([^:]+):/.exec(seen[0]!.user)?.[1];
    const plan4 = /Angle — ([^:]+):/.exec(seen[3]!.user)?.[1];
    expect(plan4).not.toBe(plan1);
    const meta = result.metadata.copyPlan as Record<string, unknown>;
    expect(meta.generations).toBe(4);
    expect(meta.replanned).toBe(true);
    expect((meta.qa as { ok: boolean }).ok).toBe(true);
    expect(result.content.ctaLabel).toBe("Open the message and read the reason");
    rmSync(dir, { recursive: true, force: true });
  });

  it("returns the best draft, flagged, when every generation fails review", async () => {
    const { provider, seen } = scripted([BAD_OUTPUT]);
    const result = await generateContent(emailopsRequest(EMAILOPS_STRATEGY_DAILYANGEL), { provider, ledger: null });
    expect(isContentServiceError(result)).toBe(false);
    if (isContentServiceError(result)) return;
    // 1 + 2 corrective, then a fresh plan + 2 corrective: six generations, bounded in production by the deadline.
    expect(seen.length).toBe(6);
    const meta = result.metadata.copyPlan as { qa: { ok: boolean; findings: string[] } };
    expect(meta.qa.ok).toBe(false);
    expect(meta.qa.findings.some((f) => /reject:/.test(f))).toBe(true);
  });

  it("stops generating when the deadline leaves no room for another call", async () => {
    const { provider, seen } = scripted([BAD_OUTPUT]);
    const result = await generateContent(emailopsRequest(EMAILOPS_STRATEGY_DAILYANGEL), { provider, ledger: null, deadlineMs: 1 });
    expect(isContentServiceError(result)).toBe(false);
    expect(seen.length).toBe(1);
  });

  it("selects a better subject from the candidates and keeps a preheader that advances it", async () => {
    const out = { ...CLEAN_DAILYANGEL_OUTPUT, subjectLine: "Someone thought about you last night", previewText: "Someone thought about you last night, again." };
    const { provider } = scripted([out]);
    const result = await generateContent(emailopsRequest(EMAILOPS_STRATEGY_DAILYANGEL), { provider, ledger: null });
    if (isContentServiceError(result)) throw new Error(result.error.message);
    // The primary subject echoes a recent one in the caller's avoid list and its preheader echoes it; a candidate wins.
    expect(result.content.subjectLine).not.toBe("Someone thought about you last night");
    expect(result.content.previewText).not.toMatch(/thought about you last night/);
  });

  it("honours a caller's forced family when the band allows it, via context.diversity", async () => {
    const { provider, seen } = scripted([CLEAN_DAILYANGEL_OUTPUT]);
    const req = emailopsRequest(EMAILOPS_STRATEGY_DAILYANGEL, {
      context: { destinationUrl: "https://go.astrologymanifest.com/dailyangelmessage", strategy: EMAILOPS_STRATEGY_DAILYANGEL, diversity: { lengthFamily: "short_note", architecture: "sparse_alert" } },
      constraints: { hardMinWords: 55, hardMaxWords: 230, minParagraphs: 1, maxParagraphs: 6, forbiddenPhrases: ["dailyangelmessage"] }
    });
    const result = await generateContent(req, { provider, ledger: null });
    if (isContentServiceError(result)) throw new Error(result.error.message);
    expect(seen[0]!.system).toMatch(/SPARSE ONE-PARAGRAPH ALERT · SHORT NOTE/);
    expect((result.metadata.copyPlan as { lengthFamily: string }).lengthFamily).toBe("short_note");
  });

  it("leaves non-email templates and production-mode requests on the V1 layout", async () => {
    const { provider, seen } = scripted([{ headline: "H", subheadline: "S" }]);
    const { validRawRequest } = await import("../fixtures.js");
    const result = await generateContent(validRawRequest(), { provider, ledger: null });
    expect(isContentServiceError(result)).toBe(false);
    expect(seen[0]!.user).not.toMatch(/THIS EMAIL'S PLAN/);
    expect(result).not.toHaveProperty("metadata.copyPlan");
  });
});
