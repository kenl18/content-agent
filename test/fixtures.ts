export function validPromoEmailRequest(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "req-email-1",
    consumer: "emailops",
    contentType: "promotional-email",
    businessModel: {
      primaryRevenueStream: "affiliate_marketing",
      secondaryRevenueStreams: ["email_list_monetization"]
    },
    primaryObjective: {
      type: "improve_affiliate_click_through_rate",
      note: "Single-CTA promotional email to the existing list"
    },
    targetAudience: "Subscribers who opted in for free astrology readings",
    desiredAction: "Click the CTA through to the affiliate offer page",
    sections: [
      { key: "subjectLine", description: "Curiosity-driven subject line, honest to the body", required: true },
      { key: "previewText", description: "Inbox preview text complementing the subject", required: true },
      { key: "body", description: "Short email body, paragraphs separated by \\n\\n, one idea, one CTA", required: true },
      { key: "ctaLabel", description: "Specific action phrasing for the offer link", required: true },
      { key: "postscript", description: "One-sentence P.S. re-angling the same CTA", required: false }
    ],
    context: {
      brandName: "Astrology Manifest",
      offerName: "Personalized soulmate reading",
      offerPromise: "A full personalized reading of the connection behind the signs the reader has noticed",
      subscriberRelationship: "Subscribed via the free tools site for a free reading"
    },
    tone: "warm, personal, curious; never hypey",
    ...overrides
  };
}

export function validRawRequest(overrides: Record<string, unknown> = {}) {
  return {
    requestId: "req-123",
    consumer: "website-builder",
    contentType: "landing-page-hero",
    businessModel: {
      primaryRevenueStream: "advertising_revenue",
      secondaryRevenueStreams: ["affiliate_marketing"],
      note: "AdSense plus ClickBank affiliate offers"
    },
    primaryObjective: {
      type: "increase_email_capture",
      note: "Free 3-card tarot reading opt-in"
    },
    secondaryObjectives: [{ type: "build_trust" }],
    targetAudience: "Women 25-45 interested in tarot and self-reflection",
    desiredAction: "Click through to the email signup form",
    sections: [
      { key: "headline", description: "A short, benefit-driven headline", required: true },
      { key: "subheadline", description: "One supporting sentence", required: true }
    ],
    context: { brandName: "Astrology Manifest" },
    tone: "warm, encouraging",
    ...overrides
  };
}
