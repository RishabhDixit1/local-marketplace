import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

export const runtime = "nodejs";

// PATCH /api/posts/manage — edit or archive a post
export async function PATCH(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const { userId } = authResult.auth;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ ok: false, message: "Invalid JSON body" }, { status: 400 });
  }

  if (!body || typeof body !== "object") {
    return NextResponse.json({ ok: false, message: "Body must be an object" }, { status: 400 });
  }

  const { postId, action, title, details, category, budget } = body as Record<string, unknown>;

  if (typeof postId !== "string" || !postId) {
    return NextResponse.json({ ok: false, message: "postId is required" }, { status: 400 });
  }

  if (action !== "edit" && action !== "archive") {
    return NextResponse.json({ ok: false, message: "action must be 'edit' or 'archive'" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }

  // Verify ownership before modifying
  const { data: post, error: fetchError } = await db
    .from("posts")
    .select("id, owner_id, type")
    .eq("id", postId)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ ok: false, message: "Post not found" }, { status: 404 });
  }

  if (post.owner_id !== userId) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  if (action === "archive") {
    const { error } = await db
      .from("posts")
      .update({ status: "archived" })
      .eq("id", postId)
      .eq("owner_id", userId);

    if (error) {
      return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
    }
    return NextResponse.json({ ok: true });
  }

  // action === "edit"
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof title === "string" && title.trim()) updates.title = title.trim();
  if (typeof details === "string") updates.details = details.trim();
  if (typeof category === "string" && category.trim()) updates.category = category.trim();
  if (typeof budget === "number" && budget >= 0) updates.budget_max = budget;

  const { error } = await db
    .from("posts")
    .update(updates)
    .eq("id", postId)
    .eq("owner_id", userId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}

// DELETE /api/posts/manage — permanently delete a post
export async function DELETE(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }
  const { userId } = authResult.auth;

  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");

  if (!postId) {
    return NextResponse.json({ ok: false, message: "postId is required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }

  // Verify ownership
  const { data: post, error: fetchError } = await db
    .from("posts")
    .select("id, owner_id")
    .eq("id", postId)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ ok: false, message: "Post not found" }, { status: 404 });
  }

  if (post.owner_id !== userId) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  const { error } = await db
    .from("posts")
    .delete()
    .eq("id", postId)
    .eq("owner_id", userId);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  return NextResponse.json({ ok: true });
}
