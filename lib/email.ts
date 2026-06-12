/**
 * Email notifications for order events.
 * Uses Resend (https://resend.com) — add RESEND_API_KEY to .env.local.
 * If the key is absent the function silently no-ops (won't crash the app).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "orders@serviqapp.com";
const APP_NAME = "ServiQ";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://serviqapp.com";

/**
 * Check whether a user has opted out of order-related emails.
 * Uses the `user_settings` table (order_notifications column).
 * Returns true (should skip email) if the user has explicitly opted out.
 */
export async function shouldSkipOrderEmail(userId: string): Promise<boolean> {
  try {
    const { createSupabaseAdminClient } = await import("@/lib/server/supabaseClients");
    const admin = createSupabaseAdminClient();
    if (!admin) return false;
    const { data } = await admin
      .from("user_settings")
      .select("order_notifications")
      .eq("user_id", userId)
      .maybeSingle<{ order_notifications: boolean }>();
    return data?.order_notifications === false;
  } catch {
    return false;
  }
}

type OrderEmailType = "placed" | "accepted" | "rejected" | "completed" | "cancelled" | "order_placed_provider" | "quote_received" | "review_received";

type OrderEmailOptions = {
  type: OrderEmailType;
  to: string;
  recipientName: string;
  orderId: string;
  itemTitle: string;
  price?: number;
  providerName?: string;
  consumerName?: string;
  rating?: number;
  reviewComment?: string;
  quoteAmount?: number;
};

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

function buildSubjectAndBody(opts: OrderEmailOptions): { subject: string; html: string } {
  const orderUrl = `${APP_URL}/orders/${opts.orderId}`;
  const priceStr = opts.price ? INR(opts.price) : "";

  const wrap = (body: string) => `
    <div style="font-family:Inter,-apple-system,sans-serif;max-width:520px;margin:0 auto;padding:32px 24px;color:#0f172a">
      <div style="margin-bottom:24px">
        <span style="font-size:20px;font-weight:700;color:#2563eb">${APP_NAME}</span>
      </div>
      ${body}
      <div style="margin-top:32px;padding-top:16px;border-top:1px solid #e2e8f0;font-size:12px;color:#94a3b8">
        You received this email because you are a member of ${APP_NAME}. 
        <a href="${APP_URL}" style="color:#2563eb">Visit platform</a>
      </div>
    </div>
  `;

  const btn = (text: string, url: string) =>
    `<a href="${url}" style="display:inline-block;margin-top:20px;padding:12px 24px;background:#2563eb;color:#fff;font-size:14px;font-weight:600;border-radius:12px;text-decoration:none">${text}</a>`;

  switch (opts.type) {
    case "placed":
      return {
        subject: `Order placed — ${opts.itemTitle}`,
        html: wrap(`
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">Order Placed! 🎉</h2>
          <p style="color:#475569;margin:0 0 4px">Hi ${opts.recipientName},</p>
          <p style="color:#475569">Your order for <strong>${opts.itemTitle}</strong>${priceStr ? ` (${priceStr})` : ""} has been placed successfully. The provider will respond shortly.</p>
          ${btn("Track Order", orderUrl)}
        `),
      };
    case "accepted":
      return {
        subject: `Order accepted — ${opts.itemTitle}`,
        html: wrap(`
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">Order Accepted ✅</h2>
          <p style="color:#475569">Hi ${opts.recipientName}, <strong>${opts.providerName ?? "the provider"}</strong> has accepted your order for <strong>${opts.itemTitle}</strong>.</p>
          ${btn("View Order", orderUrl)}
        `),
      };
    case "rejected":
      return {
        subject: `Order update — ${opts.itemTitle}`,
        html: wrap(`
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">Order Not Available</h2>
          <p style="color:#475569">Hi ${opts.recipientName}, unfortunately <strong>${opts.providerName ?? "the provider"}</strong> is unable to fulfil your order for <strong>${opts.itemTitle}</strong> right now.</p>
          ${btn("Browse More", APP_URL)}
        `),
      };
    case "completed":
      return {
        subject: `Order completed — ${opts.itemTitle}`,
        html: wrap(`
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">Order Completed 🙌</h2>
          <p style="color:#475569">Hi ${opts.recipientName}, your order for <strong>${opts.itemTitle}</strong> has been marked completed. We hope everything went smoothly!</p>
          ${btn("Leave a Review", orderUrl)}
        `),
      };
    case "cancelled":
      return {
        subject: `Order cancelled — ${opts.itemTitle}`,
        html: wrap(`
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">Order Cancelled</h2>
          <p style="color:#475569">Hi ${opts.recipientName}, the order for <strong>${opts.itemTitle}</strong> has been cancelled.</p>
          ${btn("Browse Services", APP_URL)}
        `),
      };
    case "order_placed_provider": {
      const consumerName = opts.consumerName ?? "A customer";
      return {
        subject: `New order — ${opts.itemTitle}`,
        html: wrap(`
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">New Order Received 📦</h2>
          <p style="color:#475569">Hi ${opts.recipientName},</p>
          <p style="color:#475569"><strong>${consumerName}</strong> placed an order for <strong>${opts.itemTitle}</strong>${opts.price ? ` (${INR(opts.price)})` : ""}. Review and respond to confirm availability.</p>
          ${btn("View Order", `${APP_URL}/orders/${opts.orderId}`)}
        `),
      };
    }
    case "quote_received":
      return {
        subject: `Quote received — ${opts.itemTitle}`,
        html: wrap(`
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">Quote Received 💬</h2>
          <p style="color:#475569">Hi ${opts.recipientName},</p>
          <p style="color:#475569"><strong>${opts.providerName ?? "A provider"}</strong> sent you a quote for <strong>${opts.itemTitle}</strong>${opts.quoteAmount ? ` — ${INR(opts.quoteAmount)}` : ""}.</p>
          ${btn("View Quote", `${APP_URL}/orders/${opts.orderId}`)}
        `),
      };
    case "review_received":
      return {
        subject: `New review — ${opts.itemTitle}`,
        html: wrap(`
          <h2 style="font-size:18px;font-weight:700;margin:0 0 8px">New Review ⭐</h2>
          <p style="color:#475569">Hi ${opts.recipientName}, you received a ${opts.rating ? `${opts.rating}-star` : ""} review${opts.reviewComment ? `: "${opts.reviewComment}"` : ""}.</p>
          ${btn("View Profile", `${APP_URL}/profile`)}
        `),
      };
  }
}

export async function sendOrderEmail(opts: OrderEmailOptions): Promise<void> {
  if (!RESEND_API_KEY) return; // Silently skip if not configured

  const { subject, html } = buildSubjectAndBody(opts);

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: FROM_EMAIL, to: opts.to, subject, html }),
    });
    if (!res.ok) {
      const body = await res.text();
      console.error("[sendOrderEmail] Resend error:", res.status, body);
    }
  } catch (e) {
    console.error("[sendOrderEmail] fetch error:", e);
  }
}

type OrderSmsType = "order_placed_provider" | "payment_received_provider" | "completed_consumer";

type OrderSmsOptions = {
  type: OrderSmsType;
  to: string;
  orderId: string;
  itemTitle: string;
  price?: number;
  consumerName?: string;
  providerName?: string;
};

function buildSmsMessage(opts: OrderSmsOptions): string {
  const orderUrl = `${APP_URL}/orders/${opts.orderId}`;
  const priceStr = opts.price ? INR(opts.price) : "";

  switch (opts.type) {
    case "order_placed_provider":
      return `New order received on ${APP_NAME}! ${opts.consumerName ?? "A customer"} ordered ${opts.itemTitle}${priceStr ? ` (${priceStr})` : ""}. View: ${orderUrl}`;
    case "payment_received_provider":
      return `Payment received on ${APP_NAME} for ${opts.itemTitle}${priceStr ? ` — ${priceStr}` : ""}. Check your earnings: ${orderUrl}`;
    case "completed_consumer":
      return `Your order for ${opts.itemTitle} on ${APP_NAME} is complete. We hope everything went smoothly! Review your order: ${orderUrl}`;
  }
}

export async function sendOrderSms(opts: OrderSmsOptions): Promise<void> {
  const { sendSms } = await import("@/lib/server/sms");
  const message = buildSmsMessage(opts);

  try {
    const result = await sendSms(opts.to, message);
    if (!result.ok) {
      console.error("[sendOrderSms] failed:", result.error);
    }
  } catch (e) {
    console.error("[sendOrderSms] error:", e);
  }
}
