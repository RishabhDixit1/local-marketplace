import { NextResponse } from "next/server";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { scoreWithAi, type AiMatchProvider, type AiMatchRequest } from "@/lib/ai/matching";
import { scoreLead, computeCategoryFit, mergeAiIntoBreakdown, haversineKm, type LeadScoreInput, type AiEnhancedBreakdown } from "@/lib/leads/scoring";
import { routeLeads, type ProviderCapacity } from "@/lib/leads/routing";
import { enqueueJob } from "@/lib/server/backgroundJobs";

export const runtime = "nodejs";

type AiMatchError = { ok: false; code: string; message: string; details?: string };
type AiMatchSuccess = {
  ok: true;
  helpRequestId: string;
  leads: Array<{
    providerId: string;
    score: number;
    baseScore: number;
    aiScore: number;
    breakdown: AiEnhancedBreakdown;
    aiReasoning: string;
    semanticFit: string;
    routingPriority: string;
    routingReason: string;
  }>;
  aiAssessment: string;
  routingSummary: string;
};

const toError = (status: number, code: string, message: string, details?: string) =>
  NextResponse.json({ ok: false, code, message, details } satisfies AiMatchError, { status });

export async function POST(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) return toError(401, "UNAUTHORIZED", authResult.message);

  let body: { helpRequestId: string };
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
    .select("id, title, description, category, location_label, urgency, budget_min, budget_max, latitude, longitude, radius_km, status, requester_id")
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
      id, full_name, name, headline, bio, location, role, availability,
      latitude, longitude, trust_score, response_time_minutes,
      verification_level, repeat_clients_count, interests, services, metadata,
      provider_presence!inner (
        is_online, completed_jobs, cancelled_jobs
      )
    `)
    .eq("role", "provider")
    .eq("is_test", false)
    .not("latitude", "is", null)
    .not("longitude", "is", null)
    .limit(100);

  if (profilesError) {
    return toError(500, "DB", profilesError.message);
  }

  const rawProviderList = (providers as Array<Record<string, unknown>> | null) || [];

  const hasRequestCoords = helpRequest.latitude != null && helpRequest.longitude != null;
  const sortedProviders = hasRequestCoords
    ? [...rawProviderList].sort((a, b) => {
        const aLat = a.latitude as number | null;
        const aLng = a.longitude as number | null;
        const bLat = b.latitude as number | null;
        const bLng = b.longitude as number | null;
        const aDist = (aLat != null && aLng != null)
          ? haversineKm(helpRequest.latitude as number, helpRequest.longitude as number, aLat, aLng)
          : Infinity;
        const bDist = (bLat != null && bLng != null)
          ? haversineKm(helpRequest.latitude as number, helpRequest.longitude as number, bLat, bLng)
          : Infinity;
        return aDist - bDist;
      })
    : rawProviderList;
  const providerList = sortedProviders.slice(0, 50);

  if (providerList.length === 0) {
    return NextResponse.json<AiMatchError>({
      ok: false, code: "NO_PROVIDERS", message: "No providers available for matching.",
    });
  }

  const providerIds = providerList.map((p) => p.id as string);

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

  const { data: orderCounts } = await db
    .from("orders")
    .select("provider_id, status")
    .in("provider_id", providerIds)
    .in("status", ["accepted", "in_progress"]);

  const activeJobCount = new Map<string, number>();
  for (const order of (orderCounts as Array<{ provider_id: string; status: string }> | null) || []) {
    activeJobCount.set(order.provider_id, (activeJobCount.get(order.provider_id) || 0) + 1);
  }

  const aiRequest: AiMatchRequest = {
    id: helpRequest.id,
    title: helpRequest.title,
    description: helpRequest.description,
    category: helpRequest.category,
    locationLabel: helpRequest.location_label,
    urgency: helpRequest.urgency,
    budgetMin: helpRequest.budget_min,
    budgetMax: helpRequest.budget_max,
    latitude: helpRequest.latitude,
    longitude: helpRequest.longitude,
  };

  const scoredLeads: Array<{
    providerId: string;
    baseScore: number;
    baseBreakdown: Record<string, number>;
    aiScore: number;
    breakdown: AiEnhancedBreakdown;
    aiReasoning: string;
    semanticFit: string;
    distanceKm: number | null;
    capacity: ProviderCapacity;
  }> = [];

  const aiProviders: AiMatchProvider[] = [];

  for (const provider of providerList) {
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
      ...((provider.services as string[]) || []),
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

    const baseBreakdown = scoreLead(input);

    aiProviders.push({
      id: provider.id as string,
      name: (provider.full_name as string) || (provider.name as string) || null,
      headline: (provider.headline as string) || null,
      bio: (provider.bio as string) || null,
      services: (provider.services as string[]) || [],
      interests: (provider.interests as string[]) || [],
      location: (provider.location as string) || null,
      distanceKm,
      availability: (provider.availability as string) || "available",
      trustScore: Number(provider.trust_score) || 0,
      completedJobs: Number(presence.completed_jobs) || 0,
      averageRating,
      reviewCount,
      responseTimeMinutes: Number(provider.response_time_minutes) || 30,
      verificationLevel: (provider.verification_level as string) || "email",
      businessType: ((provider.metadata as Record<string, unknown>)?.launchpad as Record<string, unknown>)
        ?.businessType as string | null || null,
    });

    scoredLeads.push({
      providerId: provider.id as string,
      baseScore: baseBreakdown.total,
      baseBreakdown: baseBreakdown as unknown as Record<string, number>,
      aiScore: 0,
      breakdown: { ...baseBreakdown, aiMatchScore: 0, total: baseBreakdown.total },
      aiReasoning: "",
      semanticFit: "",
      distanceKm,
      capacity: {
        providerId: provider.id as string,
        activeJobs: activeJobCount.get(provider.id as string) || 0,
        maxConcurrentJobs: 3,
        lastResponseMinutes: null,
        averageResponseMinutes: Number(provider.response_time_minutes) || 30,
        score: baseBreakdown.total,
      },
    });
  }

  const aiResult = await scoreWithAi(aiRequest, aiProviders);

  const aiScoreMap = new Map(
    aiResult.providerScores.map((s) => [s.providerId, s])
  );

  for (const lead of scoredLeads) {
    const aiScoreData = aiScoreMap.get(lead.providerId);
    if (aiScoreData) {
      lead.aiScore = aiScoreData.aiScore;
      lead.aiReasoning = aiScoreData.reasoning;
      lead.semanticFit = aiScoreData.semanticFit;
      lead.breakdown = mergeAiIntoBreakdown(
        lead.baseBreakdown as Parameters<typeof mergeAiIntoBreakdown>[0],
        aiScoreData.aiScore
      );
    }
  }

  const routingDecisions = routeLeads(
    scoredLeads.map((l) => ({ providerId: l.providerId, score: l.breakdown.total })),
    scoredLeads.map((l) => l.capacity),
    helpRequest.urgency
  );

  const routingMap = new Map(routingDecisions.map((d) => [d.providerId, d]));

  const topLeads = scoredLeads
    .sort((a, b) => b.breakdown.total - a.breakdown.total)
    .slice(0, 30);

  const insertPayload = topLeads.map((lead) => {
    const routing = routingMap.get(lead.providerId);
    return {
      help_request_id: body.helpRequestId,
      provider_id: lead.providerId,
      score: lead.breakdown.total,
      score_breakdown: { ...lead.breakdown, aiReasoning: lead.aiReasoning },
      metadata: {
        aiScore: lead.aiScore,
        baseScore: lead.baseScore,
        semanticFit: lead.semanticFit,
        routingPriority: routing?.priority || "normal",
        routingReason: routing?.reason || "",
      },
    };
  });

  if (insertPayload.length > 0) {
    await db.from("lead_assignments").upsert(insertPayload, {
      onConflict: "help_request_id, provider_id",
      ignoreDuplicates: false,
    });
  }

  const immediateLeads = routingDecisions.filter((d) => d.priority === "immediate" || d.priority === "high");
  if (immediateLeads.length > 0) {
    const requestTitle = helpRequest.title || helpRequest.category || "Service request";
    await enqueueJob(db, "send-push-to-many", {
      userIds: immediateLeads.map((l) => l.providerId),
      title: "AI-matched lead ready",
      body: `High-priority lead · ${requestTitle}`,
      data: {
        url: `/dashboard/leads?help_request_id=${body.helpRequestId}&ai=true`,
        help_request_id: body.helpRequestId,
        ai_matched: true,
      },
    });
  }

  const response: AiMatchSuccess = {
    ok: true,
    helpRequestId: body.helpRequestId,
    leads: topLeads.map((lead) => {
      const routing = routingMap.get(lead.providerId);
      return {
        providerId: lead.providerId,
        score: lead.breakdown.total,
        baseScore: lead.baseScore,
        aiScore: lead.aiScore,
        breakdown: lead.breakdown,
        aiReasoning: lead.aiReasoning,
        semanticFit: lead.semanticFit,
        routingPriority: routing?.priority || "normal",
        routingReason: routing?.reason || "",
      };
    }),
    aiAssessment: aiResult.overallAssessment,
    routingSummary: `${immediateLeads.length} high-priority leads notified · ${routingDecisions.length} total providers evaluated`,
  };

  return NextResponse.json(response);
}
