import { contentRequestSchema, type ContentRequest } from "../domain/content-request.js";
import { createError, type ContentServiceError } from "../domain/errors.js";

export type ValidateRequestResult =
  | { success: true; data: ContentRequest }
  | { success: false; error: ContentServiceError };

function extractRequestId(rawRequest: unknown): string | null {
  if (
    typeof rawRequest === "object" &&
    rawRequest !== null &&
    "requestId" in rawRequest &&
    typeof (rawRequest as { requestId?: unknown }).requestId === "string"
  ) {
    return (rawRequest as { requestId: string }).requestId;
  }
  return null;
}

export function validateRequest(rawRequest: unknown): ValidateRequestResult {
  const result = contentRequestSchema.safeParse(rawRequest);
  if (!result.success) {
    return {
      success: false,
      error: createError("VALIDATION_ERROR", "The request failed schema validation.", {
        requestId: extractRequestId(rawRequest),
        details: result.error.issues
      })
    };
  }
  return { success: true, data: result.data };
}
