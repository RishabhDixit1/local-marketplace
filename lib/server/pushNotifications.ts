import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
};

type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
};

let vapidConfigured = false;

const configureVapid = () => {
  if (vapidConfigured) return true;

  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim();
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim();
  const email = process.env.VAPID_EMAIL?.trim();

  if (!publicKey || !privateKey || !email) return false;

  webpush.setVapidDetails(`mailto:${email}`, publicKey, privateKey);
  vapidConfigured = true;
  return true;
};

export const sendPushToUser = async (
  db: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> => {
  if (!configureVapid()) return { sent: 0, failed: 0 };

  const { data, error } = await db
    .from("provider_push_subscriptions")
    .select("endpoint, p256dh, auth")
    .eq("provider_id", userId);

  if (error || !data?.length) return { sent: 0, failed: 0 };

  const subs = data as PushSubscriptionRow[];
  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          body
        );
        sent++;
      } catch (err) {
        failed++;
        // Remove expired/invalid subscriptions (410 Gone = unsubscribed)
        if (err instanceof Error && "statusCode" in err && (err as { statusCode: number }).statusCode === 410) {
          await db
            .from("provider_push_subscriptions")
            .delete()
            .eq("provider_id", userId)
            .eq("endpoint", sub.endpoint);
        }
      }
    })
  );

  return { sent, failed };
};

export const sendPushToMatchedProviders = async (
  db: SupabaseClient,
  helpRequestId: string,
  requestTitle: string
): Promise<{ sent: number; failed: number }> => {
  if (!configureVapid()) return { sent: 0, failed: 0 };

  const { data, error } = await db
    .from("help_request_matches")
    .select("provider_id")
    .eq("help_request_id", helpRequestId)
    .eq("status", "open")
    .limit(30);

  if (error || !data?.length) return { sent: 0, failed: 0 };

  const providerIds = (data as { provider_id: string }[]).map((row) => row.provider_id);
  const results = await Promise.all(
    providerIds.map((userId) =>
      sendPushToUser(db, userId, {
        title: "New request nearby",
        body: requestTitle || "Someone nearby needs help. Open ServiQ to accept.",
        data: {
          url: `/dashboard/tasks?tab=inbox&focus=${helpRequestId}`,
          help_request_id: helpRequestId,
        },
      })
    )
  );

  return results.reduce(
    (acc, r) => ({ sent: acc.sent + r.sent, failed: acc.failed + r.failed }),
    { sent: 0, failed: 0 }
  );
};
