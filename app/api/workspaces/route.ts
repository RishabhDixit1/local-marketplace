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

  const { data, error } = await db
    .from("workspaces")
    .select(`
      *,
      workspace_members!inner(count)
    `)
    .or(`owner_id.eq.${auth.auth.userId},workspace_members.user_id.eq.${auth.auth.userId}`)
    .order("created_at", { ascending: false });

  if (error) return toError(500, "DB", error.message);

  return NextResponse.json({ ok: true, workspaces: data });
}

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { name: string; description?: string; business_type?: string };
  try { body = await request.json(); } catch { return toError(400, "INVALID_PAYLOAD", "Invalid JSON."); }

  if (!body.name?.trim()) return toError(400, "INVALID_PAYLOAD", "Name is required.");

  const slug = body.name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "workspace";

  const { data, error } = await db.from("workspaces").insert({
    owner_id: auth.auth.userId,
    name: body.name.trim(),
    slug,
    description: body.description?.trim(),
    business_type: body.business_type?.trim(),
  }).select().single();

  if (error) return toError(500, "DB", error.message);

  await db.from("workspace_members").insert({
    workspace_id: data.id,
    user_id: auth.auth.userId,
    role: "owner",
  });

  return NextResponse.json({ ok: true, workspace: data });
}
