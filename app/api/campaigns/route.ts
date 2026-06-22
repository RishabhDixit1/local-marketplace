import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { enqueueJob } from "@/lib/server/backgroundJobs";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

async function getHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const url = new URL(request.url);
  const status = url.searchParams.get("status");

  let query = db.from("campaign_schedules").select("*").eq("provider_id", auth.auth.userId);
  if (status) query = query.eq("is_active", status === "active");
  const { data, error } = await query.order("created_at", { ascending: false });

  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true, campaigns: data });
}

async function postHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: {
    campaign_type: string; title: string; message_template: string;
    channel?: string; schedule_type?: string; delay_minutes?: number;
    starts_at?: string; ends_at?: string;
  };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.campaign_type || !body.title || !body.message_template) {
    return toError(400, "INVALID_PAYLOAD", "campaign_type, title, and message_template required.");
  }

  const { data, error } = await db.from("campaign_schedules").insert({
    provider_id: auth.auth.userId,
    campaign_type: body.campaign_type,
    title: body.title,
    message_template: body.message_template,
    channel: body.channel || "push",
    schedule_type: body.schedule_type || "immediate",
    delay_minutes: body.delay_minutes,
    starts_at: body.starts_at,
    ends_at: body.ends_at,
  }).select().single();

  if (error) return toError(400, "DB", error.message);

  if (data.schedule_type === "immediate") {
    const titleExpr = data.title;
    await enqueueJob(db, "send-push", {
      userId: auth.auth.userId,
      title: titleExpr,
      body: data.message_template,
      data: { campaign_id: data.id, campaign_type: data.campaign_type },
    });

    await db.from("campaign_schedules").update({
      executions_count: 1,
      last_executed_at: new Date().toISOString(),
    }).eq("id", data.id);
  }

  return NextResponse.json({ ok: true, campaign: data });
}

async function patchHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { id: string; is_active?: boolean; [key: string]: unknown };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.id) return toError(400, "INVALID_PAYLOAD", "id required.");

  const updates: Record<string, unknown> = {};
  if (typeof body.is_active === "boolean") updates.is_active = body.is_active;

  const { data, error } = await db.from("campaign_schedules").update(updates).eq("id", body.id).eq("provider_id", auth.auth.userId).select().single();
  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true, campaign: data });
}

async function deleteHandler(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const url = new URL(request.url);
  const id = url.searchParams.get("id");
  if (!id) return toError(400, "INVALID_PAYLOAD", "id query param required.");

  const { error } = await db.from("campaign_schedules").delete().eq("id", id).eq("provider_id", auth.auth.userId);
  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true });
}

export const GET = withErrorHandling(getHandler, "campaigns:list");
export const POST = withErrorHandling(postHandler, "campaigns:create");
export const PATCH = withErrorHandling(patchHandler, "campaigns:update");
export const DELETE = withErrorHandling(deleteHandler, "campaigns:delete");
