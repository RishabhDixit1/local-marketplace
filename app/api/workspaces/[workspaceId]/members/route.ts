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

  const { data, error } = await db
    .from("workspace_members")
    .select("*, profiles!inner(id, full_name, avatar_url, email, phone)")
    .eq("workspace_id", workspaceId)
    .order("joined_at", { ascending: true });

  if (error) return toError(500, "DB", error.message);
  return NextResponse.json({ ok: true, members: data });
}

export async function POST(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { userId: string; role?: string };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.userId) return toError(400, "INVALID_PAYLOAD", "userId required.");

  // Check seat limit
  const { data: workspace } = await db
    .from("workspaces")
    .select("max_members")
    .eq("id", workspaceId)
    .single<{ max_members: number }>();
  if (!workspace) return toError(404, "NOT_FOUND", "Workspace not found.");

  const { count } = await db
    .from("workspace_members")
    .select("id", { count: "exact", head: true })
    .eq("workspace_id", workspaceId)
    .eq("is_active", true);
  if (count != null && count >= workspace.max_members) {
    return toError(403, "SEAT_LIMIT", `Workspace seat limit (${workspace.max_members}) reached. Upgrade to add more members.`);
  }

  const { data, error } = await db.from("workspace_members").insert({
    workspace_id: workspaceId,
    user_id: body.userId,
    role: body.role || "member",
  }).select("*, profiles!inner(id, full_name, avatar_url)").single();

  if (error) return toError(400, "DB", error.message);

  await db.from("workspace_activity_log").insert({
    workspace_id: workspaceId,
    member_id: data.id,
    action: "member_added",
    entity_type: "workspace_member",
    entity_id: data.id,
    description: `Member added to workspace`,
  });

  return NextResponse.json({ ok: true, member: data });
}

export async function PATCH(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { memberId: string; role?: string; is_active?: boolean };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }
  if (!body.memberId) return toError(400, "INVALID_PAYLOAD", "memberId required.");

  const updates: Record<string, unknown> = {};
  if (body.role) updates.role = body.role;
  if (body.is_active !== undefined) updates.is_active = body.is_active;

  const { data, error } = await db.from("workspace_members").update(updates).eq("id", body.memberId).eq("workspace_id", workspaceId).select().single();
  if (error) return toError(400, "DB", error.message);

  return NextResponse.json({ ok: true, member: data });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ workspaceId: string }> }) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);
  const { workspaceId } = await params;
  const url = new URL(request.url);
  const memberId = url.searchParams.get("memberId");
  if (!memberId) return toError(400, "INVALID_PAYLOAD", "memberId required.");

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  await db.from("workspace_members").delete().eq("id", memberId).eq("workspace_id", workspaceId);
  return NextResponse.json({ ok: true });
}
