import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { sendPushToUser } from "@/lib/server/pushNotifications";
import { withErrorHandling } from "@/lib/server/errorHandler";

export const runtime = "nodejs";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@serviqapp.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://serviqapp.com";

async function postHandler() {
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const now = new Date();
  const threeDaysAgo = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000).toISOString();
  const fourteenDaysAgo = new Date(now.getTime() - 14 * 24 * 60 * 60 * 1000).toISOString();

  // Fetch review requests that need a reminder
  const { data: requests, error } = await db
    .from("review_requests")
    .select("id, order_id, provider_id, requester_id, status, reminder_count, last_reminder_at, created_at")
    .eq("status", "sent")
    .lt("reminder_count", 3)
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  let reminded = 0;
  let expired = 0;

  for (const req of (requests ?? []) as Array<{
    id: string; order_id: string; provider_id: string; requester_id: string;
    status: string; reminder_count: number; last_reminder_at: string | null; created_at: string;
  }>) {
    try {
      // Expire requests older than 14 days
      if (req.created_at < fourteenDaysAgo) {
        await db.from("review_requests").update({ status: "expired" }).eq("id", req.id);
        expired++;
        continue;
      }

      // Check if a reminder is due (3+ days since last reminder or creation)
      const lastAction = req.last_reminder_at ?? req.created_at;
      if (lastAction >= threeDaysAgo) continue;

      // Send push notification to the requester (consumer)
      await sendPushToUser(db, req.requester_id, {
        title: "How was your experience?",
        body: "Please take a moment to leave a review for your recent service.",
        data: {
          order_id: req.order_id,
          review_request_id: req.id,
          type: "review_reminder",
        },
      });

      // Send email reminder if Resend is configured
      if (RESEND_API_KEY) {
        try {
          const userResp = await db.auth.admin.getUserById(req.requester_id).catch(() => null);
          const email = (userResp as { data?: { user?: { email?: string } } } | null)?.data?.user?.email;
          if (email) {
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: FROM_EMAIL,
                to: email,
                subject: "How was your experience?",
                html: [
                  `<div style="font-family:Inter,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">`,
                  `<h2 style="font-size:18px;font-weight:700;margin:0 0 12px">We'd love your feedback!</h2>`,
                  `<p style="color:#475569">You recently had a service completed on ServiQ. Please take a moment to leave a review — it helps the provider and the community.</p>`,
                  `<a href="${APP_URL}/orders/${req.order_id}" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none">Leave a Review</a>`,
                  `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">You received this because you had an order on ServiQ.</div>`,
                  `</div>`,
                ].join(""),
              }),
            });
          }
        } catch {
          // email failure is non-fatal
        }
      }

      await db.from("review_requests").update({
        reminder_count: req.reminder_count + 1,
        last_reminder_at: now.toISOString(),
      }).eq("id", req.id);

      reminded++;
    } catch (err) {
      console.error(`[review-reminders] failed for ${req.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, reminded, expired });
}

export const POST = withErrorHandling(postHandler, "cron:review-reminders");
