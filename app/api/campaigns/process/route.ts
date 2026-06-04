import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { sendPushToUser } from "@/lib/server/pushNotifications";
import { sendSms } from "@/lib/server/twilioClient";
import { CronExpressionParser } from "cron-parser";

export const runtime = "nodejs";

const FROM_EMAIL = process.env.EMAIL_FROM ?? "noreply@serviqapp.com";
const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://serviqapp.com";

const parseCron = (expression: string): boolean => {
  try {
    const interval = CronExpressionParser.parse(expression);
    const prev = interval.prev();
    const diff = Date.now() - prev.getTime();
    return diff >= 0 && diff < 300_000;
  } catch {
    return false;
  }
};

export async function POST() {
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const { data: campaigns, error } = await db
    .from("campaign_schedules")
    .select("*")
    .eq("is_active", true)
    .limit(100);

  if (error) return NextResponse.json({ ok: false, message: error.message }, { status: 500 });
  if (!campaigns || campaigns.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const now = Date.now();
  let processed = 0;

  for (const campaign of campaigns as Array<Record<string, unknown>>) {
    if ((campaign.executions_count as number) >= (campaign.max_executions as number)) continue;
    if (campaign.starts_at && new Date(campaign.starts_at as string).getTime() > now) continue;
    if (campaign.ends_at && new Date(campaign.ends_at as string).getTime() < now) continue;

    const due = (() => {
      if (campaign.schedule_type === "immediate") return false;
      if (campaign.schedule_type === "delay" && campaign.delay_minutes) {
        const lastRun = campaign.last_executed_at
          ? new Date(campaign.last_executed_at as string).getTime()
          : new Date(campaign.created_at as string).getTime();
        return now - lastRun >= (campaign.delay_minutes as number) * 60_000;
      }
      if (campaign.schedule_type === "cron" && campaign.cron_expression) {
        return parseCron(campaign.cron_expression as string);
      }
      return false;
    })();

    if (!due) continue;

    const providerId = campaign.provider_id as string;
    const template = campaign.message_template as string;
    const title = campaign.title as string;
    const channel = (campaign.channel as string) || "push";

    try {
      const userId = providerId;

      if (channel === "push") {
        const result = await sendPushToUser(db, userId, {
          title,
          body: template,
          data: {
            campaign_id: campaign.id as string,
            campaign_type: campaign.campaign_type as string,
          },
        });
        if (result.sent === 0) {
          console.warn(`[campaign] push to ${userId} had no deliveries`);
        }
      }

      if (channel === "email" && RESEND_API_KEY) {
        const userResp = await db.auth.admin.getUserById(userId).catch(() => null);
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
              subject: title,
              html: `<div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:32px 24px"><p>${template}</p><p><a href="${APP_URL}/dashboard">Go to Dashboard</a></p></div>`,
            }),
          });
        }
      }

      if (channel === "sms") {
        const { data: profile } = await db
          .from("profiles")
          .select("phone")
          .eq("id", userId)
          .maybeSingle<{ phone: string | null }>();

        if (profile?.phone) {
          await sendSms(profile.phone, `${title}: ${template}`);
        }
      }

      if (channel === "whatsapp") {
        const { data: profile } = await db
          .from("profiles")
          .select("phone")
          .eq("id", userId)
          .maybeSingle<{ phone: string | null }>();

        if (profile?.phone) {
          const twilioModule = await import("@/lib/server/twilioClient");
          await twilioModule.sendWhatsApp(profile.phone, `${title}: ${template}`);
        }
      }

      await db.from("campaign_schedules").update({
        executions_count: ((campaign.executions_count as number) || 0) + 1,
        last_executed_at: new Date().toISOString(),
      }).eq("id", campaign.id as string);

      processed++;
    } catch (err) {
      console.error(`[campaign] execution failed for ${campaign.id}:`, err);
    }
  }

  return NextResponse.json({ ok: true, processed });
}
