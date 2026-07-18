import { z } from "zod";
import { openVocabularySchema } from "./open-vocabulary.js";

/**
 * Recommended starting vocabulary (docs/contracts.md). Not exhaustive and not enforced by the
 * schema below — see ADR-0011 and ADR-0012. Any well-formed value is accepted.
 */
export const CANONICAL_REVENUE_STREAM_TYPES = [
  "advertising_revenue",
  "affiliate_marketing",
  "email_list_monetization",
  "lead_generation",
  "direct_product_sales",
  "subscription_revenue",
  "service_bookings",
  "sponsored_content"
] as const;

export const businessModelSchema = z.object({
  primaryRevenueStream: openVocabularySchema,
  secondaryRevenueStreams: z.array(openVocabularySchema).default([]),
  note: z.string().min(1).optional()
});

export type BusinessModel = z.infer<typeof businessModelSchema>;
