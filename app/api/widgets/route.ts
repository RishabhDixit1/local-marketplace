import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

export async function GET(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const url = new URL(request.url);
  const widgetId = url.searchParams.get("id");

  if (widgetId) {
    const { data, error } = await db.from("widget_embeds").select("*").eq("id", widgetId).eq("provider_id", auth.auth.userId).single();
    if (error) return toError(404, "NOT_FOUND", "Widget not found.");
    return NextResponse.json({ ok: true, widget: data });
  }

  const { data, error } = await db.from("widget_embeds").select("*").eq("provider_id", auth.auth.userId).order("created_at", { ascending: false });
  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true, widgets: data });
}

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { widget_type?: string; allowed_domains?: string[] };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }

  const { data, error } = await db.from("widget_embeds").insert({
    provider_id: auth.auth.userId,
    widget_type: body.widget_type || "profile",
    allowed_domains: body.allowed_domains || [],
  }).select().single();

  if (error) return toError(400, "DB", error.message);

  const embedBaseUrl = process.env.NEXT_PUBLIC_APP_URL || "https://serviq.app";
  const embedCode = `<div id="serviq-widget-${data.id}" data-widget-id="${data.id}" data-provider="${auth.auth.userId}"></div>
<script src="${embedBaseUrl}/embed.js" async defer></script>`;

  await db.from("widget_embeds").update({ embed_code: embedCode }).eq("id", data.id);

  return NextResponse.json({ ok: true, widget: { ...data, embed_code: embedCode } });
}
