import { validateRequest } from "../validation/validate-request.js";
import { validateParsedContent } from "../validation/validate-response.js";
import { selectTemplate } from "../templates/select-template.js";
import {
  buildContentSchema,
  getRegisteredSchema,
  validateSectionsAgainstSchema
} from "../domain/schema-registry.js";
import { buildInstructions } from "../generation/build-instructions.js";
import { ProviderError, type ModelProvider } from "../providers/model-provider.js";
import { createError, type ContentServiceError } from "../domain/errors.js";
import type { ContentResponse } from "../domain/content-response.js";

export interface ContentServiceDeps {
  provider: ModelProvider;
}

/**
 * Orchestrates the six-step pipeline (docs/technical-design.md): receive & validate request,
 * Template Selection, Instruction Generation, AI Provider call, Response Validation, structured
 * response. Never throws across this boundary — every failure mode maps to a
 * ContentServiceError.
 */
export async function generateContent(
  rawRequest: unknown,
  deps: ContentServiceDeps
): Promise<ContentResponse | ContentServiceError> {
  const startedAt = Date.now();

  try {
    const requestValidation = validateRequest(rawRequest);
    if (!requestValidation.success) return requestValidation.error;
    const request = requestValidation.data;

    const template = selectTemplate(request.contentType);
    if (!template) {
      return createError(
        "UNKNOWN_CONTENT_TYPE",
        `No template is registered for contentType "${request.contentType}".`,
        { requestId: request.requestId }
      );
    }

    const registeredSchema = getRegisteredSchema(template.schemaId);
    if (!registeredSchema) {
      return createError(
        "INTERNAL_ERROR",
        `Template "${template.id}" references unregistered schemaId "${template.schemaId}".`,
        { requestId: request.requestId }
      );
    }

    const sectionIssues = validateSectionsAgainstSchema(request.sections, registeredSchema);
    if (sectionIssues.length > 0) {
      return createError(
        "VALIDATION_ERROR",
        "Requested sections do not match the resolved output schema.",
        { requestId: request.requestId, details: sectionIssues }
      );
    }

    const instructions = buildInstructions(request, template);

    let rawOutput;
    try {
      rawOutput = await deps.provider.generate(instructions);
    } catch (cause) {
      const message = cause instanceof ProviderError ? cause.message : "The model provider call failed.";
      return createError("PROVIDER_ERROR", message, {
        requestId: request.requestId,
        details: cause instanceof Error ? cause.message : cause
      });
    }

    let parsedContent: unknown;
    try {
      parsedContent = JSON.parse(rawOutput.text);
    } catch {
      return createError(
        "PROVIDER_OUTPUT_ERROR",
        "The model's output could not be parsed as JSON.",
        { requestId: request.requestId, details: { rawText: rawOutput.text } }
      );
    }

    const contentSchema = buildContentSchema(request.sections);
    const responseValidation = validateParsedContent<Record<string, string>>(
      parsedContent,
      contentSchema,
      request.requestId
    );
    if (!responseValidation.success) return responseValidation.error;

    const response: ContentResponse = {
      requestId: request.requestId,
      contentType: request.contentType,
      content: responseValidation.data,
      metadata: {
        provider: deps.provider.name,
        model: deps.provider.model,
        templateId: template.id,
        schemaId: template.schemaId,
        generatedAt: new Date().toISOString(),
        durationMs: Date.now() - startedAt,
        ...(request.production ? { mode: request.production.mode } : {})
      }
    };
    return response;
  } catch (cause) {
    return createError("INTERNAL_ERROR", "An unexpected internal error occurred.", {
      details: cause instanceof Error ? cause.message : cause
    });
  }
}
