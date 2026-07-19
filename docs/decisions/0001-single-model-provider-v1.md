# ADR-0001: Single AI Model Provider, Isolated Behind a Provider Interface

## Status

Accepted. The concrete V1 provider is **Anthropic (Claude)**, via `@anthropic-ai/sdk`, implemented
in `src/providers/anthropic-provider.ts`.

## Context

The Content Agent must call an AI model to generate content. Supporting multiple providers
from day one (routing, fallback, cost comparison) adds meaningful complexity — provider-specific
prompt formatting, response shapes, error semantics, and configuration — with no current
consumer requirement driving it.

## Decision

Version 1 wires up exactly **one** concrete AI model provider, accessed through a `ModelProvider`
interface owned by this service:

```ts
interface ModelProvider {
  generate(instructions: ModelInstructions): Promise<RawModelOutput>;
}
```

All domain, validation, generation, and application code depends only on this interface. The
concrete implementation (the specific SDK, auth, request/response mapping) lives entirely inside
`src/providers/` and is the only place that knows which vendor is in use.

## Consequences

- Adding a second provider later, or swapping the V1 provider for another, means adding/replacing
  one file in `src/providers/` — no changes to domain, validation, prompt, or service code.
- Provider-specific failure modes (rate limits, auth errors, malformed responses) are normalized
  at the provider boundary into the service's own error codes (`PROVIDER_ERROR`,
  `PROVIDER_OUTPUT_ERROR`) before they reach the rest of the pipeline.
- No provider routing, fallback, or multi-provider cost/quality comparison exists in V1 — that is
  explicitly deferred (see [future-vision.md](../future-vision.md)).

