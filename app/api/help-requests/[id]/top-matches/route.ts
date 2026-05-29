import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { requireRequestAuth } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: authResult.message }, { status: authResult.status });
  }

  const { id } = await params;

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, code: "CONFIG", message: "No DB client." }, { status: 500 });
  }

  const { data: matches, error } = await db
    .from("help_request_matches")
    .select("provider_id, score, created_at")
    .eq("help_request_id", id)
    .order("score", { ascending: false })
    .limit(3);

  if (error) {
    return NextResponse.json({ ok: false, code: "DB", message: error.message }, { status: 500 });
  }

  if (!matches || matches.length === 0) {
    return NextResponse.json({ ok: true, matches: [] });
  }

  const providerIds = (matches as Array<{ provider_id: string; score: number | null }>).map((m) => m.provider_id);

  const { data: profiles } = await db
    .from("profiles")
    .select("id,full_name,name,avatar_url,location,category,verification_status,trust_score")
    .in("id", providerIds);

  const profileMap = new Map(
    (profiles as Array<{
      id: string; full_name: string | null; name: string | null;
      avatar_url: string | null; location: string | null;
      category: string | null; verification_status: string | null;
      trust_score: number | null;
    }> | null)?.map((p) => [p.id, p]) ?? []
  );

  const topMatches = (matches as Array<{ provider_id: string; score: number | null; created_at: string }>).map((m) => {
    const profile = profileMap.get(m.provider_id);
    return {
      providerId: m.provider_id,
      score: m.score,
      name: profile?.full_name || profile?.name || "Unknown",
      avatarUrl: profile?.avatar_url,
      location: profile?.location,
      category: profile?.category,
      verificationStatus: profile?.verification_status,
      trustScore: profile?.trust_score,
    };
  });

  return NextResponse.json({ ok: true, matches: topMatches });
}
