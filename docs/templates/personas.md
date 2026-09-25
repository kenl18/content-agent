# Persona Voice Contracts (Strategy Layer, ADR-0018)

Authored here, mirrored in `src/templates/persona-registry.ts` — edit both together. A contract
is the voice a reader would recognise with the signature removed. Each is built from the
account's own evidence: its historic winners (winner-library dataset, 4,369 sends), the
caller's brand-identity registry (`config/brand-identity.yaml`), its style guides and
`accounts.yaml` tone lines, the winner-library account voice lines, and — where one exists —
the AstrologyManifest IP's own proposed persona dossier
(`ips/astrologymanifest/00-control/personas/proposed/*.md`), cross-referenced for continuity,
never overridden. Where evidence is thin the contract says so and is marked **owner review**
rather than invented as a caricature.

Personas the caller marks OWNER_DECISION_REQUIRED keep their brand's house contract with the
first person switched off. The service never resolves those decisions.

## Update, 2026-09-06 — "persona voice quality"

The owner's 2026-09-05 ONE-ACCOUNT-ONE-PERSONA cutover moved **ten more accounts** from a
brand-signed house voice to a named human persona in `persona-registry.ts` the same day this
table was last written, and this doc never picked it up — it still listed only five
persona-signed contracts. It now lists all fifteen. Each RESOLVED persona-signed contract also
gained **eleven deeper fields** (worldview, reader relationship, opening tendency, storytelling
behaviour, curiosity/open-loop mechanism, commercial intensity, sign-off behaviour, mystical
intensity, certainty vs. suggestiveness, 3 representative examples, 2 anti-examples) so that the
contracts control more than sender name and generic tone — the goal is that a smart subscriber
on several of our lists, with every signature removed, still could not conclude two personas
were the same person. `examples`/`antiExamples` are human/QA material only; `renderVoiceContract()`
does not quote them into the model prompt (see its doc comment) — quoting a full passage risks
the model parroting it across every send, which would work against diversity rather than for it.

**This pass also found and fixed four genuine collisions** — see "Distinctiveness audit" below.
Nothing here changes an account's identity, sign-off or provider config; it changes only how
each already-decided persona is instructed to write.

## The fifteen personas

(A sixteenth in-scope account, `resend_divinepathway`, remains brand-signed — held on
deliverability, SPAM 4 of 5 seeded sends, not on identity — so it has no human persona to list
here. See `test/oneAccountOneVoice.test.js` in the caller repo.)

| Persona | Account | Brand | Rhythm | Temperature | 1st person | Subject case | Signature tells |
|---|---|---|---|---|---|---|---|
| **Raven Thorne** | kit_mystic | Spiritual Oasis | intimate, unhurried, 9–15w | quietly certain, close | yes | sentence case | a phone screen-down, an hour before dawn; the open loop is temporal, never an object |
| **Sabine Hart** | gr1_em | Tarot Whisper | even, unhurried, 11–17w | calm, reassuring | sparing | Title Case + emoji | a regular at the table; the open loop is an object (a key, a door) |
| **Amara Rowan** | gr2_divine | Divine Readings | warm, steady, 11–17w | kind, grounded, professional-warm | sparing | sentence case | a name the reading "settles on"; never confides her own evening |
| **Elara Quinn** | kit_divine | Divine Pathway | composed, deliberate, 11–17w | steady, analytical | sparing | sentence case | doors, thresholds, inherited patterns; high certainty |
| **Clara Voss** | ml_mystic | The Oracle Within | measured, clear, 11–17w | composed, observational | sparing | Title Case + emoji | a recurrence, a count; interprets nothing, only notices |
| **Mira Arden** | ml_divine | Divine Pathway | steady, grounded, 11–17w | warm, domestic | sparing | Title Case + emoji | a room, a weight accumulated; suggestive, not diagnostic |
| **Celia Rose** | ml_venuswindow | The Venus Window | light, even, 11–16w | gently optimistic | sparing | Title Case + emoji | a season, a stretch of days — timing as calendar |
| **Donna Rowanfield** | resend_divinereadings | Divine Readings | conversational, close, 10–16w | familiar, confiding | yes | sentence case | an unfinished message; continues a thought, never settles one |
| **Elise Marlowe** | resend_venuswindow | The Venus Window | direct, personal, 10–16w | candid, friendly | yes | sentence case | a person arriving — timing as a who, not a when |
| **Madama Seraphina** | kit_sacred | Sacred Praying | unhurried; medium sentences then one short blessing-like line | warm, reverent elder | sparing | Title Case, one emoji | candlelight, a card face up, a thread; "something shifted/cleared" |
| **Eckhart** | gr3_readings | Divine Readings | plain, steady declaratives, 9–15w | calm, service-like | yes | sentence case | kitchens, phones face-down; explains a mechanism, not just notices one |
| **Seren Vale** | gr4_vw | The Venus Window | medium sentences broken by very short ones | cool-warm, attentive | sparing | sentence case | a deck that will not settle, cycles — timing as a return |
| **Wren Solace** | resend_am | AstrologyManifest | brisk plain-text correspondence, 8–14w | even, matter-of-fact | yes | sentence case | chart/placement/sky stated flatly; observes, never diagnoses |
| **Maren Hale** | resend_sacred | Sacred Praying | reflective letter, settled cadence | warm, steady friend | yes | sentence case | what she noticed this week; turns a question over, never pronounces |
| **Noelle Vesper** | sendfox_vw | The Venus Window | short and plain — every line earns its place | direct, quietly warm | sparing | sentence case | no mystical language at all; the plainest voice in the estate |
| Spiritual Oasis (house) | *(none — retired)* | Spiritual Oasis | intimate, unhurried, quietly certain | intimate, calm | no | sentence case | **RETIRED**, superseded by Raven Thorne 2026-09-06 |
| Divine Pathway (Kit house) | *(none — kit_divine now Elara Quinn)* | Divine Pathway | warm angel-and-light register | warm, bright | no | Title Case + emoji | **SUPERSEDED**, owner decision D-1 resolved 2026-09-06 |
| The Venus Window (SendFox house) | *(none — sendfox_vw now Noelle Vesper)* | The Venus Window | plain, calm | composed | no | sentence case | **SUPERSEDED**, persona cutover 2026-09-06 |

The three house voices are kept in the registry (accounts: []) as the historical fallback and
as evidence of what each account sounded like before its cutover — `resolvePersona()` cannot
reach them by account id any longer.

Brand-voiced contracts unchanged this pass (no named human, `signoffMode: "brand"`): **Tarot
Whisper** (gr1_em's pre-cutover brand, kept for `resolvePersona()`'s brand fallback),
**Divine Readings**, **The Oracle Within**, **Divine Pathway**, **The Venus Window** — each still
carries its original nine-field contract; the owner's request was specifically about human
personas, and a brand voice has no reader relationship or sign-off behaviour of its own to define.

Each RESOLVED persona-signed contract carries: sentence rhythm, typical and longest sentence
length, vocabulary, emotional temperature, directness, use of questions, imagery, humour,
first-person usage, hook tendencies, CTA style, constructions to avoid, punctuation habits, the
`evidence` list it was written from — **plus, new this pass**: worldview, reader relationship,
opening tendency, storytelling behaviour, curiosity/open-loop mechanism, commercial intensity,
sign-off behaviour, mystical intensity, certainty vs. suggestiveness, 3 representative examples
and 2 anti-examples.

## Distinctiveness audit, 2026-09-06

A structural pairwise review of all fifteen persona-signed contracts (vocabulary, imagery, hooks, CTA phrasing)
against the account-family groupings, done before the deeper fields were written, so the fixes
below are visible in the diff, not just asserted. Four genuine collisions were found and closed:

| Collision | The problem | The fix |
|---|---|---|
| **Elara Quinn ↔ Mira Arden** (both Divine Pathway) | Near-verbatim: same "a block/path, a door, what was inherited... named without melodrama" vocabulary and CTA shape, differing only in "path" vs "block". The strongest collision found. | Elara stays doors/thresholds/inheritance, high certainty, analytical. Mira re-authored around rooms/weight/accumulation, suggestive rather than declarative. Door/path imagery is now on Mira's own `avoid` list. |
| **Amara Rowan ↔ Donna Rowanfield** (both Divine Readings) | Identical CTA, "Read the name it gives you", plus overlapping "a name / someone thinking of you" hooks. | Amara stays the settled, professional-warm GetResponse voice ("the reading settled on a name"). Donna becomes the confiding Resend pen pal, continuing an unfinished thought rather than delivering a conclusion. |
| **Elise Marlowe ↔ Noelle Vesper** (both Venus Window) | Identical CTA, "See what opens next", and both drew on the same generic window/timing motif shared by the whole four-persona cluster. | The cluster was split by sub-angle: Seren Vale = returning cycle/card, Celia Rose = season/calendar, Elise Marlowe = a person arriving, Noelle Vesper = plain economy with no mystical language at all (her account's finite send pool made this the honest differentiator, not an invented trait). |
| **Wren Solace ↔ Eckhart** (plain-declarative, service-adjacent, both effectively male-coded) | Both "plain, brisk, no ornament" personas risked reading as one voice with two names once evidence/subject-line tells were stripped. | Wren is now explicitly observational — she notices a placement and stops. Eckhart is explicitly mechanistic — he explains why a pattern recurs. Noticing vs. explaining is the load-bearing difference. |

**Not run this pass, and why:** the generation-based nearest-centroid classifier
(`scripts/v4-persona-sample.mts` + the audit's bag-of-words script) that produced the 67%/31%
figure below needs a live model call per sample — 3–5 samples × 15 personas is a 45–90 minute,
real-cost run, and no request-file exists yet for several of the newly-cutover accounts. This
structural audit is the fast, zero-cost pass; the classifier is the empirical follow-up, worth
running once the enriched contracts have generated a few days of real production copy to sample
from rather than fresh synthetic requests.

**Deliberately NOT flagged as a collision:** shared tarot/card vocabulary across Sabine Hart,
Raven Thorne, Madama Seraphina and Seren Vale. The product mechanic is a card reading, so "a
card" recurring across these four is load-bearing, not lazy — ADR-0018's own classifier result
(67% vs. 31% baseline, below) was achieved on exactly this kind of shared-domain vocabulary,
distinguished by rhythm, temperature and CTA shape rather than by avoiding the word "card." Their
CTA shapes were the one real risk here — Sabine's and Raven's were near-identical ("see/read what
the card was holding/set aside for you") and have been split: Sabine's now names her as a
participant ("Turn the card she's been meaning to show you"), Raven's stays private and terminal.

## How the contract reaches the model

`renderVoiceContract()` produces a VOICE block at the top of the system prompt: positive
description first (temperature, who she is to the reader, rhythm, vocabulary, directness,
questions, humour, imagery, hooks), then — where a contract defines them — one condensed line
for opening/storytelling/curiosity-loop behaviour and one for certainty/mystical-intensity/
selling/sign-off, then CTA, first-person rule and subject case, then a one-line "this voice does
not" list. A brand/house contract with none of the new fields renders exactly the nine lines it
always has — nothing grew for the entries this pass did not touch. The estate-wide fingerprint
budget follows separately, so a persona's own avoid list is never confused with the machine-copy
tells. `examples`/`antiExamples` are never rendered into the prompt (see the field's doc comment
in `persona-registry.ts`) — they are for a human reviewing the contract, or for a future
distinctiveness script, not for the model to imitate verbatim.

## How distinctiveness is checked

The QA harness for ADR-0018 re-runs the audit's bag-of-words nearest-centroid classifier over
the generated sample. Under V3 it identified the persona in 6–12% of production emails against
a 10–25% majority baseline — indistinguishable. The V4 sample (5 personas, freely planned,
`reports/copy-v4-qa-2026-09-05/`) reached **67% against a 20% baseline** — a real, measured
improvement, on the five accounts tested before the 2026-09-06 cutover added ten more personas
and before this pass's deeper contracts existed. Distinctiveness is measured, not gated: a weak
contract is corrected here, not enforced by rejecting copy.

## Open owner decisions

- kit_mystic / kit_divine / sendfox_vw: **CLOSED since this doc was last written.** All three
  resolved persona-signed 2026-09-06 (Raven Thorne, Elara Quinn, Noelle Vesper) — see
  `config/brand-identity.yaml` and `writer-lanes.yaml` in the caller's repo. Their house-voice
  contracts are retained here for history and for `resolvePersona()`'s brand fallback, not
  because the decision is still open.
- Eckhart, Wren Solace, Maren Hale, Sabine Hart, Amara Rowan and every 2026-09-06 cutover persona
  still carry `ownerReview: true` where the AstrologyManifest IP's own proposed dossier or the
  brand registry flagged the distinction as evidence-thin rather than owner-confirmed. This pass
  deepened each contract from the SAME evidence already on file (winner-library, brand registry,
  the AM IP's proposed dossiers) — it is a stronger draft of the same proposal, not a new owner
  ruling, and `ownerReview` is left exactly as the caller's registry and the AM dossiers state it.
- Seren Vale, gr4_vw and the rest of the Venus Window group not owned by this IP's split (see the
  boundary note in `ips/astrologymanifest/00-control/personas/proposed/seren-vale.md`): nothing
  in this pass changed her voice — only where she sits relative to her three EmailOps-authored
  Venus Window siblings was recorded, for the distinctiveness audit above.
