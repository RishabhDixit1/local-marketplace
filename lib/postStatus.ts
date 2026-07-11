/**
 * Post status lifecycle — single source of truth.
 *
 * Statuses:
 *   open        → default, visible in public feed/matching
 *   matched     → provider accepted, visible only to matched parties
 *   in_progress → work started, tied to order lifecycle
 *   completed   → work finished, removed from feed, visible in My Work
 *   cancelled   → cancelled before completion, removed from feed
 *   archived    → soft-hide by owner, restorable from Profile
 *   deleted     → soft-delete, terminal
 *   hidden      → hidden from feed, restorable
 *   draft       → not yet published
 */

export const POST_STATUSES = [
  "open",
  "matched",
  "in_progress",
  "completed",
  "cancelled",
  "archived",
  "deleted",
  "hidden",
  "draft",
] as const;

export type PostStatus = (typeof POST_STATUSES)[number];

/**
 * Allowed transitions: source → Set<target>.
 * Terminal statuses (completed, deleted) have no outgoing transitions.
 */
const TRANSITIONS: Record<PostStatus, ReadonlySet<PostStatus>> = {
  open: new Set(["matched", "in_progress", "completed", "cancelled", "archived", "deleted", "hidden", "draft"]),
  matched: new Set(["in_progress", "completed", "cancelled", "open"]),
  in_progress: new Set(["completed", "cancelled"]),
  completed: new Set(), // terminal
  cancelled: new Set(["open", "archived", "deleted"]),
  archived: new Set(["open", "deleted"]),
  deleted: new Set(), // terminal
  hidden: new Set(["open", "deleted"]),
  draft: new Set(["open", "deleted"]),
};

/**
 * Returns true if the transition from `from` to `to` is allowed.
 */
export const canTransition = (from: PostStatus, to: PostStatus): boolean =>
  TRANSITIONS[from]?.has(to) ?? false;

/**
 * Statuses that are excluded from the public feed.
 * Feed queries should filter: WHERE status = 'open'
 */
export const FEED_VISIBLE_STATUSES: readonly PostStatus[] = ["open"];

/**
 * Statuses visible in a user's own Profile Marketplace tab.
 * Shows everything except cancelled and deleted (user can still see archived, matched, etc.)
 */
export const PROFILE_VISIBLE_STATUSES: readonly PostStatus[] = [
  "open",
  "matched",
  "in_progress",
  "completed",
  "archived",
  "hidden",
  "draft",
];

/**
 * Statuses visible in the My Work / Tasks section.
 */
export const MY_WORK_STATUSES: readonly PostStatus[] = [
  "matched",
  "in_progress",
  "completed",
];

/**
 * Closed statuses — used by feed/profile to filter out completed/cancelled/etc.
 * Kept in sync with communityData.ts isVisibleStatus and profile/public.ts isClosedStatus.
 */
export const CLOSED_STATUSES: ReadonlySet<string> = new Set([
  "cancelled",
  "canceled",
  "closed",
  "completed",
  "fulfilled",
  "archived",
  "deleted",
  "hidden",
]);

/**
 * Check if a status string is a "closed" status (excluded from public visibility).
 */
export const isClosedStatus = (status?: string | null): boolean =>
  CLOSED_STATUSES.has((status || "").trim().toLowerCase());

/**
 * Normalize a raw status string to a PostStatus, defaulting to 'open'.
 */
export const normalizePostStatus = (value?: string | null): PostStatus => {
  const normalized = (value || "").trim().toLowerCase() as string;
  return (POST_STATUSES as readonly string[]).includes(normalized)
    ? (normalized as PostStatus)
    : "open";
};

/**
 * Human-readable label for a post status.
 */
export const postStatusLabel = (status: PostStatus): string => {
  const labels: Record<PostStatus, string> = {
    open: "Open",
    matched: "Matched",
    in_progress: "In Progress",
    completed: "Completed",
    cancelled: "Cancelled",
    archived: "Archived",
    deleted: "Deleted",
    hidden: "Hidden",
    draft: "Draft",
  };
  return labels[status] ?? status;
};

/**
 * Tailwind class map for status badges.
 */
export const postStatusClasses = (status: PostStatus): string => {
  const classes: Record<PostStatus, string> = {
    open: "border-emerald-200 bg-emerald-50 text-emerald-700",
    matched: "border-blue-200 bg-blue-50 text-blue-700",
    in_progress: "border-amber-200 bg-amber-50 text-amber-700",
    completed: "border-slate-200 bg-slate-100 text-slate-600",
    cancelled: "border-rose-200 bg-rose-50 text-rose-600",
    archived: "border-slate-200 bg-slate-50 text-slate-500",
    deleted: "border-rose-200 bg-rose-50 text-rose-600",
    hidden: "border-slate-200 bg-slate-50 text-slate-500",
    draft: "border-slate-200 bg-slate-50 text-slate-500",
  };
  return classes[status] ?? classes.open;
};

/**
 * Maps order status to the corresponding post status transition.
 * Returns the target post status, or null if no post transition needed.
 */
export const orderStatusToPostStatus = (
  orderStatus: string | null | undefined,
): PostStatus | null => {
  const normalized = (orderStatus || "").toLowerCase();
  if (normalized === "accepted") return "matched";
  if (normalized === "in_progress") return "in_progress";
  if (normalized === "completed") return "completed";
  if (normalized === "cancelled" || normalized === "canceled") return "cancelled";
  return null;
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseDbClient = { from: (table: string) => any; rpc: (fn: string, args: Record<string, string>) => any };

/**
 * Transition the linked post status when an order status changes.
 * Uses the transition_post_status RPC for atomic DB-level transition.
 * Silently no-ops if the order has no post_id or the transition fails.
 */
export const transitionLinkedPostStatus = async (params: {
  db: SupabaseDbClient;
  orderId: string;
  newOrderStatus: string;
  actorId: string;
  postIdOverride?: string;
}): Promise<{ ok: boolean; postId?: string; newPostStatus?: PostStatus; message?: string }> => {
  const { db, orderId, newOrderStatus, actorId, postIdOverride } = params;

  const targetPostStatus = orderStatusToPostStatus(newOrderStatus);
  if (!targetPostStatus) return { ok: false, message: "No post transition for this order status" };

  let resolvedPostId: string = postIdOverride ?? "";

  if (!resolvedPostId) {
    const { data: order, error: fetchError } = await db
      .from("orders")
      .select("post_id")
      .eq("id", orderId)
      .single();

    if (fetchError || !order?.post_id) {
      return { ok: false, message: "Order has no linked post" };
    }
    resolvedPostId = order.post_id;
  }

  // Transition the post via RPC
  const { data: result, error: rpcError } = await db.rpc("transition_post_status", {
    p_post_id: resolvedPostId,
    p_new_status: targetPostStatus,
    p_actor_id: actorId,
  });

  if (rpcError) {
    const msg = String(rpcError);
    // RPC doesn't exist yet (migration not applied) — fall back to direct update
    if (msg.includes("function") && msg.includes("does not exist")) {
      const { error: fallbackErr } = await db
        .from("posts")
        .update({ status: targetPostStatus, updated_at: new Date().toISOString() })
        .eq("id", resolvedPostId);
      if (fallbackErr) {
        return { ok: false, message: String(fallbackErr) };
      }
      return {
        ok: true,
        postId: resolvedPostId,
        newPostStatus: targetPostStatus,
        message: "Applied via fallback (migration not yet deployed)",
      };
    }
    return { ok: false, message: msg };
  }

  const resultObj = result as { ok?: boolean; message?: string; newStatus?: string } | null;
  return {
    ok: resultObj?.ok ?? false,
    postId: resolvedPostId,
    newPostStatus: targetPostStatus,
    message: resultObj?.message,
  };
};
