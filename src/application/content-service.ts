import { validateRequest } from "../validation/validate-request.js";
import { validateParsedContent } from "../validation/validate-response.js";
import { selectTemplate } from "../templates/select-template.js";
import {
  buildContentSchema,
  getRegisteredSchema,
  validateSectionsAgainstSchema
} from "../domain/schema-registry.js";
import { buildInstructions } from "../generation/build-instructions.js";
import { buildInstructionsV4, V4_INTERNAL_KEYS } from "../generation/build-instructions-v4.js";
import { ProviderError, type ModelProvider } from "../providers/model-provider.js";
import { createError, type ContentServiceError, type ErrorCode } from "../domain/errors.js";
import type { ContentResponse } from "../domain/content-response.js";
import type { ContentRequest } from "../domain/content-request.js";
import type { Template } from "../templates/template.js";
import type { CopyPlan, LedgerEntry, WordBand } from "../domain/copy-plan.js";
import { CopyLedger, DEFAULT_LEDGER_DIR, hookFamilyOf } from "../diversity/ledger.js";
import { loadDestinationPack, DEFAULT_PACK_DIR } from "../diversity/destination-content.js";
import { destinationSlugFromUrl, parseStrategy, resolveAccount } from "../diversity/strategy-parser.js";
import { resolvePersona } from "../templates/persona-registry.js";
import { planCopy } from "../diversity/planner.js";
import { rankSubjects, type SubjectCandidate } from "../diversity/subjects.js";
import { renderRevision, reviewDraft, type QaReview } from "../diversity/qa.js";
import { mulberry32, hashSeed } from "../diversity/planner.js";

export interface ContentServiceDeps {
  provider: ModelProvider;
  /**
   * ADR-0018: the concept diversity ledger. Omit for the default file ledger
   * (CONTENT_AGENT_LEDGER_DIR or ./data/copy-ledger); pass null to run without one.
   */
  ledger?: CopyLedger | null;
  /** Directory of destination content packs (default ./data/destination-content). */
  packDir?: string;
  /** Wall-clock budget for the whole generation loop, from receipt of the request. */
  deadlineMs?: number;
  /** Corrective (feedback) retries before a fresh angle/architecture is assigned. */
  maxCorrectiveRetries?: number;
  /** Hard cap on model generations per request (default 6: 1 + 2 corrective, re-plan, + 2 corrective). */
  maxGenerations?: number;
  now?: () => Date;
}

// The whole loop must finish inside the caller's own child timeout (EmailOps: 180 s per call)
// with room for process start-up, the auth preflight and the response write.
const DEFAULT_DEADLINE_MS = 150_000;
const MIN_MS_FOR_ANOTHER_GENERATION = 45_000;
const DEADLINE_MARGIN_MS = 5_000;
const DEFAULT_MAX_GENERATIONS = 6;
/**
 * Effort for V4 generations (ADR-0018 §13). Measured alone on the same real brief, 2026-09-05:
 * effort high 113–153 s per generation, medium ~53 s with a full-length body, low ~10 s but a
 * body under the band. Medium keeps a corrective retry inside the caller's 180 s call; the
 * in-loop review carries the quality burden. Override with CONTENT_AGENT_V4_EFFORT.
 */
export const V4_GENERATION_EFFORT: "low" | "medium" | "high" | "xhigh" | "max" =
  (process.env.CONTENT_AGENT_V4_EFFORT as "low" | "medium" | "high" | "xhigh" | "max" | undefined) ?? "medium";
const CANONICAL_SECTIONS = ["subjectLine", "previewText", "body", "ctaLabel"];

/**
 * Orchestrates the six-step pipeline (docs/technical-design.md): receive & validate request,
 * Template Selection, Instruction Generation, AI Provider call, Response Validation, structured
 * response. Templates with the diversity layer enabled (ADR-0018) plan the email, review each
 * draft, and retry with corrective feedback inside the provider step. Never throws across this
 * boundary — every failure mode maps to a ContentServiceError.
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

    const sectionKeys = new Set(request.sections.map((s) => s.key));
    const diversityEligible =
      template.strategy.diversity?.enabled === true &&
      !request.production &&
      CANONICAL_SECTIONS.every((k) => sectionKeys.has(k));
    if (diversityEligible) return generateWithDiversity(request, template, deps, startedAt);

    const instructions = buildInstructions(request, template);

    let rawOutput;
    try {
      rawOutput = await deps.provider.generate(instructions);
    } catch (cause) {
      return providerFailure(cause, request.requestId);
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

function providerFailure(cause: unknown, requestId: string): ContentServiceError {
  // ADR-0017: a classified provider failure keeps its class on the wire so the caller can
  // tell "retry now" (PROVIDER_ERROR) from "retry later, never on a paid path"
  // (CLAUDE_SUBSCRIPTION_LIMIT) from "an operator must act" (CLAUDE_AUTH_UNAVAILABLE).
  const code: ErrorCode =
    cause instanceof ProviderError && cause.classification !== "PROVIDER_FAULT"
      ? cause.classification
      : "PROVIDER_ERROR";
  const message = cause instanceof ProviderError ? cause.message : "The model provider call failed.";
  return createError(code, message, {
    requestId,
    details:
      cause instanceof ProviderError
        ? { classification: cause.classification, ...(cause.details ?? {}) }
        : cause instanceof Error
          ? cause.message
          : cause
  });
}

// ---------------------------------------------------------------------------------------------
// Copy System V4 (ADR-0018)
// ---------------------------------------------------------------------------------------------
interface Attempt {
  plan: CopyPlan;
  review: QaReview;
  generation: number;
  candidateCount: number;
}

async function generateWithDiversity(
  request: ContentRequest,
  template: Template,
  deps: ContentServiceDeps,
  startedAt: number
): Promise<ContentResponse | ContentServiceError> {
  const now = deps.now ?? (() => new Date());
  const ctx = request.context as Record<string, unknown>;
  const parsed = parseStrategy(typeof ctx.strategy === "string" ? ctx.strategy : "");
  const { account, sendKey, attempt } = resolveAccount(request, parsed);
  const persona = resolvePersona({ account, brand: parsed.brand, fromNames: parsed.fromNames, voice: parsed.voice });
  const destination = destinationSlugFromUrl(ctx.destinationUrl);
  const pack = loadDestinationPack(destination, deps.packDir ?? DEFAULT_PACK_DIR);
  const ledger = deps.ledger === undefined ? new CopyLedger({ dir: process.env.CONTENT_AGENT_LEDGER_DIR || DEFAULT_LEDGER_DIR, now }) : deps.ledger;
  const recent = account && ledger ? safe(() => ledger.recent(account, 14), []) : [];
  const priorAttempts = account && sendKey && ledger ? safe(() => ledger.attemptsFor(account, sendKey), []) : [];
  const c = request.constraints;
  const hardBand: WordBand | null =
    c?.hardMinWords != null && c?.hardMaxWords != null ? { min: c.hardMinWords, max: c.hardMaxWords } : parsed.hardBand;
  const paragraphBand = c?.minParagraphs != null && c?.maxParagraphs != null ? { min: c.minParagraphs, max: c.maxParagraphs } : parsed.paragraphBand;

  const plannerInput = {
    requestId: request.requestId,
    account,
    sendKey,
    attempt,
    persona,
    destination,
    truth: parsed.truth,
    pack,
    cta: parsed.cta,
    hardBand,
    paragraphBand,
    recent,
    priorAttempts,
    preferredFrames: parsed.preferredFrames,
    ...(ctx.diversity && typeof ctx.diversity === "object" ? { force: ctx.diversity as { lengthFamily?: CopyPlan["lengthFamily"]; architecture?: CopyPlan["architecture"]; angle?: CopyPlan["angle"] } } : {})
  };
  let plan = planCopy(plannerInput);
  const deadline = startedAt + (deps.deadlineMs ?? DEFAULT_DEADLINE_MS);
  const maxCorrective = deps.maxCorrectiveRetries ?? 2;
  const rng = mulberry32(hashSeed(`${request.requestId}:subjects`));

  let best: Attempt | null = null;
  let revision: string | undefined;
  let corrective = 0;
  let replanned = false;
  let generation = 0;
  let lastGenMs = 0;
  let lastFailure: ContentServiceError | null = null;

  for (;;) {
    const remaining = deadline - Date.now();
    // Another generation is started only when the last one's measured duration fits in what is
    // left, and it is capped so it can never overrun the deadline.
    if (generation > 0 && remaining < Math.max(MIN_MS_FOR_ANOTHER_GENERATION, lastGenMs * 1.15)) break;
    if (generation >= (deps.maxGenerations ?? DEFAULT_MAX_GENERATIONS)) break;
    const instructions = buildInstructionsV4(request, template, { plan, parsed, pack, persona, recent, ...(revision ? { revision } : {}) });
    let rawText: string;
    const genStarted = Date.now();
    try {
      // The first generation always gets the provider's own limit; later ones are capped by
      // what remains of the deadline.
      const cap = generation > 0 && remaining > DEADLINE_MARGIN_MS ? { timeoutMs: remaining - DEADLINE_MARGIN_MS } : {};
      rawText = (await deps.provider.generate(instructions, { ...cap, effort: V4_GENERATION_EFFORT })).text;
    } catch (cause) {
      if (best) break;
      return providerFailure(cause, request.requestId);
    }
    lastGenMs = Date.now() - genStarted;
    generation++;

    let output: Record<string, unknown> | null = null;
    try {
      const j: unknown = JSON.parse(rawText);
      if (j && typeof j === "object" && !Array.isArray(j)) output = j as Record<string, unknown>;
    } catch {
      output = null;
    }
    if (!output) {
      lastFailure = createError("PROVIDER_OUTPUT_ERROR", "The model's output could not be parsed as JSON.", { requestId: request.requestId, details: { rawText } });
      if (best) break;
      if (corrective < maxCorrective) { corrective++; continue; }
      return lastFailure;
    }

    const candidates: SubjectCandidate[] = [];
    candidates.push({ subject: String(output.subjectLine ?? ""), preheader: String(output.previewText ?? ""), structure: "primary" });
    const extra = output.subjectCandidates;
    if (Array.isArray(extra)) for (const e of extra) if (e && typeof e === "object") candidates.push({ subject: String((e as { subject?: unknown }).subject ?? ""), preheader: String((e as { preheader?: unknown }).preheader ?? ""), structure: String((e as { structure?: unknown }).structure ?? "") });
    for (const k of V4_INTERNAL_KEYS) delete output[k];

    const ranking = rankSubjects(candidates, {
      plan,
      truth: parsed.truth,
      cta: parsed.cta,
      persona,
      recentSubjects: [...recent.map((e) => e.subject), ...parsed.avoidSubjects],
      recentStructures: recent.slice(0, 10).map((e) => e.subjectStructure),
      rng
    });
    const chosen = ranking.chosen ?? { subject: candidates[0]!.subject, preheader: candidates[0]!.preheader };

    const review = reviewDraft(
      { subject: chosen.subject, preheader: chosen.preheader, body: String(output.body ?? ""), cta: String(output.ctaLabel ?? ""), ...(typeof output.postscript === "string" ? { postscript: output.postscript } : {}) },
      { plan, truth: parsed.truth, cta: parsed.cta, persona, siblingBrands: parsed.siblingBrands, hardBand, paragraphBand, recent }
    );
    const attemptResult: Attempt = { plan, review, generation, candidateCount: candidates.length };
    if (!best || review.score < best.review.score) best = attemptResult;
    if (review.ok) break;

    if (corrective < maxCorrective) {
      corrective++;
      revision = renderRevision(review, plan, corrective);
      continue;
    }
    if (!replanned) {
      // Owner rule (ADR-0018 §7): after two failed corrective retries, a genuinely different
      // angle and architecture — never another paraphrase.
      replanned = true;
      corrective = 0;
      revision = undefined;
      plan = planCopy({ ...plannerInput, exclude: { angles: [plan.angle], architectures: [plan.architecture] } });
      continue;
    }
    break;
  }

  if (!best) return lastFailure ?? createError("PROVIDER_OUTPUT_ERROR", "No draft was produced.", { requestId: request.requestId });

  const d = best.review.draft;
  const content: Record<string, string> = { subjectLine: d.subject, previewText: d.preheader, body: best.review.paragraphs.join("\n\n"), ctaLabel: d.cta };
  if (request.sections.some((s) => s.key === "postscript") && d.postscript) content.postscript = d.postscript;
  const responseValidation = validateParsedContent<Record<string, string>>(content, buildContentSchema(request.sections), request.requestId);
  if (!responseValidation.success) return responseValidation.error;

  const finalPlan = best.plan;
  const entry: LedgerEntry = {
    at: now().toISOString(),
    consumer: request.consumer ?? null,
    requestId: request.requestId,
    sendKey,
    attempt,
    account: account ?? "unknown",
    persona: persona?.name ?? null,
    destination,
    lengthFamily: finalPlan.lengthFamily,
    architecture: finalPlan.architecture,
    angle: finalPlan.angle,
    hookFamily: hookFamilyOf(d.subject),
    emotionalEngine: finalPlan.emotionalEngine,
    promiseType: finalPlan.promiseType,
    ctaFamily: finalPlan.ctaFamily,
    subjectStructure: finalPlan.subjectStructure,
    subject: d.subject,
    words: best.review.words,
    paragraphs: best.review.paragraphs.length,
    ticScore: best.review.tics.score,
    qaOk: best.review.ok,
    qaFindings: best.review.findings.map((f) => `${f.severity}:${f.code}`),
    generations: generation,
    source: "generated"
  };
  if (ledger && account) safe(() => ledger.append(entry), undefined);

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
      copyPlan: {
        version: "v4",
        account,
        persona: persona?.name ?? null,
        personaStatus: finalPlan.personaStatus,
        destination,
        lengthFamily: finalPlan.lengthFamily,
        band: finalPlan.band,
        architecture: finalPlan.architecture,
        angle: finalPlan.angle,
        hookFamily: entry.hookFamily,
        emotionalEngine: finalPlan.emotionalEngine,
        promiseType: finalPlan.promiseType,
        ctaFamily: finalPlan.ctaFamily,
        subjectStructure: finalPlan.subjectStructure,
        words: best.review.words,
        paragraphs: best.review.paragraphs.length,
        generations: generation,
        replanned,
        subjectChosenFrom: best.candidateCount,
        qa: { ok: best.review.ok, findings: best.review.findings.map((f) => `${f.severity}:${f.code}`), ticScore: best.review.tics.score },
        eligibility: finalPlan.eligibility
      }
    }
  };
  return response;
}

function safe<T>(fn: () => T, fallback: T): T {
  try {
    return fn();
  } catch {
    return fallback;
  }
}
