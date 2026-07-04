import { z } from "zod";
import { generate } from "./provider";

const AiMatchResultSchema = z.object({
  providerScores: z.array(
    z.object({
      providerId: z.string(),
      aiScore: z.number().min(0).max(100),
      reasoning: z.string(),
      semanticFit: z.string(),
      confidenceFlags: z.array(z.string()).optional(),
    })
  ),
  overallAssessment: z.string(),
});

export type AiMatchResult = z.infer<typeof AiMatchResultSchema>;

export type AiMatchProvider = {
  id: string;
  name: string | null;
  headline: string | null;
  bio: string | null;
  services: string[];
  interests: string[];
  location: string | null;
  distanceKm: number | null;
  availability: string;
  trustScore: number;
  completedJobs: number;
  averageRating: number;
  reviewCount: number;
  responseTimeMinutes: number;
  verificationLevel: string;
  businessType: string | null;
};

export type AiMatchRequest = {
  id: string;
  title: string | null;
  description: string | null;
  category: string | null;
  locationLabel: string | null;
  urgency: string | null;
  budgetMin: number | null;
  budgetMax: number | null;
  latitude: number | null;
  longitude: number | null;
};

function buildProviderSummary(providers: AiMatchProvider[]): string {
  return providers
    .map(
      (p) =>
        `- Provider ${p.id.slice(0, 8)}: "${p.name || "Unnamed"}"` +
        `${p.headline ? ` — ${p.headline}` : ""}` +
        `${p.bio ? ` | Bio: ${p.bio.slice(0, 120)}` : ""}` +
        ` | Services: ${p.services.join(", ") || "none listed"}` +
        ` | Location: ${p.location || "unknown"}` +
        ` | Distance: ${p.distanceKm != null ? `${p.distanceKm.toFixed(1)}km` : "unknown"}` +
        ` | Availability: ${p.availability}` +
        ` | Trust: ${p.trustScore}/100` +
        ` | Rating: ${p.averageRating.toFixed(1)}★ (${p.reviewCount} reviews)` +
        ` | Jobs: ${p.completedJobs}` +
        ` | Response: ${p.responseTimeMinutes}min` +
        ` | Verification: ${p.verificationLevel}` +
        `${p.businessType ? ` | Business: ${p.businessType}` : ""}`
    )
    .join("\n");
}

export async function scoreWithAi(
  request: AiMatchRequest,
  providers: AiMatchProvider[]
): Promise<AiMatchResult> {
  if (!process.env.GOOGLE_GEMINI_API_KEY || providers.length === 0) {
    return buildFallbackResult(providers);
  }

  const providerSummary = buildProviderSummary(providers);

  const prompt = `Score each provider's fit for this service request.

REQUEST:
Title: ${request.title || "Untitled"}
Description: ${request.description || "Not provided"}
Category: ${request.category || "Uncategorized"}
Location: ${request.locationLabel || "Unknown"}
Urgency: ${request.urgency || "Not specified"}
Budget: ${request.budgetMin != null ? `₹${request.budgetMin}` : "?"} - ${request.budgetMax != null ? `₹${request.budgetMax}` : "?"}
Coordinates: ${request.latitude != null ? `${request.latitude}, ${request.longitude}` : "Unknown"}

AVAILABLE PROVIDERS:
${providerSummary}

Score each provider 0-100 on fit for THIS specific request. Consider:

1. **Service match**: Does the provider's listed services/interests/business match what's needed? Higher weight for exact matches.
2. **Location fit**: Is the provider nearby? Under 3km = excellent, 3-8km = good, 8-15km = fair, beyond = poor.
3. **Availability**: Is the provider free to take this job now?
4. **Reputation**: Trust score, ratings, review count, and completed jobs indicate reliability.
5. **Responsiveness**: Faster response times are better.
6. **Urgency fit**: For urgent requests, prioritize available and fast-responding providers.
7. **Semantic fit**: Does their bio/headline suggest relevant expertise beyond just category tags?

Return a score and brief reasoning for each provider.`;

  try {
    const result = await generate({
      prompt,
      schema: AiMatchResultSchema,
      system:
        "You are a smart lead matching system for ServiQ, an Indian hyperlocal services marketplace. " +
        "Score provider-request fit accurately. Be critical — not every provider is a good match. " +
        "Scores below 30 mean poor fit, 30-60 means acceptable, 60-80 means good, 80+ means excellent. " +
        "Return confidenceFlags like 'exact_category_match', 'highly_recommended', 'location_concern', 'availability_concern', 'new_provider' where relevant.",
    });

    return result;
  } catch {
    return buildFallbackResult(providers);
  }
}

function buildFallbackResult(providers: AiMatchProvider[]): AiMatchResult {
  return {
    providerScores: providers.map((p) => ({
      providerId: p.id,
      aiScore: Math.round(
        p.trustScore * 0.3 +
          (p.averageRating / 5) * 25 +
          Math.min(p.completedJobs, 30) * 1.5 +
          (p.availability === "available" || p.availability === "online" ? 15 : 0)
      ),
      reasoning: "AI unavailable — score based on trust, ratings, and experience.",
      semanticFit: p.services[0] || "general",
    })),
    overallAssessment: "AI matching unavailable — using fallback scoring.",
  };
}

export function mergeAiScore(
  currentBreakdown: Record<string, number>,
  aiScore: number,
  aiWeight: number = 0.2
): { mergedBreakdown: Record<string, number>; total: number } {
  const currentTotal = currentBreakdown.total || 0;
  const adjustedCurrent = Math.round(currentTotal * (1 - aiWeight));
  const adjustedAi = Math.round(aiScore * aiWeight);
  const total = Math.min(adjustedCurrent + adjustedAi, 100);

  return {
    mergedBreakdown: {
      ...currentBreakdown,
      aiMatchScore: Math.round(aiScore),
      total,
    },
    total,
  };
}
