/**
 * Email notifications for order events.
 * Uses Resend (https://resend.com) — add RESEND_API_KEY to .env.local.
 * If the key is absent the function silently no-ops (won't crash the app).
 */

const RESEND_API_KEY = process.env.RESEND_API_KEY ?? "";
const FROM_EMAIL = process.env.EMAIL_FROM ?? "orders@serviq.in";
const APP_NAME = "ServiQ";
const APP_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://serviq.in";

type OrderEmailType = "placed" | "accepted" | "rejected" | "completed" | "cancelled";

type OrderEmailOptions = {
  type: OrderEmailType;
  to: string;
  recipientName: string;
  orderId: string;
  itemTitle: string;
  price?: number;
  providerName?: string;
  consumerName?: string;
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
