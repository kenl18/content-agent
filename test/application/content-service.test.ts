import { describe, expect, it } from "vitest";
import { generateContent } from "../../src/application/content-service.js";
import { ProviderError, type ModelProvider } from "../../src/providers/model-provider.js";
import { isContentServiceError } from "../../src/domain/errors.js";
import { validPromoEmailRequest, validRawRequest } from "../fixtures.js";

function providerReturning(text: string): ModelProvider {
  return {
    name: "fake",
    model: "fake-model",
    generate: async () => ({ text })
  };
}

describe("generateContent (full pipeline)", () => {
  it("returns a structured response for a valid request and well-formed model output", async () => {
    const provider = providerReturning(
      JSON.stringify({ headline: "Your Story Is Written in the Stars", subheadline: "Free reading inside" })
    );
    const result = await generateContent(validRawRequest(), { provider });

    expect(isContentServiceError(result)).toBe(false);
    if (!isContentServiceError(result)) {
      expect(result.content.headline).toBe("Your Story Is Written in the Stars");
      expect(result.metadata.provider).toBe("fake");
      expect(result.metadata.schemaId).toBe("hero-headline-subheadline-v1");
      expect(result.metadata.templateId).toBe("landing-hero-generic-v1");
    }
  });

  it("generates a promotional email end-to-end, including the optional postscript", async () => {
    const provider = providerReturning(
      JSON.stringify({
        subjectLine: "The signs you noticed were pointing somewhere",
        previewText: "Your reading is ready when you are",
        body: "First paragraph.\n\nSecond paragraph with the promise.\n\nThird paragraph into the ask.",
        ctaLabel: "Read Your Full Message",
        postscript: "P.S. The reading takes less than a minute to open."
      })
    );
    const result = await generateContent(validPromoEmailRequest(), { provider });

    expect(isContentServiceError(result)).toBe(false);
    if (!isContentServiceError(result)) {
      expect(result.contentType).toBe("promotional-email");
      expect(result.metadata.templateId).toBe("promotional-email-generic-v2");
      expect(result.metadata.schemaId).toBe("promotional-email-v2");
      expect(result.content.subjectLine).toBeTruthy();
      expect(result.content.body).toContain("\n\n");
    }
  });

  it("accepts a promotional email response that omits the optional postscript", async () => {
    const provider = providerReturning(
      JSON.stringify({
        subjectLine: "s",
        previewText: "p",
        body: "b",
        ctaLabel: "c"
      })
    );
    const raw = validPromoEmailRequest({
      sections: [
        { key: "subjectLine", description: "d", required: true },
        { key: "previewText", description: "d", required: true },
        { key: "body", description: "d", required: true },
        { key: "ctaLabel", description: "d", required: true }
      ]
    });
    const result = await generateContent(raw, { provider });
    expect(isContentServiceError(result)).toBe(false);
  });

  it("runs a refresh-mode request and echoes the mode in metadata", async () => {
    const provider = providerReturning(
      JSON.stringify({
        subjectLine: "Refreshed subject",
        previewText: "p",
        body: "a\n\nb",
        ctaLabel: "Open Your Reading",
        changesFromReference: "Sharpened subject line — original phrasing was stale"
      })
    );
    const raw = validPromoEmailRequest({
      sections: [
        { key: "subjectLine", description: "d", required: true },
        { key: "previewText", description: "d", required: true },
        { key: "body", description: "d", required: true },
        { key: "ctaLabel", description: "d", required: true },
        { key: "changesFromReference", description: "one change per line", required: true }
      ],
      production: {
        mode: "refresh",
        referenceContent: [{ fields: { subjectLine: "Old subject", body: "Old body" } }],
        preserveElements: ["the core angle"]
      }
    });
    const result = await generateContent(raw, { provider });

    expect(isContentServiceError(result)).toBe(false);
    if (!isContentServiceError(result)) {
      expect(result.metadata.mode).toBe("refresh");
      expect(result.content.changesFromReference).toBeTruthy();
    }
  });

  it("runs a variant-mode request producing only variant sections", async () => {
    const provider = providerReturning(
      JSON.stringify({
        subjectLineVariants: "Variant one\nVariant two\nVariant three",
        rationale: "Three distinct curiosity angles"
      })
    );
    const raw = validPromoEmailRequest({
      sections: [
        { key: "subjectLineVariants", description: "3 variants, one per line", required: true },
        { key: "rationale", description: "why these", required: true }
      ],
      production: {
        mode: "variant",
        referenceContent: [{ fields: { subjectLine: "Old subject" } }],
        requestedVariants: { count: 3, vary: ["subjectLine"] }
      }
    });
    const result = await generateContent(raw, { provider });

    expect(isContentServiceError(result)).toBe(false);
    if (!isContentServiceError(result)) {
      expect(result.metadata.mode).toBe("variant");
      expect(result.content.subjectLineVariants?.split("\n")).toHaveLength(3);
    }
  });

  it("returns VALIDATION_ERROR for refresh mode without a reference", async () => {
    const provider = providerReturning("{}");
    const result = await generateContent(
      validPromoEmailRequest({ production: { mode: "refresh" } }),
      { provider }
    );
    expect(isContentServiceError(result)).toBe(true);
    if (isContentServiceError(result)) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns VALIDATION_ERROR for a request missing primaryObjective", async () => {
    const raw = validRawRequest();
    delete (raw as Record<string, unknown>).primaryObjective;
    const provider = providerReturning("{}");
    const result = await generateContent(raw, { provider });

    expect(isContentServiceError(result)).toBe(true);
    if (isContentServiceError(result)) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
      expect(result.requestId).toBe("req-123");
    }
  });

  it("returns UNKNOWN_CONTENT_TYPE for an unregistered contentType", async () => {
    const provider = providerReturning("{}");
    const result = await generateContent(validRawRequest({ contentType: "does-not-exist" }), { provider });

    expect(isContentServiceError(result)).toBe(true);
    if (isContentServiceError(result)) {
      expect(result.error.code).toBe("UNKNOWN_CONTENT_TYPE");
    }
  });

  it("returns VALIDATION_ERROR when requested sections don't match the resolved schema", async () => {
    const provider = providerReturning("{}");
    const raw = validRawRequest({
      sections: [{ key: "headline", description: "only one section", required: true }]
    });
    const result = await generateContent(raw, { provider });

    expect(isContentServiceError(result)).toBe(true);
    if (isContentServiceError(result)) {
      expect(result.error.code).toBe("VALIDATION_ERROR");
    }
  });

  it("returns PROVIDER_ERROR when the provider throws", async () => {
    const provider: ModelProvider = {
      name: "fake",
      model: "fake-model",
      generate: async () => {
        throw new Error("boom");
      }
    };
    const result = await generateContent(validRawRequest(), { provider });

    expect(isContentServiceError(result)).toBe(true);
    if (isContentServiceError(result)) {
      expect(result.error.code).toBe("PROVIDER_ERROR");
    }
  });

  it("keeps a classified provider failure on the wire (ADR-0017)", async () => {
    const limited: ModelProvider = {
      name: "claude-code",
      model: "claude-sonnet-5",
      generate: async () => {
        throw new ProviderError("usage limit", {
          classification: "CLAUDE_SUBSCRIPTION_LIMIT",
          details: { resetsAt: "2026-09-05T12:00:00.000Z" }
        });
      }
    };
    const result = await generateContent(validRawRequest(), { provider: limited });
    expect(isContentServiceError(result)).toBe(true);
    if (isContentServiceError(result)) {
      expect(result.error.code).toBe("CLAUDE_SUBSCRIPTION_LIMIT");
      expect(result.error.details).toEqual({
        classification: "CLAUDE_SUBSCRIPTION_LIMIT",
        resetsAt: "2026-09-05T12:00:00.000Z"
      });
    }

    const unauthenticated: ModelProvider = {
      name: "claude-code",
      model: "claude-sonnet-5",
      generate: async () => {
        throw new ProviderError("not logged in", { classification: "CLAUDE_AUTH_UNAVAILABLE" });
      }
    };
    const authResult = await generateContent(validRawRequest(), { provider: unauthenticated });
    if (isContentServiceError(authResult)) expect(authResult.error.code).toBe("CLAUDE_AUTH_UNAVAILABLE");

    const fault: ModelProvider = {
      name: "claude-code",
      model: "claude-sonnet-5",
      generate: async () => {
        throw new ProviderError("timed out");
      }
    };
    const faultResult = await generateContent(validRawRequest(), { provider: fault });
    if (isContentServiceError(faultResult)) expect(faultResult.error.code).toBe("PROVIDER_ERROR");
  });

  it("returns PROVIDER_OUTPUT_ERROR when the model output isn't valid JSON", async () => {
    const provider = providerReturning("not json at all");
    const result = await generateContent(validRawRequest(), { provider });

    expect(isContentServiceError(result)).toBe(true);
    if (isContentServiceError(result)) {
      expect(result.error.code).toBe("PROVIDER_OUTPUT_ERROR");
    }
  });

  it("returns RESPONSE_VALIDATION_ERROR when the model omits a required field", async () => {
    const provider = providerReturning(JSON.stringify({ headline: "Only a headline" }));
    const result = await generateContent(validRawRequest(), { provider });

    expect(isContentServiceError(result)).toBe(true);
    if (isContentServiceError(result)) {
      expect(result.error.code).toBe("RESPONSE_VALIDATION_ERROR");
    }
  });
});
