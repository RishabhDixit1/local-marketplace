import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

const getDb = (accessToken: string) =>
  createSupabaseAdminClient() || createSupabaseUserServerClient(accessToken);

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;
  const db = getDb(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");
  const { data, error } = await db.from("workspace_assignment_rules").select("*").eq("workspace_id", workspaceId).order("priority");
  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true, rules: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;
  const db = getDb(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { name: string; category?: string; priority?: number; max_distance_km?: number; max_leads_per_member?: number; round_robin?: boolean; sla_minutes?: number };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.name?.trim()) return toError(400, "INVALID_PAYLOAD", "Name required.");

  const { data, error } = await db.from("workspace_assignment_rules").insert({
    workspace_id: workspaceId,
    name: body.name.trim(),
    category: body.category,
    priority: body.priority ?? 100,
    max_distance_km: body.max_distance_km,
    max_leads_per_member: body.max_leads_per_member ?? 10,
    round_robin: body.round_robin ?? true,
    sla_minutes: body.sla_minutes ?? 15,
  }).select().single();

  if (error) return toError(400, "DB", error.message);
  return NextResponse.json({ ok: true, rule: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;
  const db = getDb(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { ruleId: string; name?: string; category?: string; priority?: number; max_distance_km?: number; max_leads_per_member?: number; round_robin?: boolean; sla_minutes?: number; is_active?: boolean };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.ruleId) return toError(400, "INVALID_PAYLOAD", "ruleId required.");

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.category !== undefined) updates.category = body.category;
  if (body.priority !== undefined) updates.priority = body.priority;
  if (body.max_distance_km !== undefined) updates.max_distance_km = body.max_distance_km;
  if (body.max_leads_per_member !== undefined) updates.max_leads_per_member = body.max_leads_per_member;
  if (body.round_robin !== undefined) updates.round_robin = body.round_robin;
  if (body.sla_minutes !== undefined) updates.sla_minutes = body.sla_minutes;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data, error } = await db.from("workspace_assignment_rules").update(updates).eq("id", body.ruleId).eq("workspace_id", workspaceId).select().single();
  if (error) return toError(400, "DB", error.message);
  return NextResponse.json({ ok: true, rule: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;
  const db = getDb(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const url = new URL(request.url);
  const ruleId = url.searchParams.get("ruleId");
  if (!ruleId) return toError(400, "INVALID_PAYLOAD", "ruleId required.");

  const { error } = await db.from("workspace_assignment_rules").delete().eq("id", ruleId).eq("workspace_id", workspaceId);
  if (error) return toError(400, "DB", error.message);
  return NextResponse.json({ ok: true });
}
