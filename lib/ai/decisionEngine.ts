import type { ParsedIntent } from "./intentParser";
import type { IntentMatchItem } from "./intentMatching";

export type LoopRecommendation = {
  loop: "direct_booking" | "requirement_post";
  confidence: number;
  reason: string;
  prefillData: {
    category: string | null;
    title: string;
    description: string;
    urgency: string | null;
    location: string | null;
    budgetMax: number | null;
  };
  suggestedProviders?: { id: string; title: string; score: number }[];
};

const HIGH_CONFIDENCE_THRESHOLD = 0.7;
const MIN_MATCH_SCORE = 50;

export function resolveLoop(
  parsed: ParsedIntent,
  matches: IntentMatchItem[],
): LoopRecommendation {
  const highScoreMatches = matches.filter((m) => m.score >= MIN_MATCH_SCORE);
  const providerMatches = highScoreMatches.filter((m) => m.matchType === "provider");
  const serviceMatches = highScoreMatches.filter((m) => m.matchType === "service");

  const hasStrongDirectMatch =
    parsed.confidence >= HIGH_CONFIDENCE_THRESHOLD &&
    parsed.intentType === "direct_booking" &&
    (providerMatches.length > 0 || serviceMatches.length > 0);

  if (hasStrongDirectMatch) {
    return {
      loop: "direct_booking",
      confidence: Math.min(parsed.confidence + 0.1, 1.0),
      reason: `Found ${providerMatches.length} provider(s) and ${serviceMatches.length} service(s) matching your request.`,
      prefillData: buildDirectBookingPrefill(parsed),
      suggestedProviders: providerMatches.slice(0, 3).map((m) => ({
        id: m.matchId,
        title: m.title,
        score: m.score,
      })),
    };
  }

  return {
    loop: "requirement_post",
    confidence: parsed.confidence,
    reason: highScoreMatches.length === 0
      ? "No exact matches found nearby. Post your requirement and let providers come to you."
      : "Posting a requirement lets you compare multiple responses.",
    prefillData: buildRequirementPrefill(parsed),
  };
}

function buildDirectBookingPrefill(parsed: ParsedIntent) {
  const categoryLabel = parsed.category
    ? parsed.category.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "Service";

  return {
    category: parsed.category,
    title: `${categoryLabel}${parsed.location ? ` in ${parsed.location}` : ""}`,
    description: parsed.originalQuery,
    urgency: parsed.urgency,
    location: parsed.location,
    budgetMax: parsed.budget.max,
  };
}

function buildRequirementPrefill(parsed: ParsedIntent) {
  const categoryLabel = parsed.category
    ? parsed.category.split("-").map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join(" ")
    : "Help";

  const urgencyText = parsed.urgency === "now"
    ? " (Urgent)"
    : parsed.urgency === "today"
      ? " (Today)"
      : "";

  return {
    category: parsed.category,
    title: `${categoryLabel} needed${urgencyText}${parsed.location ? ` in ${parsed.location}` : ""}`,
    description: parsed.originalQuery,
    urgency: parsed.urgency,
    location: parsed.location,
    budgetMax: parsed.budget.max,
  };
}
