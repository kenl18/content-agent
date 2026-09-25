# ADR-0018: Copy System V4 — Controlled Diversity in Normal Production

## Status

**Accepted (owner GO, 2026-09-05) — implemented in this repository; EmailOps unchanged.**
Extends the approved surface after the 2026-09-05 read-only copywriting audit. Not an
experiment: there are no arms, no assignment, no registry, no split traffic. It is the way
promotional emails are generated from now on, monitored through normal production reporting.

## Context

The audit measured the estate's real copy (253 production sends, 93 August sends, 41 V3
generations). It was truthful and well-guarded, and homogeneous: em-dashes in 95% of emails,
"not X, but Y" in 66%, "not a general / not a type" in 39%, one absent-person/message-waiting
psychology in roughly 80–85% of sends, a 16-persona classifier that could not tell the
personas apart (6% against a 12% baseline), every email inside the same 80–160-word shape,
and retries that re-ran an identical prompt. The owner's direction: a smart subscriber on
several of our lists must not conclude one person wrote every email — while every V3 truth
protection stays exactly as strong.

## Decision

A **diversity layer** (`src/diversity/`) plans, briefs, reviews and records each promotional
email. It is enabled per template (`TemplateStrategy.diversity.enabled`) and today applies to
`promotional-email` requests without a `production` block.

### Layers, deliberately separated

| Layer | Owns | Where |
|---|---|---|
| **Hard guards** | destination promise contract, fabricated-event / urgency / health / surveillance bans, unsupported precision (date, timing window, person, number, card or sign choice), CTA truth, repetition, filler, brand/persona, compliance, the caller's word and paragraph bands | The caller's V3 gate remains the authority. The layer's `qa.ts` pre-checks the same rules inside the loop so a violation is corrected with an instruction instead of costing a blind external retry. Nothing was weakened. |
| **Creative brief** | persona voice contract, email shape, destination content, the one angle and engine for this send, subject structure target, CTA intent, style budget | `build-instructions-v4.ts` — brief first, rules compact, no quoted phrasings |
| **Performance learning** | concept labels per send for later joins | the ledger; no automatic weighting from small samples (see "What this does not do") |

### Length families (§2)

`short_note` 55–85 · `standard` 90–130 · `story` 130–180 · `long_form` 180–230 words (counted
over preheader + body, as EmailOps measures). Guidance bands, never targets: the brief says
"length follows the idea; stop when it is said". A family is eligible only where it overlaps
the caller's **hard** band by ≥20 words, and its effective band is that overlap. The hard band
is read from `constraints.hardMinWords/hardMaxWords` when supplied, else from the caller's
strategy text ("80-160 words total"). Under EmailOps' current V3 gate (80–160, 3–5
paragraphs) that leaves `standard` and `story`; `short_note` and `long_form` unlock the day
EmailOps widens its band (an owner decision, listed in the return).

### Architecture library (§3)

Ten shapes, each a paragraph-by-paragraph plan of what must happen, never what is said:
direct question → tension → reveal; observation → implication → reveal; short personal note;
story fragment → unresolved line → CTA; interaction/choose-a-card invitation; pattern
recognition → personal relevance; explanatory/authority note; sparse one-paragraph alert;
reflective letter; concrete observation → unanswered question. Each carries eligibility
(length families, paragraph range, required interaction or claim classes, first-person
allowance) and a base weight; the planner scores fit to the chosen angle and recency.

### Concept diversity ledger (§4, §11)

`data/copy-ledger/<account>.jsonl`, append-only, one line per email: angle, architecture,
hook family, emotional engine, promise type, CTA family, length family, subject structure,
subject, word count, QA outcome, generation count — never a body. The planner reads the
account's last 14 days and penalises recently used concepts; "someone is thinking about you"
and "a person has you on their mind" classify to the same angle. Seeded from the caller's own
recent plan files by `scripts/seed-copy-ledger.mts`. **Owner-approved exception** to the V1
"no persistence" boundary: a flat file of labels, no database, no query engine.

### Persona voice contracts (§5)

`src/templates/persona-registry.ts`, authored in `docs/templates/personas.md`. Ten contracts
built from each account's own evidence (historic winners, the caller's brand registry and
style guide, the winner-library voice line): rhythm, sentence length, vocabulary, temperature,
directness, questions, imagery, humour, first person, hooks, CTA style, avoid list, punctuation.
RESOLVED persona-signed: Madama Seraphina, Eckhart, Seren Vale, Wren Solace, Maren Hale.
RESOLVED brand-voiced: Tarot Whisper, Divine Readings, The Oracle Within, Divine Pathway, The
Venus Window. OWNER_DECISION_REQUIRED (kit_mystic, kit_divine, sendfox_vw) keep their brand's
house contract with the first person switched off, exactly as the caller's registry leaves
them brand-signed. Contracts whose evidence is thin say so and are flagged for owner review.

### The "one Claude" fingerprint (§6)

`tics.ts` measures fourteen constructions the audit found systemic, each with a per-email
allowance (an ordinary single em-dash passes) and a corrective sentence. The brief names them
once as a style budget; the review rejects only systemic use (two constructions over allowance,
or three occurrences over) and feeds the exact sentence back.

### Reviewed retries (§7)

Each draft is reviewed in-loop. A rejection returns a `REVISION` block: the finding, its exact
correction ("Keep sentence 2 as the one statement of the promise; replace sentences 3 and 4
with a concrete observation"), and the previous draft. After two failed corrective retries the
planner assigns a **different angle and architecture** — never another paraphrase. The loop is
bounded by a wall-clock deadline (default 165 s, below the caller's 180 s child timeout) and
always returns the best-reviewed draft with its findings in `metadata.copyPlan.qa`.

### Subject / preheader (§8)

One generation returns the primary subject plus 3–5 structurally different candidates
(statement, question, fragment, specific observation, restrained curiosity, ellipsis loop).
`subjects.ts` ranks them: unsupported claims and near-duplicates (at concept level, against
the ledger and the caller's avoid list) are rejected; dominant structures and openers on the
account are demoted; the planned structure is promoted; the preheader must advance the subject.

### Destination content pack (§9)

`scripts/build-destination-content.mts` fetches each final landing page once, directly (never
through a click gateway or affiliate link, no script execution) and stores what the page says:
title, headings, buttons, short snippets, mechanics (card choice, email capture, step markers).
Testimonials and boilerplate are filtered out of the brief. The pack supplies specificity; the
caller's promise contract still decides what may be claimed.

### Contract additions

- `ModelInstructions.outputSchema` may carry internal non-string properties (`subjectCandidates`);
  the application strips them before Response Validation.
- `constraints` gains optional `minWords`, `maxWords`, `hardMinWords`, `hardMaxWords`,
  `minParagraphs`, `maxParagraphs` (EmailOps' `minWords/maxWords` were previously dropped by the
  schema without notice).
- `context.diversity` may force a length family, architecture or angle; an ineligible value is
  ignored and noted.
- `metadata.copyPlan` records the plan, counts and QA outcome for every V4 response.

### QA on 2026-09-05 (reports/copy-v4-qa-2026-09-05/)

16 real sends through EmailOps' own generator and unchanged V3 gate: 16/16 pass, 0 fallbacks, 0
provider errors, EmailOps attempts mean 2.0, 140 s per send. 13 wide-band briefs: 12/13 pass, all
four length families and seven architectures exercised. Persona sample (3 × 5 personas): classifier
67% vs 31% for V3 on the same accounts. Style fingerprints fell from 39–95% of emails to 0–19%;
0 unsupported claims across 47 V4 emails on an independent scan.

## What this does not do

- It does not weaken or bypass any caller guard, and it never reads or writes the caller's files.
- It does not learn weights from performance automatically. The ledger and `metadata.copyPlan`
  exist so the caller can join concept labels to delivered / clicks / revenue / unsubscribes
  later; any weighting from that evidence is a separate, owner-approved step, never inferred
  from small samples or from click rate alone.
- It does not create arms, assignments, a registry, or extra volume.

### Model effort and latency (§13)

Measured alone on one real brief (kit_mystic → dailyangelmessage, 2026-09-05, Claude Code,
claude-sonnet-5): the V4 prompt is smaller than V3's (10.0k vs 15.5k chars) but a generation at
effort **high** took 113–153 s (V3 brief at high: 48 s), at **medium** ~53 s with a full-length
body, at **low** ~10 s with a body under the band. The extra thinking at high effort, not the
brief or the output schema, is the cost. V4 therefore generates at **medium** effort
(`CONTENT_AGENT_V4_EFFORT` overrides) so a corrective retry still fits inside the caller's 180 s
call, and relies on the in-loop review for quality. The provider interface gained per-call
`GenerateOptions` (`timeoutMs`, `effort`); the loop caps every generation after the first by
the time remaining, and a default of six generations bounds the worst case.

## Consequences

- Prompt shape changes: creative brief first (~3–4k chars), compact hard rules, the caller's
  unclassified guidance verbatim at the end; the caller's V3 standard block is restated by the
  plan, not dumped.
- More model calls per email when a draft needs correction (measured in QA); fewer external
  retries because the correction carries the reason.
- Two owner decisions unlock the rest of the length range: widening EmailOps' hard band and
  paragraph range, and the three OWNER_DECISION_REQUIRED personas.
