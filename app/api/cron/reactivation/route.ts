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

  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString();

  let reactivated = 0;

  // --- Re-activate idle providers ---
  // Providers with no completed orders in 30+ days, but who have been active before
  const { data: idleProviders } = await db
    .from("profiles")
    .select("id, full_name, name")
    .in("role", ["provider", "business"])
    .not("full_name", "is", null)
    .limit(50);

  const providerIds = (idleProviders ?? []).map((p) => p.id);

  if (providerIds.length > 0) {
    // Check which ones have recent completed orders
    const { data: recentOrders } = await db
      .from("orders")
      .select("provider_id")
      .eq("status", "completed")
      .gte("updated_at", thirtyDaysAgo)
      .in("provider_id", providerIds);

    const activeProviderIds = new Set((recentOrders ?? []).map((o) => o.provider_id));
    const trulyIdle = (idleProviders ?? []).filter((p) => !activeProviderIds.has(p.id));

    for (const provider of trulyIdle) {
      try {
        await sendPushToUser(db, provider.id, {
          title: "Your services are in demand!",
          body: "Customers are looking for providers like you. Update your listings to get more orders.",
          data: { type: "reactivation", role: "provider" },
        });

        if (RESEND_API_KEY) {
          const userResp = await db.auth.admin.getUserById(provider.id).catch(() => null);
          const email = (userResp as { data?: { user?: { email?: string } } } | null)?.data?.user?.email;
          if (email) {
            const name = provider.full_name || provider.name || "there";
            await fetch("https://api.resend.com/emails", {
              method: "POST",
              headers: {
                Authorization: `Bearer ${RESEND_API_KEY}`,
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                from: FROM_EMAIL,
                to: email,
                subject: "Customers are looking for you on ServiQ",
                html: [
                  `<div style="font-family:Inter,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">`,
                  `<h2 style="font-size:18px;font-weight:700;margin:0 0 12px">Hey ${name}, your skills are needed! 👋</h2>`,
                  `<p style="color:#475569">It's been a while since your last order on ServiQ. Local customers are actively looking for providers like you.</p>`,
                  `<p style="color:#475569">Update your service listings and availability to start getting new leads today.</p>`,
                  `<a href="${APP_URL}/dashboard" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none">Go to Dashboard</a>`,
                  `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">You received this because you're a registered provider on ServiQ.</div>`,
                  `</div>`,
                ].join(""),
              }),
            });
          }
        }

        // Log reactivation campaign
        await db.from("campaign_schedules").insert({
          provider_id: provider.id,
          campaign_type: "reactivation",
          title: "Provider reactivation",
          message_template: "Customers are looking for providers like you.",
          channel: "push",
          schedule_type: "immediate",
          is_active: false,
        });

        reactivated++;
      } catch (err) {
        console.error(`[reactivation] failed for provider ${provider.id}:`, err);
      }
    }
  }

  // --- Re-activate idle seekers ---
  // Seekers with no help requests in 30+ days
  const { data: recentSeekers } = await db
    .from("help_requests")
    .select("requester_id")
    .gte("created_at", thirtyDaysAgo);

  const activeSeekerIds = new Set((recentSeekers ?? []).map((r) => r.requester_id));

  const { data: seekers } = await db
    .from("profiles")
    .select("id, full_name, name")
    .eq("role", "seeker")
    .not("full_name", "is", null)
    .limit(50);

  for (const seeker of (seekers ?? [])) {
    if (activeSeekerIds.has(seeker.id)) continue;

    try {
      await sendPushToUser(db, seeker.id, {
        title: "Need help with something?",
        body: "Local providers are ready to help. Post a request and get quotes fast.",
        data: { type: "reactivation", role: "seeker" },
      });

      if (RESEND_API_KEY) {
        const userResp = await db.auth.admin.getUserById(seeker.id).catch(() => null);
        const email = (userResp as { data?: { user?: { email?: string } } } | null)?.data?.user?.email;
        if (email) {
          const name = seeker.full_name || seeker.name || "there";
          await fetch("https://api.resend.com/emails", {
            method: "POST",
            headers: {
              Authorization: `Bearer ${RESEND_API_KEY}`,
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              from: FROM_EMAIL,
              to: email,
              subject: "Need help with something around the house?",
              html: [
                `<div style="font-family:Inter,-apple-system,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px;color:#0f172a">`,
                `<h2 style="font-size:18px;font-weight:700;margin:0 0 12px">Hi ${name}, what do you need done? 🛠️</h2>`,
                `<p style="color:#475569">It's been a while since you last used ServiQ. Local providers are ready to help with repairs, services, and more.</p>`,
                `<p style="color:#475569">Post a request and get quotes from trusted providers near you.</p>`,
                `<a href="${APP_URL}/" style="display:inline-block;margin-top:16px;padding:12px 24px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none">Find Help Now</a>`,
                `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">You received this because you're registered on ServiQ.</div>`,
                `</div>`,
              ].join(""),
            }),
          });
        }
      }

      reactivated++;
    } catch (err) {
      console.error(`[reactivation] failed for seeker ${seeker.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, reactivated });
}

export const POST = withErrorHandling(postHandler, "cron:reactivation");
