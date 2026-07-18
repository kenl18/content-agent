import { describe, expect, it } from "vitest";
import { businessObjectiveSchema } from "../../src/domain/business-objective.js";
import { businessModelSchema } from "../../src/domain/business-model.js";

describe("open vocabulary fields", () => {
  it("accepts canonical and custom snake_case objective types", () => {
    expect(businessObjectiveSchema.safeParse({ type: "increase_email_capture" }).success).toBe(true);
    expect(businessObjectiveSchema.safeParse({ type: "a_brand_new_objective" }).success).toBe(true);
  });

  it("rejects non-snake_case objective types", () => {
    expect(businessObjectiveSchema.safeParse({ type: "IncreaseEmailCapture" }).success).toBe(false);
    expect(businessObjectiveSchema.safeParse({ type: "increase email capture" }).success).toBe(false);
    expect(businessObjectiveSchema.safeParse({ type: "" }).success).toBe(false);
  });

  it("accepts a business model with primary + secondary revenue streams", () => {
    const result = businessModelSchema.safeParse({
      primaryRevenueStream: "advertising_revenue",
      secondaryRevenueStreams: ["affiliate_marketing", "a_new_revenue_model"]
    });
    expect(result.success).toBe(true);
  });

  it("defaults secondaryRevenueStreams to an empty array", () => {
    const result = businessModelSchema.safeParse({ primaryRevenueStream: "advertising_revenue" });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.secondaryRevenueStreams).toEqual([]);
    }
  });
});
