import type { z } from "zod";
import { createError, type ContentServiceError } from "../domain/errors.js";

export type ValidateResponseResult<T> =
  | { success: true; data: T }
  | { success: false; error: ContentServiceError };

/**
 * `schema` is typed as `z.ZodTypeAny` (rather than `z.ZodType<T>`) because it's built dynamically
 * per-request (see domain/schema-registry.ts, buildContentSchema) from a `Record<string,
 * ZodTypeAny>` shape whose literal keys aren't known at the type level. Callers instantiate `T`
 * explicitly at the call site.
 */
export function validateParsedContent<T>(
  parsedContent: unknown,
  schema: z.ZodTypeAny,
  requestId: string
): ValidateResponseResult<T> {
  const result = schema.safeParse(parsedContent);
  if (!result.success) {
    return {
      success: false,
      error: createError(
        "RESPONSE_VALIDATION_ERROR",
        "The model's output did not satisfy the resolved output schema.",
        { requestId, details: result.error.issues }
      )
    };
  }
  return { success: true, data: result.data as T };
}
