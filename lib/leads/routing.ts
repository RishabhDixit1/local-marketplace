export type ProviderCapacity = {
  providerId: string;
  activeJobs: number;
  maxConcurrentJobs: number;
  lastResponseMinutes: number | null;
  averageResponseMinutes: number;
  score: number;
};

export type RoutingDecision = {
  providerId: string;
  priority: "immediate" | "high" | "normal" | "low";
  reason: string;
};

const DEFAULT_MAX_JOBS = 3;

export function calculateProviderCapacity(
  provider: ProviderCapacity
): { available: boolean; load: number; reason: string } {
  const load = provider.activeJobs / Math.max(provider.maxConcurrentJobs, DEFAULT_MAX_JOBS);

  if (load >= 1) {
    return { available: false, load, reason: "At full capacity" };
  }

  if (load >= 0.75) {
    return { available: true, load, reason: "Near capacity — slow response possible" };
  }

  if (load >= 0.5) {
    return { available: true, load, reason: "Moderate load" };
  }

  return { available: true, load, reason: "Ready for new work" };
}

export function routeLeads(
  scoredProviders: { providerId: string; score: number }[],
  capacities: ProviderCapacity[],
  requestUrgency: string | null,
  topN: number = 5
): RoutingDecision[] {
  const capacityMap = new Map(capacities.map((c) => [c.providerId, c]));

  const decisions: RoutingDecision[] = [];

  for (const provider of scoredProviders) {
    const capacity = capacityMap.get(provider.providerId);
    const isUrgent = requestUrgency === "urgent" || requestUrgency === "today";

    if (capacity) {
      const { available } = calculateProviderCapacity(capacity);
      if (!available) {
        decisions.push({
          providerId: provider.providerId,
          priority: "low",
          reason: `At capacity (${capacity.activeJobs}/${capacity.maxConcurrentJobs} jobs)`,
        });
        continue;
      }
    }

    let priority: RoutingDecision["priority"];
    let reason: string;

    if (provider.score >= 80 && isUrgent) {
      priority = "immediate";
      reason = "High score + urgent request — route immediately";
    } else if (provider.score >= 70) {
      priority = "high";
      reason = `Strong match (score: ${provider.score})`;
    } else if (provider.score >= 40) {
      priority = "normal";
      reason = `Adequate match (score: ${provider.score})`;
    } else {
      priority = "low";
      reason = `Weak match (score: ${provider.score})`;
    }

    decisions.push({ providerId: provider.providerId, priority, reason });
  }

  return decisions
    .sort((a, b) => {
      const order: Record<string, number> = { immediate: 0, high: 1, normal: 2, low: 3 };
      return order[a.priority] - order[b.priority];
    })
    .slice(0, topN);
}

export function shouldNotifyProvider(
  routingDecision: RoutingDecision,
  alreadyNotifiedCount: number,
  urgency: string | null
): boolean {
  const isUrgent = urgency === "urgent" || urgency === "today";

  if (routingDecision.priority === "immediate") return true;
  if (routingDecision.priority === "high" && alreadyNotifiedCount < 3) return true;
  if (routingDecision.priority === "normal" && alreadyNotifiedCount < 2 && !isUrgent) return true;

  return false;
}
