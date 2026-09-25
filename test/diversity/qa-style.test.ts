import { describe, expect, it } from "vitest";
import { detectTics, paragraphRhythm } from "../../src/diversity/tics.js";
import { detectBanned, detectClaims } from "../../src/diversity/claims.js";
import { rankSubjects } from "../../src/diversity/subjects.js";
import { renderRevision, reviewDraft, stripSignoff } from "../../src/diversity/qa.js";
import { CopyLedger, classifyCopy, hookFamilyOf, subjectStructureOf } from "../../src/diversity/ledger.js";
import { parseStrategy } from "../../src/diversity/strategy-parser.js";
import { planCopy } from "../../src/diversity/planner.js";
import { resolvePersona, renderVoiceContract, PERSONA_CONTRACTS } from "../../src/templates/persona-registry.js";
import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { EMAILOPS_STRATEGY_DAILYANGEL } from "../fixtures-v4.js";

const TIC_HEAVY =
  "There's a message that hasn't been opened yet — not a general one, not a type — and it names the person. " +
  "Not a name. Not a date. It's the part worth reading properly, and your reading names them — the specific line they never sent. " +
  "This isn't about the past, but about what stayed specific.";

describe("tics", () => {
  it("counts the estate's fingerprints over their per-email allowance", () => {
    const r = detectTics(TIC_HEAVY, "Someone kept a message for you");
    const ids = r.hits.map((h) => h.id);
    expect(ids).toEqual(expect.arrayContaining(["em_dash", "not_a_general", "staccato_negation", "the_part_worth", "asserted_specificity", "there_is_opener"]));
    // One "your reading names…" is ordinary usage and stays within its allowance.
    expect(ids).not.toContain("reading_names");
    expect(r.distinctOver).toBeGreaterThanOrEqual(5);
    expect(r.hits.find((h) => h.id === "em_dash")!.fix).toMatch(/at most one em-dash/);
  });
  it("lets a single ordinary occurrence pass", () => {
    const r = detectTics("The card came up twice this week. It is the same card — the one you set aside. You know which.", "One card, twice");
    expect(r.hits.map((h) => h.id)).not.toContain("em_dash");
    expect(r.score).toBe(0);
  });
  it("flags uniform paragraph rhythm", () => {
    expect(paragraphRhythm(["a b c d e f g h i j", "k l m n o p q r s t", "u v w x y z a b c d"]).uniform).toBe(true);
    expect(paragraphRhythm(["a b c d e f g h i j k l m n o p", "short.", "u v w x y z a b c d e f"]).uniform).toBe(false);
  });
});

describe("claims", () => {
  it("detects precision classes and ignores denials", () => {
    expect(detectClaims("There is a specific day marked in your reading.").map((c) => c.cls)).toContain("date");
    expect(detectClaims("A 48-hour window opened around you.").map((c) => c.cls)).toContain("timing_window");
    expect(detectClaims("Your reading names the person and shows their name.").map((c) => c.cls)).toContain("person");
    expect(detectClaims("Choose one card to reveal the message.").map((c) => c.cls)).toContain("card_choice");
    expect(detectClaims("It doesn't hand you a name or a date.").map((c) => c.cls)).toEqual([]);
    expect(detectClaims("Not a specific day — a pattern.").map((c) => c.cls)).toEqual([]);
  });
  it("detects banned patterns", () => {
    expect(detectBanned("Someone paid for a reading and got your face.").map((b) => b.code)).toContain("FABRICATED_EVENT");
    expect(detectBanned("This closes at midnight. Last chance.").map((b) => b.code)).toContain("FAKE_URGENCY");
    expect(detectBanned("Blue eyes are watching you tonight.").map((b) => b.code)).toContain("SURVEILLANCE");
    expect(detectBanned("A card came up twice this week.")).toEqual([]);
  });
});

describe("ledger classification", () => {
  it("labels hook family, structure and angle at concept level", () => {
    expect(hookFamilyOf("Someone thought about you last night")).toBe("someone_opener");
    expect(hookFamilyOf("Why does it keep coming back?")).toBe("question");
    expect(hookFamilyOf("The card that came back after the shuffle")).toBe("object_image");
    expect(subjectStructureOf("Read the second half first…")).toBe("ellipsis_loop");
    expect(subjectStructureOf("One card, twice")).toBe("fragment");
    const a = classifyCopy({ subject: "Someone thought about you last night", body: "Someone thought of you and set the phone down. It has been sitting there.\n\nYour reading looks at why.\n\nRead it.", cta: "See why the thought showed up" });
    const b = classifyCopy({ subject: "A person has you on their mind", body: "A person has you on their mind this week and has not said so.\n\nThe reading concerns them.\n\nOpen it.", cta: "Reveal who it is" });
    expect(a.angle).toBe("someone_thinking_of_you");
    expect(b.angle).toBe("someone_thinking_of_you");
    expect(a.lengthFamily).toBe("short_note");
  });
  it("appends and reads back within a window, per account", () => {
    const dir = mkdtempSync(join(tmpdir(), "ledger-"));
    const ledger = new CopyLedger({ dir });
    const base = { consumer: "emailops", requestId: "r1", sendKey: "k", attempt: 1, account: "acct_a", persona: null, destination: "d", lengthFamily: "standard" as const, architecture: "observation_implication_reveal" as const, angle: "message_waiting" as const, hookFamily: "statement" as never, emotionalEngine: "hope" as const, promiseType: "message" as const, ctaFamily: "REVEAL_MESSAGE" as const, subjectStructure: "statement" as const, subject: "S", words: 100, paragraphs: 3, ticScore: 0, qaOk: true, qaFindings: [], generations: 1, source: "generated" as const };
    ledger.append({ ...base, at: new Date(Date.now() - 20 * 86400e3).toISOString() });
    ledger.append({ ...base, at: new Date().toISOString(), requestId: "r2" });
    expect(ledger.recent("acct_a", 14).map((e) => e.requestId)).toEqual(["r2"]);
    expect(ledger.recent("acct_b")).toEqual([]);
    expect(ledger.attemptsFor("acct_a", "k").length).toBe(1);
    expect(ledger.accounts()).toEqual(["acct_a"]);
    rmSync(dir, { recursive: true, force: true });
  });
});

describe("persona registry", () => {
  it("resolves by account, by persona name and by brand; ODR is now historical (all three accounts cut over 2026-09-06)", () => {
    expect(resolvePersona({ account: "gr3_readings" })?.name).toBe("Eckhart");
    expect(resolvePersona({ brand: "Sacred Praying", fromNames: ["Madama Seraphina 🔮"] })?.id).toBe("madama_seraphina");
    expect(resolvePersona({ brand: "The Venus Window" })?.signoffMode).toBe("brand");
    // kit_mystic / kit_divine / sendfox_vw were OWNER_DECISION_REQUIRED when this test was
    // written; the owner's 2026-09-06 ONE-ACCOUNT-ONE-PERSONA cutover resolved all three
    // (Raven Thorne, Elara Quinn, Noelle Vesper). Their former house voices
    // (spiritual_oasis_house, divine_pathway_kit_house, venus_window_sendfox_house) stay in
    // PERSONA_CONTRACTS with accounts: [] and status "OWNER_DECISION_REQUIRED"/"RETIRED_..." as
    // history and as resolvePersona()'s brand fallback, but no live account resolves to them.
    const raven = resolvePersona({ account: "kit_mystic" })!;
    expect(raven.id).toBe("raven_thorne");
    expect(raven.status).toBe("RESOLVED");
    expect(raven.firstPerson).toBe("yes");
    expect(renderVoiceContract(raven, "kit_mystic")).toMatch(/You may write in the first person/);
    const retiredHouseVoice = PERSONA_CONTRACTS.find((c) => c.id === "spiritual_oasis_house")!;
    expect(retiredHouseVoice.accounts).toEqual([]);
    expect(renderVoiceContract(retiredHouseVoice, null)).toMatch(/Never write in the first person/);
    expect(resolvePersona({ account: "nobody", brand: "Unknown Co" })).toBeNull();
  });
  it("gives every RESOLVED persona-signed contract a distinct rhythm and imagery line", () => {
    const persona = PERSONA_CONTRACTS.filter((c) => c.signoffMode === "persona" && c.status === "RESOLVED");
    // 15 persona-signed accounts as of the 2026-09-06 ONE-ACCOUNT-ONE-PERSONA cutover (16th
    // in-scope account, resend_divinepathway, stays brand-signed — held on deliverability, not
    // identity, per test/oneAccountOneVoice.test.js in the caller repo).
    expect(persona.map((c) => c.name)).toEqual([
      "Elara Quinn", "Noelle Vesper", "Sabine Hart", "Amara Rowan", "Raven Thorne",
      "Clara Voss", "Mira Arden", "Celia Rose", "Donna Rowanfield", "Elise Marlowe",
      "Madama Seraphina", "Eckhart", "Seren Vale", "Wren Solace", "Maren Hale",
    ]);
    expect(new Set(persona.map((c) => c.rhythm)).size).toBe(persona.length);
    expect(new Set(persona.map((c) => c.imagery)).size).toBe(persona.length);
    for (const c of PERSONA_CONTRACTS) expect(c.evidence.length).toBeGreaterThan(0);
  });
});

describe("subject ranking", () => {
  const parsed = parseStrategy(EMAILOPS_STRATEGY_DAILYANGEL);
  const plan = planCopy({ requestId: "r", account: "kit_mystic", sendKey: null, attempt: 1, persona: resolvePersona({ account: "kit_mystic" }), destination: "dailyangelmessage", truth: parsed.truth, pack: null, cta: parsed.cta, hardBand: parsed.hardBand, paragraphBand: parsed.paragraphBand, recent: [], priorAttempts: [], preferredFrames: [] });
  it("rejects unsupported claims, near-duplicates and over-long subjects, and demotes the dominant opener", () => {
    const recent = ["Someone thought about you last night", "Someone kept a message for you", "Someone almost said it", "A line was set aside"];
    const { chosen, ranked } = rankSubjects(
      [
        { subject: "Someone thought of you last night", preheader: "It came back this morning." },
        { subject: "The exact date is marked in your reading", preheader: "Open it." },
        { subject: "Someone kept a message waiting for you", preheader: "Read it." },
        { subject: "This message is a very long subject line that goes on far beyond fifty-eight characters", preheader: "x" },
        { subject: "One sentence went unanswered last week", preheader: "The reason arrived this morning." }
      ],
      { plan: { ...plan, subjectStructure: "specific_observation" }, truth: parsed.truth, cta: parsed.cta, persona: resolvePersona({ account: "kit_mystic" }), recentSubjects: recent, recentStructures: [], rng: () => 0.5 }
    );
    expect(chosen?.subject).toBe("One sentence went unanswered last week");
    expect(ranked.find((r) => /exact date/.test(r.subject))!.rejected).toMatch(/unsupported date/);
    expect(ranked.find((r) => /kept a message waiting/.test(r.subject))!.rejected).toMatch(/near-duplicate/);
    expect(ranked.find((r) => /very long/.test(r.subject))!.rejected).toMatch(/over 58/);
    expect(ranked.find((r) => /thought of you/.test(r.subject))!.notes.join(" ")).toMatch(/Someone/);
  });
  it("penalises a preheader that echoes the subject", () => {
    const { ranked } = rankSubjects([{ subject: "A message arrived this morning", preheader: "A message arrived this morning for you." }, { subject: "A message arrived this morning", preheader: "It is about the thing you said last week." }], { plan, truth: parsed.truth, cta: parsed.cta, persona: null, recentSubjects: [], recentStructures: [], rng: () => 0.5 });
    expect(ranked[0]!.preheader).toMatch(/last week/);
  });
});

describe("draft review", () => {
  const parsed = parseStrategy(EMAILOPS_STRATEGY_DAILYANGEL);
  const persona = resolvePersona({ account: "kit_mystic" });
  const plan = planCopy({ requestId: "r", account: "kit_mystic", sendKey: null, attempt: 1, persona, destination: "dailyangelmessage", truth: parsed.truth, pack: null, cta: parsed.cta, hardBand: parsed.hardBand, paragraphBand: parsed.paragraphBand, recent: [], priorAttempts: [], preferredFrames: [] });
  const ctx = { plan: { ...plan, promiseType: "message" as const, angle: "message_waiting" as const }, truth: parsed.truth, cta: parsed.cta, persona, siblingBrands: parsed.siblingBrands, hardBand: parsed.hardBand, paragraphBand: parsed.paragraphBand, recent: [] };
  it("rejects an unsupported person claim, a repeated promise, a generic CTA and the fingerprint budget, with fixes", () => {
    const review = reviewDraft({ subject: "A message was kept back", preheader: "It was written before you asked.", body: TIC_HEAVY + "\n\nThe message names the person for you. The message is waiting. This message concerns a person.\n\nRead it when you can.", cta: "Read your full reading" }, ctx);
    const codes = review.findings.map((f) => f.code);
    expect(review.ok).toBe(false);
    expect(codes).toContain("UNSUPPORTED_PERSON_CLAIM");
    expect(codes).toContain("REPEATED_PROMISE");
    expect(codes).toContain("CTA_GENERIC");
    expect(codes).toContain("STYLE_FINGERPRINT");
    expect(review.findings.find((f) => f.code === "REPEATED_PROMISE")!.fix).toMatch(/Keep sentence \d+/);
    const revision = renderRevision(review, plan, 1);
    expect(revision).toMatch(/REVISION 1/);
    expect(revision).toMatch(/UNSUPPORTED_PERSON_CLAIM/);
    expect(revision).toMatch(/Previous draft:/);
  });
  it("rejects a CTA that shares no word with the email and a length outside the caller's band", () => {
    const review = reviewDraft({ subject: "One sentence went unanswered", preheader: "The reason arrived this morning.", body: "Short.\n\nToo short.\n\nStill short.", cta: "Reveal who it is" }, ctx);
    const codes = review.findings.map((f) => f.code);
    expect(codes).toContain("LENGTH_OUTSIDE_HARD_BAND");
    expect(codes).toContain("CTA_NOT_DERIVED");
  });
  it("accepts a clean draft and strips a trailing sign-off", () => {
    const body = "Last week you said something out loud that you had only ever thought. It was in the kitchen, late, to nobody in particular, and nobody answered it at the time.\n\nThis morning's angel reading picks that sentence up. It gives the reason it went unanswered, and what the silence was holding for you while you waited for an answer that never came.\n\nOpen the message and read the reason for yourself. It is shorter than you expect, and it ends on the line you needed to hear.\n\nWith warmth,\n— Spiritual Oasis";
    const review = reviewDraft({ subject: "A line was kept back until this morning", preheader: "It concerns something you said out loud last week.", body, cta: "Open the message and read the reason" }, ctx);
    expect(review.findings.filter((f) => f.severity === "reject")).toEqual([]);
    expect(review.ok).toBe(true);
    expect(review.paragraphs.length).toBe(3);
    expect(review.paragraphs[2]).not.toMatch(/Spiritual Oasis/);
    expect(stripSignoff("A.\n\nB.\n\nWarmly,\nEckhart", ["Eckhart"])).toBe("A.\n\nB.");
  });
});
