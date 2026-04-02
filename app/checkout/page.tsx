"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  ShoppingBag,
} from "lucide-react";
import RouteObservability from "@/app/components/RouteObservability";
import { useCart } from "@/app/components/store/CartContext";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

// Razorpay's global JS is loaded dynamically — type it minimally
declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

type PaymentMethod = "razorpay" | "cod";
type OrderCreationMetadata = Record<string, string | null | undefined>;

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, clearCart } = useCart();

  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("razorpay");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);
  const scriptLoadedRef = useRef(false);

  // Load user info
  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) { router.replace("/"); return; }
      setUserEmail(user.email ?? "");
      setUserName(user.user_metadata?.name ?? user.email ?? "");
      setUserPhone(
        typeof user.phone === "string" && user.phone.trim().length > 0
          ? user.phone
          : typeof user.user_metadata?.phone === "string"
          ? user.user_metadata.phone
          : ""
      );
    })();
  }, [router]);

  // Load Razorpay script
  useEffect(() => {
    if (scriptLoadedRef.current) return;
    scriptLoadedRef.current = true;

    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.async = true;
    script.onload = () => setRazorpayAvailable(true);
    script.onerror = () => setRazorpayAvailable(false);
    document.head.appendChild(script);
  }, []);

  // Create ServiQ orders in DB
  const createOrders = useCallback(
    async (paymentMeta: OrderCreationMetadata = {}): Promise<string[]> => {
      const res = await fetchAuthedJson<{ ok: boolean; orderIds: string[] }>(supabase, "/api/orders", {
        method: "POST",
        body: JSON.stringify({
          items: items.map((item) => ({
            providerId: item.providerId,
            itemType: item.itemType,
            itemId: item.itemId,
            price: item.price * item.quantity,
            quantity: item.quantity,
            title: item.title,
            address,
            notes,
            ...paymentMeta,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to create orders");
      return res.orderIds;
    },
    [items, address, notes]
  );

  const handleCOD = useCallback(async () => {
    if (!address.trim()) { setError("Please enter a delivery address."); return; }
    if (address.trim().length < 10) { setError("Address is too short. Please enter a complete address."); return; }
    if (address.trim().length > 500) { setError("Address must be 500 characters or fewer."); return; }
    setBusy(true); setError("");

    try {
      const orderIds = await createOrders({
        payment_method: "cod",
        payment_status: "pending",
      });
      clearCart();
      setSuccess(orderIds[0] ?? "");
      setTimeout(() => router.push(`/orders/${orderIds[0]}`), 1500);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not place order.");
    } finally {
      setBusy(false);
    }
  }, [address, createOrders, clearCart, router]);

  const handleRazorpay = useCallback(async () => {
    if (!address.trim()) { setError("Please enter a delivery address."); return; }
    if (address.trim().length < 10) { setError("Address is too short. Please enter a complete address."); return; }
    if (address.trim().length > 500) { setError("Address must be 500 characters or fewer."); return; }
    if (!razorpayAvailable || !window.Razorpay) {
      setError("Payment gateway not loaded. Please refresh and try again."); return;
    }

    setBusy(true); setError("");

    try {
      // 1. Create Razorpay order
      const amountPaise = Math.round(totalPrice * 100);
      const pgRes = await fetchAuthedJson<{
        ok: boolean;
        orderId: string;
        amount: number;
        currency: string;
        keyId: string;
      }>(supabase, "/api/payment/create-order", {
        method: "POST",
        body: JSON.stringify({
          amount: amountPaise,
          receipt: `chk_${Date.now()}`,
          notes: { address, notes },
        }),
      });

      if (!pgRes.ok) throw new Error("Payment gateway unavailable.");

      // 2. Open Razorpay checkout UI
      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay!({
          key: pgRes.keyId,
          amount: pgRes.amount,
          currency: pgRes.currency,
          order_id: pgRes.orderId,
          name: "ServiQ",
          description: `Order — ${items.length} item${items.length !== 1 ? "s" : ""}`,
          prefill: { name: userName, email: userEmail, contact: userPhone },
          theme: { color: "#2563eb" },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            let checkoutStage: "creating_order" | "verifying_payment" = "creating_order";
            try {
              // 3. Create ServiQ orders
              const orderIds = await createOrders({
                payment_method: "razorpay",
                payment_status: "processing",
                razorpay_order_id: response.razorpay_order_id,
                razorpay_payment_id: response.razorpay_payment_id,
              });

              // 4. Verify payment
              checkoutStage = "verifying_payment";
              await fetchAuthedJson(supabase, "/api/payment/verify", {
                method: "POST",
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  serviQOrderIds: orderIds,
                }),
              });

              clearCart();
              setSuccess(orderIds[0] ?? "");
              setTimeout(() => router.push(`/orders/${orderIds[0]}`), 1500);
              resolve();
            } catch (e) {
              if (e instanceof Error && e.message.trim()) {
                reject(e);
                return;
              }

              if (checkoutStage === "verifying_payment") {
                reject(
                  new Error(
                    `Payment captured and order confirmation is still syncing. Keep payment ID ${response.razorpay_payment_id} handy if you contact support.`
                  )
                );
                return;
              }

              reject(
                new Error(
                  `Payment captured but order creation failed. Keep payment ID ${response.razorpay_payment_id} handy if you contact support.`
                )
              );
            } finally {
              setBusy(false);
            }
          },
          modal: {
            ondismiss: () => {
              setBusy(false);
              reject(new Error("Payment cancelled."));
            },
          },
        });
        rz.open();
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Payment failed.");
      setBusy(false);
    }
  }, [address, notes, totalPrice, items, razorpayAvailable, userEmail, userName, userPhone, createOrders, clearCart, router]);

  // Group items by provider
  const byProvider = items.reduce<Record<string, typeof items>>((acc, item) => {
    (acc[item.providerId] ??= []).push(item);
    return acc;
  }, {});

  if (success !== null) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f2ee] px-4">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-6 sm:p-10 shadow-lg max-w-sm w-full text-center">
          <CheckCircle2 className="h-14 w-14 text-emerald-500" />
          <h1 className="text-xl font-bold text-slate-900">Order Placed!</h1>
          {success && (
            <p className="text-xs font-mono text-slate-400">Order #{success.slice(0, 8).toUpperCase()}</p>
          )}
          <p className="text-sm text-slate-500">Redirecting to your order status…</p>
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
        </div>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f2ee] px-4">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-6 sm:p-10 shadow-lg max-w-sm w-full text-center">
          <ShoppingBag className="h-12 w-12 text-slate-300" />
          <p className="font-semibold text-slate-700">Your cart is empty</p>
          <Link href="/" className="text-sm font-medium text-blue-600 hover:underline">Browse marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <RouteObservability route="checkout" />

      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-2xl items-center gap-3 px-4 py-3">
          <Link href="/" className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 transition">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </Link>
          <span className="font-semibold text-slate-900">Checkout</span>
          <span className="ml-auto text-sm text-slate-500">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="mx-auto max-w-2xl px-4 py-6 space-y-5">

        {/* Order summary */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 font-semibold text-slate-900">
            <Package className="h-4 w-4 text-slate-500" />
            Order Summary
          </h2>

          <div className="space-y-3">
            {Object.entries(byProvider).map(([, provItems]) => (
              provItems.map((item) => (
                <div key={item.key} className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-slate-500">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                    <p className="text-xs text-slate-500">{item.providerName} · Qty {item.quantity}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-900">{INR(item.price * item.quantity)}</p>
                </div>
              ))
            ))}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4 flex justify-between">
            <span className="text-sm font-medium text-slate-600">Total</span>
            <span className="text-base font-bold text-slate-900">{INR(totalPrice)}</span>
          </div>
        </section>

        {/* Delivery address */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-slate-500" />
            Delivery / Meeting Address
          </h2>
          <textarea
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none"
            placeholder="Enter your full address or describe where to meet the provider…"
            aria-label="Delivery address"
            rows={3}
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className={`mt-1 text-right text-[11px] ${address.length > 480 ? "text-amber-500" : "text-slate-400"}`}>
            {address.length}/500
          </p>
          <textarea
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none"
            placeholder="Additional notes for the provider (optional)…"
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        {/* Payment method */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <CreditCard className="h-4 w-4 text-slate-500" />
            Payment Method
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3" role="radiogroup" aria-label="Payment method">
            {[
              { id: "razorpay" as const, label: "Pay Online", desc: "UPI, Cards, NetBanking", icon: "💳", disabled: !razorpayAvailable },
              { id: "cod" as const, label: "Pay on Delivery", desc: "Cash or UPI on arrival", icon: "🏠", disabled: false },
            ].map((opt) => (
              <button
                key={opt.id}
                type="button"
                disabled={opt.disabled}
                onClick={() => setPayMethod(opt.id)}
                role="radio"
                aria-checked={payMethod === opt.id}
                className={`flex flex-col items-start gap-1 rounded-2xl border-2 p-4 transition text-left ${
                  payMethod === opt.id
                    ? "border-blue-500 bg-blue-50"
                    : opt.disabled
                    ? "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className="text-xl">{opt.icon}</span>
                <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                <span className="text-xs text-slate-500">{opt.desc}</span>
                {opt.disabled && (
                  <span className="text-[10px] text-slate-400">Not configured</span>
                )}
              </button>
            ))}
          </div>
          {!razorpayAvailable && (
            <button
              type="button"
              onClick={() => {
                scriptLoadedRef.current = false;
                setRazorpayAvailable(false);
                const script = document.createElement("script");
                script.src = "https://checkout.razorpay.com/v1/checkout.js";
                script.async = true;
                script.onload = () => setRazorpayAvailable(true);
                document.head.appendChild(script);
              }}
              className="mt-2 text-xs text-blue-600 hover:underline"
            >
              Retry loading payment gateway
            </button>
          )}
        </section>

        {/* Error */}
        {error && (
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={payMethod === "razorpay" ? handleRazorpay : handleCOD}
          disabled={busy}
          className="w-full rounded-2xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
        >
          {busy ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
          ) : (
            payMethod === "razorpay" ? `Pay ${INR(totalPrice)}` : `Place Order — ${INR(totalPrice)}`
          )}
        </button>

        <p className="text-center text-xs text-slate-400">
          By placing this order you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
