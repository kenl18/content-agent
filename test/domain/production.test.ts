import { describe, expect, it } from "vitest";
import { contentRequestSchema } from "../../src/domain/content-request.js";
import { validPromoEmailRequest } from "../fixtures.js";

const reference = {
  label: "2026-05 winner",
  fields: { subjectLine: "s", previewText: "p", body: "b" },
  performanceSummary: { openRate: 0.41, clickRate: 0.062 }
};

describe("production block (ADR-0016 mode coherence)", () => {
  it("accepts a request with no production block (backward compatible)", () => {
    expect(contentRequestSchema.safeParse(validPromoEmailRequest()).success).toBe(true);
  });

  it("accepts refresh with a reference", () => {
    const raw = validPromoEmailRequest({
      production: {
        mode: "refresh",
        referenceContent: [reference],
        preserveElements: ["curiosity-gap subject angle"],
        improveElements: ["stale phrasing"]
      }
    });
    expect(contentRequestSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects refresh without a reference", () => {
    const raw = validPromoEmailRequest({ production: { mode: "refresh" } });
    expect(contentRequestSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects variant without requestedVariants", () => {
    const raw = validPromoEmailRequest({
      production: { mode: "variant", referenceContent: [reference] }
    });
    expect(contentRequestSchema.safeParse(raw).success).toBe(false);
  });

  it("accepts variant with reference and requestedVariants", () => {
    const raw = validPromoEmailRequest({
      production: {
        mode: "variant",
        referenceContent: [reference],
        requestedVariants: { count: 3, vary: ["subjectLine"], hold: "angle, offer framing" }
      }
    });
    expect(contentRequestSchema.safeParse(raw).success).toBe(true);
  });

  it("rejects create carrying a reference", () => {
    const raw = validPromoEmailRequest({
      production: { mode: "create", referenceContent: [reference] }
    });
    expect(contentRequestSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects requestedVariants outside variant mode", () => {
    const raw = validPromoEmailRequest({
      production: {
        mode: "refresh",
        referenceContent: [reference],
        requestedVariants: { count: 2, vary: ["subjectLine"] }
      }
    });
    expect(contentRequestSchema.safeParse(raw).success).toBe(false);
  });

  it("rejects a reference with empty fields", () => {
    const raw = validPromoEmailRequest({
      production: { mode: "refresh", referenceContent: [{ fields: {} }] }
    });
    expect(contentRequestSchema.safeParse(raw).success).toBe(false);
  });

  it("accepts constraints.prohibitedClaims", () => {
    const raw = validPromoEmailRequest({
      constraints: { prohibitedClaims: ["guaranteed results"] }
    });
    expect(contentRequestSchema.safeParse(raw).success).toBe(true);
  });

  it("caps referenceContent at 5 entries", () => {
    const raw = validPromoEmailRequest({
      production: { mode: "refresh", referenceContent: Array(6).fill(reference) }
    });
    expect(contentRequestSchema.safeParse(raw).success).toBe(false);
  });
});
