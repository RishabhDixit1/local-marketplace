import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

export type ProviderProfileData = {
  ok: true;
  currentUserId: string;
  acceptedConnectionIds: string[];
  viewerRoleFamily: "seeker" | "provider";
  profiles: Record<string, unknown>[];
  services: Record<string, unknown>[];
  products: Record<string, unknown>[];
  posts: Record<string, unknown>[];
  helpRequests: Record<string, unknown>[];
  reviews: Record<string, unknown>[];
  presence: Record<string, unknown>[];
  orderStats: Record<string, unknown>[];
} | {
  ok: false;
  code: string;
  message: string;
};

async function getHandler(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<NextResponse> {
  const { id } = await params;

  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json(
      { ok: false, code: "UNAUTHORIZED", message: authResult.message } satisfies ProviderProfileData,
      { status: authResult.status },
    );
  }

  const admin = createSupabaseAdminClient();
  const dbClient = admin || createSupabaseUserServerClient(authResult.auth.accessToken);

  if (!dbClient) {
    return NextResponse.json(
      { ok: false, code: "CONFIG", message: "Supabase server credentials are missing." } satisfies ProviderProfileData,
      { status: 500 },
    );
  }

  try {
    const [
      profileRes,
      servicesRes,
      productsRes,
      postsRes,
      helpRequestsRes,
      reviewsRes,
      presenceRes,
      orderStatsRes,
    ] = await Promise.all([
      dbClient.from("profiles").select("*").eq("id", id).maybeSingle(),
      dbClient.from("service_listings").select("*").eq("provider_id", id),
      dbClient.from("product_catalog").select("*").eq("provider_id", id),
      dbClient.from("posts").select("*").eq("provider_id", id),
      dbClient.from("help_requests").select("*").eq("requester_id", id),
      dbClient.from("reviews").select("provider_id,rating").eq("provider_id", id),
      dbClient.from("provider_presence")
        .select("provider_id,is_online,availability,response_sla_minutes,rolling_response_minutes,last_seen")
        .eq("provider_id", id)
        .maybeSingle(),
      dbClient.rpc("get_provider_order_stats", { provider_ids: [id] }).then(
        (r) => r.error ? Promise.resolve({ data: null, error: null }) : r,
      ),
    ]);

    if (profileRes.error) throw profileRes.error;
    if (servicesRes.error) throw servicesRes.error;
    if (productsRes.error) throw productsRes.error;
    if (postsRes.error) throw postsRes.error;
    if (helpRequestsRes.error) throw helpRequestsRes.error;
    if (reviewsRes.error) throw reviewsRes.error;
    if (presenceRes.error && !presenceRes.error.message?.includes("42P01")) throw presenceRes.error;

    const profile = profileRes.data;
    if (!profile) {
      return NextResponse.json(
        { ok: false, code: "NOT_FOUND", message: "Provider not found." } satisfies ProviderProfileData,
        { status: 404 },
      );
    }

    return NextResponse.json({
      ok: true,
      currentUserId: authResult.auth.userId,
      acceptedConnectionIds: [],
      viewerRoleFamily: "seeker",
      profiles: [profile],
      services: servicesRes.data || [],
      products: productsRes.data || [],
      posts: postsRes.data || [],
      helpRequests: helpRequestsRes.data || [],
      reviews: reviewsRes.data || [],
      presence: presenceRes.data ? [presenceRes.data] : [],
      orderStats: Array.isArray(orderStatsRes.data) ? orderStatsRes.data : (orderStatsRes.data ? [orderStatsRes.data] : []),
    } satisfies ProviderProfileData, {
      headers: {
        "Cache-Control": "private, max-age=0, stale-while-revalidate=30",
      },
    });
  } catch (error) {
    console.error("[providers/profile] Failed:", error);
    return NextResponse.json(
      {
        ok: false,
        code: "DB",
        message: error instanceof Error ? error.message : "Unable to load provider profile.",
      } satisfies ProviderProfileData,
      { status: 500 },
    );
  }
}

export const GET = withErrorHandling(getHandler, "providers:profile");
