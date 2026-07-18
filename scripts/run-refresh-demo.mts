import { readFileSync, writeFileSync } from "node:fs";
import { createContentClient } from "../src/index.js";
import { createAnthropicProvider } from "../src/providers/anthropic-provider.js";

const envText = readFileSync("c:/Internet Marketing Business/content-service/.env", "utf8");
const apiKey = envText.match(/ANTHROPIC_API_KEY=(.+)/)?.[1]?.trim();
if (!apiKey || apiKey === "paste-your-key-here") {
  console.error("No ANTHROPIC_API_KEY in content-service/.env");
  process.exit(1);
}

const provider = createAnthropicProvider({ apiKey, maxTokens: 8000 });
const client = createContentClient({ provider });

// The real historical winner, exported by EmailOps from GetResponse (GR3 Readings).
const reference = {
  label: "GR3 'A Psychic Message Arrived' — 2026-06-20 winner (169 opens, 76 clicks, ~45% CTOR)",
  fields: {
    subjectLine: "A Psychic Message Arrived And It Has Your Name On It [[firstname]] \u{1F4E9}",
    body:
      "Sabrina Tuned Into Your Energy This Morning And What Came Through Was Waiting Specifically For You.\n\n" +
      "Hi [[firstname]],\n\n" +
      "The morning carried a particular kind of stillness. Not empty. Not quiet in the ordinary way. The kind that arrives just before something that has been gathering in the psychic field finally finds the soul it was meant for.\n\n" +
      "Sabrina received a message for you today. Not a general reading. Something drawn from the specific energy you are carrying right now. The questions living beneath the surface of your days. The answers that have been forming in the field around you.\n\n" +
      "She tuned in this morning. And what came through was unmistakably yours.\n\n" +
      "✨ See what Sabrina received for you this morning ✨\n\n" +
      "Some messages are held in the psychic field until the soul they belong to is ready to receive them. Yours was ready this morning.\n\n" +
      "\u{1F4AB} What Sabrina saw for you is waiting right here \u{1F4AB}\n\n" +
      "In the soft and particular quality of a morning when something held in the psychic field finally finds the soul it was always meant to reach,\n\nEckhart Rose"
  },
  performanceSummary: {
    opens: 169,
    clicks: 76,
    clickToOpenRate: "45%",
    note: "aggregate campaign metrics from GetResponse; strongest recent performer for this funnel"
  }
};

const shared = {
  consumer: "emailops",
  contentType: "promotional-email",
  businessModel: {
    primaryRevenueStream: "advertising_revenue",
    secondaryRevenueStreams: ["email_list_monetization"],
    note: "Email drives clicks to a blog reading page monetized with AdSense"
  },
  primaryObjective: {
    type: "increase_email_click_through_rate",
    note: "The email's one job is the click through to the reading page"
  },
  secondaryObjectives: [{ type: "increase_adsense_rpm", note: "Downstream: engaged readers on the AdSense-monetized page" }],
  targetAudience: "US, 35-65, female-skewing subscribers who believe in astrology/tarot/numerology and opted in for free readings",
  desiredAction: "Click through to read their full message reading",
  context: {
    brandName: "Astrology Manifest",
    psychicPersona: "Sabrina — the psychic who receives the reader's message",
    signOff: "Eckhart Rose",
    offerPromise: "A personal message received specifically for the reader is waiting to be read",
    personalizationToken: "[[firstname]] — ESP merge tag for the reader's first name; may be used where a first name naturally appears",
    audienceNote: "This exact list received the reference email ~4 weeks ago; the refresh must read as a fresh email, never a repeat send"
  },
  tone: "Atmospheric and sensory, second person, short paragraph rhythm, intimate but never hypey",
  constraints: {
    prohibitedClaims: [
      "guaranteed outcomes or predictions coming true",
      "medical, legal, or financial advice",
      "claims about specific named events in the reader's life"
    ]
  }
};

const refreshRequest = {
  ...shared,
  requestId: `refresh-${Date.now()}`,
  sections: [
    { key: "subjectLine", description: "Fresh subject line — must NOT reuse the reference's phrasing; same curiosity mechanism, new expression. May use [[firstname]] and one emoji.", required: true },
    { key: "previewText", description: "Inbox preheader complementing (not repeating) the subject", required: true },
    { key: "body", description: "Full refreshed body, short paragraphs separated by blank lines", required: true },
    { key: "bodySections", description: "The same body as role-tagged blocks separated by --- lines, each starting 'role: ' (hook, context, story, proof, objection, cta-lead, ps)", required: true },
    { key: "ctaLabel", description: "The single CTA label used at both CTA moments", required: true },
    { key: "textOnlyVersion", description: "Complete ready-to-send plain-text version of the email", required: true },
    { key: "postscript", description: "One-sentence P.S. re-angling the same CTA", required: false },
    { key: "rationale", description: "Short prose: why this refresh should outperform the original — name the specific mechanisms", required: true },
    { key: "changesFromReference", description: "Every meaningful change from the reference, one per line, each with its reason", required: true }
  ],
  production: {
    mode: "refresh",
    referenceContent: [reference],
    preserveElements: [
      "the core angle: a personal message was received specifically for this reader and is waiting",
      "the atmospheric 'morning stillness' sensory opening technique (though the specific imagery may change)",
      "Sabrina as the psychic who received the message",
      "two CTA moments mid-body plus a closing one",
      "the intimate sign-off style from Eckhart Rose"
    ],
    improveElements: [
      "subject line must be fresh — same curiosity mechanism, completely new phrasing",
      "the mid-body repetition (two nearly identical CTA framings) — make the second CTA moment escalate rather than repeat",
      "tighten the final third; the close currently drifts",
      "preview text did not exist as a distinct crafted element — craft one"
    ]
  }
};

const variantRequest = {
  ...shared,
  requestId: `variants-${Date.now()}`,
  sections: [
    { key: "subjectLineVariants", description: "Exactly 3 subject lines, one per line, each a DIFFERENT psychological angle (e.g. urgency-of-timing vs. specificity vs. question). May use [[firstname]] and at most one emoji each.", required: true },
    { key: "previewTextVariants", description: "Exactly 3 preheaders, one per line, each paired in order with the matching subject variant", required: true },
    { key: "bodyVariants", description: "Exactly 3 full email bodies separated by lines containing only ---, each matching its subject/preview pair in angle, each with the same CTA intent", required: true },
    { key: "rationale", description: "Exactly 3 blocks separated by lines containing only ---, one per variant in order: why that variant should outperform the original — name the mechanism being tested", required: true }
  ],
  production: {
    mode: "variant",
    referenceContent: [reference],
    preserveElements: [
      "the core angle: a personal message received specifically for this reader",
      "Sabrina persona and Eckhart Rose sign-off",
      "CTA intent: click through to read the message"
    ],
    requestedVariants: {
      count: 3,
      vary: ["subjectLine", "previewText", "body"],
      hold: "core angle, persona, CTA intent, atmospheric tone, prohibited-claims discipline"
    }
  }
};

const out: Record<string, unknown> = {};
for (const [name, req] of [["refresh", refreshRequest], ["variants", variantRequest]] as const) {
  console.log(`Running ${name}...`);
  const started = Date.now();
  const result = await client.generate(req);
  console.log(`${name} done in ${Date.now() - started}ms — ${"error" in (result as object) && (result as any).error ? "ERROR: " + JSON.stringify((result as any).error) : "OK"}`);
  out[name] = result;
}

const outPath = "C:/Users/admin/AppData/Local/Temp/claude/c--Internet-Marketing-Business-content-service/5cd665c6-8461-481c-bb0e-f5ecf2bc0760/scratchpad/results.json";
writeFileSync(outPath, JSON.stringify(out, null, 2), "utf8");
console.log("Saved to", outPath);
