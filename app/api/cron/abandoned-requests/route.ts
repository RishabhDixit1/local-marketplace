import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { withErrorHandling } from "@/lib/server/errorHandler";
import { verifyCronSecret, cronAuthFailure } from "@/lib/server/requestAuth";

export const runtime = "nodejs";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@serviqapp.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://serviqapp.com";

async function postHandler(request: Request) {
  if (!verifyCronSecret(request)) return cronAuthFailure();
  if (!RESEND_API_KEY) {
    return NextResponse.json({ ok: false, message: "Resend not configured" }, { status: 500 });
  }

  const db = createSupabaseAdminClient();
  if (!db) {
    return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });
  }

  const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

  const { data: requests, error } = await db
    .from("help_requests")
    .select("id,title,requester_id,created_at")
    .eq("status", "open")
    .lt("created_at", cutoff)
    .limit(50);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (!requests || requests.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const req of requests as Array<{ id: string; title: string | null; requester_id: string; created_at: string }>) {
    try {
      const userResp = await db.auth.admin.getUserById(req.requester_id).catch(() => null);
      const email = (userResp as { data?: { user?: { email?: string } } } | null)?.data?.user?.email;
      if (!email) { failed++; continue; }

      const name = ((userResp as { data?: { user?: { user_metadata?: Record<string, unknown> } } } | null)
        ?.data?.user?.user_metadata?.name as string | undefined) ?? "there";

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: `Need help with "${req.title || "your request"}"?`,
          html: [
            `<div style="font-family:Inter,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">`,
            `<h2 style="font-size:18px;font-weight:700;margin:0 0 12px">Still need help? 🙌</h2>`,
            `<p style="color:#475569;margin:0 0 8px">Hi ${name},</p>`,
            `<p style="color:#475569">You posted a request for <strong>${req.title || "help"}</strong> over 24 hours ago and it hasn't been matched yet. Don't worry — providers are still able to respond.</p>`,
            `<p style="color:#475569">You can also browse available providers directly:</p>`,
            `<a href="${APP_URL}/dashboard/providers" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none">Browse Providers</a>`,
            `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">You received this because you posted a help request on ServiQ.</div>`,
            `</div>`,
          ].join(""),
        }),
      });

      if (res.ok) sent++;
      else failed++;
    } catch {
      failed++;
    }
  }

  return NextResponse.json({ ok: true, sent, failed });
}

export const POST = withErrorHandling(postHandler, "cron:abandoned-requests");
