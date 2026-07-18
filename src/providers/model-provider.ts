/**
 * The provider boundary (ADR-0001). Domain, templates, validation, generation, and application
 * code depend only on this interface — never on a concrete vendor SDK.
 */
export interface ModelInstructions {
  system: string;
  user: string;
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
 * Thrown by a ModelProvider implementation on any failure calling the underlying vendor API
 * (auth, network, rate limit, provider-side error). The application layer catches this and maps
 * it to the PROVIDER_ERROR error code.
 */
export class ProviderError extends Error {
  constructor(message: string, options?: { cause?: unknown }) {
    super(message, options);
    this.name = "ProviderError";
  }
}
