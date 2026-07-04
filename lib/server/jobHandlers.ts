import type { SupabaseClient } from "@supabase/supabase-js";
import { registerJobHandler } from "./backgroundJobs";
import { sendPushToUser } from "./pushNotifications";
import { sendEventWhatsApp, sendBulkWhatsApp } from "./whatsappNotifications";

registerJobHandler("send-push", async (db: SupabaseClient, payload: Record<string, unknown>) => {
  const userId = payload.userId as string;
  if (!userId) throw new Error("Missing userId in push payload");

  await sendPushToUser(db, userId, {
    title: (payload.title as string) ?? "",
    body: (payload.body as string) ?? "",
    data: payload.data as Record<string, unknown> | undefined,
  });
});

registerJobHandler("send-push-to-many", async (db: SupabaseClient, payload: Record<string, unknown>) => {
  const userIds = payload.userIds as string[];
  const title = (payload.title as string) ?? "";
  const body = (payload.body as string) ?? "";
  const data = payload.data as Record<string, unknown> | undefined;

  if (!userIds?.length) throw new Error("Missing userIds in push-to-many payload");

  const results = await Promise.allSettled(
    userIds.map((userId) => sendPushToUser(db, userId, { title, body, data }))
  );

  const failed = results.filter((r) => r.status === "rejected").length;
  if (failed > 0) {
    console.warn(`[bg-jobs] send-push-to-many: ${failed}/${userIds.length} pushes failed`);
  }
});

registerJobHandler("send-whatsapp", async (db: SupabaseClient, payload: Record<string, unknown>) => {
  const event = payload.event as string;
  const userId = payload.userId as string;
  const role = payload.role as "consumer" | "provider";
  const details = payload.details as Record<string, string> | undefined;

  if (!event || !userId || !role) throw new Error("Missing event, userId, or role in WhatsApp payload");

  await sendEventWhatsApp(event as Parameters<typeof sendEventWhatsApp>[0], userId, role, details ?? {});
});

registerJobHandler("send-whatsapp-bulk", async (db: SupabaseClient, payload: Record<string, unknown>) => {
  const recipients = payload.recipients as { userId: string; role: "consumer" | "provider"; details: Record<string, string> }[] | undefined;
  const event = payload.event as string;

  if (!recipients?.length || !event) throw new Error("Missing recipients or event in bulk WhatsApp payload");

  await sendBulkWhatsApp(event as Parameters<typeof sendBulkWhatsApp>[0], recipients);
});
