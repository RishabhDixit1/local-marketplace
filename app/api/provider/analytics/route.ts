import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { getProviderSubscription, hasFeature } from "@/lib/server/subscriptionCheck";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const userId = auth.auth.userId;

  // Only paid plans get analytics
  const sub = await getProviderSubscription(userId);
  if (!sub.active || !hasFeature(sub, "analytics dashboard")) {
    return NextResponse.json({ ok: false, message: "Analytics requires an Essential or Premium subscription" }, { status: 403 });
  }
  const url = new URL(request.url);
  const year = parseInt(url.searchParams.get("year") ?? String(new Date().getFullYear()));
  if (isNaN(year) || year < 2020 || year > 2099) {
    return NextResponse.json({ ok: false, message: "Invalid year" }, { status: 400 });
  }

  // Monthly earnings for the year
  const { data: monthlyOrders } = await db
    .from("orders")
    .select("status, price, provider_payout_paise, created_at, metadata")
    .eq("provider_id", userId)
    .gte("created_at", `${year}-01-01`)
    .lt("created_at", `${year + 1}-01-01`);

  const monthlyEarnings: Record<string, { earned: number; paid: number; count: number }> = {};
  const monthLabels = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

  for (const order of monthlyOrders ?? []) {
    const month = new Date(order.created_at).getMonth();
    const key = monthLabels[month];
    if (!monthlyEarnings[key]) monthlyEarnings[key] = { earned: 0, paid: 0, count: 0 };

    if (["completed", "closed"].includes(order.status)) {
      monthlyEarnings[key].earned += typeof order.provider_payout_paise === "number" ? order.provider_payout_paise : 0;
      monthlyEarnings[key].paid += typeof order.price === "number" ? order.price * 100 : 0;
    }
    monthlyEarnings[key].count += 1;
  }

  const earningsChartData = monthLabels.map((label) => ({
    month: label,
    earned: monthlyEarnings[label]?.earned ?? 0,
    revenue: monthlyEarnings[label]?.paid ?? 0,
    orders: monthlyEarnings[label]?.count ?? 0,
  }));

  // Status breakdown
  const statusBreakdown: Record<string, number> = {};
  for (const order of monthlyOrders ?? []) {
    statusBreakdown[order.status] = (statusBreakdown[order.status] ?? 0) + 1;
  }

  // Conversion: how many quoted orders were accepted
  const quotedCount = (monthlyOrders ?? []).filter((o) =>
    ["quoted", "accepted", "in_progress", "completed", "closed"].includes(o.status)
  ).length;
  const acceptedCount = (monthlyOrders ?? []).filter((o) =>
    ["accepted", "in_progress", "completed", "closed"].includes(o.status)
  ).length;
  const conversionRate = quotedCount > 0 ? Math.round((acceptedCount / quotedCount) * 100) : 0;

  // Total all-time
  const { data: allOrders } = await db
    .from("orders")
    .select("provider_payout_paise, price, status")
    .eq("provider_id", userId)
    .in("status", ["completed", "closed"]);

  const totalEarnedPaise = (allOrders ?? []).reduce(
    (s, o) => s + (typeof o.provider_payout_paise === "number" ? o.provider_payout_paise : 0), 0
  );
  const totalRevenuePaise = (allOrders ?? []).reduce(
    (s, o) => s + (typeof o.price === "number" ? o.price * 100 : 0), 0
  );

  // Top customers (most orders)
  const { data: customerOrders } = await db
    .from("orders")
    .select("consumer_id, price, status")
    .eq("provider_id", userId);

  const customerMap: Record<string, { orders: number; spent: number }> = {};
  const customerIds = new Set<string>();
  for (const o of customerOrders ?? []) {
    customerIds.add(o.consumer_id);
    if (!customerMap[o.consumer_id]) customerMap[o.consumer_id] = { orders: 0, spent: 0 };
    customerMap[o.consumer_id].orders += 1;
    customerMap[o.consumer_id].spent += typeof o.price === "number" ? o.price * 100 : 0;
  }

  const sortedCustomerIds = [...customerIds].sort((a, b) => (customerMap[b]?.orders ?? 0) - (customerMap[a]?.orders ?? 0)).slice(0, 5);
  const { data: customerProfiles } = await db
    .from("profiles")
    .select("id, full_name, avatar_url")
    .in("id", sortedCustomerIds);

  const profileMap = new Map((customerProfiles ?? []).map((p) => [p.id, p]));
  const topCustomers = sortedCustomerIds.map((id) => ({
    id,
    name: profileMap.get(id)?.full_name ?? "Unknown",
    orders: customerMap[id]?.orders ?? 0,
    spentPaise: customerMap[id]?.spent ?? 0,
  }));

  // Average rating from reviews
  const { data: reviews } = await db
    .from("reviews")
    .select("rating, created_at")
    .eq("provider_id", userId);

  const avgRating = reviews && reviews.length > 0
    ? Math.round((reviews.reduce((s, r) => s + r.rating, 0) / reviews.length) * 10) / 10
    : null;

  return NextResponse.json({
    ok: true,
    analytics: {
      earningsChartData,
      statusBreakdown,
      conversionRate,
      summary: {
        totalEarnedPaise,
        totalRevenuePaise,
        totalOrders: (customerOrders ?? []).length,
        completedOrders: (allOrders ?? []).length,
        uniqueCustomers: customerIds.size,
        avgRating,
      },
      topCustomers,
    },
  });
}

export const GET = withErrorHandling(getHandler, "provider:analytics");
