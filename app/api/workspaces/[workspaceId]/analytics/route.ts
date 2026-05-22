import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const url = new URL(request.url);
  const period = url.searchParams.get("period") || "30d";

  const since = new Date();
  since.setDate(since.getDate() - (period === "7d" ? 7 : period === "90d" ? 90 : 30));

  const memberIds = await db.from("workspace_members").select("user_id").eq("workspace_id", workspaceId);
  const userIds = (memberIds.data || []).map((m: { user_id: string }) => m.user_id);

  const [ordersData, activityData, presenceData] = await Promise.all([
    userIds.length > 0
      ? db.from("orders").select("status, created_at, total").in("provider_id", userIds).gte("created_at", since.toISOString()).limit(500)
      : Promise.resolve({ data: [] }),
    db.from("workspace_activity_log").select("*").eq("workspace_id", workspaceId).gte("created_at", since.toISOString()).order("created_at", { ascending: false }).limit(100),
    db.from("workspace_members").select("user_id, role, is_active, joined_at, profiles!inner(full_name)").eq("workspace_id", workspaceId),
  ]);

  const orders = (ordersData.data || []) as Array<{ status: string; total: number | null }>;
  const completed = orders.filter((o) => o.status === "completed");
  const totalRevenue = completed.reduce((sum, o) => sum + (Number(o.total) || 0), 0);

  return NextResponse.json({
    ok: true,
    analytics: {
      totalMembers: (presenceData.data || []).length,
      activeMembers: (presenceData.data || []).filter((m: { is_active: boolean }) => m.is_active).length,
      totalOrders: orders.length,
      completedOrders: completed.length,
      totalRevenue,
      avgOrderValue: completed.length > 0 ? Math.round(totalRevenue / completed.length) : 0,
      recentActivity: activityData.data || [],
      members: presenceData.data || [],
    },
  });
}
