import { z } from "zod";

/**
 * Shape rule for open-vocabulary fields (BusinessObjective.type, BusinessModel revenue stream
 * types) per docs/contracts.md, "Open vocabulary fields" and ADR-0011: a well-formed
 * lowercase snake_case string, not a membership check against a closed list. Callers may supply
 * values outside any documented canonical set.
 */
export const openVocabularySchema = z
  .string()
  .regex(/^[a-z][a-z0-9_]*$/, "must be a lowercase snake_case string");

export type OpenVocabularyValue = z.infer<typeof openVocabularySchema>;
