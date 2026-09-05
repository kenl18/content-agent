/**
 * The provider boundary (ADR-0001). Domain, templates, validation, generation, and application
 * code depend only on this interface — never on a concrete vendor SDK or CLI.
 */
export interface ModelInstructions {
  system: string;
  user: string;
  /**
   * Optional JSON Schema (draft-07 subset: object with string properties) describing the exact
   * output object the pipeline will validate. Built by Instruction Generation from the request's
   * sections. A provider MAY use it to enforce structured output at the model boundary
   * (ADR-0017); providers that cannot simply ignore it — the pipeline's own Response
   * Validation step remains the authority either way.
   */
  outputSchema?: JsonObjectSchema;
}

export interface JsonObjectSchema {
  type: "object";
  properties: Record<string, { type: "string"; minLength?: number; description?: string }>;
  required: string[];
  additionalProperties: false;
}

export interface RawModelOutput {
  text: string;
}

export interface ModelProvider {
  readonly name: string;
  readonly model: string;
  generate(instructions: ModelInstructions): Promise<RawModelOutput>;
}

/**
 * How a provider failure should be understood by the caller (ADR-0017). The application layer
 * maps these onto the error contract:
 *   PROVIDER_FAULT             -> PROVIDER_ERROR (transient/unclassified; caller may retry now)
 *   CLAUDE_SUBSCRIPTION_LIMIT  -> CLAUDE_SUBSCRIPTION_LIMIT (subscription usage window
 *                                 exhausted; retry LATER, never fall back to a paid API)
 *   CLAUDE_AUTH_UNAVAILABLE    -> CLAUDE_AUTH_UNAVAILABLE (no subscription auth reachable;
 *                                 fail closed — an operator must re-authenticate)
 */
export type ProviderFailureClass =
  | "PROVIDER_FAULT"
  | "CLAUDE_SUBSCRIPTION_LIMIT"
  | "CLAUDE_AUTH_UNAVAILABLE";

export interface ProviderErrorOptions {
  cause?: unknown;
  classification?: ProviderFailureClass;
  /** Structured, log-safe detail (never credentials). */
  details?: Record<string, unknown>;
}

/**
 * Thrown by a ModelProvider implementation on any failure calling the underlying vendor API or
 * CLI (auth, network, rate/usage limit, provider-side error). The application layer catches this
 * and maps it to an error code via `classification` (default PROVIDER_ERROR).
 */
export class ProviderError extends Error {
  readonly classification: ProviderFailureClass;
  readonly details: Record<string, unknown> | undefined;

  constructor(message: string, options: ProviderErrorOptions = {}) {
    super(message, options.cause !== undefined ? { cause: options.cause } : undefined);
    this.name = "ProviderError";
    this.classification = options.classification ?? "PROVIDER_FAULT";
    this.details = options.details;
  }
}
