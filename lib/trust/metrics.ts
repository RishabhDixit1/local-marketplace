export type TrustMetricsInput = {
  completedJobs: number;
  cancelledJobs: number;
  totalJobs: number;
  responseTimeMinutes: number;
  averageRating: number;
  reviewCount: number;
  repeatClientsCount: number;
  abuseReports: number;
  isOnline: boolean;
  verificationLevel: string;
};

export type TrustMetricsResult = {
  responseScore: number;
  completionScore: number;
  repeatCustomerScore: number;
  ratingScore: number;
  reliabilityScore: number;
  overallScore: number;
};

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function calculateTrustMetrics(input: TrustMetricsInput): TrustMetricsResult {
  const responseScore = (() => {
    if (input.responseTimeMinutes <= 5) return 100;
    if (input.responseTimeMinutes <= 15) return 90;
    if (input.responseTimeMinutes <= 30) return 75;
    if (input.responseTimeMinutes <= 60) return 55;
    if (input.responseTimeMinutes <= 120) return 35;
    return 10;
  })();

  const completionRate = input.totalJobs > 0
    ? clamp(input.completedJobs / input.totalJobs, 0, 1)
    : 0;
  const completionScore = Math.round(completionRate * 100);

  const repeatCustomerScore = (() => {
    if (input.completedJobs === 0) return 0;
    const repeatRate = clamp(input.repeatClientsCount / Math.max(input.completedJobs, 1), 0, 1);
    return Math.round(repeatRate * 100);
  })();

  const ratingScore = input.averageRating > 0
    ? Math.round(clamp(input.averageRating * 20, 0, 100))
    : 0;

  const reliabilityScore = (() => {
    let score = 50;
    if (input.isOnline) score += 15;
    if (input.abuseReports === 0) score += 15;
    if (input.verificationLevel === "business" || input.verificationLevel === "kyc") score += 10;
    if (input.verificationLevel === "verified") score += 5;
    if (input.reviewCount > 0) score += Math.min(input.reviewCount, 10);
    return clamp(score, 0, 100);
  })();

  const overallScore = Math.round(
    responseScore * 0.15 +
    completionScore * 0.25 +
    repeatCustomerScore * 0.15 +
    ratingScore * 0.25 +
    reliabilityScore * 0.2
  );

  return {
    responseScore,
    completionScore,
    repeatCustomerScore,
    ratingScore,
    reliabilityScore,
    overallScore,
  };
}
