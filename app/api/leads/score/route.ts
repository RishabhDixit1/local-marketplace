import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { scoreLead, computeCategoryFit, type LeadScoreInput, type LeadScoreBreakdown } from "@/lib/leads/scoring";
import { sendPushToUser } from "@/lib/server/pushNotifications";

export const runtime = "nodejs";

type LeadApiError = { ok: false; code: string; message: string; details?: string };
type ScoredProvider = {
  providerId: string;
  helpRequestId: string;
  score: number;
  breakdown: LeadScoreBreakdown;
};

type ScoreLeadsRequest = {
  helpRequestId: string;
};

const toError = (status: number, code: string, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details } satisfies LeadApiError, { status });

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toError(401, "UNAUTHORIZED", authResult.message);

  let body: ScoreLeadsRequest;
  try {
    body = await request.json();
  } catch {
    return toError(400, "INVALID_PAYLOAD", "Invalid JSON payload.");
  }

  if (!body.helpRequestId) {
    return toError(400, "INVALID_PAYLOAD", "helpRequestId is required.");
  }

  const admin = createSupabaseAdminClient();
  const userClient = createSupabaseUserServerClient(authResult.auth.accessToken);
  const db = admin || userClient;
  if (!db) return toError(500, "CONFIG", "Supabase server credentials are missing.");

  const { data: helpRequest, error: hrError } = await db
    .from("help_requests")
    .select("id, title, category, latitude, longitude, radius_km, status, requester_id")
    .eq("id", body.helpRequestId)
    .maybeSingle();

  if (hrError || !helpRequest) {
    return toError(404, "NOT_FOUND", hrError?.message || "Help request not found.");
  }

  if (helpRequest.status !== "open") {
    return toError(400, "INVALID_STATE", "Help request is not open for matching.");
  }

  const providerRadiusKm = helpRequest.radius_km || 8;

  const { data: providers, error: profilesError } = await db
    .from("profiles")
    .select(`
      id, role, availability, latitude, longitude,
      trust_score, response_time_minutes, verification_level,
      repeat_clients_count, interests, metadata,
      provider_presence!inner (
        is_online, completed_jobs, cancelled_jobs
      )
    `)
    .eq("role", "provider")
    .not("latitude", "is", null)
    .not("longitude", "is", null);

  if (profilesError) {
    return toError(500, "DB", profilesError.message);
  }

  const providerIds = (providers as Array<{ id: string }> | null)?.map((p) => p.id) || [];
  if (providerIds.length === 0) {
    return NextResponse.json({ ok: true, leads: [], helpRequestId: body.helpRequestId });
  }

  const { data: reviewsData } = await db
    .from("reviews")
    .select("provider_id, rating")
    .in("provider_id", providerIds);

  const reviewMap = new Map<string, { count: number; total: number }>();
  for (const review of (reviewsData as Array<{ provider_id: string; rating: number }> | null) || []) {
    const entry = reviewMap.get(review.provider_id) || { count: 0, total: 0 };
    entry.count += 1;
    entry.total += Number(review.rating) || 0;
    reviewMap.set(review.provider_id, entry);
  }

  const leads: ScoredProvider[] = [];

  for (const provider of (providers as Array<Record<string, unknown>>) || []) {
    const presence = provider.provider_presence as Record<string, unknown> | null;
    if (!presence) continue;

    const providerLat = provider.latitude as number | null;
    const providerLng = provider.longitude as number | null;
    let distanceKm: number | null = null;

    if (
      providerLat != null && providerLng != null &&
      helpRequest.latitude != null && helpRequest.longitude != null
    ) {
      distanceKm = haversineKm(
        helpRequest.latitude as number,
        helpRequest.longitude as number,
        providerLat,
        providerLng
      );
    }

    if (distanceKm != null && distanceKm > providerRadiusKm) continue;

    const reviews = reviewMap.get(provider.id as string);
    const reviewCount = reviews?.count || 0;
    const averageRating = reviewCount > 0 ? reviews!.total / reviewCount : 0;

    const providerCategories = [
      ...((provider.interests as string[]) || []),
      ...((((provider.metadata as Record<string, unknown>)?.launchpad as Record<string, unknown>)
        ?.businessType as string) || ""),
    ].filter(Boolean);

    const categoryFit = computeCategoryFit(helpRequest.category || "", providerCategories);

    const input: LeadScoreInput = {
      categoryFit,
      distanceKm,
      availability: (provider.availability as string) || "available",
      responseTimeMinutes: Number(provider.response_time_minutes) || 30,
      trustScore: Number(provider.trust_score) || 0,
      completedJobs: Number(presence.completed_jobs) || 0,
      reviewCount,
      averageRating,
      isOnline: Boolean(presence.is_online),
      repeatClientsCount: Number(provider.repeat_clients_count) || 0,
    };

    const breakdown = scoreLead(input);
    if (breakdown.total < 5) continue;

    leads.push({
      providerId: provider.id as string,
      helpRequestId: body.helpRequestId,
      score: breakdown.total,
      breakdown,
    });
  }

  leads.sort((a, b) => b.score - a.score);
  const topLeads = leads.slice(0, 30);

  let insertedCount = 0;
  if (topLeads.length > 0) {
    const insertPayload = topLeads.map((lead) => ({
      help_request_id: lead.helpRequestId,
      provider_id: lead.providerId,
      score: lead.score,
      score_breakdown: lead.breakdown,
    }));

    const { error: insertError } = await db.from("lead_assignments").upsert(insertPayload, {
      onConflict: "help_request_id, provider_id",
      ignoreDuplicates: false,
    });

    if (!insertError) {
      insertedCount = topLeads.length;
    }

    const requestTitle = helpRequest.title || helpRequest.category || "Service request";
    for (const lead of topLeads) {
      void sendPushToUser(db, lead.providerId, {
        title: "New high-quality lead",
        body: `Score ${lead.score}/100 · ${requestTitle}`,
        data: {
          url: `/dashboard/leads?help_request_id=${body.helpRequestId}`,
          help_request_id: body.helpRequestId,
          score: lead.score,
        },
      });
    }
  }

  return NextResponse.json({
    ok: true,
    helpRequestId: body.helpRequestId,
    leadsScored: topLeads.length,
    leadsInserted: insertedCount,
    leads: topLeads,
  });
}

export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toError(401, "UNAUTHORIZED", authResult.message);

  const url = new URL(request.url);
  const providerId = url.searchParams.get("providerId") || authResult.auth.userId;

  const admin = createSupabaseAdminClient();
  const db = admin || createSupabaseUserServerClient(authResult.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "Supabase server credentials are missing.");

  const { data: leads, error } = await db
    .from("lead_assignments")
    .select(`
      id, help_request_id, score, score_breakdown, status,
      assigned_at, responded_at,
      help_requests!inner(title, category, location_label, budget_min, budget_max, status, created_at)
    `)
    .eq("provider_id", providerId)
    .order("assigned_at", { ascending: false })
    .limit(50);

  if (error) {
    return toError(500, "DB", error.message);
  }

  return NextResponse.json({ ok: true, leads });
}

function haversineKm(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6371;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLng / 2) * Math.sin(dLng / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

function toRad(deg: number): number {
  return (deg * Math.PI) / 180;
}
