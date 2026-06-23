import Razorpay from "razorpay";

export const RAZORPAY_KEY_ID = process.env.RAZORPAY_KEY_ID ?? "";
export const RAZORPAY_KEY_SECRET = process.env.RAZORPAY_KEY_SECRET ?? "";
export const RAZORPAY_WEBHOOK_SECRET = process.env.RAZORPAY_WEBHOOK_SECRET ?? "";

export const isRazorpayConfigured = () => !!(RAZORPAY_KEY_ID && RAZORPAY_KEY_SECRET);

export const getRazorpay = (): Razorpay => {
  if (!isRazorpayConfigured()) {
    throw new Error("Razorpay not configured");
  }
  return new Razorpay({ key_id: RAZORPAY_KEY_ID, key_secret: RAZORPAY_KEY_SECRET });
};
