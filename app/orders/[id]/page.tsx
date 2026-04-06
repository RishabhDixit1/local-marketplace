"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  CheckCircle2,
  Clock3,
  CreditCard,
  Loader2,
  MapPin,
  Package,
  ThumbsDown,
  ThumbsUp,
  XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import type { CanonicalOrderStatus } from "@/lib/orderWorkflow";
import { getOrderFulfillmentOption, type OrderFulfillmentMethod } from "@/lib/orderFulfillment";
import { getOrderPaymentSummary, type PaymentStatusTone } from "@/lib/paymentFlow";

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const STATUS_LABEL: Record<CanonicalOrderStatus, string> = {
  new_lead: "Waiting for Provider",
  quoted: "Provider Sent Quote",
  accepted: "Order Accepted",
  in_progress: "In Progress",
  completed: "Completed",
  closed: "Closed",
  cancelled: "Cancelled",
  rejected: "Rejected",
};

const STATUS_COLOR: Record<CanonicalOrderStatus, string> = {
  new_lead: "bg-amber-100 text-amber-700 border-amber-200",
  quoted: "bg-blue-100 text-blue-700 border-blue-200",
  accepted: "bg-indigo-100 text-indigo-700 border-indigo-200",
  in_progress: "bg-purple-100 text-purple-700 border-purple-200",
  completed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  closed: "bg-emerald-100 text-emerald-700 border-emerald-200",
  cancelled: "bg-rose-100 text-rose-700 border-rose-200",
  rejected: "bg-rose-100 text-rose-700 border-rose-200",
};

const TIMELINE: CanonicalOrderStatus[] = ["new_lead", "accepted", "in_progress", "completed"];

const PAYMENT_TONE_STYLES: Record<PaymentStatusTone, string> = {
  emerald: "border-emerald-200 bg-emerald-50 text-emerald-700",
  amber: "border-amber-200 bg-amber-50 text-amber-700",
  blue: "border-blue-200 bg-blue-50 text-blue-700",
  slate: "border-slate-200 bg-slate-50 text-slate-700",
};

const formatTimestamp = (value: string | undefined) => {
  if (!value) return "Awaiting update";

  try {
    return new Date(value).toLocaleString("en-IN");
  } catch {
    return "Awaiting update";
  }
};

type OrderRow = {
  id: string;
  status: CanonicalOrderStatus;
  price: number | null;
  listing_type: string;
  consumer_id: string;
  provider_id: string | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
};

export default function OrderStatusPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [order, setOrder] = useState<OrderRow | null>(null);
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [actionError, setActionError] = useState("");

  const fetchOrder = useCallback(async () => {
    try {
      const res = await fetchAuthedJson<{ ok: boolean; order: OrderRow }>(supabase, `/api/orders/${id}`, { method: "GET" });
      if (res.ok && res.order) setOrder(res.order);
    } catch {
      // order stays null → shows "not found" UI
    }
    setLoading(false);
  }, [id]);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      setViewerId(user?.id ?? null);
    })();
    void fetchOrder();
  }, [fetchOrder]);

  // Real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel(`order:${id}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "orders", filter: `id=eq.${id}` }, (payload) => {
        setOrder((prev) => prev ? { ...prev, ...(payload.new as Partial<OrderRow>) } : null);
      })
      .subscribe();
    return () => { void supabase.removeChannel(channel); };
  }, [id]);

  const updateStatus = useCallback(async (nextStatus: CanonicalOrderStatus) => {
    setBusy(true); setActionError("");
    try {
      await fetchAuthedJson(supabase, `/api/orders/${id}`, {
        method: "PATCH",
        body: JSON.stringify({ status: nextStatus }),
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update order.");
    } finally {
      setBusy(false);
    }
  }, [id]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f4f2ee]">
        <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
      </div>
    );
  }

  if (!order) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-[#f4f2ee] gap-4 px-4">
        <XCircle className="h-12 w-12 text-rose-400" />
        <p className="font-semibold text-slate-700">Order not found or access denied.</p>
        <Link href="/dashboard/tasks" className="text-sm font-medium text-blue-600 hover:underline">Back to tasks</Link>
      </div>
    );
  }

  const isConsumer = viewerId === order.consumer_id;
  const isProvider = viewerId === order.provider_id;
  const status = order.status;
  const isFinal = ["completed", "closed", "cancelled", "rejected"].includes(status);

  const itemTitle =
    (order.metadata?.title as string | undefined) ??
    "Item";

  const itemCategory = (order.metadata?.category as string | undefined) ?? "";

  const address = order.metadata?.address as string | undefined;
  const notes = order.metadata?.notes as string | undefined;
  const paymentMethod = order.metadata?.payment_method;
  const paymentStatus = order.metadata?.payment_status as string | undefined;
  const paymentCollectedAt = order.metadata?.paid_at as string | undefined;
  const razorpayOrderId = order.metadata?.razorpay_order_id as string | undefined;
  const razorpayPaymentId = order.metadata?.razorpay_payment_id as string | undefined;
  const fulfillmentOption = getOrderFulfillmentOption(order.metadata?.fulfillment_method);
  const paymentSummary = getOrderPaymentSummary({
    paymentMethod,
    paymentStatus,
    fulfillmentMethod: order.metadata?.fulfillment_method as OrderFulfillmentMethod | undefined,
  });

  const timelineIdx = TIMELINE.indexOf(status);

  return (
    <div className="min-h-screen bg-[#f4f2ee]">
      {/* Top bar */}
      <div className="sticky top-0 z-40 border-b border-slate-200 bg-white/90 backdrop-blur-sm">
        <div className="mx-auto flex max-w-lg items-center gap-3 px-4 py-3">
          <button type="button" onClick={() => router.back()} className="flex h-8 w-8 items-center justify-center rounded-full hover:bg-slate-100 transition">
            <ArrowLeft className="h-4 w-4 text-slate-600" />
          </button>
          <span className="font-semibold text-slate-900">Order</span>
          <span className={`ml-auto rounded-full border px-3 py-0.5 text-xs font-semibold ${STATUS_COLOR[status]}`}>
            {STATUS_LABEL[status]}
          </span>
        </div>
      </div>

      <div className="mx-auto max-w-lg px-4 py-6 space-y-4">

        {/* Item card */}
        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-slate-100">
              <Package className="h-5 w-5 text-slate-500" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="font-semibold text-slate-900">{itemTitle}</p>
              {itemCategory && <p className="text-xs text-slate-500 capitalize">{itemCategory}</p>}
              <p className="mt-1 text-base font-bold text-slate-900">{order.price ? INR(order.price) : "Price TBD"}</p>
            </div>
          </div>
          <div
            className={`mt-3 flex items-center gap-2 rounded-xl border px-3 py-2 text-xs ${PAYMENT_TONE_STYLES[paymentSummary.tone]}`}
          >
            <CreditCard className="h-3.5 w-3.5" />
            {paymentSummary.methodLabel} • {paymentSummary.statusLabel}
          </div>
        </section>

        {/* Progress timeline */}
        {!["cancelled", "rejected"].includes(status) && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-sm font-semibold text-slate-700">Order Progress</h2>
            <div className="relative">
              {/* Track line */}
              <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-slate-100" />
              <div className="space-y-4">
                {TIMELINE.map((step, idx) => {
                  const done = timelineIdx >= idx;
                  const active = timelineIdx === idx;
                  return (
                    <div key={step} className="relative flex items-start gap-3 pl-10">
                      <div className={`absolute left-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        done ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200 bg-white text-slate-400"
                      } ${active ? "ring-4 ring-blue-100" : ""}`}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      </div>
                      <div className="pt-0.5">
                        <p className={`text-sm font-medium ${done ? "text-slate-900" : "text-slate-400"}`}>
                          {STATUS_LABEL[step]}
                        </p>
                        {active && <p className="text-xs text-blue-600">Current status</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        <section className="rounded-2xl bg-white p-5 shadow-sm">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Payment</p>
              <h2 className="mt-1 text-base font-semibold text-slate-900">{paymentSummary.heading}</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">{paymentSummary.detail}</p>
            </div>
            <span
              className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${PAYMENT_TONE_STYLES[paymentSummary.tone]}`}
            >
              {paymentSummary.statusLabel}
            </span>
          </div>

          <div className="mt-4 grid gap-3 sm:grid-cols-2">
            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Method</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{paymentSummary.methodLabel}</p>
              {paymentSummary.rails.length > 0 ? (
                <p className="mt-1 text-xs text-slate-500">{paymentSummary.rails.join(" • ")}</p>
              ) : (
                <p className="mt-1 text-xs text-slate-500">Payment details will appear here after checkout.</p>
              )}
            </div>

            <div className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Tracking</p>
              <p className="mt-1 text-sm font-semibold text-slate-900">{formatTimestamp(paymentCollectedAt)}</p>
              <p className="mt-1 text-xs text-slate-500">{paymentSummary.support}</p>
            </div>
          </div>

          {razorpayOrderId || razorpayPaymentId ? (
            <div className="mt-3 rounded-2xl border border-slate-200 bg-white px-4 py-3">
              <p className="text-[10px] font-semibold uppercase tracking-[0.14em] text-slate-500">Payment reference</p>
              {razorpayOrderId ? (
                <p className="mt-1 break-all font-mono text-xs text-slate-600">Order: {razorpayOrderId}</p>
              ) : null}
              {razorpayPaymentId ? (
                <p className="mt-1 break-all font-mono text-xs text-slate-600">Payment: {razorpayPaymentId}</p>
              ) : null}
            </div>
          ) : null}
        </section>

        {/* Delivery info */}
        <section className="rounded-2xl bg-white p-5 shadow-sm space-y-2">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">Fulfillment method</p>
          <p className="text-sm font-semibold text-slate-900">{fulfillmentOption.label}</p>
          <p className="text-xs leading-5 text-slate-600">{fulfillmentOption.description}</p>
        </section>

        {(address || notes) && (
          <section className="rounded-2xl bg-white p-5 shadow-sm space-y-2">
            <p className="text-xs font-semibold uppercase tracking-[0.12em] text-slate-500">{fulfillmentOption.addressLabel}</p>
            {address && (
              <div className="flex items-start gap-2 text-sm text-slate-700">
                <MapPin className="h-4 w-4 mt-0.5 shrink-0 text-slate-400" />
                <p>{address}</p>
              </div>
            )}
            {notes && (
              <p className="text-xs text-slate-500 italic pl-6">&ldquo;{notes}&rdquo;</p>
            )}
          </section>
        )}

        {/* Provider actions */}
        {isProvider && !isFinal && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Provider Actions</h2>
            <div className="grid grid-cols-2 gap-3">
              {status === "new_lead" && (
                <>
                  <button type="button" disabled={busy} onClick={() => void updateStatus("accepted")}
                    className="flex items-center justify-center gap-2 rounded-xl bg-emerald-500 py-3 text-sm font-semibold text-white transition hover:bg-emerald-600 disabled:opacity-60">
                    <ThumbsUp className="h-4 w-4" /> Accept
                  </button>
                  <button type="button" disabled={busy} onClick={() => void updateStatus("rejected")}
                    className="flex items-center justify-center gap-2 rounded-xl bg-rose-500 py-3 text-sm font-semibold text-white transition hover:bg-rose-600 disabled:opacity-60">
                    <ThumbsDown className="h-4 w-4" /> Reject
                  </button>
                </>
              )}
              {status === "accepted" && (
                <button type="button" disabled={busy} onClick={() => void updateStatus("in_progress")}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-purple-500 py-3 text-sm font-semibold text-white transition hover:bg-purple-600 disabled:opacity-60">
                  Mark In Progress
                </button>
              )}
              {status === "in_progress" && (
                <button type="button" disabled={busy} onClick={() => void updateStatus("completed")}
                  className="col-span-2 flex items-center justify-center gap-2 rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60">
                  <CheckCircle2 className="h-4 w-4" /> Mark Completed
                </button>
              )}
            </div>
          </section>
        )}

        {/* Consumer actions */}
        {isConsumer && !isFinal && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <button type="button" disabled={busy} onClick={() => void updateStatus("cancelled")}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 flex items-center justify-center gap-2">
              <XCircle className="h-4 w-4" /> Cancel Order
            </button>
          </section>
        )}

        {busy && <div className="flex justify-center"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>}

        {actionError && (
          <div role="alert" className="flex items-start gap-2 rounded-2xl border border-rose-100 bg-rose-50 p-4 text-sm text-rose-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            {actionError}
          </div>
        )}

        <div className="flex flex-col gap-2 sm:flex-row sm:gap-3">
          <Link href="/dashboard/tasks"
            className="w-full sm:flex-1 rounded-2xl border border-slate-200 bg-white py-3 text-center text-sm font-medium text-slate-700 transition hover:bg-slate-50">
            View All Orders
          </Link>
          <Link href="/"
            className="w-full sm:flex-1 rounded-2xl bg-blue-600 py-3 text-center text-sm font-semibold text-white transition hover:bg-blue-700">
            Continue Shopping
          </Link>
        </div>

        <p className="text-center text-xs text-slate-400">
          Order ID: <span className="font-mono">{order.id}</span>
        </p>
      </div>
    </div>
  );
}
