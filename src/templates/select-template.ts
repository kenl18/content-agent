import { getTemplateForContentType } from "./template-registry.js";
import type { Template } from "./template.js";

/**
 * Template Selection (ADR-0008). V1 resolves purely on `contentType`; objective/business-model
 * -aware template branching is a documented future extension (docs/technical-design.md), not
 * implemented here yet.
 */
export function selectTemplate(contentType: string): Template | undefined {
  return getTemplateForContentType(contentType);
}
