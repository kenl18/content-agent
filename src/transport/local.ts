import { generateContent } from "../application/content-service.js";
import { createAnthropicProvider } from "../providers/anthropic-provider.js";
import type { ModelProvider } from "../providers/model-provider.js";
import type { ContentResponse } from "../domain/content-response.js";
import type { ContentServiceError } from "../domain/errors.js";

/**
 * The documented local-invocation surface for consumers (EmailOps today; Funnel Builder and
 * others later — the client is consumer-agnostic). A future HTTP transport wraps the same
 * generateContent() without touching this or the core (ADR-0004, ADR-0016).
 *
 * Callers own their credentials: pass either a ready ModelProvider or an apiKey the caller
 * loaded itself (e.g. from its own .env). This module never reads the environment.
 */
export interface ContentClientOptions {
  provider?: ModelProvider;
  apiKey?: string;
  model?: string;
}

export interface ContentClient {
  generate(rawRequest: unknown): Promise<ContentResponse | ContentServiceError>;
}

export function createContentClient(options: ContentClientOptions): ContentClient {
  const provider =
    options.provider ??
    (options.apiKey
      ? createAnthropicProvider({ apiKey: options.apiKey, model: options.model })
      : undefined);
  if (!provider) {
    throw new Error("createContentClient requires either a provider or an apiKey.");
  }
  return {
    generate: (rawRequest) => generateContent(rawRequest, { provider })
  };
}
