import { z } from "zod";

/**
 * Production modes (ADR-0016). Channel-neutral by design: the channel is carried by
 * contentType, so future funnel contentTypes reuse these same modes unchanged.
 */
export const PRODUCTION_MODES = ["refresh", "create", "variant"] as const;
export type ProductionMode = (typeof PRODUCTION_MODES)[number];

/**
 * A caller-supplied reference (e.g. a proven historical email). `performanceSummary` is
 * aggregate metrics only — never subscriber-level data; that boundary is contractual
 * (docs/contracts.md) since it cannot be detected schematically.
 */
export const referenceContentSchema = z.object({
  label: z.string().min(1).optional(),
  fields: z
    .record(z.string(), z.string().min(1))
    .refine((fields) => Object.keys(fields).length > 0, "reference fields must not be empty"),
  performanceSummary: z.record(z.string(), z.union([z.string(), z.number()])).optional()
});

export const requestedVariantsSchema = z.object({
  count: z.number().int().min(1).max(5),
  vary: z.array(z.string().min(1)).min(1),
  hold: z.string().min(1).optional()
});

export const productionSchema = z.object({
  mode: z.enum(PRODUCTION_MODES),
  referenceContent: z.array(referenceContentSchema).max(5).default([]),
  preserveElements: z.array(z.string().min(1)).default([]),
  improveElements: z.array(z.string().min(1)).default([]),
  requestedVariants: requestedVariantsSchema.optional()
});

export type ReferenceContent = z.infer<typeof referenceContentSchema>;
export type RequestedVariants = z.infer<typeof requestedVariantsSchema>;
export type Production = z.infer<typeof productionSchema>;
