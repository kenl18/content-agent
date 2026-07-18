import { describe, expect, it } from "vitest";
import { contentRequestSchema } from "../../src/domain/content-request.js";
import { validRawRequest } from "../fixtures.js";

describe("contentRequestSchema", () => {
  it("accepts a well-formed request", () => {
    const result = contentRequestSchema.safeParse(validRawRequest());
    expect(result.success).toBe(true);
  });

  it("rejects a request missing primaryObjective", () => {
    const raw = validRawRequest();
    delete (raw as Record<string, unknown>).primaryObjective;
    const result = contentRequestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("rejects a request missing businessModel", () => {
    const raw = validRawRequest();
    delete (raw as Record<string, unknown>).businessModel;
    const result = contentRequestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("accepts an objective type outside the canonical vocabulary (open vocabulary)", () => {
    const raw = validRawRequest({
      primaryObjective: { type: "increase_newsletter_forwarding" }
    });
    const result = contentRequestSchema.safeParse(raw);
    expect(result.success).toBe(true);
  });

  it("rejects a malformed (non-snake_case) objective type", () => {
    const raw = validRawRequest({
      primaryObjective: { type: "Increase Email Capture" }
    });
    const result = contentRequestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("rejects duplicate section keys", () => {
    const raw = validRawRequest({
      sections: [
        { key: "headline", description: "a", required: true },
        { key: "headline", description: "b", required: false }
      ]
    });
    const result = contentRequestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("rejects an empty sections array", () => {
    const raw = validRawRequest({ sections: [] });
    const result = contentRequestSchema.safeParse(raw);
    expect(result.success).toBe(false);
  });

  it("defaults secondaryObjectives and context when omitted", () => {
    const raw = validRawRequest();
    delete (raw as Record<string, unknown>).secondaryObjectives;
    delete (raw as Record<string, unknown>).context;
    const result = contentRequestSchema.safeParse(raw);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.secondaryObjectives).toEqual([]);
      expect(result.data.context).toEqual({});
    }
  });
});
