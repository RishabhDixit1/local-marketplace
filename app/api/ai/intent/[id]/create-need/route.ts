import { NextResponse } from "next/server";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

type RouteParams = { params: Promise<{ id: string }> };
type CreateNeedBody = {
  title?: string;
  details?: string;
  category?: string;
  urgency?: string;
  locationLabel?: string;
  budgetMin?: number;
  budgetMax?: number;
};

async function postHandler(request: Request, { params }: RouteParams) {
  const { id: intentId } = await params;

  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  if (!intentId) {
    return NextResponse.json({ ok: false, message: "Missing intent ID" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  // Fetch intent to get parsed data as defaults
  const { data: intent, error: intentErr } = await db
    .from("intent_logs")
    .select("id, query, parsed_category, parsed_urgency, parsed_location, parsed_budget_min, parsed_budget_max, latitude, longitude")
    .eq("id", intentId)
    .single();

  if (intentErr || !intent) {
    return NextResponse.json({ ok: false, message: "Intent not found" }, { status: 404 });
  }

  const body = (await request.json()) as CreateNeedBody;

  const title = body.title || `Need ${intent.parsed_category || "service"} help`;
  const details = body.details || intent.query;
  const category = body.category || intent.parsed_category;
  const urgency = body.urgency || intent.parsed_urgency || "flexible";
  const locationLabel = body.locationLabel || intent.parsed_location;
  const budgetMin = body.budgetMin ?? intent.parsed_budget_min;
  const budgetMax = body.budgetMax ?? intent.parsed_budget_max;

  // Look up locality from location label
  let localityId: string | null = null;
  if (locationLabel) {
    const { data: locality } = await db
      .from("localities")
      .select("id")
      .ilike("name", `%${locationLabel}%`)
      .limit(1)
      .single();
    localityId = locality?.id || null;
  }

  // Create the help request (using the existing help_requests table)
  const { data: helpRequest, error: createErr } = await db
    .from("help_requests")
    .insert({
      requester_id: auth.auth.userId,
      title,
      details,
      category,
      urgency,
      budget_min: budgetMin,
      budget_max: budgetMax,
      location_label: locationLabel,
      latitude: intent.latitude,
      longitude: intent.longitude,
      status: "open",
    })
    .select("id, title, status, created_at")
    .single();

  if (createErr) {
    return NextResponse.json({ ok: false, message: createErr.message }, { status: 500 });
  }

  return NextResponse.json({
    ok: true,
    helpRequest: {
      id: helpRequest.id,
      title: helpRequest.title,
      status: helpRequest.status,
      createdAt: helpRequest.created_at,
    },
    redirectUrl: `/app/tasks`,
    message: "Your need has been posted. Nearby providers will be notified.",
  });
}

export const POST = withErrorHandling(postHandler, "ai:intent:create-need");
