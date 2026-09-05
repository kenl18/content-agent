import { describe, expect, it } from "vitest";
import { buildInstructions } from "../../src/generation/build-instructions.js";
import { contentRequestSchema } from "../../src/domain/content-request.js";
import { selectTemplate } from "../../src/templates/select-template.js";
import { validPromoEmailRequest, validRawRequest } from "../fixtures.js";

describe("buildInstructions", () => {
  const request = contentRequestSchema.parse(validRawRequest());
  const template = selectTemplate(request.contentType)!;

  it("is a pure function: identical inputs produce identical instructions", () => {
    const first = buildInstructions(request, template);
    const second = buildInstructions(request, template);
    expect(first).toEqual(second);
  });

  it("includes the primary and secondary business objectives", () => {
    const instructions = buildInstructions(request, template);
    expect(instructions.user).toContain("increase_email_capture");
    expect(instructions.user).toContain("build_trust");
  });

  it("includes the business model's revenue streams", () => {
    const instructions = buildInstructions(request, template);
    expect(instructions.user).toContain("advertising_revenue");
    expect(instructions.user).toContain("affiliate_marketing");
  });

  it("includes every requested section key and its required/optional status", () => {
    const instructions = buildInstructions(request, template);
    expect(instructions.user).toContain("headline");
    expect(instructions.user).toContain("subheadline");
    expect(instructions.user).toContain("required");
  });

  it("emits an outputSchema mirroring the requested sections (ADR-0017)", () => {
    const instructions = buildInstructions(request, template);
    expect(instructions.outputSchema).toEqual({
      type: "object",
      properties: {
        headline: { type: "string", minLength: 1, description: "A short, benefit-driven headline" },
        subheadline: { type: "string", minLength: 1, description: "One supporting sentence" }
      },
      required: ["headline", "subheadline"],
      additionalProperties: false
    });
    const promo = contentRequestSchema.parse(validPromoEmailRequest());
    const promoInstructions = buildInstructions(promo, selectTemplate(promo.contentType)!);
    expect(promoInstructions.outputSchema?.required).toEqual(["subjectLine", "previewText", "body", "ctaLabel"]);
    expect(Object.keys(promoInstructions.outputSchema?.properties ?? {})).toContain("postscript");
  });

  it("instructs the model to respond with JSON only", () => {
    const instructions = buildInstructions(request, template);
    expect(instructions.system.toLowerCase()).toContain("json");
  });

  it("does not invent facts absent from the request (no hardcoded brand/business text)", () => {
    const instructions = buildInstructions(request, template);
    expect(instructions.system).not.toContain("Astrology");
    expect(instructions.user).toContain("Astrology Manifest");
  });

  describe("production brief rendering (ADR-0016)", () => {
    const emailTemplate = selectTemplate("promotional-email")!;
    const refreshRequest = contentRequestSchema.parse(
      validPromoEmailRequest({
        production: {
          mode: "refresh",
          referenceContent: [
            {
              label: "may-winner",
              fields: { subjectLine: "Old subject", body: "Old body" },
              performanceSummary: { openRate: 0.41 }
            }
          ],
          preserveElements: ["the curiosity-gap angle"],
          improveElements: ["stale phrasing"]
        }
      })
    );

    it("renders reference fields, performance, preserve and improve lists into the user prompt", () => {
      const instructions = buildInstructions(refreshRequest, emailTemplate);
      expect(instructions.user).toContain("Production mode: refresh");
      expect(instructions.user).toContain("may-winner");
      expect(instructions.user).toContain("Old subject");
      expect(instructions.user).toContain("openRate: 0.41");
      expect(instructions.user).toContain("the curiosity-gap angle");
      expect(instructions.user).toContain("stale phrasing");
    });

    it("appends the refresh mode overlay to the system prompt", () => {
      const instructions = buildInstructions(refreshRequest, emailTemplate);
      expect(instructions.system).toContain("REFRESH mode");
      expect(instructions.system).not.toContain("VARIANT mode");
    });

    it("appends the variant overlay and renders the variant spec", () => {
      const variantRequest = contentRequestSchema.parse(
        validPromoEmailRequest({
          production: {
            mode: "variant",
            referenceContent: [{ fields: { subjectLine: "Old subject" } }],
            requestedVariants: { count: 3, vary: ["subjectLine"], hold: "angle" }
          }
        })
      );
      const instructions = buildInstructions(variantRequest, emailTemplate);
      expect(instructions.system).toContain("VARIANT mode");
      expect(instructions.user).toContain("3 variant(s)");
      expect(instructions.user).toContain("subjectLine");
      expect(instructions.user).toContain("hold constant: angle");
    });

    it("applies no overlay in create mode", () => {
      const createRequest = contentRequestSchema.parse(
        validPromoEmailRequest({ production: { mode: "create" } })
      );
      const instructions = buildInstructions(createRequest, emailTemplate);
      expect(instructions.system).not.toContain("REFRESH mode");
      expect(instructions.system).not.toContain("VARIANT mode");
      expect(instructions.user).toContain("Production mode: create");
    });
  });
});
