"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { AlertCircle, CheckCircle2, Loader2 } from "lucide-react";
import {
  canTransitionOrderStatus,
  getAllowedTransitions,
  getOrderStatusLabel,
  getOrderStatusPillClass,
  getTransitionActionLabel,
  normalizeOrderStatus,
  stageOrder,
  type CanonicalOrderStatus,
} from "@/lib/orderWorkflow";

type Order = {
  id: string;
  listing_type: string;
  price: number;
  status: string;
  consumer_id: string;
  provider_id: string;
  created_at: string;
};

export default function ProviderOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);
  const [liveNotice, setLiveNotice] = useState<string | null>(null);

  const loadOrders = useCallback(async (userId: string) => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("provider_id", userId)
      .order("created_at", { ascending: false });

    setOrders((data as Order[] | null) || []);
    setLoading(false);
  }, []);

  useEffect(() => {
    let isMounted = true;

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!isMounted) return;
      if (!user) {
        setLoading(false);
        return;
      }

      setProviderId(user.id);
      await loadOrders(user.id);
    })();

    return () => {
      isMounted = false;
    };
  }, [loadOrders]);

  useEffect(() => {
    if (!providerId) return;

    const channel = supabase
      .channel(`provider-orders-live-${providerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `provider_id=eq.${providerId}`,
        },
        (payload) => {
          if (payload.eventType === "INSERT") {
            setLiveNotice("New lead received in realtime.");
          }
          void loadOrders(providerId);
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [providerId, loadOrders]);

  useEffect(() => {
    if (!liveNotice) return;
    const timer = window.setTimeout(() => setLiveNotice(null), 3200);
    return () => window.clearTimeout(timer);
  }, [liveNotice]);

  const pipelineStats = useMemo(() => {
    const totals = {
      newLead: 0,
      quoted: 0,
      active: 0,
      completed: 0,
    };

    orders.forEach((order) => {
      const stage = normalizeOrderStatus(order.status);
      if (stage === "new_lead") totals.newLead += 1;
      if (stage === "quoted") totals.quoted += 1;
      if (["accepted", "in_progress"].includes(stage)) totals.active += 1;
      if (["completed", "closed"].includes(stage)) totals.completed += 1;
    });

    return totals;
  }, [orders]);

  const updateStatus = async (orderId: string, nextStatus: CanonicalOrderStatus) => {
    const currentOrder = orders.find((order) => order.id === orderId);
    if (!currentOrder) return;

    const canTransition = canTransitionOrderStatus({
      from: currentOrder.status,
      to: nextStatus,
      actor: "provider",
    });

    if (!canTransition) {
      alert("Invalid status transition for provider workflow.");
      return;
    }

    setBusyOrderId(orderId);
    const { error } = await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);

    if (error) {
      alert(`Unable to update order status: ${error.message}`);
      setBusyOrderId(null);
      return;
    }

    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order))
    );
    setBusyOrderId(null);
  };

  if (!providerId && !loading) {
    return (
      <div className="w-full max-w-[2200px] mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-700">
          Please log in as a provider to manage leads.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[2200px] mx-auto space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-indigo-600 via-purple-600 to-fuchsia-600 p-5 sm:p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">Lead Pipeline</h1>
        <p className="mt-1 text-sm text-white/90">
          Unified provider workflow with validated state transitions.
        </p>
        <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
          <MetricCard label="New Leads" value={pipelineStats.newLead} />
          <MetricCard label="Quoted" value={pipelineStats.quoted} />
          <MetricCard label="Active" value={pipelineStats.active} />
          <MetricCard label="Completed" value={pipelineStats.completed} />
        </div>
        {liveNotice && (
          <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-emerald-300/60 bg-emerald-500/20 px-3 py-2 text-xs font-semibold text-emerald-100">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {liveNotice}
          </div>
        )}
      </div>

      {loading && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          Loading lead pipeline...
        </div>
      )}

      {!loading && orders.length === 0 && (
        <div className="rounded-2xl border border-slate-200 bg-white p-6 text-slate-600">
          No leads yet. Publish services/products so nearby customers can find you.
        </div>
      )}

      <div className="space-y-4">
        {orders.map((order) => {
          const stage = normalizeOrderStatus(order.status);
          const activeStepIndex = stageOrder.findIndex((step) => step === stage);
          const isBusy = busyOrderId === order.id;
          const transitions = getAllowedTransitions(order.status, "provider");

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-sm text-slate-500">{order.listing_type.toUpperCase()} LEAD</p>
                  <p className="text-lg font-semibold text-slate-900">₹ {order.price}</p>
                  <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
                </div>
                <span
                  className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusPillClass(stage)}`}
                >
                  {getOrderStatusLabel(stage)}
                </span>
              </div>

              <div className="mt-4 grid gap-2 sm:grid-cols-6">
                {stageOrder.map((step, index) => {
                  const complete = activeStepIndex >= index;
                  return (
                    <div
                      key={`${order.id}-${step}`}
                      className={`rounded-xl border px-3 py-2 text-xs ${
                        complete
                          ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                          : "border-slate-200 bg-slate-50 text-slate-500"
                      }`}
                    >
                      {getOrderStatusLabel(step)}
                    </div>
                  );
                })}
              </div>

              {!!transitions.length && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {transitions.map((nextStatus) => (
                    <button
                      key={`${order.id}-${nextStatus}`}
                      onClick={() => void updateStatus(order.id, nextStatus)}
                      disabled={isBusy}
                      className={`inline-flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-medium transition-colors disabled:opacity-70 ${
                        ["rejected", "cancelled"].includes(nextStatus)
                          ? "bg-red-600 text-white hover:bg-red-500"
                          : ["completed", "closed"].includes(nextStatus)
                          ? "bg-emerald-600 text-white hover:bg-emerald-500"
                          : "bg-indigo-600 text-white hover:bg-indigo-500"
                      }`}
                    >
                      <CheckCircle2 size={14} />
                      {getTransitionActionLabel({ actor: "provider", nextStatus })}
                    </button>
                  ))}
                </div>
              )}

              {!transitions.length && (
                <div className="mt-4 inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                  <AlertCircle className="h-3.5 w-3.5" />
                  No further provider actions available.
                </div>
              )}

              {isBusy && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-xl bg-slate-100 px-3 py-2 text-sm text-slate-600">
                  <Loader2 size={14} className="animate-spin" />
                  Updating...
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/30 bg-white/15 p-3">
      <p className="text-xs uppercase tracking-wide text-white/80">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
