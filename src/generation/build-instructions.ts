import type { ContentRequest } from "../domain/content-request.js";
import type { Production } from "../domain/production.js";
import type { Template } from "../templates/template.js";
import type { JsonObjectSchema, ModelInstructions } from "../providers/model-provider.js";

function renderProduction(production: Production): string {
  const lines: string[] = [`Production mode: ${production.mode}`];

  production.referenceContent.forEach((reference, index) => {
    lines.push("", `Reference ${index + 1}${reference.label ? ` (${reference.label})` : ""}:`);
    for (const [key, value] of Object.entries(reference.fields)) {
      lines.push(`  ${key}: ${value}`);
    }
    if (reference.performanceSummary) {
      const metrics = Object.entries(reference.performanceSummary)
        .map(([key, value]) => `${key}: ${value}`)
        .join(", ");
      lines.push(`  Aggregate performance: ${metrics}`);
    }
  });

  if (production.preserveElements.length > 0) {
    lines.push("", "Elements to preserve:", ...production.preserveElements.map((e) => `- ${e}`));
  }
  if (production.improveElements.length > 0) {
    lines.push("", "Elements to improve:", ...production.improveElements.map((e) => `- ${e}`));
  }
  if (production.requestedVariants) {
    const { count, vary, hold } = production.requestedVariants;
    lines.push(
      "",
      `Variant request: ${count} variant(s), varying only [${vary.join(", ")}]` +
        (hold ? `; hold constant: ${hold}` : "")
    );
  }

  return lines.join("\n");
}

/**
 * The exact output object the pipeline will validate (mirrors domain/schema-registry.ts
 * buildContentSchema: every section a non-empty string, required ones mandatory, no extra keys),
 * expressed as JSON Schema so a provider can enforce it at the model boundary (ADR-0017).
 */
export function buildOutputSchema(request: ContentRequest): JsonObjectSchema {
  const properties: JsonObjectSchema["properties"] = {};
  const required: string[] = [];
  for (const section of request.sections) {
    properties[section.key] = { type: "string", minLength: 1, description: section.description };
    if (section.required) required.push(section.key);
  }
  return { type: "object", properties, required, additionalProperties: false };
}

/**
 * Pure function: (validated request, resolved template) -> model instructions. Must not read
 * from anything other than its two arguments — no defaults, no invented facts. See ADR-0005 and
 * ADR-0008.
 */
export function buildInstructions(request: ContentRequest, template: Template): ModelInstructions {
  const objectiveLines = [
    `Primary business objective: ${request.primaryObjective.type}` +
      (request.primaryObjective.note ? ` — ${request.primaryObjective.note}` : ""),
    ...request.secondaryObjectives.map(
      (objective) =>
        `Secondary business objective: ${objective.type}` + (objective.note ? ` — ${objective.note}` : "")
    )
  ].join("\n");

  const businessModelLines = [
    `Primary revenue stream: ${request.businessModel.primaryRevenueStream}`,
    ...request.businessModel.secondaryRevenueStreams.map(
      (stream) => `Secondary revenue stream: ${stream}`
    ),
    request.businessModel.note ? `Business model notes: ${request.businessModel.note}` : null
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  const sectionLines = request.sections
    .map(
      (section) =>
        `- "${section.key}" (${section.required ? "required" : "optional"}): ${section.description}`
    )
    .join("\n");

  const contextLines =
    Object.keys(request.context).length > 0 ? JSON.stringify(request.context, null, 2) : "(none supplied)";

  const constraintLines = request.constraints
    ? JSON.stringify(request.constraints, null, 2)
    : "(none supplied)";

  const mode = request.production?.mode;
  const modeOverlay =
    mode && mode !== "create" ? template.strategy.modeGuidance?.[mode] : undefined;

  const system = [
    "You are writing content for a Business Content Optimization Service.",
    "Every section you write must serve the business objective(s) below, interpreted within the",
    "supplied business model. Do not invent business facts not present in the supplied context.",
    "",
    // Only the Strategy Layer's modelGuidance (plus the matching per-mode overlay) reaches the
    // model at runtime (ADR-0014/0016); the other strategy fields justify and inform it but
    // are not prompt material.
    template.strategy.modelGuidance,
    ...(modeOverlay ? ["", modeOverlay] : []),
    "",
    "Respond with ONLY a single JSON object whose top-level keys are exactly the requested",
    "section keys below, each mapping to a string value. Do not include any text, explanation,",
    "or markdown formatting outside that JSON object."
  ].join("\n");

  const user = [
    `Content type: ${request.contentType}`,
    "",
    businessModelLines,
    "",
    objectiveLines,
    ...(request.production ? ["", renderProduction(request.production)] : []),
    "",
    `Target audience: ${request.targetAudience}`,
    `Desired reader action: ${request.desiredAction}`,
    request.tone ? `Tone: ${request.tone}` : null,
    "",
    "Required/optional sections:",
    sectionLines,
    "",
    "Business context:",
    contextLines,
    "",
    "Constraints:",
    constraintLines
  ]
    .filter((line): line is string => line !== null)
    .join("\n");

  return { system, user, outputSchema: buildOutputSchema(request) };
}
