import Razorpay from "razorpay";

const RAZORPAY_MODE = process.env.RAZORPAY_MODE ?? "test";

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

export const isRazorpayConfigured = () => {
  if (!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET)) return false;
  if (RAZORPAY_MODE === "test" && !RAZORPAY_KEY_ID.startsWith("rzp_test_")) {
    console.warn("[razorpay] RAZORPAY_MODE=test but key does not start with rzp_test_ — refusing to use live key");
    return false;
  }
  if (RAZORPAY_MODE === "live" && !RAZORPAY_KEY_ID.startsWith("rzp_live_")) {
    console.warn("[razorpay] RAZORPAY_MODE=live but key does not start with rzp_live_ — refusing to use test key in live mode");
    return false;
  }
  return true;
};

export const getRazorpay = (): Razorpay => {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay not configured");
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
};

export type RefundResult =
  | { ok: true; id: string; status: string }
  | { ok: false; error: string };

export async function createRefund(
  paymentId: string,
  amountPaise: number,
  notes?: Record<string, string>,
): Promise<RefundResult> {
  if (!isRazorpayConfigured()) return { ok: false, error: "Razorpay not configured" };
  try {
    const razorpay = getRazorpay();
    const refund = await razorpay.api.post({
      url: `/payments/${paymentId}/refund`,
      data: { amount: amountPaise, notes },
    }) as { id: string; status: string };
    return { ok: true, id: refund.id, status: refund.status };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[razorpay] Refund failed for payment", paymentId, err);
    return { ok: false, error: message };
  }
}
