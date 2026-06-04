import "server-only";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

type SubscriptionInfo = {
  active: boolean;
  planName: string;
  planId: string | null;
  features: string[];
  periodEnd: string | null;
};

export async function getProviderSubscription(providerId: string): Promise<SubscriptionInfo> {
  const db = createSupabaseAdminClient();
  if (!db) {
    return { active: false, planName: "Free", planId: null, features: [], periodEnd: null };
  }

  const { data } = await db
    .from("provider_subscriptions")
    .select("*, plan:plan_id(*)")
    .eq("provider_id", providerId)
    .in("status", ["active", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (!data) {
    return { active: false, planName: "Free", planId: null, features: [], periodEnd: null };
  }

  const plan = data.plan as { name: string; features: string[] } | undefined;
  const now = new Date();
  const periodEnd = data.current_period_end ? new Date(data.current_period_end) : null;
  const expired = periodEnd && periodEnd < now;

  if (expired) {
    return { active: false, planName: "Free", planId: null, features: [], periodEnd: data.current_period_end };
  }

  return {
    active: data.status === "active",
    planName: plan?.name ?? "Free",
    planId: data.plan_id,
    features: (plan?.features as string[]) ?? [],
    periodEnd: data.current_period_end,
  };
}

export function hasFeature(subscription: SubscriptionInfo, feature: string): boolean {
  return subscription.features.some((f) => f.toLowerCase().includes(feature.toLowerCase()));
}
