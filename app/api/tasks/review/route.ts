import { NextResponse } from "next/server";
import { requireRequestAuth } from "@/lib/server/requestAuth";
import { createSupabaseAdminClient, createSupabaseUserServerClient } from "@/lib/server/supabaseClients";
import { sendOrderEmail, shouldSkipOrderEmail } from "@/lib/email";

export const runtime = "nodejs";

const toError = (status: number, code: string, message: string) =>
  NextResponse.json({ ok: false, code, message }, { status });

export async function POST(request: Request) {
  const auth = await requireRequestAuth(request);
  if (!auth.ok) return toError(401, "UNAUTHORIZED", auth.message);

  const db = createSupabaseAdminClient() || createSupabaseUserServerClient(auth.auth.accessToken);
  if (!db) return toError(500, "CONFIG", "No DB client");

  let body: { taskId: string; rating: number; comment?: string };
  try {
    body = await request.json();
  } catch {
    return toError(400, "INVALID_PAYLOAD", "Invalid JSON.");
  }

  const taskId = body.taskId?.trim();
  const rating = Math.max(1, Math.min(5, Math.round(body.rating || 0)));
  const comment = body.comment?.trim() || null;

  if (!taskId) {
    return toError(400, "INVALID_PAYLOAD", "taskId is required.");
  }

  const { data: order, error: orderError } = await db
    .from("orders")
    .select("id,provider_id,consumer_id,status,listing_type,metadata")
    .eq("id", taskId)
    .maybeSingle<{
      id: string;
      provider_id: string | null;
      consumer_id: string | null;
      status: string | null;
      listing_type: string | null;
      metadata: Record<string, unknown> | null;
    }>();

  if (orderError) {
    return toError(500, "DB", orderError.message);
  }

  if (!order) {
    return toError(404, "NOT_FOUND", "Order not found.");
  }

  const providerId = order.provider_id;
  if (!providerId) {
    return toError(400, "NO_TARGET", "This order does not have a provider to review.");
  }

  if (providerId === auth.auth.userId) {
    return toError(400, "SELF_REVIEW", "You cannot review yourself.");
  }

  const metadata = {
    task_id: taskId,
    task_source: "order",
    order_id: taskId,
    help_request_id: null,
  };

  const { error: insertError } = await db.from("reviews").insert({
    provider_id: providerId,
    reviewer_id: auth.auth.userId,
    rating,
    comment,
    metadata,
  });

  if (insertError) return toError(500, "DB", insertError.message);

  void (async () => {
    try {
      const skip = await shouldSkipOrderEmail(providerId);
      if (skip) return;
      const admin = createSupabaseAdminClient();
      if (admin && providerId) {
        const { data: providerUser } = await admin.auth.admin.getUserById(providerId);
        const email = providerUser?.user?.email;
        const title = (order.metadata?.title as string | undefined) ?? "Task";
        if (email) {
          await sendOrderEmail({
            type: "review_received",
            to: email,
            recipientName: (providerUser.user?.user_metadata?.name as string | undefined) ?? "there",
            orderId: taskId,
            itemTitle: title,
            rating,
            reviewComment: comment ?? undefined,
          });
        }
      }
    } catch (err) {
      console.error("[task-review-email] failed", err);
    }
  })();

  return NextResponse.json({ ok: true });
}
