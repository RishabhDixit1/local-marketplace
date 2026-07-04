import "server-only";
import { createSupabaseAdminClient } from "./supabaseClients";
import { sendWhatsApp } from "./twilioClient";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.serviqapp.com";

type UserPhone = { phone: string | null };
type UserSettings = { whatsapp_notifications: boolean | null };

export type NotificationEvent =
  | "help_request_match"
  | "new_quote"
  | "quote_accepted"
  | "order_confirmed"
  | "order_in_progress"
  | "order_completed"
  | "order_cancelled"
  | "payment_received"
  | "new_review"
  | "new_message";

type EventTemplate = {
  consumer: (details: Record<string, string>) => string;
  provider: (details: Record<string, string>) => string;
};

const TEMPLATES: Record<string, EventTemplate> = {
  help_request_match: {
    consumer: () =>
      `A provider is interested in your request! Check your matches in the app.\n\n${APP_URL}`,
    provider: (d) =>
      `New lead: ${d.requestTitle || "Someone"} needs your help nearby. Respond fast to win the job!\n\n${APP_URL}/dashboard/leads`,
  },
  new_quote: {
    consumer: (d) =>
      `You've received a quote for "${d.requestTitle || "your request"}" — ₹${d.amount || "—"}. Review and respond in the app.\n\n${APP_URL}/orders/${d.orderId || ""}`,
    provider: () =>
      `Your quote has been sent. We'll notify you when the customer responds.\n\n${APP_URL}/dashboard/orders`,
  },
  quote_accepted: {
    consumer: (d) =>
      `Your quote has been accepted! Order #${d.orderId || ""} is confirmed.\n\n${APP_URL}/orders/${d.orderId || ""}`,
    provider: (d) =>
      `Great news — your quote was accepted! Order #${d.orderId || ""} is confirmed. Get ready to start.\n\n${APP_URL}/dashboard/orders/${d.orderId || ""}`,
  },
  order_in_progress: {
    consumer: (d) =>
      `Your provider has started working on "${d.requestTitle || "your order"}". Track progress in the app.\n\n${APP_URL}/orders/${d.orderId || ""}`,
    provider: (d) =>
      `Order #${d.orderId || ""} is now in progress. Keep up the great work!\n\n${APP_URL}/dashboard/orders/${d.orderId || ""}`,
  },
  order_completed: {
    consumer: (d) =>
      `Your order "${d.requestTitle || ""}" has been marked complete. Please review your provider!\n\n${APP_URL}/orders/${d.orderId || ""}`,
    provider: (d) =>
      `Order #${d.orderId || ""} completed! Your payout will be processed once the customer closes the order.\n\n${APP_URL}/dashboard/orders/${d.orderId || ""}`,
  },
  order_cancelled: {
    consumer: (d) =>
      `Order #${d.orderId || ""} has been cancelled. If you have concerns, contact support.\n\n${APP_URL}`,
    provider: (d) =>
      `Order #${d.orderId || ""} was cancelled. Don't worry — new opportunities are waiting!\n\n${APP_URL}/dashboard/leads`,
  },
  payment_received: {
    consumer: (d) =>
      `Payment of ₹${d.amount || "—"} confirmed for order #${d.orderId || ""}. Thank you!\n\n${APP_URL}/orders/${d.orderId || ""}`,
    provider: (d) =>
      `₹${d.amount || "—"} has been released to your account for order #${d.orderId || ""}.\n\n${APP_URL}/dashboard/payouts`,
  },
  new_review: {
    consumer: () =>
      `Your review makes a difference! Thank you for helping the community.\n\n${APP_URL}`,
    provider: (d) =>
      `You received a ${d.rating || ""}-star review! Check what they said.\n\n${APP_URL}/dashboard/profile`,
  },
  new_message: {
    consumer: (d) =>
      `New message about "${d.requestTitle || "your conversation"}" — check it out.\n\n${APP_URL}/dashboard/chat`,
    provider: (d) =>
      `New message from a customer about "${d.requestTitle || "your conversation"}".\n\n${APP_URL}/dashboard/chat`,
  },
};

export async function shouldSendWhatsApp(
  userId: string,
  db: ReturnType<typeof createSupabaseAdminClient>,
): Promise<boolean> {
  if (!db) return false;

  const { data: settings } = await db
    .from("user_settings")
    .select("whatsapp_notifications")
    .eq("user_id", userId)
    .maybeSingle<UserSettings>();

  return settings?.whatsapp_notifications === true;
}

export async function getWhatsAppPhone(
  userId: string,
  db: ReturnType<typeof createSupabaseAdminClient>,
): Promise<string | null> {
  if (!db) return null;

  const { data: profile } = await db
    .from("profiles")
    .select("phone")
    .eq("id", userId)
    .maybeSingle<UserPhone>();

  if (!profile?.phone) return null;

  const digits = profile.phone.replace(/\D/g, "");
  if (digits.length >= 10) {
    const countryCode = digits.length === 10 ? "91" : "";
    return `+${countryCode}${digits}`;
  }

  return null;
}

export async function sendEventWhatsApp(
  event: NotificationEvent,
  userId: string,
  role: "consumer" | "provider",
  details: Record<string, string> = {},
): Promise<{ ok: boolean; error?: string }> {
  const db = createSupabaseAdminClient();
  if (!db) return { ok: false, error: "No DB client" };

  const canSend = await shouldSendWhatsApp(userId, db);
  if (!canSend) return { ok: false, error: "WhatsApp notifications disabled" };

  const phone = await getWhatsAppPhone(userId, db);
  if (!phone) return { ok: false, error: "No phone number on profile" };

  const template = TEMPLATES[event];
  if (!template) return { ok: false, error: `No template for event: ${event}` };

  const message = template[role]?.(details);
  if (!message) return { ok: false, error: `No ${role} template for ${event}` };

  const result = await sendWhatsApp(phone, message);

  if (!result.ok) {
    console.warn(`[whatsapp] Failed to send ${event} to ${userId}: ${result.error}`);
  }

  return result;
}

export async function sendBulkWhatsApp(
  event: NotificationEvent,
  userIds: { userId: string; role: "consumer" | "provider"; details: Record<string, string> }[],
): Promise<{ sent: number; failed: number }> {
  const results = await Promise.allSettled(
    userIds.map(({ userId, role, details }) =>
      sendEventWhatsApp(event, userId, role, details),
    ),
  );

  const sent = results.filter((r) => r.status === "fulfilled" && r.value.ok).length;
  const failed = results.filter(
    (r) => r.status === "rejected" || (r.status === "fulfilled" && !r.value.ok),
  ).length;

  return { sent, failed };
}

export function buildShareUrl(
  type: "app" | "provider" | "listing" | "order",
  identifier: string,
  shareData?: { providerName?: string; listingTitle?: string; amount?: string },
): { whatsapp: string; telegram: string } {
  const appUrl = APP_URL;
  const encodedAppUrl = encodeURIComponent(appUrl);

  const messages: Record<string, { whatsapp: string; telegram: string }> = {
    app: {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(
        `Need help nearby? ServiQ connects you with local providers in minutes. Try it here: ${appUrl}`,
      )}`,
      telegram: `https://t.me/share/url?url=${encodedAppUrl}&text=${encodeURIComponent(
        "Need help nearby? ServiQ connects you with local providers in minutes.",
      )}`,
    },
    provider: {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(
        `Check out ${shareData?.providerName || "this provider"} on ServiQ — trusted local services nearby.\n\n${appUrl}/profile/${identifier}`,
      )}`,
      telegram: `https://t.me/share/url?url=${encodedAppUrl}&text=${encodeURIComponent(
        `Check out ${shareData?.providerName || "this provider"} on ServiQ — trusted local services nearby.`,
      )}`,
    },
    listing: {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(
        `Check out "${shareData?.listingTitle || "this service"}" on ServiQ${shareData?.amount ? ` at ₹${shareData.amount}` : ""}.\n\n${appUrl}/listings/${identifier}`,
      )}`,
      telegram: `https://t.me/share/url?url=${encodedAppUrl}&text=${encodeURIComponent(
        `Check out "${shareData?.listingTitle || "this service"}" on ServiQ${shareData?.amount ? ` at ₹${shareData.amount}` : ""}.`,
      )}`,
    },
    order: {
      whatsapp: `https://wa.me/?text=${encodeURIComponent(
        `Track my order on ServiQ: ${appUrl}/orders/${identifier}`,
      )}`,
      telegram: `https://t.me/share/url?url=${encodedAppUrl}&text=${encodeURIComponent(
        "Track my order on ServiQ.",
      )}`,
    },
  };

  return messages[type] || messages.app;
}
