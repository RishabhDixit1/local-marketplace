import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const { data: widget, error } = await db
    .from("widget_embeds")
    .select("provider_id, config")
    .eq("id", id)
    .eq("is_active", true)
    .maybeSingle();

  if (error || !widget) {
    return NextResponse.json({ ok: false, message: "Widget not found" }, { status: 404 });
  }

  const providerId = widget.provider_id;
  const widgetConfig = (widget.config as Record<string, unknown>) || {};

  const { data: profile } = await db
    .from("profiles")
    .select("id, full_name, avatar_url, locality, bio, trust_score, average_rating, zip")
    .eq("id", providerId)
    .maybeSingle();

  if (!profile) {
    return NextResponse.json({ ok: false, message: "Provider not found" }, { status: 404 });
  }

  const { count: servicesCount } = await db
    .from("provider_services")
    .select("*", { count: "exact", head: true })
    .eq("provider_id", providerId);

  return NextResponse.json({
    ok: true,
    provider: {
      id: profile.id,
      name: profile.full_name,
      avatar: profile.avatar_url,
      locality: profile.locality,
      bio: profile.bio,
      trustScore: profile.trust_score,
      rating: profile.average_rating,
      zip: profile.zip,
      servicesCount: servicesCount || 0,
    },
    config: widgetConfig,
  });
}
