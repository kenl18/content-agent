import { z } from "zod";
import { businessObjectiveSchema } from "./business-objective.js";
import { businessModelSchema } from "./business-model.js";
import { productionSchema } from "./production.js";

export const contentSectionSchema = z.object({
  key: z.string().min(1),
  description: z.string().min(1),
  required: z.boolean()
});

export const contentConstraintsSchema = z.object({
  maxLength: z.number().positive().optional(),
  minLength: z.number().nonnegative().optional(),
  forbiddenPhrases: z.array(z.string()).optional(),
  requiredPhrases: z.array(z.string()).optional(),
  // Semantic prohibitions ("guaranteed results"), enforced via instructions — distinct from
  // forbiddenPhrases' literal string matching. See ADR-0016.
  prohibitedClaims: z.array(z.string().min(1)).optional()
});

export const contentRequestSchema = z
  .object({
    requestId: z.string().min(1),
    consumer: z.string().min(1),
    contentType: z.string().min(1),
    businessModel: businessModelSchema,
    primaryObjective: businessObjectiveSchema,
    secondaryObjectives: z.array(businessObjectiveSchema).default([]),
    targetAudience: z.string().min(1),
    desiredAction: z.string().min(1),
    sections: z.array(contentSectionSchema).min(1),
    context: z.record(z.string(), z.unknown()).default({}),
    tone: z.string().min(1).optional(),
    constraints: contentConstraintsSchema.optional(),
    production: productionSchema.optional()
  })
  .superRefine((request, ctx) => {
    const seen = new Set<string>();
    request.sections.forEach((section, index) => {
      if (seen.has(section.key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: `duplicate section key "${section.key}"`,
          path: ["sections", index, "key"]
        });
      }
      seen.add(section.key);
    });

    // Mode coherence (ADR-0016): refresh/variant must be grounded in a supplied reference —
    // the service never invents the thing it's told to preserve (ADR-0005) — and create must
    // not smuggle references in, forcing honest mode selection.
    const production = request.production;
    if (!production) return;
    const hasReference = production.referenceContent.length > 0;
    if (production.mode === "refresh" && !hasReference) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mode "refresh" requires at least one referenceContent entry',
        path: ["production", "referenceContent"]
      });
    }
    if (production.mode === "variant") {
      if (!hasReference) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mode "variant" requires at least one referenceContent entry',
          path: ["production", "referenceContent"]
        });
      }
      if (!production.requestedVariants) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: 'mode "variant" requires requestedVariants',
          path: ["production", "requestedVariants"]
        });
      }
    }
    if (production.mode === "create" && hasReference) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'mode "create" forbids referenceContent — use "refresh" or "variant" when a reference exists',
        path: ["production", "referenceContent"]
      });
    }
    if (production.mode !== "variant" && production.requestedVariants) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: 'requestedVariants is only allowed in mode "variant"',
        path: ["production", "requestedVariants"]
      });
    }
  });

export type ContentSection = z.infer<typeof contentSectionSchema>;
export type ContentConstraints = z.infer<typeof contentConstraintsSchema>;
export type ContentRequest = z.infer<typeof contentRequestSchema>;
