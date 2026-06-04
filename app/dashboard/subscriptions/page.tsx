"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  CheckCircle2,
  Crown,
  CreditCard,
  Loader2,
  Sparkles,
  Star,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import { appName } from "@/lib/branding";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

type Plan = {
  id: string;
  name: string;
  description: string;
  price_paise: number;
  interval: string;
  features: string[];
  highlighted: boolean;
};

type Subscription = {
  id: string;
  plan_id: string;
  status: string;
  current_period_end: string;
  plan: Plan;
};

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v / 100);

const PLAN_ICONS = [Sparkles, Star, Crown];
const PLAN_COLORS = ["slate", "blue", "amber"];

export default function SubscriptionsPage() {
  const [plans, setPlans] = useState<Plan[]>([]);
  const [currentSub, setCurrentSub] = useState<Subscription | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);
  const scriptLoadedRef = useRef(false);

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

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [plansRes, subRes] = await Promise.all([
        fetchAuthedJson<{ ok: boolean; plans: Plan[] }>(supabase, "/api/subscriptions/plans", { method: "GET" }),
        fetchAuthedJson<{ ok: boolean; subscription: Subscription | null }>(supabase, "/api/subscriptions/current", { method: "GET" }),
      ]);
      if (plansRes.ok) setPlans(plansRes.plans);
      if (subRes.ok) setCurrentSub(subRes.subscription);
    } catch {
      setError("Failed to load plans. Please refresh.");
    }
    setLoading(false);
  }, []);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const handleSubscribe = useCallback(async (plan: Plan) => {
    if (!razorpayAvailable || !window.Razorpay) {
      setError("Payment gateway not loaded. Please refresh.");
      return;
    }
    setBusy(true); setError(""); setSuccess("");

    try {
      const pgRes = await fetchAuthedJson<{
        ok: boolean; orderId: string; amount: number; currency: string; keyId: string; plan: Plan;
      }>(supabase, "/api/subscriptions/create-order", {
        method: "POST",
        body: JSON.stringify({ planId: plan.id }),
      });

      if (!pgRes.ok) throw new Error("Payment gateway unavailable.");

      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay!({
          key: pgRes.keyId,
          amount: pgRes.amount,
          currency: pgRes.currency,
          order_id: pgRes.orderId,
          name: appName,
          description: `${plan.name} — ${plan.interval}ly`,
          theme: { color: "#2563eb" },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              const verifyRes = await fetchAuthedJson<{ ok: boolean; subscription: Subscription }>(
                supabase, "/api/subscriptions/verify", {
                  method: "POST",
                  body: JSON.stringify({
                    razorpayOrderId: response.razorpay_order_id,
                    razorpayPaymentId: response.razorpay_payment_id,
                    razorpaySignature: response.razorpay_signature,
                    planId: plan.id,
                  }),
                }
              );
              if (!verifyRes.ok) throw new Error("Verification failed.");
              setCurrentSub(verifyRes.subscription);
              setSuccess(`${plan.name} plan activated!`);
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error("Verification failed."));
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
    } finally {
      setBusy(false);
    }
  }, [razorpayAvailable]);

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-4xl px-4 py-6 sm:px-6 sm:py-10">
      {/* Header */}
      <div className="mb-8 text-center">
        <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-1.5 text-xs font-semibold uppercase tracking-[0.16em] text-amber-700">
          <Crown className="h-3.5 w-3.5" />
          Grow Your Business
        </div>
        <h1 className="mt-4 text-2xl font-bold text-slate-900 sm:text-3xl">Choose your plan</h1>
        <p className="mt-2 text-sm text-slate-500">Unlock more visibility, trust signals, and growth tools for your business.</p>
      </div>

      {/* Current subscription banner */}
      {currentSub && currentSub.status === "active" && (
        <div className="mb-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-center text-sm text-emerald-800">
          You are currently on the <strong>{currentSub.plan.name}</strong> plan.
          {currentSub.current_period_end && (
            <> Valid until {new Date(currentSub.current_period_end).toLocaleDateString("en-IN")}.</>
          )}
        </div>
      )}

      {error && (
        <div className="mb-6 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700 text-center">
          {error}
        </div>
      )}

      {success && (
        <div className="mb-6 rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700 text-center flex items-center justify-center gap-2">
          <CheckCircle2 className="h-4 w-4" /> {success}
        </div>
      )}

      {/* Plans grid */}
      <div className="grid gap-6 sm:grid-cols-3">
        {plans.map((plan, idx) => {
          const PlanIcon = PLAN_ICONS[idx] || Sparkles;
          const isFree = plan.price_paise <= 0;
          const isCurrentPlan = currentSub?.plan_id === plan.id;
          const color = PLAN_COLORS[idx] || "slate";

          return (
            <div
              key={plan.id}
              className={`relative rounded-2xl border bg-white p-6 shadow-sm transition ${
                plan.highlighted ? "border-blue-300 ring-2 ring-blue-100" : "border-slate-200"
              } ${isCurrentPlan ? "border-emerald-300 ring-2 ring-emerald-100" : ""}`}
            >
              {plan.highlighted && !isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-blue-600 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                  Most Popular
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2 rounded-full bg-emerald-500 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-white">
                  Current Plan
                </div>
              )}

              <div className={`mb-4 inline-flex h-10 w-10 items-center justify-center rounded-xl ${
                color === "blue" ? "bg-blue-50 text-blue-600" :
                color === "amber" ? "bg-amber-50 text-amber-600" :
                "bg-slate-50 text-slate-600"
              }`}>
                <PlanIcon className="h-5 w-5" />
              </div>

              <h3 className="text-lg font-bold text-slate-900">{plan.name}</h3>
              <p className="mt-1 text-xs text-slate-500">{plan.description}</p>

              <div className="mt-4 flex items-baseline gap-1">
                {isFree ? (
                  <span className="text-3xl font-bold text-slate-900">Free</span>
                ) : (
                  <>
                    <span className="text-3xl font-bold text-slate-900">{INR(plan.price_paise)}</span>
                    <span className="text-sm text-slate-500">/{plan.interval}</span>
                  </>
                )}
              </div>

              <ul className="mt-5 space-y-2.5">
                {(plan.features as string[]).map((feature) => (
                  <li key={feature} className="flex items-start gap-2 text-xs text-slate-600">
                    <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-500" />
                    <span>{feature}</span>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                disabled={busy || isCurrentPlan || isFree}
                onClick={() => void handleSubscribe(plan)}
                className={`mt-6 w-full rounded-xl py-3 text-sm font-semibold transition disabled:opacity-50 ${
                  isCurrentPlan
                    ? "border border-slate-200 bg-slate-50 text-slate-400 cursor-default"
                    : plan.highlighted
                    ? "bg-blue-600 text-white hover:bg-blue-700"
                    : "border border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                }`}
              >
                {busy ? <><Loader2 className="mr-2 inline h-4 w-4 animate-spin" /> Processing...</> :
                 isCurrentPlan ? "Current Plan" :
                 isFree ? "Free" : `Subscribe — ${INR(plan.price_paise)}`}
              </button>
            </div>
          );
        })}
      </div>

      {/* Feature comparison note */}
      <div className="mt-10 rounded-2xl border border-slate-200 bg-slate-50 p-6 text-center text-sm text-slate-500">
        All plans include access to the {appName} marketplace, community feed, and real-time chat.
        Prices are inclusive of all taxes. Subscriptions auto-renew monthly. Cancel anytime.
      </div>
    </div>
  );
}
