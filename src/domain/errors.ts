export const ERROR_CODES = [
  "VALIDATION_ERROR",
  "UNKNOWN_CONTENT_TYPE",
  "PROVIDER_ERROR",
  // ADR-0017: subscription-authenticated Claude Code provider failure classes. Both are
  // provider failures the caller must NOT answer by retrying immediately on a paid API path.
  "CLAUDE_SUBSCRIPTION_LIMIT",
  "CLAUDE_AUTH_UNAVAILABLE",
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
