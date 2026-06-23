"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import {
  AlertCircle,
  ArrowLeft,
  Camera,
  CheckCircle2,
  Clock3,
  CreditCard,
  FileText,
  Gavel,
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
import {
  needsDeliveryTracking,
  getDeliveryStatusLabel,
  getDeliveryStatusDescription,
  getDeliveryStatusPillClass,
  deliveryTimelineSteps,
  normalizeDeliveryStatus,
  getAllowedDeliveryTransitions,
  type DeliveryInfo,
  type DeliveryStatus,
} from "@/lib/deliveryWorkflow";
import BookingSlotPicker from "@/app/components/BookingSlotPicker";
import DisputeFormModal from "@/app/components/DisputeFormModal";

declare global {
  interface Window {
    Razorpay?: new (opts: Record<string, unknown>) => { open: () => void };
  }
}

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

const STATUS_LABEL: Record<CanonicalOrderStatus, string> = {
  new_lead: "Waiting for Provider",
  quoted: "Provider Sent Quote",
  accepted: "Order Accepted",
  paid: "Payment Received",
  payment_failed: "Payment Failed",
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
  paid: "bg-emerald-100 text-emerald-700 border-emerald-200",
  payment_failed: "bg-rose-100 text-rose-700 border-rose-200",
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
  const [disputeLoading] = useState(false);
  const [disputeSent, setDisputeSent] = useState(false);
  const [showDisputeForm, setShowDisputeForm] = useState(false);
  const [razorpayAvailable, setRazorpayAvailable] = useState(false);
  const [orderRealtimeHealth, setOrderRealtimeHealth] = useState<"connected" | "degraded">("connected");
  const scriptLoadedRef = useRef(false);

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
      .subscribe((status) => {
        if (status === "SUBSCRIBED") setOrderRealtimeHealth("connected");
        else if (["CHANNEL_ERROR", "TIMED_OUT", "CLOSED"].includes(status)) setOrderRealtimeHealth("degraded");
      });
    return () => { setOrderRealtimeHealth("connected"); void supabase.removeChannel(channel); };
  }, [id]);

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

  const updateDeliveryStatus = useCallback(async (nextStatus: DeliveryStatus, extra?: Record<string, string | undefined>) => {
    setBusy(true); setActionError("");
    try {
      const res = await fetchAuthedJson<{ ok: boolean; delivery: DeliveryInfo }>(supabase, `/api/orders/${id}/delivery`, {
        method: "POST",
        body: JSON.stringify({ status: nextStatus, ...extra }),
      });
      if (res.ok && res.delivery) {
        setOrder((prev) => prev ? { ...prev, metadata: { ...prev.metadata, delivery: res.delivery } } : null);
      }
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Failed to update delivery.");
    } finally {
      setBusy(false);
    }
  }, [id]);

  const raiseDispute = useCallback(async () => {
    setShowDisputeForm(true);
  }, []);

  const handlePayNow = useCallback(async () => {
    if (!razorpayAvailable || !window.Razorpay || !order?.price) return;
    setBusy(true); setActionError("");
    try {
      const amountPaise = Math.round(order.price * 100);
      const pgRes = await fetchAuthedJson<{
        ok: boolean; orderId: string; amount: number; currency: string; keyId: string;
      }>(supabase, "/api/payment/create-order", {
        method: "POST",
        body: JSON.stringify({ amount: amountPaise, receipt: `ord_${order.id}_${Date.now()}` }),
      });
      if (!pgRes.ok) throw new Error("Payment gateway unavailable.");
      await new Promise<void>((resolve, reject) => {
        const rz = new window.Razorpay!({
          key: pgRes.keyId,
          amount: pgRes.amount,
          currency: pgRes.currency,
          order_id: pgRes.orderId,
          name: "ServiQ",
          description: `Order #${order.id.slice(0, 8).toUpperCase()}`,
          theme: { color: "#2563eb" },
          handler: async (response: {
            razorpay_order_id: string;
            razorpay_payment_id: string;
            razorpay_signature: string;
          }) => {
            try {
              await fetchAuthedJson(supabase, "/api/payment/verify", {
                method: "POST",
                body: JSON.stringify({
                  razorpayOrderId: response.razorpay_order_id,
                  razorpayPaymentId: response.razorpay_payment_id,
                  razorpaySignature: response.razorpay_signature,
                  serviQOrderIds: [order.id],
                }),
              });
              resolve();
            } catch (e) {
              reject(e instanceof Error ? e : new Error("Payment verification failed."));
            }
          },
          modal: { ondismiss: () => { setBusy(false); reject(new Error("Payment cancelled.")); } },
        });
        rz.open();
      });
    } catch (e) {
      setActionError(e instanceof Error ? e.message : "Payment failed.");
    } finally {
      setBusy(false);
    }
  }, [order, razorpayAvailable]);

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
  const fulfillmentMethod = order.metadata?.fulfillment_method as string | undefined;
  const fulfillmentOption = getOrderFulfillmentOption(fulfillmentMethod);
  const paymentSummary = getOrderPaymentSummary({
    paymentMethod,
    paymentStatus,
    fulfillmentMethod: fulfillmentMethod as OrderFulfillmentMethod | undefined,
  });

  const showDelivery = needsDeliveryTracking(fulfillmentMethod);
  const deliveryInfo = (order.metadata?.delivery as DeliveryInfo | undefined) ?? null;
  const deliveryStatus = deliveryInfo?.status ? normalizeDeliveryStatus(deliveryInfo.status) : null;

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
          {orderRealtimeHealth === "degraded" && (
            <span className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[11px] font-semibold text-rose-700">
              <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />
              Reconnecting
            </span>
          )}
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

        {/* Delivery tracking */}
        {showDelivery && deliveryInfo && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-sm font-semibold text-slate-700">Delivery Tracking</h2>
              <span className={`rounded-full border px-3 py-1 text-[11px] font-semibold ${getDeliveryStatusPillClass(deliveryStatus ?? "pending")}`}>
                {getDeliveryStatusLabel(deliveryStatus ?? "pending")}
              </span>
            </div>

            {deliveryInfo.trackingNumber && (
              <div className="mb-3 flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                <Package className="h-4 w-4 text-slate-400" />
                <div className="text-xs">
                  <p className="font-medium text-slate-700">Tracking # {deliveryInfo.trackingNumber}</p>
                  {deliveryInfo.carrier && <p className="text-slate-500">via {deliveryInfo.carrier}</p>}
                </div>
              </div>
            )}

            {/* Delivery photos */}
            {deliveryInfo.photoUrls && deliveryInfo.photoUrls.length > 0 && (
              <div className="mb-3 flex flex-wrap gap-2">
                {deliveryInfo.photoUrls.map((url, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer"
                    className="block h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt={`Delivery photo ${i + 1}`} className="h-full w-full object-cover" />
                  </a>
                ))}
              </div>
            )}

            {/* Upload photo button (provider only, not final) */}
            {isProvider && !isFinal && (
              <div className="mb-3">
                <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-blue-200 bg-blue-50 px-4 py-2 text-xs font-semibold text-blue-700 transition hover:bg-blue-100">
                  <Camera className="h-4 w-4" />
                  Add Photo
                  <input
                    type="file"
                    accept="image/*"
                    className="hidden"
                    onChange={async (e) => {
                      const file = e.target.files?.[0];
                      if (!file) return;
                      const formData = new FormData();
                      formData.append("file", file);
                      setBusy(true);
                      try {
                        const session = await supabase.auth.getSession();
                        const token = session.data.session?.access_token;
                        await fetch(`/api/orders/${id}/delivery/photos`, {
                          method: "POST",
                          headers: token ? { Authorization: `Bearer ${token}` } : {},
                          body: formData,
                        });
                      } catch {
                        // silently fail, photo attachment is optional
                      } finally {
                        setBusy(false);
                        e.target.value = "";
                      }
                    }}
                  />
                </label>
              </div>
            )}

            <div className="relative">
              <div className="absolute left-[18px] top-0 bottom-0 w-0.5 bg-slate-100" />
              <div className="space-y-4">
                {deliveryTimelineSteps.map((step, idx) => {
                  const done = deliveryStatus
                    ? deliveryTimelineSteps.indexOf(deliveryStatus as typeof step) >= idx
                    : false;
                  const active = step === deliveryStatus;
                  const stepTimestamp = deliveryInfo?.updates?.find(
                    (u) => normalizeDeliveryStatus(u.status) === step
                  )?.timestamp;
                  return (
                    <div key={step} className="relative flex items-start gap-3 pl-10">
                      <div className={`absolute left-0 flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 transition ${
                        done ? "border-blue-500 bg-blue-500 text-white" : "border-slate-200 bg-white text-slate-400"
                      } ${active ? "ring-4 ring-blue-100" : ""}`}>
                        {done ? <CheckCircle2 className="h-4 w-4" /> : <Clock3 className="h-4 w-4" />}
                      </div>
                      <div className="pt-0.5">
                        <p className={`text-sm font-medium ${done ? "text-slate-900" : "text-slate-400"}`}>
                          {getDeliveryStatusLabel(step)}
                        </p>
                        <p className="text-xs text-slate-500">{getDeliveryStatusDescription(step)}</p>
                        {stepTimestamp && (
                          <p className="mt-0.5 text-[11px] text-slate-400">{formatTimestamp(stepTimestamp)}</p>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>
        )}

        {/* Assign delivery (provider, no delivery info yet) */}
        {showDelivery && isProvider && !deliveryInfo && !isFinal && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Assign Delivery</h2>
            <form
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const formData = new FormData(form);
                void updateDeliveryStatus("assigned", {
                  driverName: (formData.get("driverName") as string) || undefined,
                  driverPhone: (formData.get("driverPhone") as string) || undefined,
                  trackingNumber: (formData.get("trackingNumber") as string) || undefined,
                  carrier: (formData.get("carrier") as string) || undefined,
                });
              }}
              className="space-y-3"
            >
              <input name="driverName" placeholder="Driver name" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
              <input name="driverPhone" placeholder="Driver phone" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
              <input name="trackingNumber" placeholder="Tracking number" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
              <input name="carrier" placeholder="Carrier (e.g. Delhivery, Shadowfax)" className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-blue-400" />
              <button type="submit" disabled={busy} className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2">
                {busy ? <><Loader2 className="h-4 w-4 animate-spin" /> Saving...</> : <>Start Delivery</>}
              </button>
            </form>
          </section>
        )}

        {/* Provider delivery actions */}
        {showDelivery && isProvider && deliveryStatus && !isFinal && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <h2 className="mb-3 text-sm font-semibold text-slate-700">Update Delivery</h2>
            <div className="grid grid-cols-2 gap-3">
              {getAllowedDeliveryTransitions(deliveryStatus).map((nextStatus) => (
                <button
                  key={nextStatus}
                  type="button"
                  disabled={busy}
                  onClick={() => void updateDeliveryStatus(nextStatus)}
                  className="flex items-center justify-center gap-2 rounded-xl border border-blue-200 bg-blue-50 py-3 text-sm font-semibold text-blue-700 transition hover:bg-blue-100 disabled:opacity-60"
                >
                  {nextStatus === "delivered" ? <CheckCircle2 className="h-4 w-4" /> : null}
                  {nextStatus === "picked_up" ? <Package className="h-4 w-4" /> : null}
                  {nextStatus === "in_transit" ? <MapPin className="h-4 w-4" /> : null}
                  {nextStatus === "failed" ? <XCircle className="h-4 w-4" /> : null}
                  {nextStatus === "assigned" ? <Clock3 className="h-4 w-4" /> : null}
                  Mark {getDeliveryStatusLabel(nextStatus as DeliveryStatus)}
                </button>
              ))}
            </div>
          </section>
        )}

        {/* Booking slot picker (visible when order is accepted) */}
        {status === "accepted" && order.provider_id && (
          <section className="rounded-2xl bg-white p-5 shadow-sm">
            <BookingSlotPicker
              orderId={id}
              providerId={order.provider_id}
              onBooked={() => setOrder((prev) => prev ? { ...prev, status: "accepted" } : null)}
            />
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
          <section className="rounded-2xl bg-white p-5 shadow-sm space-y-3">
            {paymentStatus === "pending" && (
              <button
                type="button"
                disabled={busy || !razorpayAvailable}
                onClick={() => void handlePayNow()}
                className="w-full rounded-xl bg-blue-600 py-3 text-sm font-semibold text-white transition hover:bg-blue-700 disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {busy ? (
                  <><Loader2 className="h-4 w-4 animate-spin" /> Processing...</>
                ) : (
                  <><CreditCard className="h-4 w-4" /> Pay Now {order.price ? INR(order.price) : ""}</>
                )}
              </button>
            )}
            <button type="button" disabled={busy} onClick={() => void updateStatus("cancelled")}
              className="w-full rounded-xl border border-rose-200 bg-rose-50 py-3 text-sm font-semibold text-rose-600 transition hover:bg-rose-100 disabled:opacity-60 flex items-center justify-center gap-2">
              <XCircle className="h-4 w-4" /> Cancel Order
            </button>
          </section>
        )}

        {isFinal && !disputeSent ? (
          <section className="rounded-2xl border border-amber-200 bg-amber-50 p-5 shadow-sm">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-amber-800">
              <Gavel className="h-4 w-4" /> Need help?
            </h2>
            <p className="mt-1 text-xs text-amber-700">
              If something went wrong with this order, you can file a dispute for review.
            </p>
            <button
              type="button"
              disabled={disputeLoading}
              onClick={() => void raiseDispute()}
              className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-amber-300 bg-white px-4 py-2 text-xs font-semibold text-amber-800 transition hover:bg-amber-100 disabled:opacity-50"
            >
              {disputeLoading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Gavel className="h-3.5 w-3.5" />}
              Raise Dispute
            </button>
          </section>
        ) : null}

        {disputeSent ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-700">
            Dispute submitted. An admin will review and follow up.
          </div>
        ) : null}

        {status === "completed" ? (
          <InvoiceSection orderId={id} />
        ) : null}

        <DisputeFormModal
          orderId={id}
          open={showDisputeForm}
          onClose={() => setShowDisputeForm(false)}
          onSuccess={() => setDisputeSent(true)}
        />

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

function InvoiceSection({ orderId }: { orderId: string }) {
  const [invoiceUrl, setInvoiceUrl] = useState<string | null>(null);
  const [generating, setGenerating] = useState(false);

  useEffect(() => {
    (async () => {
      const res = await fetch(`/api/invoices?orderId=${orderId}`);
      if (res.ok) {
        const body = (await res.json()) as { invoice: { id: string } };
        setInvoiceUrl(`/dashboard/invoices/${body.invoice.id}`);
      }
    })();
  }, [orderId]);

  const generate = async () => {
    setGenerating(true);
    try {
      const res = await fetch("/api/invoices/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderId }),
      });
      if (res.ok) {
        const body = (await res.json()) as { invoiceId: string };
        setInvoiceUrl(`/dashboard/invoices/${body.invoiceId}`);
      }
    } finally {
      setGenerating(false);
    }
  };

  if (invoiceUrl) {
    return (
      <Link href={invoiceUrl}
        className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-slate-300"
      >
        <div className="flex items-center gap-3">
          <div className="rounded-xl bg-slate-100 p-2">
            <FileText className="h-5 w-5 text-slate-600" />
          </div>
          <div>
            <p className="text-sm font-semibold text-slate-900">Tax Invoice</p>
            <p className="text-xs text-slate-500">View or download invoice</p>
          </div>
        </div>
        <span className="text-xs font-semibold text-slate-900">View &rarr;</span>
      </Link>
    );
  }

  return (
    <button
      type="button"
      disabled={generating}
      onClick={generate}
      className="flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-4 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
    >
      {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <FileText className="h-4 w-4" />}
      {generating ? "Generating invoice..." : "Generate Tax Invoice"}
    </button>
  );
}
