import Razorpay from "razorpay";

const RAZORPAY_MODE = process.env.RAZORPAY_MODE ?? "live";

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

export async function createRefund(
  paymentId: string,
  amountPaise: number,
  notes?: Record<string, string>,
): Promise<{ id: string; status: string } | null> {
  if (!isRazorpayConfigured()) return null;
  try {
    const razorpay = getRazorpay();
    const refund = await razorpay.api.post({
      url: `/payments/${paymentId}/refund`,
      data: { amount: amountPaise, notes },
    }) as { id: string; status: string };
    return { id: refund.id, status: refund.status };
  } catch (err) {
    console.error("[razorpay] Refund failed for payment", paymentId, err);
    return null;
  }
}
