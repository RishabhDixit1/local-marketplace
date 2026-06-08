import type { SupabaseClient } from "@supabase/supabase-js";
import { registerJobHandler } from "./backgroundJobs";
import { sendPushToUser } from "./pushNotifications";

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
