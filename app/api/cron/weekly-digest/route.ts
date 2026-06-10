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

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString();

  const { data: newProviders, error } = await db
    .from("profiles")
    .select("id,full_name,name,location,category")
    .eq("role", "provider")
    .gte("created_at", sevenDaysAgo)
    .limit(100);

  if (error) {
    return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  }

  if (!newProviders || newProviders.length === 0) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  const providersByLocation: Record<string, Array<{ name: string; location: string | null }>> = {};
  for (const p of newProviders as Array<{ id: string; full_name: string | null; name: string | null; location: string | null; category: string | null }>) {
    const loc = (p.location || "nearby").toLowerCase();
    if (!providersByLocation[loc]) providersByLocation[loc] = [];
    providersByLocation[loc].push({ name: p.full_name || p.name || "A new provider", location: p.location });
  }

  const { data: seekers } = await db
    .from("profiles")
    .select("id,location")
    .eq("role", "seeker")
    .limit(500);

  if (!seekers) {
    return NextResponse.json({ ok: true, sent: 0 });
  }

  let sent = 0;
  let failed = 0;

  for (const seeker of seekers as Array<{ id: string; location: string | null }>) {
    const seekerLoc = (seeker.location || "").toLowerCase();
    const relevantProviders = providersByLocation[seekerLoc] || [];
    if (relevantProviders.length === 0) continue;

    try {
      const userResp = await db.auth.admin.getUserById(seeker.id).catch(() => null);
      const email = (userResp as { data?: { user?: { email?: string } } } | null)?.data?.user?.email;
      if (!email) { failed++; continue; }

      const name = ((userResp as { data?: { user?: { user_metadata?: Record<string, unknown> } } } | null)
        ?.data?.user?.user_metadata?.name as string | undefined) ?? "there";
      const providerList = relevantProviders.slice(0, 5).map((p) =>
        `<li style="margin:4px 0">${p.name}${p.location ? ` — ${p.location}` : ""}</li>`
      ).join("");

      const res = await fetch("https://api.resend.com/emails", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${RESEND_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          from: FROM_EMAIL,
          to: email,
          subject: `New providers in your area this week — ServiQ`,
          html: [
            `<div style="font-family:Inter,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">`,
            `<h2 style="font-size:18px;font-weight:700;margin:0 0 12px">New providers this week 🎉</h2>`,
            `<p style="color:#475569;margin:0 0 8px">Hi ${name},</p>`,
            `<p style="color:#475569">We found <strong>${relevantProviders.length} new provider${relevantProviders.length === 1 ? "" : "s"}</strong> in your area this week:</p>`,
            `<ul style="color:#475569;padding-left:20px">${providerList}</ul>`,
            `<a href="${APP_URL}/dashboard/providers" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none">View All Providers</a>`,
            `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">You're receiving this weekly digest as a member of ServiQ. <a href="${APP_URL}/dashboard/settings" style="color:#2563eb">Unsubscribe</a></div>`,
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

export const POST = withErrorHandling(postHandler, "cron:weekly-digest");
