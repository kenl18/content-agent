import { describe, expect, it } from "vitest";
import { selectTemplate } from "../../src/templates/select-template.js";

describe("selectTemplate", () => {
  it("resolves a registered contentType to its template", () => {
    const template = selectTemplate("landing-page-hero");
    expect(template).toBeDefined();
    expect(template?.schemaId).toBe("hero-headline-subheadline-v1");
  });

  it("resolves promotional-email to its production template", () => {
    const template = selectTemplate("promotional-email");
    expect(template).toBeDefined();
    expect(template?.id).toBe("promotional-email-generic-v2");
    expect(template?.schemaId).toBe("promotional-email-v2");
  });

  it("promotional-email carries refresh and variant mode guidance (ADR-0016)", () => {
    const template = selectTemplate("promotional-email")!;
    expect(template.strategy.modeGuidance?.refresh).toBeTruthy();
    expect(template.strategy.modeGuidance?.variant).toBeTruthy();
  });

  it("every registered template has a complete Strategy Layer (ADR-0014)", () => {
    for (const contentType of ["landing-page-hero", "promotional-email"]) {
      const template = selectTemplate(contentType)!;
      const strategy = template.strategy;
      expect(strategy.businessPurpose.length).toBeGreaterThan(0);
      expect(strategy.audiencePsychology.length).toBeGreaterThan(0);
      expect(strategy.conversionReasoning.length).toBeGreaterThan(0);
      expect(strategy.referencePrinciples.length).toBeGreaterThan(0);
      expect(strategy.informationHierarchy.length).toBeGreaterThan(0);
      expect(strategy.objections.length).toBeGreaterThan(0);
      expect(strategy.desiredProgression.length).toBeGreaterThan(0);
      expect(strategy.monetizationContribution.length).toBeGreaterThan(0);
      expect(strategy.modelGuidance.length).toBeGreaterThan(0);
    }
  });

  it("returns undefined for an unregistered contentType", () => {
    expect(selectTemplate("unknown-content-type")).toBeUndefined();
  });
});
