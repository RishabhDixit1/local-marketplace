import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import type { RequestAuthContext } from "@/lib/server/requestAuth";

const TIER_HIERARCHY: Record<string, number> = {
  free: 0,
  basic: 1,
  premium: 2,
};

const planNameToTier = (name: string): string => {
  switch (name.toLowerCase()) {
    case "premium":
      return "premium";
    case "essential":
      return "basic";
    default:
      return "free";
  }
};

export type SubscriptionGuardContext = {
  auth: RequestAuthContext;
  planTier: string;
  planName: string;
};

export type SubscriptionGuardFailure = {
  ok: false;
  status: number;
  message: string;
};

export async function requireSubscription(
  request: Request,
  requiredTier: "free" | "basic" | "premium"
): Promise<{ ok: true; context: SubscriptionGuardContext } | SubscriptionGuardFailure> {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return authResult;

  const db = createSupabaseAdminClient();
  if (!db) {
    return { ok: false, status: 500, message: "Server config error" };
  }

  const requiredLevel = TIER_HIERARCHY[requiredTier];
  if (requiredLevel === undefined) {
    return { ok: false, status: 500, message: "Invalid tier specified" };
  }

  const { data, error } = await db
    .from("provider_subscriptions")
    .select("*, plan:plan_id(*)")
    .eq("provider_id", authResult.auth.userId)
    .in("status", ["active", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    return { ok: false, status: 500, message: error.message };
  }

  const userLevel = data?.plan?.sort_order ?? 0;
  const planName = data?.plan?.name ?? "Free";
  const planTier = planNameToTier(planName);

  if (userLevel < requiredLevel) {
    return {
      ok: false,
      status: 403,
      message: `This feature requires a ${requiredTier} subscription. Current plan: ${planName}.`,
    };
  }

  return {
    ok: true,
    context: {
      auth: authResult.auth,
      planTier,
      planName,
    },
  };
}

export async function getSubscriptionTier(
  request: Request
): Promise<{ tier: string; name: string; active: boolean }> {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return { tier: "free", name: "Free", active: false };
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return { tier: "free", name: "Free", active: false };
  }

  const { data, error } = await db
    .from("provider_subscriptions")
    .select("*, plan:plan_id(*)")
    .eq("provider_id", authResult.auth.userId)
    .in("status", ["active", "past_due"])
    .order("current_period_end", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error || !data?.plan) {
    return { tier: "free", name: "Free", active: !error };
  }

  return {
    tier: planNameToTier(data.plan.name),
    name: data.plan.name,
    active: true,
  };
}
