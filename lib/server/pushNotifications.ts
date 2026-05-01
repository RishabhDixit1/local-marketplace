import webpush from "web-push";
import type { SupabaseClient } from "@supabase/supabase-js";
import { applicationDefault, cert, getApps, initializeApp } from "firebase-admin/app";
import { getMessaging } from "firebase-admin/messaging";

type PushSubscriptionRow = {
  endpoint: string;
  p256dh: string;
  auth: string;
  fcm_token?: string | null;
};

type PushPayload = {
  title: string;
  body: string;
  icon?: string;
  data?: Record<string, unknown>;
};

let vapidConfigured = false;
let firebaseConfigured = false;

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

const configureFirebase = () => {
  if (firebaseConfigured) return true;

  if (getApps().length > 0) {
    firebaseConfigured = true;
    return true;
  }

  const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON?.trim();
  const projectId = process.env.FIREBASE_PROJECT_ID?.trim();
  const hasApplicationDefault = Boolean(process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim() || projectId);

  if (!serviceAccountJson && !hasApplicationDefault) return false;

  try {
    initializeApp({
      credential: serviceAccountJson ? cert(JSON.parse(serviceAccountJson)) : applicationDefault(),
      projectId: projectId || undefined,
    });
    firebaseConfigured = true;
    return true;
  } catch (error) {
    console.warn("[push] Firebase Admin could not initialize:", error instanceof Error ? error.message : error);
    return false;
  }
};

const stringifyFcmData = (data: Record<string, unknown> = {}) => {
  return Object.fromEntries(
    Object.entries(data)
      .filter(([, value]) => value !== null && value !== undefined)
      .map(([key, value]) => [key, typeof value === "string" ? value : String(value)])
  );
};

const sendFcmToTokens = async (
  db: SupabaseClient,
  userId: string,
  tokens: string[],
  payload: PushPayload
) => {
  if (tokens.length === 0 || !configureFirebase()) return { sent: 0, failed: 0 };

  const result = await getMessaging().sendEachForMulticast({
    tokens,
    notification: {
      title: payload.title,
      body: payload.body,
    },
    data: stringifyFcmData(payload.data),
    android: {
      priority: "high",
      notification: {
        channelId: "serviq_updates",
        icon: "ic_launcher",
      },
    },
    apns: {
      payload: {
        aps: {
          sound: "default",
        },
      },
    },
  });

  const invalidTokens = result.responses
    .map((response, index) => ({ response, token: tokens[index] }))
    .filter(({ response }) => {
      const code = response.error?.code || "";
      return code.includes("registration-token-not-registered") || code.includes("invalid-registration-token");
    })
    .map(({ token }) => token)
    .filter(Boolean);

  if (invalidTokens.length > 0) {
    await db.from("provider_push_subscriptions").delete().eq("provider_id", userId).in("fcm_token", invalidTokens);
  }

  return {
    sent: result.successCount,
    failed: result.failureCount,
  };
};

export const sendPushToUser = async (
  db: SupabaseClient,
  userId: string,
  payload: PushPayload
): Promise<{ sent: number; failed: number }> => {
  const { data, error } = await db
    .from("provider_push_subscriptions")
    .select("endpoint, p256dh, auth, fcm_token")
    .eq("provider_id", userId);

  if (error || !data?.length) return { sent: 0, failed: 0 };

  const subs = data as PushSubscriptionRow[];
  const fcmTokens = Array.from(
    new Set(
      subs
        .map((sub) => sub.fcm_token?.trim() || (sub.endpoint.startsWith("fcm:") ? sub.endpoint.slice(4).trim() : ""))
        .filter(Boolean)
    )
  );
  const webSubs = subs.filter((sub) => !sub.fcm_token && !sub.endpoint.startsWith("fcm:"));

  const fcmResult = await sendFcmToTokens(db, userId, fcmTokens, payload);
  if (webSubs.length === 0 || !configureVapid()) {
    return fcmResult;
  }

  const body = JSON.stringify(payload);
  let sent = 0;
  let failed = 0;

  await Promise.all(
    webSubs.map(async (sub) => {
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

  return { sent: sent + fcmResult.sent, failed: failed + fcmResult.failed };
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
