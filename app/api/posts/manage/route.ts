import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { invalidateUserFeed } from "@/lib/cache/invalidation";

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
    .select("id, owner_id, user_id, author_id, created_by, requester_id, provider_id, type, status, metadata")
    .eq("id", postId)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ ok: false, message: "Post not found" }, { status: 404 });
  }

  const ownerIds = [
    post.owner_id,
    post.user_id,
    post.author_id,
    post.created_by,
    post.requester_id,
    post.provider_id,
  ].filter(Boolean);

  if (!ownerIds.includes(userId)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  if (action === "archive") {
    // Try the RPC for proper transition + history tracking
    const { data: result, error: rpcError } = await db.rpc("transition_post_status", {
      p_post_id: postId,
      p_new_status: "archived",
      p_actor_id: userId,
    });

    if (rpcError) {
      const msg = rpcError.message || "";
      // RPC doesn't exist yet (migration not applied) — fall back to direct update
      if (msg.includes("function") && msg.includes("does not exist")) {
        const { error: fallbackErr } = await db
          .from("posts")
          .update({ status: "archived", updated_at: new Date().toISOString() })
          .eq("id", postId);
        if (fallbackErr) {
          return NextResponse.json({ ok: false, message: fallbackErr.message }, { status: 500 });
        }
        invalidateUserFeed(userId).catch(() => {});
        return NextResponse.json({ ok: true });
      }
      return NextResponse.json({ ok: false, message: msg }, { status: 500 });
    }

    const resultObj = result as { ok?: boolean; message?: string } | null;
    if (!resultObj?.ok) {
      return NextResponse.json(
        { ok: false, message: resultObj?.message || "Archive failed" },
        { status: 400 },
      );
    }

    invalidateUserFeed(userId).catch(() => {});
    return NextResponse.json({ ok: true });
  }

  // action === "edit"
  const updates: Record<string, unknown> = { updated_at: new Date().toISOString() };
  if (typeof title === "string" && title.trim()) updates.title = title.trim();
  if (typeof details === "string") updates.description = details.trim();
  if (typeof category === "string" && category.trim()) updates.category = category.trim();
  if (typeof budget === "number" && budget >= 0) {
    const currentMetadata =
      post.metadata && typeof post.metadata === "object" && !Array.isArray(post.metadata)
        ? (post.metadata as Record<string, unknown>)
        : {};
    updates.metadata = { ...currentMetadata, budget };
  }

  const { data: updated, error } = await db
    .from("posts")
    .update(updates)
    .eq("id", postId)
    .select("id")
    .maybeSingle();

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (!updated) {
    return NextResponse.json({ ok: false, message: "Post not found or not editable." }, { status: 404 });
  }

  invalidateUserFeed(userId).catch(() => {});
  return NextResponse.json({ ok: true });
}

// DELETE /api/posts/manage — soft-delete a post (sets status = 'deleted')
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
    .select("id, owner_id, user_id, author_id, created_by, requester_id, provider_id")
    .eq("id", postId)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ ok: false, message: "Post not found" }, { status: 404 });
  }

  const ownerIds = [
    post.owner_id,
    post.user_id,
    post.author_id,
    post.created_by,
    post.requester_id,
    post.provider_id,
  ].filter(Boolean);

  if (!ownerIds.includes(userId)) {
    return NextResponse.json({ ok: false, message: "Forbidden" }, { status: 403 });
  }

  // Try the RPC for proper transition + history tracking
  const { data: result, error: rpcError } = await db.rpc("transition_post_status", {
    p_post_id: postId,
    p_new_status: "deleted",
    p_actor_id: userId,
  });

  if (rpcError) {
    const msg = rpcError.message || "";
    // RPC doesn't exist yet (migration not applied) — fall back to direct update
    if (msg.includes("function") && msg.includes("does not exist")) {
      const { error: fallbackErr } = await db
        .from("posts")
        .update({ status: "deleted", updated_at: new Date().toISOString() })
        .eq("id", postId);
      if (fallbackErr) {
        return NextResponse.json({ ok: false, message: fallbackErr.message }, { status: 500 });
      }
      invalidateUserFeed(userId).catch(() => {});
      return NextResponse.json({ ok: true });
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }

  const resultObj = result as { ok?: boolean; message?: string } | null;
  if (!resultObj?.ok) {
    return NextResponse.json(
      { ok: false, message: resultObj?.message || "Delete failed" },
      { status: 400 },
    );
  }

  invalidateUserFeed(userId).catch(() => {});
  return NextResponse.json({ ok: true });
}
