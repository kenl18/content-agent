import { describe, expect, it } from "vitest";
import { createContentClient } from "../../src/transport/local.js";
import type { ModelProvider } from "../../src/providers/model-provider.js";
import { isContentServiceError } from "../../src/domain/errors.js";
import { validPromoEmailRequest } from "../fixtures.js";

const fakeProvider: ModelProvider = {
  name: "fake",
  model: "fake-model",
  generate: async () => ({
    text: JSON.stringify({
      subjectLine: "s",
      previewText: "p",
      body: "b\n\nc",
      ctaLabel: "Read it",
      postscript: "P.S. same CTA, new angle."
    })
  })
};

describe("createContentClient (local transport)", () => {
  it("generates end-to-end with an injected provider", async () => {
    const client = createContentClient({ provider: fakeProvider });
    const result = await client.generate(validPromoEmailRequest());
    expect(isContentServiceError(result)).toBe(false);
  });

  it("throws when neither provider nor apiKey is supplied", () => {
    expect(() => createContentClient({})).toThrow();
  });

  it("returns structured errors rather than throwing on bad requests", async () => {
    const client = createContentClient({ provider: fakeProvider });
    const result = await client.generate({ nonsense: true });
    expect(isContentServiceError(result)).toBe(true);
  });
});
