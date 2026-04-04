"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  Sparkles,
  Store,
  Truck,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import RouteObservability from "@/app/components/RouteObservability";
import { useCart } from "@/app/components/store/CartContext";
import {
  getFulfillmentMinimumLength,
  getOrderFulfillmentOption,
  ORDER_FULFILLMENT_METHODS,
  ORDER_FULFILLMENT_OPTIONS,
  recommendOrderFulfillmentMethod,
  type OrderFulfillmentMethod,
} from "@/lib/orderFulfillment";
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
const PRODUCT_DELIVERY_SUMMARY_LABELS = {
  pickup: "Pickup only",
  delivery: "Provider delivery",
  both: "Pickup or delivery",
} as const;
const FULFILLMENT_ICONS: Record<OrderFulfillmentMethod, LucideIcon> = {
  self: Store,
  provider: Package,
  platform: Sparkles,
  courier: Truck,
};

const buildFulfillmentRecommendation = (value: OrderFulfillmentMethod) => {
  if (value === "self") return "Recommended because your current cart is best suited for pickup or meetup.";
  if (value === "provider") return "Recommended because the provider can handle the visit or delivery directly.";
  if (value === "platform") return "Recommended when you want ServiQ to coordinate the handoff.";
  return "Recommended when a courier or external delivery partner will complete the handoff.";
};

const buildNotesPlaceholder = (value: OrderFulfillmentMethod) => {
  if (value === "self") return "Add meetup details, landmark notes, or pickup timing for the provider (optional)...";
  if (value === "courier") return "Add courier instructions, landmark notes, or gate details (optional)...";
  if (value === "platform") return "Add handoff notes, timing preferences, or coordination details (optional)...";
  return "Add delivery notes, access instructions, or service timing details (optional)...";
};

const buildFulfillmentNextAction = (value: OrderFulfillmentMethod) => {
  if (value === "self") return "Next: add the pickup point or meeting landmark.";
  if (value === "courier") return "Next: add the courier destination and access notes.";
  if (value === "platform") return "Next: add the address so ServiQ can coordinate the handoff.";
  return "Next: add the delivery or service address for the provider.";
};

export default function CheckoutPage() {
  const router = useRouter();
  const { items, totalPrice, clearCart, hydrated } = useCart();

  const [address, setAddress] = useState("");
  const [notes, setNotes] = useState("");
  const [payMethod, setPayMethod] = useState<PaymentMethod>("razorpay");
  const [fulfillmentMethod, setFulfillmentMethod] = useState<OrderFulfillmentMethod>("provider");
  const [fulfillmentTouched, setFulfillmentTouched] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState<string | null>(null);
  const [userName, setUserName] = useState("");
  const [userEmail, setUserEmail] = useState("");
  const [userPhone, setUserPhone] = useState("");
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);
  const scriptLoadedRef = useRef(false);
  const [authResolved, setAuthResolved] = useState(false);
  const recommendedFulfillmentMethod = useMemo(() => recommendOrderFulfillmentMethod(items), [items]);
  const fulfillmentOption = useMemo(
    () => getOrderFulfillmentOption(fulfillmentMethod),
    [fulfillmentMethod]
  );
  const recommendedFulfillmentOption = useMemo(
    () => getOrderFulfillmentOption(recommendedFulfillmentMethod),
    [recommendedFulfillmentMethod]
  );
  const addressMinimumLength = getFulfillmentMinimumLength(fulfillmentMethod);

  useEffect(() => {
    if (!hydrated || fulfillmentTouched) return;
    setFulfillmentMethod(recommendedFulfillmentMethod);
  }, [fulfillmentTouched, hydrated, recommendedFulfillmentMethod]);

  // Load user info
  useEffect(() => {
    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setAuthResolved(true);
        router.replace("/");
        return;
      }
      setUserEmail(user.email ?? "");
      setUserName(user.user_metadata?.name ?? user.email ?? "");
      setUserPhone(
        typeof user.phone === "string" && user.phone.trim().length > 0
          ? user.phone
          : typeof user.user_metadata?.phone === "string"
          ? user.user_metadata.phone
          : ""
      );
      setAuthResolved(true);
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
            fulfillment_method: fulfillmentMethod,
            ...paymentMeta,
          })),
        }),
      });
      if (!res.ok) throw new Error("Failed to create orders");
      return res.orderIds;
    },
    [address, fulfillmentMethod, items, notes]
  );

  const validateFulfillmentLocation = useCallback(() => {
    if (!address.trim()) {
      setError(
        fulfillmentMethod === "self"
          ? "Please enter a pickup point or meeting location."
          : "Please enter a delivery or service address."
      );
      return false;
    }
    if (address.trim().length < addressMinimumLength) {
      setError(
        fulfillmentMethod === "self"
          ? "Pickup point is too short. Please enter a clearer meeting location."
          : "Address is too short. Please enter a complete address."
      );
      return false;
    }
    if (address.trim().length > 500) {
      setError("Address must be 500 characters or fewer.");
      return false;
    }
    return true;
  }, [address, addressMinimumLength, fulfillmentMethod]);

  const handleCOD = useCallback(async () => {
    if (!validateFulfillmentLocation()) return;
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
  }, [clearCart, createOrders, router, validateFulfillmentLocation]);

  const handleRazorpay = useCallback(async () => {
    if (!validateFulfillmentLocation()) return;
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
  }, [address, clearCart, createOrders, items, notes, razorpayAvailable, router, totalPrice, userEmail, userName, userPhone, validateFulfillmentLocation]);

  // Group items by provider
  const byProvider = items.reduce<Record<string, typeof items>>((acc, item) => {
    (acc[item.providerId] ??= []).push(item);
    return acc;
  }, {});

  const handleBackNavigation = useCallback(() => {
    if (typeof window !== "undefined" && window.history.length > 1) {
      try {
        const referrer = document.referrer ? new URL(document.referrer) : null;
        if (referrer && referrer.origin === window.location.origin && referrer.pathname !== "/checkout") {
          router.back();
          return;
        }
      } catch {
        // Fall through to dashboard when referrer parsing fails.
      }
    }

    router.push("/dashboard");
  }, [router]);

  if (!hydrated || !authResolved) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f2ee] px-4">
        <div className="flex flex-col items-center gap-4 rounded-3xl bg-white p-6 sm:p-10 shadow-lg max-w-sm w-full text-center">
          <Loader2 className="h-12 w-12 animate-spin text-slate-300" />
          <p className="font-semibold text-slate-700">Loading checkout…</p>
        </div>
      </div>
    );
  }

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
          <Link href="/dashboard" className="text-sm font-medium text-blue-600 hover:underline">Browse marketplace</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      <RouteObservability route="checkout" />

      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-5xl items-center gap-3 px-3 py-3 sm:px-4">
          <button
            type="button"
            onClick={handleBackNavigation}
            aria-label="Go back"
            className="flex h-8 w-8 items-center justify-center rounded-full transition hover:bg-slate-100"
          >
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <span className="font-semibold text-slate-900">Checkout</span>
          <span className="ml-auto text-sm text-slate-500">{items.length} item{items.length !== 1 ? "s" : ""}</span>
        </div>
      </div>

      <div className="mx-auto max-w-5xl px-3 py-4 sm:px-4 sm:py-6 lg:grid lg:grid-cols-[minmax(0,1fr)_19rem] lg:items-start lg:gap-6">

        {/* Order summary */}
        <section className="rounded-[1.6rem] bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5 lg:col-start-2 lg:row-span-5 lg:sticky lg:top-24">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 className="flex items-center gap-2 font-semibold text-slate-900">
              <Package className="h-4 w-4 text-slate-500" />
              Order Summary
            </h2>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
              {items.length} item{items.length !== 1 ? "s" : ""}
            </span>
          </div>
          <div className="mb-4 grid grid-cols-3 gap-2 rounded-2xl border border-slate-200 bg-slate-50 p-2 text-[11px] font-semibold text-slate-600">
            <div className="rounded-xl bg-white px-2.5 py-2 text-center shadow-sm">1. Flow</div>
            <div className="rounded-xl bg-white px-2.5 py-2 text-center shadow-sm">2. Address</div>
            <div className="rounded-xl bg-white px-2.5 py-2 text-center shadow-sm">3. Payment</div>
          </div>

          <div className="space-y-3">
            {Object.entries(byProvider).map(([, provItems]) => (
              provItems.map((item) => (
                <div key={item.key} className="flex items-start gap-3 rounded-2xl border border-slate-100 bg-slate-50/80 px-3 py-3">
                  <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-white text-slate-500 shadow-sm">
                    <Package className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-slate-900">{item.title}</p>
                    {item.itemType === "product" && item.deliveryMethod ? (
                      <p className="mt-0.5 text-[11px] text-slate-400">{PRODUCT_DELIVERY_SUMMARY_LABELS[item.deliveryMethod]}</p>
                    ) : null}
                    <p className="text-xs text-slate-500">{item.providerName} · Qty {item.quantity}</p>
                  </div>
                  <p className="shrink-0 text-sm font-semibold text-slate-900">{INR(item.price * item.quantity)}</p>
                </div>
              ))
            ))}
          </div>

          <div className="mt-4 border-t border-slate-100 pt-4">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-slate-600">Total</span>
              <span className="text-base font-bold text-slate-900">{INR(totalPrice)}</span>
            </div>
            <div className="mt-3 grid grid-cols-2 gap-2">
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Selected flow</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{fulfillmentOption.shortLabel}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Payment</p>
                <p className="mt-1 text-sm font-semibold text-slate-900">{payMethod === "razorpay" ? "Online" : "On delivery"}</p>
              </div>
            </div>
            <p className="mt-3 text-[11px] leading-5 text-slate-500">{buildFulfillmentNextAction(fulfillmentMethod)}</p>
          </div>
        </section>

        {/* Delivery / fulfillment */}
        <section className="rounded-[1.6rem] bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5 lg:col-start-1">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <Package className="h-4 w-4 text-slate-500" />
            Delivery / Fulfillment
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3">
            {ORDER_FULFILLMENT_METHODS.map((method) => {
              const option = ORDER_FULFILLMENT_OPTIONS[method];
              const active = fulfillmentMethod === method;
              const recommended = recommendedFulfillmentMethod === method;
              const Icon = FULFILLMENT_ICONS[method];

              return (
                <button
                  key={method}
                  type="button"
                  onClick={() => {
                    setFulfillmentTouched(true);
                    setFulfillmentMethod(method);
                  }}
                  className={`rounded-2xl border p-3 text-left transition sm:p-4 ${
                    active ? "border-blue-500 bg-blue-50 shadow-[0_12px_28px_-24px_rgba(37,99,235,0.9)]" : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${active ? "bg-white text-blue-600" : "bg-slate-100 text-slate-600"}`}>
                      <Icon className="h-4 w-4" />
                    </span>
                    {recommended ? (
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-600">
                        Recommended
                      </span>
                    ) : null}
                  </div>
                  <p className="mt-2 text-sm font-semibold text-slate-900 sm:hidden">{option.shortLabel}</p>
                  <p className="mt-2 hidden text-sm font-semibold text-slate-900 sm:block">{option.label}</p>
                  <p className="mt-1 text-[11px] leading-4 text-slate-600 sm:text-xs sm:leading-5">{option.helperText}</p>
                </button>
              );
            })}
          </div>
          <div className="mt-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Selected flow</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{fulfillmentOption.label}</p>
            <p className="mt-1 text-xs leading-5 text-slate-600">{fulfillmentOption.helperText}</p>
            <p className="mt-2 text-[11px] text-slate-500">
              Cart recommendation: {recommendedFulfillmentOption.label}.
            </p>
            <p className="mt-1 text-[11px] text-slate-500">
              {buildFulfillmentRecommendation(recommendedFulfillmentMethod)}
            </p>
            <p className="mt-1 text-[11px] font-medium text-slate-600">{buildFulfillmentNextAction(fulfillmentMethod)}</p>
          </div>
        </section>

        {/* Delivery address */}
        <section className="rounded-[1.6rem] bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5 lg:col-start-1">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <MapPin className="h-4 w-4 text-slate-500" />
            {fulfillmentOption.addressLabel}
          </h2>
          <textarea
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none"
            placeholder={fulfillmentOption.addressPlaceholder}
            aria-label={fulfillmentOption.addressLabel}
            rows={3}
            maxLength={500}
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
          <p className="mt-2 text-[11px] text-slate-500">{fulfillmentOption.helperText}</p>
          <p className={`mt-1 text-right text-[11px] ${address.length > 480 ? "text-amber-500" : "text-slate-400"}`}>
            {address.length}/500
          </p>
          <textarea
            className="mt-3 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-blue-500 focus:ring-4 focus:ring-blue-500/10 resize-none"
            placeholder={buildNotesPlaceholder(fulfillmentMethod)}
            rows={2}
            maxLength={1000}
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
          />
        </section>

        {/* Payment method */}
        <section className="rounded-[1.6rem] bg-white p-4 shadow-sm sm:rounded-2xl sm:p-5 lg:col-start-1">
          <h2 className="mb-3 flex items-center gap-2 font-semibold text-slate-900">
            <CreditCard className="h-4 w-4 text-slate-500" />
            Payment Method
          </h2>
          <div className="grid grid-cols-2 gap-2.5 sm:gap-3" role="radiogroup" aria-label="Payment method">
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
                className={`flex flex-col items-start gap-2 rounded-2xl border p-3 transition text-left sm:p-4 ${
                  payMethod === opt.id
                    ? "border-blue-500 bg-blue-50 shadow-[0_12px_28px_-24px_rgba(37,99,235,0.9)]"
                    : opt.disabled
                    ? "border-slate-100 bg-slate-50 opacity-40 cursor-not-allowed"
                    : "border-slate-200 hover:border-slate-300"
                }`}
              >
                <span className={`inline-flex h-9 w-9 items-center justify-center rounded-xl ${payMethod === opt.id ? "bg-white" : "bg-slate-100"}`}>{opt.icon}</span>
                <span className="text-sm font-semibold text-slate-900">{opt.label}</span>
                <span className="text-[11px] leading-4 text-slate-500 sm:text-xs sm:leading-5">{opt.desc}</span>
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
          <div role="alert" className="flex items-start gap-3 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700 lg:col-start-1">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <span>{error}</span>
          </div>
        )}

        {/* CTA */}
        <button
          type="button"
          onClick={payMethod === "razorpay" ? handleRazorpay : handleCOD}
          disabled={busy}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-blue-600 py-4 text-base font-bold text-white shadow-lg transition hover:bg-blue-700 disabled:opacity-60 lg:col-start-1"
        >
          {busy ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Processing…</>
          ) : (
            payMethod === "razorpay" ? `Pay ${INR(totalPrice)}` : `Place Order — ${INR(totalPrice)}`
          )}
        </button>

        <p className="text-center text-xs text-slate-400 lg:col-start-1">
          By placing this order you agree to our terms of service.
        </p>
      </div>
    </div>
  );
}
