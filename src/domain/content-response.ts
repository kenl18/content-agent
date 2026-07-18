import { z } from "zod";

/**
 * metadata is intentionally open (`.passthrough()`) — future optimization modules may attach
 * additional optional fields (e.g. readabilityScore) without a contract change. See
 * docs/technical-design.md, "Extension points for future optimization modules."
 */
export const contentResponseMetadataSchema = z
  .object({
    provider: z.string().min(1),
    model: z.string().min(1),
    templateId: z.string().min(1),
    schemaId: z.string().min(1),
    generatedAt: z.string().min(1),
    durationMs: z.number().nonnegative()
  })
  .passthrough();

export const contentResponseSchema = z.object({
  requestId: z.string().min(1),
  contentType: z.string().min(1),
  content: z.record(z.string(), z.string()),
  metadata: contentResponseMetadataSchema
});

export type ContentResponseMetadata = z.infer<typeof contentResponseMetadataSchema>;
export type ContentResponse = z.infer<typeof contentResponseSchema>;
