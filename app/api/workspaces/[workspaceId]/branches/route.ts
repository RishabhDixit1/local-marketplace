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
  const { data, error } = await db.from("workspace_branches").select("*").eq("workspace_id", workspaceId).order("name");
  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true, branches: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;
  const db = getDb(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { name: string; address?: string; phone?: string; email?: string; latitude?: number; longitude?: number; service_area_radius_km?: number };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.name?.trim()) return toError(400, "INVALID_PAYLOAD", "Name required.");

  const { data, error } = await db.from("workspace_branches").insert({
    workspace_id: workspaceId,
    name: body.name.trim(),
    address: body.address?.trim(),
    phone: body.phone?.trim(),
    email: body.email?.trim(),
    latitude: body.latitude,
    longitude: body.longitude,
    service_area_radius_km: body.service_area_radius_km || 5,
  }).select().single();

  if (error) return toError(400, "DB", error.message);
  return NextResponse.json({ ok: true, branch: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;
  const db = getDb(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { branchId: string; name?: string; address?: string; phone?: string; email?: string; latitude?: number; longitude?: number; service_area_radius_km?: number; is_active?: boolean };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.branchId) return toError(400, "INVALID_PAYLOAD", "branchId required.");

  const updates: Record<string, unknown> = {};
  if (body.name !== undefined) updates.name = body.name.trim();
  if (body.address !== undefined) updates.address = body.address?.trim() ?? null;
  if (body.phone !== undefined) updates.phone = body.phone?.trim() ?? null;
  if (body.email !== undefined) updates.email = body.email?.trim() ?? null;
  if (body.latitude !== undefined) updates.latitude = body.latitude;
  if (body.longitude !== undefined) updates.longitude = body.longitude;
  if (body.service_area_radius_km !== undefined) updates.service_area_radius_km = body.service_area_radius_km;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data, error } = await db.from("workspace_branches").update(updates).eq("id", body.branchId).eq("workspace_id", workspaceId).select().single();
  if (error) return toError(400, "DB", error.message);
  return NextResponse.json({ ok: true, branch: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;
  const db = getDb(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const url = new URL(request.url);
  const branchId = url.searchParams.get("branchId");
  if (!branchId) return toError(400, "INVALID_PAYLOAD", "branchId required.");

  const { error } = await db.from("workspace_branches").delete().eq("id", branchId).eq("workspace_id", workspaceId);
  if (error) return toError(400, "DB", error.message);
  return NextResponse.json({ ok: true });
}
