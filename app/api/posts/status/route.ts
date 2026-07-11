import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { invalidateUserFeed } from "@/lib/cache/invalidation";
import { POST_STATUSES, type PostStatus } from "@/lib/postStatus";

export const runtime = "nodejs";

// POST /api/posts/status — transition a post's status via the transition_post_status RPC
export async function POST(request: Request) {
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

  const { postId, status } = body as Record<string, unknown>;

  if (typeof postId !== "string" || !postId) {
    return NextResponse.json({ ok: false, message: "postId is required" }, { status: 400 });
  }

  if (typeof status !== "string" || !(POST_STATUSES as readonly string[]).includes(status)) {
    return NextResponse.json(
      { ok: false, message: `status must be one of: ${POST_STATUSES.join(", ")}` },
      { status: 400 },
    );
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }

  // Verify the user owns the post before transitioning
  const { data: post, error: fetchError } = await db
    .from("posts")
    .select("id, owner_id, user_id, author_id, created_by, requester_id, provider_id, status")
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

  // Call the RPC function
  const { data: result, error: rpcError } = await db.rpc("transition_post_status", {
    p_post_id: postId,
    p_new_status: status,
    p_actor_id: userId,
  });

  if (rpcError) {
    const msg = rpcError.message || "";
    // RPC doesn't exist yet (migration not applied) — fall back to direct update
    if (msg.includes("function") && msg.includes("does not exist")) {
      const { error: fallbackErr } = await db
        .from("posts")
        .update({ status, updated_at: new Date().toISOString() })
        .eq("id", postId);
      if (fallbackErr) {
        return NextResponse.json({ ok: false, message: fallbackErr.message }, { status: 500 });
      }
      invalidateUserFeed(userId).catch(() => {});
      return NextResponse.json({ ok: true, postId, oldStatus: post.status, newStatus: status });
    }
    return NextResponse.json({ ok: false, message: msg }, { status: 500 });
  }

  const resultObj = result as { ok?: boolean; message?: string; newStatus?: string } | null;
  if (!resultObj?.ok) {
    return NextResponse.json(
      { ok: false, message: resultObj?.message || "Status transition failed" },
      { status: 400 },
    );
  }

  // Invalidate feed cache so both Dashboard and Profile reflect the change
  invalidateUserFeed(userId).catch(() => {});

  return NextResponse.json({
    ok: true,
    postId,
    oldStatus: post.status,
    newStatus: resultObj?.newStatus || status,
  });
}

// GET /api/posts/status?postId=xxx — fetch current status + history
export async function GET(request: Request) {
  const authResult = await requireRequestAuth(request);
  if (!authResult.ok) {
    return NextResponse.json({ ok: false, message: "Unauthorized" }, { status: 401 });
  }

  const url = new URL(request.url);
  const postId = url.searchParams.get("postId");

  if (!postId) {
    return NextResponse.json({ ok: false, message: "postId is required" }, { status: 400 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "Database unavailable" }, { status: 503 });
  }

  const { data: post, error: fetchError } = await db
    .from("posts")
    .select("id, status, updated_at")
    .eq("id", postId)
    .single();

  if (fetchError || !post) {
    return NextResponse.json({ ok: false, message: "Post not found" }, { status: 404 });
  }

  // Try to fetch lifecycle columns + history (may not exist if migration not applied)
  let history: unknown[] = [];
  try {
    const { data: h } = await db
      .from("post_status_history")
      .select("id, old_status, new_status, actor_id, created_at")
      .eq("post_id", postId)
      .order("created_at", { ascending: false })
      .limit(20);
    history = h || [];
  } catch {
    // post_status_history table doesn't exist yet
  }

  return NextResponse.json({
    ok: true,
    post: {
      id: post.id,
      status: post.status,
      updated_at: post.updated_at,
    },
    history,
  });
}
