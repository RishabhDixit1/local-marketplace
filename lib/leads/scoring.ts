export type LeadScoreInput = {
  categoryFit: number;
  distanceKm: number | null;
  availability: string;
  responseTimeMinutes: number;
  trustScore: number;
  completedJobs: number;
  reviewCount: number;
  averageRating: number;
  isOnline: boolean;
  repeatClientsCount: number;
};

export type LeadScoreBreakdown = {
  categoryFitScore: number;
  distanceScore: number;
  availabilityScore: number;
  responsivenessScore: number;
  trustScoreComponent: number;
  experienceScore: number;
  total: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function scoreLead(input: LeadScoreInput): LeadScoreBreakdown {
  const categoryFitScore = clamp(input.categoryFit * 20, 0, 100) * 0.2;

  const distanceScore = input.distanceKm == null
    ? 50
    : clamp(100 - input.distanceKm * 6, 0, 100);
  const distanceWeighted = distanceScore * 0.2;

  const availabilityScore = (() => {
    if (!input.isOnline) return 20;
    if (input.availability === "available") return 100;
    if (input.availability === "online") return 95;
    if (input.availability === "busy") return 40;
    return 10;
  })();
  const availabilityWeighted = availabilityScore * 0.1;

  const responsivenessScore = clamp(100 - input.responseTimeMinutes * 0.5, 0, 100);
  const responsivenessWeighted = responsivenessScore * 0.1;

  const trustScoreComponent = clamp(input.trustScore, 0, 100);
  const trustWeighted = trustScoreComponent * 0.2;

  const experienceScore = (() => {
    let score = 0;
    score += Math.min(input.completedJobs, 50) * 1.2;
    score += Math.min(input.reviewCount, 20) * 1.5;
    score += clamp(input.averageRating * 8, 0, 40);
    score += Math.min(input.repeatClientsCount, 20) * 2;
    return clamp(score, 0, 100);
  })();
  const experienceWeighted = experienceScore * 0.2;

  const total = Math.round(
    categoryFitScore +
    distanceWeighted +
    availabilityWeighted +
    responsivenessWeighted +
    trustWeighted +
    experienceWeighted
  );

  return {
    categoryFitScore: Math.round(categoryFitScore),
    distanceScore: Math.round(distanceScore),
    availabilityScore: Math.round(availabilityScore),
    responsivenessScore: Math.round(responsivenessScore),
    trustScoreComponent: Math.round(trustScoreComponent),
    experienceScore: Math.round(experienceScore),
    total: clamp(total, 0, 100),
  };
}

export type ScoringConfig = {
  categoryWeights: Record<string, string[]>;
  maxDistanceKm: number;
};

export function computeCategoryFit(
  requestCategory: string,
  providerCategories: string[],
  config?: ScoringConfig
): number {
  const normalizedRequest = requestCategory.toLowerCase();
  const normalizedProvider = providerCategories.map((c) => c.toLowerCase());

  if (normalizedProvider.includes(normalizedRequest)) return 1.0;

  if (config?.categoryWeights) {
    for (const [group, members] of Object.entries(config.categoryWeights)) {
      const groupLower = group.toLowerCase();
      if (normalizedRequest === groupLower || members.some((m) => m.toLowerCase() === normalizedRequest)) {
        if (normalizedProvider.includes(groupLower) || members.some((m) => normalizedProvider.includes(m.toLowerCase()))) {
          return 0.8;
        }
      }
    }
  }

  const requestWords = normalizedRequest.split(/\s+/);
  for (const providerCat of normalizedProvider) {
    const providerWords = providerCat.split(/\s+/);
    const overlap = requestWords.filter((w) => providerWords.includes(w)).length;
    if (overlap > 0) return 0.3 + overlap * 0.15;
  }

  return 0.1;
}

export function pickTopLeads<T extends { score: number }>(
  leads: T[],
  limit: number = 10
): T[] {
  return [...leads]
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
