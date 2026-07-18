import { describe, expect, it } from "vitest";
import {
  buildContentSchema,
  getRegisteredSchema,
  validateSectionsAgainstSchema
} from "../../src/domain/schema-registry.js";

describe("schema-registry", () => {
  it("resolves the reference schemaId", () => {
    expect(getRegisteredSchema("hero-headline-subheadline-v1")).toBeDefined();
    expect(getRegisteredSchema("does-not-exist")).toBeUndefined();
  });

  it("accepts sections that exactly match the registered schema's required fields", () => {
    const schema = getRegisteredSchema("hero-headline-subheadline-v1")!;
    const issues = validateSectionsAgainstSchema(
      [
        { key: "headline", description: "d", required: true },
        { key: "subheadline", description: "d", required: true }
      ],
      schema
    );
    expect(issues).toEqual([]);
  });

  it("flags a section key not present in the schema", () => {
    const schema = getRegisteredSchema("hero-headline-subheadline-v1")!;
    const issues = validateSectionsAgainstSchema(
      [
        { key: "headline", description: "d", required: true },
        { key: "subheadline", description: "d", required: true },
        { key: "cta", description: "d", required: false }
      ],
      schema
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("flags a required schema field missing from sections", () => {
    const schema = getRegisteredSchema("hero-headline-subheadline-v1")!;
    const issues = validateSectionsAgainstSchema(
      [{ key: "headline", description: "d", required: true }],
      schema
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("promotional-email-v1 allows omitting the optional postscript from sections", () => {
    const schema = getRegisteredSchema("promotional-email-v1")!;
    const issues = validateSectionsAgainstSchema(
      [
        { key: "subjectLine", description: "d", required: true },
        { key: "previewText", description: "d", required: true },
        { key: "body", description: "d", required: true },
        { key: "ctaLabel", description: "d", required: true }
      ],
      schema
    );
    expect(issues).toEqual([]);
  });

  it("promotional-email-v1 flags a missing required field (previewText)", () => {
    const schema = getRegisteredSchema("promotional-email-v1")!;
    const issues = validateSectionsAgainstSchema(
      [
        { key: "subjectLine", description: "d", required: true },
        { key: "body", description: "d", required: true },
        { key: "ctaLabel", description: "d", required: true }
      ],
      schema
    );
    expect(issues.length).toBeGreaterThan(0);
  });

  it("buildContentSchema requires non-empty strings for required sections and rejects unknown keys", () => {
    const schema = buildContentSchema([
      { key: "headline", description: "d", required: true },
      { key: "subheadline", description: "d", required: false }
    ]);

    expect(schema.safeParse({ headline: "Hello", subheadline: "World" }).success).toBe(true);
    expect(schema.safeParse({ headline: "Hello" }).success).toBe(true);
    expect(schema.safeParse({ headline: "" }).success).toBe(false);
    expect(schema.safeParse({}).success).toBe(false);
    expect(schema.safeParse({ headline: "Hello", extra: "not allowed" }).success).toBe(false);
  });
});
