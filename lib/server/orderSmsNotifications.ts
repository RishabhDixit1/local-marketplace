import { createSupabaseAdminClient } from "@/lib/server/supabaseClients";

const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.serviqapp.com";

export type OrderInfo = {
  id: string;
  consumer_id: string;
  provider_id: string | null;
  status: string;
  price: number | string | null;
};

type UserPhone = {
  phone: string | null;
};

const STATUS_SMS_TEMPLATES: Record<string, { consumer: string; provider: string }> = {
  accepted: {
    consumer: "Your order has been accepted! Your provider will start working on it soon.",
    provider: "You've accepted the order. Get ready to start!",
  },
  in_progress: {
    consumer: "Your provider has started working on your order. Track progress in the app.",
    provider: "Order is now in progress. Keep up the great work!",
  },
  completed: {
    consumer: "Your order has been marked as completed. Please review and close if satisfied.",
    provider: "Order completed! You'll receive your payout once the consumer closes the order.",
  },
  cancelled: {
    consumer: "Your order has been cancelled. If you have any concerns, please contact support.",
    provider: "An order has been cancelled. No worries — new opportunities await!",
  },
};

export async function sendOrderSmsNotifications(order: OrderInfo, previousStatus: string) {
  if (order.status === previousStatus) return;

  const template = STATUS_SMS_TEMPLATES[order.status];
  if (!template) return;

  const smsFrom = process.env.TWILIO_SMS_FROM;
  if (!smsFrom) return;

  let twilioClient: { messages: { create: (opts: { body: string; from: string; to: string }) => Promise<unknown> } };
  try {
    const twilioModule = await import("twilio");
    const TwilioConstructor = (twilioModule.default ?? twilioModule) as unknown as (
      sid: string,
      token: string
    ) => typeof twilioClient;
    twilioClient = TwilioConstructor(
      process.env.TWILIO_ACCOUNT_SID ?? "",
      process.env.TWILIO_AUTH_TOKEN ?? ""
    );
  } catch {
    return;
  }

  const db = createSupabaseAdminClient();
  if (!db) return;

  const orderUrl = `${APP_URL}/orders/${order.id}`;

  const { data: consumer } = await db
    .from("auth.users")
    .select("phone")
    .eq("id", order.consumer_id)
    .single<UserPhone>();

  if (consumer?.phone) {
    try {
      await twilioClient.messages.create({
        body: `${template.consumer}\n\nOrder: ${orderUrl}`,
        from: smsFrom,
        to: consumer.phone,
      });
    } catch {
      console.warn(`SMS failed for consumer ${order.consumer_id}`);
    }
  }

  if (order.provider_id) {
    const { data: provider } = await db
      .from("auth.users")
      .select("phone")
      .eq("id", order.provider_id)
      .single<UserPhone>();

    if (provider?.phone) {
      try {
        await twilioClient.messages.create({
          body: `${template.provider}\n\nOrder: ${orderUrl}`,
          from: smsFrom,
          to: provider.phone,
        });
      } catch {
        console.warn(`SMS failed for provider ${order.provider_id}`);
      }
    }
  }
}
