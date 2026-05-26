import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { sendPushToUser } from "@/lib/server/pushNotifications";
import * as cronParser from "cron-parser";

export const runtime = "nodejs";

const parseCron = (expression: string): boolean => {
  try {
    const interval = cronParser.parseExpression(expression);
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
      if (channel === "push") {
        const result = await sendPushToUser(db, providerId, {
          title,
          body: template,
          data: {
            campaign_id: campaign.id as string,
            campaign_type: campaign.campaign_type as string,
          },
        });
        if (result.sent === 0) {
          console.warn(`[campaign] push to ${providerId} had no deliveries`);
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
