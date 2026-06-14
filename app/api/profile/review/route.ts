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

  let body: { providerId: string; rating: number; comment?: string; metadata?: Record<string, unknown> };
  try {
    body = await request.json();
  } catch {
    return toError(400, "INVALID_PAYLOAD", "Invalid JSON.");
  }

  const providerId = body.providerId?.trim();
  const rating = Math.max(1, Math.min(5, Math.round(body.rating || 0)));
  const comment = body.comment?.trim() || null;
  const metadata = body.metadata ?? null;

  if (!providerId) {
    return toError(400, "INVALID_PAYLOAD", "providerId is required.");
  }

  if (providerId === auth.auth.userId) {
    return toError(400, "SELF_REVIEW", "You cannot review yourself.");
  }

  const insertPayload: Record<string, unknown> = {
    provider_id: providerId,
    reviewer_id: auth.auth.userId,
    rating,
    comment,
  };
  if (metadata != null) insertPayload.metadata = metadata;

  const { data: inserted, error } = await db.from("reviews").insert(insertPayload).select("id").single();

  if (error) return toError(500, "DB", error.message);

  void (async () => {
    try {
      const skip = await shouldSkipOrderEmail(providerId);
      if (skip) return;
      const admin = createSupabaseAdminClient();
      if (admin) {
        const { data: providerUser } = await admin.auth.admin.getUserById(providerId);
        const email = providerUser?.user?.email;
        if (email) {
          await sendOrderEmail({
            type: "review_received",
            to: email,
            recipientName: (providerUser.user?.user_metadata?.name as string | undefined) ?? "there",
            orderId: "",
            itemTitle: "Profile review",
            rating,
            reviewComment: comment ?? undefined,
          });
        }
      }
    } catch (err) {
      console.error("[profile-review-email] failed", err);
    }
  })();

  return NextResponse.json({ ok: true, reviewId: inserted?.id });
}
