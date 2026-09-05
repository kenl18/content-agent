export { generateContent, type ContentServiceDeps } from "./application/content-service.js";
export { createContentClient } from "./transport/local.js";
export type { ContentClient, ContentClientOptions } from "./transport/local.js";
export type { Production, ProductionMode, ReferenceContent, RequestedVariants } from "./domain/production.js";
export { PRODUCTION_MODES } from "./domain/production.js";

export { createAnthropicProvider, AnthropicProvider } from "./providers/anthropic-provider.js";
export {
  createClaudeCodeProvider,
  ClaudeCodeProvider,
  buildClaudeCodeEnv,
  classifyClaudeCodeFailure,
  resolveClaudeBinary,
  SCRUBBED_ENV_VARS,
  DEFAULT_CLAUDE_CODE_MODEL
} from "./providers/claude-code-provider.js";
export type { ClaudeCodeProviderOptions, ClaudeCodeAuthStatus } from "./providers/claude-code-provider.js";
export type { ModelProvider, ModelInstructions, RawModelOutput, JsonObjectSchema, ProviderFailureClass } from "./providers/model-provider.js";
export { ProviderError } from "./providers/model-provider.js";

export type { ContentRequest, ContentSection, ContentConstraints } from "./domain/content-request.js";
export type { ContentResponse, ContentResponseMetadata } from "./domain/content-response.js";
export type { BusinessObjective } from "./domain/business-objective.js";
export { CANONICAL_BUSINESS_OBJECTIVE_TYPES } from "./domain/business-objective.js";
export type { BusinessModel } from "./domain/business-model.js";
export { CANONICAL_REVENUE_STREAM_TYPES } from "./domain/business-model.js";
export type { ContentServiceError, ErrorCode } from "./domain/errors.js";
export { isContentServiceError } from "./domain/errors.js";

export type { Template, TemplateStrategy } from "./templates/template.js";
export { listRegisteredContentTypes } from "./templates/template-registry.js";
