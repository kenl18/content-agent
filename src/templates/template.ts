/**
 * A server-owned definition of how a given contentType should be structurally/rhetorically
 * framed, and which schemaId its output must satisfy. See ADR-0008.
 *
 * Per ADR-0014, every template is two layers: the Strategy Layer below (durable, deliberately
 * curated business knowledge — authored in docs/templates/*.md and kept in sync here) and the
 * Output Layer (the schemaId's field shape plus the generated content itself, which changes
 * freely). Only `modelGuidance` is consumed by Instruction Generation at runtime; the other
 * Strategy Layer fields exist to justify and inform it, and to make template quality reviewable.
 */
export interface TemplateStrategy {
  /** Why this content exists at all. */
  businessPurpose: string;
  /** What the audience should think/feel, and which psychological mechanism is in play. */
  audiencePsychology: string;
  /** The causal chain from this content choice to the outcome it's meant to produce. */
  conversionReasoning: string;
  /** Which reusable principle(s) this design traces back to, and from which analysis. */
  referencePrinciples: string[];
  /** Where this content sits in the overall page/journey sequencing, and why. */
  informationHierarchy: string;
  /** Likely audience hesitations at this point, which the content should address. */
  objections: string[];
  /** What the audience should do next as a direct result of this content. */
  desiredProgression: string;
  /** Explicit linkage to the funnel stage(s) this content serves. */
  monetizationContribution: string;
  /** Operational writing instructions — consumed by Instruction Generation on every request. */
  modelGuidance: string;
  /**
   * Optional per-mode overlays appended after modelGuidance when the request carries a
   * production block (ADR-0016). "create" mode uses the base modelGuidance unmodified.
   */
  modeGuidance?: {
    refresh?: string;
    variant?: string;
  };
}

export interface Template {
  id: string;
  contentType: string;
  schemaId: string;
  strategy: TemplateStrategy;
}
