import { z } from "zod";
import type { ContentSection } from "./content-request.js";

/**
 * A registered output schema: the fixed set of fields a given schemaId's content must produce,
 * decoupled from contentType (see ADR-0007). `required: false` fields may still be requested by
 * a caller's `sections` entry, but the schema itself does not mandate them.
 */
export interface RegisteredSchemaField {
  required: boolean;
}

export interface RegisteredSchema {
  schemaId: string;
  fields: Record<string, RegisteredSchemaField>;
}

const schemaRegistry = new Map<string, RegisteredSchema>([
  [
    "hero-headline-subheadline-v1",
    {
      schemaId: "hero-headline-subheadline-v1",
      fields: {
        headline: { required: true },
        subheadline: { required: true }
      }
    }
  ],
  [
    // Output Layer for the promotional-email template. `body` holds multi-paragraph text
    // joined with \n\n (the flat-string-map convention recorded in
    // docs/validation/soulmate-message-validation.md, G-3). The CTA destination URL is
    // never part of content — EmailOps wraps `ctaLabel` in its own link.
    "promotional-email-v1",
    {
      schemaId: "promotional-email-v1",
      fields: {
        subjectLine: { required: true },
        previewText: { required: true },
        body: { required: true },
        ctaLabel: { required: true },
        postscript: { required: false }
      }
    }
  ],
  [
    // ADR-0016: production-mode-aware email schema. Every field is schema-optional so the
    // caller's `sections` selects what a given run requires (a subject-variant run requests
    // only subjectLineVariants + rationale). List fields are newline-delimited; bodySections
    // and bodyVariants use \n---\n block delimiters, blocks starting "role: " (hook, story,
    // cta-lead, ps, ...). No URL/TID/HTML fields exist by design.
    "promotional-email-v2",
    {
      schemaId: "promotional-email-v2",
      fields: {
        subjectLine: { required: false },
        previewText: { required: false },
        body: { required: false },
        bodySections: { required: false },
        ctaLabel: { required: false },
        textOnlyVersion: { required: false },
        postscript: { required: false },
        rationale: { required: false },
        changesFromReference: { required: false },
        riskFlags: { required: false },
        testHypotheses: { required: false },
        subjectLineVariants: { required: false },
        previewTextVariants: { required: false },
        hookVariants: { required: false },
        ctaLabelVariants: { required: false },
        bodyVariants: { required: false }
      }
    }
  ]
]);

export function getRegisteredSchema(schemaId: string): RegisteredSchema | undefined {
  return schemaRegistry.get(schemaId);
}

/**
 * Cross-checks request-supplied sections against a registered schema's fields: every section key
 * must be a known field, and every field the schema marks required must appear in `sections`
 * with `required: true`. Returns a list of human-readable issues; empty means valid.
 */
export function validateSectionsAgainstSchema(
  sections: ContentSection[],
  registeredSchema: RegisteredSchema
): string[] {
  const issues: string[] = [];
  const sectionsByKey = new Map(sections.map((section) => [section.key, section]));

  for (const section of sections) {
    if (!(section.key in registeredSchema.fields)) {
      issues.push(`section "${section.key}" is not part of schema "${registeredSchema.schemaId}"`);
    }
  }

  for (const [fieldKey, field] of Object.entries(registeredSchema.fields)) {
    if (!field.required) continue;
    const section = sectionsByKey.get(fieldKey);
    if (!section) {
      issues.push(`schema "${registeredSchema.schemaId}" requires a section for "${fieldKey}"`);
    } else if (!section.required) {
      issues.push(`section "${fieldKey}" must be marked required for schema "${registeredSchema.schemaId}"`);
    }
  }

  return issues;
}

/**
 * Builds the Zod schema a provider's parsed output must satisfy: required fields are non-empty
 * strings, optional fields (per the request's own sections) are optional non-empty strings, and
 * no keys outside the request's sections are permitted.
 */
export function buildContentSchema(sections: ContentSection[]) {
  const shape: Record<string, z.ZodTypeAny> = {};
  for (const section of sections) {
    shape[section.key] = section.required ? z.string().min(1) : z.string().min(1).optional();
  }
  return z.object(shape).strict();
}
