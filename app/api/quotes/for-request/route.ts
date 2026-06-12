import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) {
    return NextResponse.json({ ok: false, message: auth.message }, { status: auth.status });
  }

  const url = new URL(request.url);
  const helpRequestId = url.searchParams.get("helpRequestId");

  if (!helpRequestId) {
    return NextResponse.json({ ok: false, message: "helpRequestId is required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  // Verify the user has access to this help request
  const { data: helpRequest } = await db
    .from("help_requests")
    .select("id, requester_id, title, accepted_provider_id")
    .eq("id", helpRequestId)
    .single();

  if (!helpRequest) {
    return NextResponse.json({ ok: false, message: "Help request not found" }, { status: 404 });
  }

  const userId = auth.auth.userId;
  const isRequester = helpRequest.requester_id === userId;
  const isAcceptedProvider = helpRequest.accepted_provider_id === userId;

  let isMatchedProvider = false;
  if (!isRequester && !isAcceptedProvider) {
    const { data: match } = await db
      .from("help_request_matches")
      .select("status")
      .eq("help_request_id", helpRequestId)
      .eq("provider_id", userId)
      .in("status", ["interested", "accepted"])
      .maybeSingle();
    isMatchedProvider = match !== null;
  }

  if (!isRequester && !isAcceptedProvider && !isMatchedProvider) {
    return NextResponse.json({ ok: false, message: "Access denied" }, { status: 403 });
  }

  // Fetch all quote_drafts for this help request (not just the accepted provider)
  const { data: quotes } = await db
    .from("quote_drafts")
    .select("*, quote_line_items(*)")
    .eq("help_request_id", helpRequestId)
    .order("created_at", { ascending: false });

  // Fetch provider profiles
  const providerIds = [...new Set((quotes ?? []).map((q) => q.provider_id))];
  const profilesMap = new Map<string, { full_name: string | null; avatar_url: string | null }>();

  if (providerIds.length > 0) {
    const { data: profiles } = await db
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", providerIds);

    for (const p of profiles ?? []) {
      profilesMap.set(p.id, { full_name: p.full_name, avatar_url: p.avatar_url });
    }
  }

  const enriched = (quotes ?? []).map((q) => {
    const provider = profilesMap.get(q.provider_id);
    return {
      ...q,
      provider_name: provider?.full_name ?? "Unknown",
      provider_avatar: provider?.avatar_url ?? null,
      is_from_accepted_provider: helpRequest.accepted_provider_id === q.provider_id,
    };
  });

  return NextResponse.json({
    ok: true,
    quotes: enriched,
    help_request_title: helpRequest.title,
  });
}

export const GET = withErrorHandling(getHandler, "quotes:for-request");
