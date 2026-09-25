/**
 * A faithful, condensed copy of the strategy text EmailOps' composer embeds in every request
 * (captured 2026-09-05 for kit_mystic -> dailyangelmessage). Used to test the parser, planner
 * and V4 layout against the real caller shape rather than an invented one.
 */
export const EMAILOPS_STRATEGY_DAILYANGEL = `Destination dailyangelmessage. Single idea, single CTA.
WINNER LIBRARY GUIDANCE (evidence-based priors, NOT mandates — a fresh execution of winning psychology beats a mechanical copy of the top pattern):
Preferred creative frames (pick ONE, execute it freshly):
  * [PROVEN] held-back-message-names-person: A personal message/reading already EXISTS, was HELD BACK or has been WAITING, and it concerns a SPECIFIC PERSON. (evidence includes this destination)
  * [PROVEN] someone-opener: Subject OPENS with "Someone/Somebody" + an unspoken act directed at the reader. (evidence includes this destination)
Also available (lower confidence):
  * [PROMISING] contrast-lede: One-sentence lede that contrasts the generic with THIS message. (evidence includes this destination)
Recent frame history on this account (last 14d): "The ..." abstract opener x15, tarot/card object x8, someone-is-thinking-of-you x6.
AVOID these structures (measured losers across the estate):
  - Subject opens with "The ..." (abstract noun phrase). -> Recast as an event that happened to the reader (past-tense verb) or a Someone-opener.
  - Subject opens with What/Why/How/Who. -> State the answer's existence instead of asking.
  - Long explanatory subjects (>55 chars). -> Cut to one clause under ~42 chars; move the qualifier to the preview text.
Subject: under ~42 characters, sentence case unless the voice says otherwise, no question-word opener, never start with "The".
VOICE (this account only — a frame transfers between accounts, a voice never does): Raven Thorne — plain, intimate, quiet declarative sentences, sentence case, no emoji.
BRAND IDENTITY (hard constraint, not a preference). This email is from "Spiritual Oasis". Its sign-off ("— Spiritual Oasis") is appended automatically at render time — do NOT write any sign-off, valediction or sender name at the end of the body; end the body with its final full sentence. Approved sender identities: Raven Thorne, Soulmate Whisperer.
NEVER name, sign off as, or write in the voice of any other brand in this estate: Tarot Whisper, Divine Readings, The Venus Window, Sacred Praying, Divine Pathway, The Oracle Within, AstrologyManifest. Do not mention another brand's name anywhere in the subject, body or sign-off. A CTA destination may belong to a different property — that never changes who this email is FROM.
Do not echo or paraphrase any of these recent subjects: "Someone thought of calling you tonight" | "Someone in your chart hasn't arrived yet" | "Mara paused on the third card" | "This message was held until today" | "Read the second half first" | "Someone thought about you last night"
DESTINATION PROMISE CONTRACT (owner ruling 2026-09-05) — the hardest constraint on this email:
You may not promise anything the landing page does not actually deliver. A more compelling email is
welcome; a less truthful one is rejected and regenerated, never softened into a different phrasing.

WHAT dailyangelmessage ACTUALLY DELIVERS, read from the live page on 2026-09-05:
  Its own headline: "🔮 Your Guardian Angel Has a Message Just for You 🔮"
  Its own button:   "💌 UNVEIL MY HEAVENLY MESSAGE"
  Interaction it asks for: read_only

YOU MAY NOT claim — the page says nothing of the kind, so any of these is a lie to a subscriber:
  - an exact date or calendar day
  - a timing window, period, or when something shifts
  - the identity or name of a specific person
  - a specific count or number
  - choosing/picking/tapping a card
  - choosing a zodiac sign
The page's own subject matter includes: message, reason.

The CTA obeys this contract too. If the page does not show a day, the CTA must not say "See the
day it arrives".

EMAILOPS COPY STANDARD V3 (owner ruling 2026-09-05). These replace the previous body rules.

SHAPE — one email, one idea:
  HOOK  ->  ONE core observation  ->  ONE curiosity / open-loop development  ->  CTA
  3-5 paragraphs. 80-160 words total, and 90-140 is the sweet spot.
  Longer ONLY when the idea genuinely requires it. NEVER pad to reach a word count.

SIGN-OFF: do not write one. The canonical sign-off is appended at render time.

CTA RULE (EmailOps house style, owner ruling 2026-09-04) — this is the most important constraint on ctaLabel:
The ctaLabel must NAME THE SPECIFIC PAYOFF of THIS email, or ask for the small action that closes the loop this email opened.

REQUIRED SHAPE:
- 3-8 words, under 48 characters, a complete phrase, sentence case, no trailing arrow or full stop.
- Must contain one of these action verbs: reveal, choose, select, open, see, discover, meet, find, name, hear, read.
- Must share real vocabulary with this email's subject or body — it is specific to THIS send, not reusable.

ONE OF THESE INTENTS: REVEAL_PERSON (The reading identifies a specific person. e.g. shape: "Reveal who this points to") | REVEAL_MESSAGE (A specific message is waiting to be read. e.g. shape: "Open the message waiting for you") | REVEAL_REASON (The payoff explains why something happened. e.g. shape: "See what is behind it") | SEE_WHAT_IS_WAITING (Something is already prepared and unopened. e.g. shape: "See what is waiting for you") | OPEN_READING (The reading itself is the payoff and no narrower promise is honest. e.g. shape: "Open your reading")

BANNED — these are never acceptable and the copy will be rejected:
- Any generic destination label: "read your full reading", "read the full reading", "see your full reading", or similar.
- Any promise the destination does not actually deliver.
- Fabricated events, fake urgency or scarcity, health/body claims, surveillance or threat framing, unsupported certainty, invented names/dates.
- Do NOT ask the reader to choose, select, pick or tap a card: this destination is a reading page, not an interactive chooser. Claiming an interaction that does not exist is a lie to a subscriber.
`;

/** The same block for a chooser page that permits card choice and a person reveal. */
export const EMAILOPS_STRATEGY_CHOOSER = EMAILOPS_STRATEGY_DAILYANGEL
  .replace(/dailyangelmessage/g, "spoptin-stars")
  .replace('Its own headline: "🔮 Your Guardian Angel Has a Message Just for You 🔮"', 'Its own headline: "The Oracle Of The Stars"')
  .replace("Interaction it asks for: read_only", "Interaction it asks for: choose_card")
  .replace(
    "YOU MAY NOT claim — the page says nothing of the kind, so any of these is a lie to a subscriber:\n  - an exact date or calendar day\n  - a timing window, period, or when something shifts\n  - the identity or name of a specific person\n  - a specific count or number\n  - choosing/picking/tapping a card\n  - choosing a zodiac sign",
    "YOU MAY refer to (the page supports it, quoted evidence on file):\n  - choosing/picking/tapping a card\n  - the identity or name of a specific person\nYOU MAY NOT claim — the page says nothing of the kind, so any of these is a lie to a subscriber:\n  - an exact date or calendar day\n  - a timing window, period, or when something shifts\n  - a specific count or number\n  - choosing a zodiac sign"
  )
  .replace("The page's own subject matter includes: message, reason.", "The page's own subject matter includes: card, message.")
  .replace("ONE OF THESE INTENTS: REVEAL_PERSON", 'ONE OF THESE INTENTS: CHOOSE_CARD (The page asks the reader to choose a card. e.g. shape: "Choose your card and read its message") | REVEAL_PERSON')
  .replace("- Do NOT ask the reader to choose, select, pick or tap a card: this destination is a reading page, not an interactive chooser. Claiming an interaction that does not exist is a lie to a subscriber.", '- This destination genuinely offers "choose_card", so a choose/select CTA is permitted here.')
  .replace('This email is from "Spiritual Oasis"', 'This email is from "Sacred Praying"')
  .replace("Approved sender identities: Raven Thorne, Soulmate Whisperer.", "Approved sender identities: Madama Seraphina 🔮.")
  .replace("VOICE (this account only — a frame transfers between accounts, a voice never does): Raven Thorne — plain, intimate, quiet declarative sentences, sentence case, no emoji.", "VOICE (this account only — a frame transfers between accounts, a voice never does): Sacred Praying house voice (Madama Seraphina) — Title Case subjects, gentle mystical warmth, tasteful single emoji allowed.");

export function emailopsRequest(strategy: string, overrides: Record<string, unknown> = {}) {
  return {
    requestId: "emailops-daily-2026-09-08-kit_mystic-0000-1",
    consumer: "emailops",
    contentType: "promotional-email",
    businessModel: { primaryRevenueStream: "affiliate_and_display_ads" },
    primaryObjective: { type: "click_through", description: "Drive a click from an email to an owned astrology reading page." },
    targetAudience: "Existing opted-in subscribers interested in astrology, tarot and spiritual readings.",
    desiredAction: "Click through to read the full reading.",
    sections: [
      { key: "subjectLine", description: "The single subject line — specific and curiosity-driven, honest to what the body delivers.", required: true },
      { key: "previewText", description: "Inbox preview/preheader text, complementing (not repeating) the subject line.", required: true },
      { key: "body", description: "Full email body copy, short paragraphs separated by blank lines, one topic, one CTA.", required: true },
      { key: "ctaLabel", description: "The single CTA label — specific action phrasing, never \"click here\".", required: true },
      { key: "postscript", description: "Optional one-sentence P.S. re-angling the same CTA from a different angle.", required: false }
    ],
    context: { destinationUrl: "https://go.astrologymanifest.com/dailyangelmessage", strategy },
    tone: "Calm, specific, unhurried, concrete. British spelling. No hype, no emoji in the body.",
    constraints: { minWords: 55, maxWords: 145, forbiddenPhrases: ["dailyangelmessage"] },
    ...overrides
  };
}

/** A clean draft for the dailyangelmessage brief: 3 paragraphs, ~100 words, message angle, no tics. */
export const CLEAN_DAILYANGEL_OUTPUT = {
  subjectLine: "A line was kept back until this morning",
  previewText: "It concerns something you said out loud last week.",
  body:
    "Last week you said something out loud that you had only ever thought. It was in the kitchen, late, to nobody in particular, and nobody answered it at the time.\n\n" +
    "This morning's angel reading picks that sentence up. It gives the reason it went unanswered, and what the silence was holding for you while you waited for an answer that never came.\n\n" +
    "Open the message and read the reason for yourself. It is shorter than you expect, and it ends on the line you needed to hear.",
  ctaLabel: "Open the message and read the reason",
  subjectCandidates: [
    { subject: "Why last week's sentence went unanswered", preheader: "The reason arrived this morning, in a message.", structure: "question" },
    { subject: "One sentence, kept back", preheader: "Said out loud last week. Answered this morning.", structure: "fragment" },
    { subject: "The silence after you said it had a reason", preheader: "This morning's message names it.", structure: "specific_observation" }
  ]
};
