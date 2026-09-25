import { describe, expect, it } from "vitest";
import { destinationSlugFromUrl, parseStrategy, resolveAccount } from "../../src/diversity/strategy-parser.js";
import { planCopy, type PlannerInput } from "../../src/diversity/planner.js";
import { eligibleLengthFamilies } from "../../src/diversity/length-families.js";
import { ANGLES } from "../../src/diversity/angles.js";
import { resolvePersona } from "../../src/templates/persona-registry.js";
import type { LedgerEntry } from "../../src/domain/copy-plan.js";
import { EMAILOPS_STRATEGY_CHOOSER, EMAILOPS_STRATEGY_DAILYANGEL, emailopsRequest } from "../fixtures-v4.js";

function entry(over: Partial<LedgerEntry>): LedgerEntry {
  return {
    at: new Date().toISOString(), consumer: "emailops", requestId: "x", sendKey: null, attempt: 1, account: "kit_mystic", persona: null, destination: "dailyangelmessage",
    lengthFamily: "standard", architecture: "observation_implication_reveal", angle: "message_waiting", hookFamily: "someone_opener", emotionalEngine: "mystery", promiseType: "message",
    ctaFamily: "REVEAL_MESSAGE", subjectStructure: "statement", subject: "Someone kept a message for you", words: 110, paragraphs: 4, ticScore: 0, qaOk: true, qaFindings: [], generations: 1, source: "generated", ...over
  };
}

function input(strategy: string, over: Partial<PlannerInput> = {}): PlannerInput {
  const parsed = parseStrategy(strategy);
  return { requestId: "emailops-daily-2026-09-08-kit_mystic-0000-1", account: "kit_mystic", sendKey: "emailops-daily-2026-09-08-kit_mystic-0000", attempt: 1, persona: resolvePersona({ account: "kit_mystic" }), destination: "dailyangelmessage", truth: parsed.truth, pack: null, cta: parsed.cta, hardBand: parsed.hardBand, paragraphBand: parsed.paragraphBand, recent: [], priorAttempts: [], preferredFrames: parsed.preferredFrames, ...over };
}

describe("parseStrategy (EmailOps strategy text)", () => {
  const p = parseStrategy(EMAILOPS_STRATEGY_DAILYANGEL);
  it("finds the four caller blocks and the destination truth", () => {
    expect(p.blocksFound).toEqual(["winner-library", "promise-contract", "v3-standard", "cta-rule"]);
    expect(p.truth.established).toBe(true);
    expect(p.truth.interaction).toBe("read_only");
    expect(p.truth.headline).toContain("Guardian Angel");
    expect(p.truth.may).toEqual(expect.arrayContaining(["message", "reason"]));
    expect(p.truth.may).not.toContain("person");
    expect(p.truth.mayNot).toEqual(expect.arrayContaining(["date", "timing_window", "person", "number", "card_choice", "sign_choice"]));
  });
  it("reads brand, voice, sign-off, siblings, avoid-subjects, frames, losers and bands", () => {
    expect(p.brand).toBe("Spiritual Oasis");
    expect(p.signoff).toBe("— Spiritual Oasis");
    expect(p.fromNames).toEqual(["Raven Thorne", "Soulmate Whisperer"]);
    expect(p.siblingBrands).toContain("Divine Readings");
    expect(p.voice).toMatch(/Raven Thorne/);
    expect(p.avoidSubjects.length).toBe(6);
    expect(p.preferredFrames[0]).toBe("held-back-message-names-person (PROVEN)");
    expect(p.loserStructures.length).toBe(3);
    expect(p.hardBand).toEqual({ min: 80, max: 160 });
    expect(p.paragraphBand).toEqual({ min: 3, max: 5 });
  });
  it("reads the CTA rule", () => {
    expect(p.cta?.verbs).toContain("reveal");
    expect(p.cta?.maxChars).toBe(48);
    expect(p.cta?.intents).toEqual(expect.arrayContaining(["REVEAL_MESSAGE", "OPEN_READING"]));
    expect(p.cta?.bannedLabels).toContain("read your full reading");
    expect(p.cta?.interactionAllowed).toBe(false);
  });
  it("fails closed with no promise block", () => {
    const none = parseStrategy("Destination x. Single idea, single CTA.");
    expect(none.truth.established).toBe(false);
    expect(none.blocksFound).toEqual([]);
  });
  it("reads a chooser page that permits card choice and person", () => {
    const c = parseStrategy(EMAILOPS_STRATEGY_CHOOSER);
    expect(c.truth.interaction).toBe("choose_card");
    expect(c.truth.may).toEqual(expect.arrayContaining(["card_choice", "person", "card", "message"]));
    expect(c.truth.mayNot).not.toContain("card_choice");
    expect(c.cta?.interactionAllowed).toBe(true);
  });
  it("resolves the account and send key from the EmailOps requestId shape", () => {
    const r = resolveAccount(emailopsRequest(EMAILOPS_STRATEGY_DAILYANGEL) as never, p);
    expect(r).toEqual({ account: "kit_mystic", sendKey: "emailops-daily-2026-09-08-kit_mystic-0000", attempt: 1 });
    expect(destinationSlugFromUrl("https://go.astrologymanifest.com/past-lover-v3")).toBe("past-lover-v3");
  });
});

describe("length families under a caller hard band", () => {
  it("clips to the caller band and drops families with too little overlap", () => {
    const f = eligibleLengthFamilies({ min: 80, max: 160 });
    expect(f.map((x) => x.id)).toEqual(["standard", "story"]);
    expect(f.find((x) => x.id === "story")!.band).toEqual({ min: 130, max: 160 });
  });
  it("offers all four families without a hard band or with a wide one", () => {
    expect(eligibleLengthFamilies(null).map((x) => x.id)).toEqual(["short_note", "standard", "story", "long_form"]);
    expect(eligibleLengthFamilies({ min: 55, max: 230 }).map((x) => x.id)).toEqual(["short_note", "standard", "story", "long_form"]);
  });
});

describe("planCopy", () => {
  it("never plans an angle the destination's contract forbids", () => {
    const plan = planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL));
    for (const a of plan.eligibility.angles) expect(ANGLES[a].requiresClaims.every((c) => ["message", "reason"].includes(c))).toBe(true);
    expect(plan.eligibility.angles).not.toContain("named_person_reveal");
    expect(plan.eligibility.angles).not.toContain("timing_window");
    expect(plan.eligibility.angles).not.toContain("card_choice_invitation");
    expect(plan.eligibility.architectures).not.toContain("interaction_invitation");
    expect(plan.ctaFamily).not.toBe("CHOOSE_CARD");
  });
  it("is deterministic for a requestId and changes on a re-plan", () => {
    const a = planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL));
    const b = planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL));
    expect(a.angle).toBe(b.angle);
    expect(a.architecture).toBe(b.architecture);
    const re = planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL, { exclude: { angles: [a.angle], architectures: [a.architecture] } }));
    expect(re.angle).not.toBe(a.angle);
    expect(re.architecture).not.toBe(a.architecture);
  });
  it("respects the caller's hard band and paragraph range", () => {
    const plan = planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL));
    expect(["standard", "story"]).toContain(plan.lengthFamily);
    expect(plan.band.min).toBeGreaterThanOrEqual(80);
    expect(plan.band.max).toBeLessThanOrEqual(160);
    expect(plan.paragraphs.min).toBeGreaterThanOrEqual(3);
    expect(plan.paragraphs.max).toBeLessThanOrEqual(5);
    expect(plan.eligibility.lengthFamilies).toEqual(["standard", "story"]);
  });
  it("steers away from the account's dominant recent angle and subject structure", () => {
    const recent = Array.from({ length: 8 }, (_, i) => entry({ angle: "message_waiting", subjectStructure: "statement", subject: `Subject ${i}` }));
    const plans = Array.from({ length: 12 }, (_, i) => planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL, { recent, requestId: `emailops-daily-2026-09-08-kit_mystic-0${i}00-1` })));
    const messageShare = plans.filter((p) => p.angle === "message_waiting").length / plans.length;
    expect(messageShare).toBeLessThan(0.5);
    for (const p of plans) expect(p.avoid.angles).toContain("message_waiting");
    expect(plans.some((p) => p.avoid.subjectStructures.includes("statement"))).toBe(true);
  });
  it("assigns a different angle and architecture on the third attempt of the same send", () => {
    const prior = [entry({ sendKey: "emailops-daily-2026-09-08-kit_mystic-0000", angle: "message_waiting", architecture: "observation_implication_reveal" }), entry({ sendKey: "emailops-daily-2026-09-08-kit_mystic-0000", angle: "message_waiting", architecture: "observation_implication_reveal" })];
    const plan = planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL, { attempt: 3, priorAttempts: prior, requestId: "emailops-daily-2026-09-08-kit_mystic-0000-3" }));
    expect(plan.angle === "message_waiting" && plan.architecture === "observation_implication_reveal").toBe(false);
  });
  it("opens the chooser architecture and card angle only where the page supports it", () => {
    const plan = planCopy(input(EMAILOPS_STRATEGY_CHOOSER, { account: "kit_sacred", persona: resolvePersona({ account: "kit_sacred" }), destination: "spoptin-stars", force: { architecture: "interaction_invitation", angle: "card_choice_invitation" } }));
    expect(plan.architecture).toBe("interaction_invitation");
    expect(plan.angle).toBe("card_choice_invitation");
    expect(plan.ctaFamily).toBe("CHOOSE_CARD");
  });
  it("ignores a forced family the caller's band makes ineligible, and says so", () => {
    const plan = planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL, { force: { lengthFamily: "long_form" } }));
    expect(plan.lengthFamily).not.toBe("long_form");
    expect(plan.eligibility.notes.join(" ")).toMatch(/forced length family long_form is not eligible/);
  });
  it("offers all four families and every architecture when the caller band is wide", () => {
    const plan = planCopy(input(EMAILOPS_STRATEGY_DAILYANGEL, { hardBand: { min: 55, max: 230 }, paragraphBand: { min: 1, max: 6 }, force: { lengthFamily: "short_note", architecture: "sparse_alert" } }));
    expect(plan.eligibility.lengthFamilies).toEqual(["short_note", "standard", "story", "long_form"]);
    expect(plan.architecture).toBe("sparse_alert");
    expect(plan.lengthFamily).toBe("short_note");
    expect(plan.paragraphs).toEqual({ min: 1, max: 1 });
  });
});
