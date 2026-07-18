import { z } from "zod";
import { openVocabularySchema } from "./open-vocabulary.js";

/**
 * Recommended starting vocabulary (docs/contracts.md). Not exhaustive and not enforced by the
 * schema below — see ADR-0011. Templates may have specific tuning for these; any other
 * well-formed value is still accepted and passed through to the model.
 */
export const CANONICAL_BUSINESS_OBJECTIVE_TYPES = [
  "increase_organic_traffic",
  "improve_search_intent_matching",
  "increase_time_on_page",
  "reduce_bounce_rate",
  "increase_pages_per_session",
  "increase_ad_viewability",
  "increase_adsense_rpm",
  "encourage_tool_usage",
  "increase_email_capture",
  "improve_affiliate_click_through_rate",
  "improve_affiliate_conversion_rate",
  "build_trust",
  "improve_user_retention"
] as const;

export const businessObjectiveSchema = z.object({
  type: openVocabularySchema,
  note: z.string().min(1).optional()
});

export type BusinessObjective = z.infer<typeof businessObjectiveSchema>;
