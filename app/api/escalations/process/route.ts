import { NextResponse } from "next/server";
import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";
import { sendWhatsApp, sendSms } from "@/lib/server/twilioClient";
import { sendPushToUser } from "@/lib/server/pushNotifications";

export const runtime = "nodejs";

const buildMessage = (reason: string | null, helpRequestTitle: string | null): string => {
  if (reason === "no_immediate_match") {
    return `Your urgent service request "${helpRequestTitle || "Help request"}" hasn't been matched yet. We'll keep looking. Visit ServiQ to check status.`;
  }
  return `Update from ServiQ regarding your service request.`;
};

export async function POST() {
  const db = createSupabaseAdminClient();
  if (!db) return NextResponse.json({ ok: false, message: "No DB client" }, { status: 500 });

  const { data: pending, error: fetchError } = await db
    .from("notification_escalations")
    .select("*, help_requests!left(title)")
    .eq("status", "pending")
    .order("created_at", { ascending: true })
    .limit(20);

  if (fetchError) return NextResponse.json({ ok: false, message: fetchError.message }, { status: 500 });
  if (!pending || pending.length === 0) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  let processed = 0;
  let failed = 0;

  for (const escalation of pending as Array<{
    id: string; channel: string; target: string;
    attempt_count: number; help_request_id: string | null;
    metadata: Record<string, unknown> | null;
    help_requests: { title: string } | null;
  }>) {
    try {
      const reason = (escalation.metadata?.reason as string | null) || null;
      const helpRequestTitle = escalation.help_requests?.title || null;
      const message = buildMessage(reason, helpRequestTitle);

      if (escalation.channel === "whatsapp") {
        const result = await sendWhatsApp(escalation.target, message);
        if (!result.ok) throw new Error(result.error || "WhatsApp delivery failed");
      } else if (escalation.channel === "sms") {
        const result = await sendSms(escalation.target, message);
        if (!result.ok) throw new Error(result.error || "SMS delivery failed");
      } else if (escalation.channel === "push") {
        const result = await sendPushToUser(db, escalation.target, {
          title: "Urgent: No match found yet",
          body: message,
          data: {
            help_request_id: escalation.help_request_id,
            reason,
          },
        });
        if (result.sent === 0 && result.failed > 0) {
          console.warn(`[escalation] push to ${escalation.target} had no successful deliveries`);
        }
      }

      await db.from("notification_escalations").update({
        status: "sent",
        attempt_count: (escalation.attempt_count || 0) + 1,
      }).eq("id", escalation.id);

      processed++;
    } catch (err) {
      await db.from("notification_escalations").update({
        status: "failed",
        last_error: err instanceof Error ? err.message : "Delivery failed",
        attempt_count: (escalation.attempt_count || 0) + 1,
      }).eq("id", escalation.id);

      failed++;
    }
  }

  return NextResponse.json({ ok: true, processed, failed });
}
