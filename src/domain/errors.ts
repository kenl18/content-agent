export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNKNOWN_CONTENT_TYPE",
  "PROVIDER_ERROR",
  "PROVIDER_OUTPUT_ERROR",
  "RESPONSE_VALIDATION_ERROR",
  "INTERNAL_ERROR"
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

export interface ContentServiceError {
  requestId: string | null;
  error: {
    code: ErrorCode;
    message: string;
    details?: unknown;
  };
}

export function createError(
  code: ErrorCode,
  message: string,
  options: { requestId?: string | null; details?: unknown } = {}
): ContentServiceError {
  return {
    requestId: options.requestId ?? null,
    error: {
      code,
      message,
      ...(options.details !== undefined ? { details: options.details } : {})
    }
  };
}

export function isContentServiceError(value: unknown): value is ContentServiceError {
  return (
    typeof value === "object" &&
    value !== null &&
    "error" in value &&
    typeof (value as { error?: unknown }).error === "object"
  );
}
