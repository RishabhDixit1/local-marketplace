import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

export async function GET(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  const { data, error } = await db.from("workspace_branches").select("*").eq("workspace_id", workspaceId).order("name");
  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true, branches: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
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
