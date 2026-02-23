"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import { CheckCircle2, Clock3, Loader2, Send, XCircle } from "lucide-react";

type Order = {
  id: string;
  listing_type: string;
  price: number;
  status: string;
  consumer_id: string;
  provider_id: string;
  created_at: string;
};

type LeadStage = "new_lead" | "quoted" | "accepted" | "completed" | "rejected";

const stageOrder: LeadStage[] = ["new_lead", "quoted", "accepted", "completed"];

const normalizeLeadStatus = (status: string): LeadStage => {
  const lower = (status || "").toLowerCase();
  if (["new_lead", "lead", "pending"].includes(lower)) return "new_lead";
  if (lower === "quoted") return "quoted";
  if (["accepted", "in_progress"].includes(lower)) return "accepted";
  if (["completed", "closed"].includes(lower)) return "completed";
  if (["rejected", "cancelled"].includes(lower)) return "rejected";
  return "new_lead";
};

const statusPillClass = (status: LeadStage) => {
  if (status === "new_lead") return "bg-amber-500/20 text-amber-300";
  if (status === "quoted") return "bg-blue-500/20 text-blue-300";
  if (status === "accepted") return "bg-indigo-500/20 text-indigo-300";
  if (status === "completed") return "bg-emerald-500/20 text-emerald-300";
  return "bg-red-500/20 text-red-300";
};

const statusLabel = (status: LeadStage) => {
  if (status === "new_lead") return "New Lead";
  if (status === "quoted") return "Quoted";
  if (status === "accepted") return "Accepted";
  if (status === "completed") return "Completed";
  return "Rejected";
};

export default function ProviderOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  const loadOrders = async (userId: string) => {
    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("provider_id", userId)
      .order("created_at", { ascending: false });

    setOrders((data as Order[] | null) || []);
    setLoading(false);
  };

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
  }, []);

  const pipelineStats = useMemo(() => {
    const totals = {
      newLead: 0,
      quoted: 0,
      accepted: 0,
      completed: 0,
    };

    orders.forEach((order) => {
      const stage = normalizeLeadStatus(order.status);
      if (stage === "new_lead") totals.newLead += 1;
      if (stage === "quoted") totals.quoted += 1;
      if (stage === "accepted") totals.accepted += 1;
      if (stage === "completed") totals.completed += 1;
    });

    return totals;
  }, [orders]);

  const updateStatus = async (orderId: string, nextStatus: LeadStage) => {
    setBusyOrderId(orderId);
    await supabase.from("orders").update({ status: nextStatus }).eq("id", orderId);
    setOrders((current) =>
      current.map((order) => (order.id === orderId ? { ...order, status: nextStatus } : order))
    );
    setBusyOrderId(null);
  };

  if (!providerId && !loading) {
    return (
      <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black p-6 text-white">
        <p className="text-slate-300">Please log in as a provider to manage leads.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black p-6 text-white">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="rounded-3xl border border-indigo-500/30 bg-gradient-to-r from-indigo-600/25 to-pink-600/20 p-5 sm:p-6">
          <h1 className="text-2xl font-bold">Lead Pipeline</h1>
          <p className="mt-1 text-sm text-slate-200">
            Track each customer journey: new lead, quoted, accepted, and completed.
          </p>
          <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
            <MetricCard label="New Leads" value={pipelineStats.newLead} />
            <MetricCard label="Quoted" value={pipelineStats.quoted} />
            <MetricCard label="Accepted" value={pipelineStats.accepted} />
            <MetricCard label="Completed" value={pipelineStats.completed} />
          </div>
        </div>

        {loading && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
            Loading lead pipeline...
          </div>
        )}

        {!loading && orders.length === 0 && (
          <div className="rounded-2xl border border-slate-800 bg-slate-900/70 p-6 text-slate-300">
            No leads yet. Publish services/products so nearby customers can find you.
          </div>
        )}

        <div className="space-y-4">
          {orders.map((order) => {
            const stage = normalizeLeadStatus(order.status);
            const activeStepIndex = stageOrder.findIndex((step) => step === stage);
            const isBusy = busyOrderId === order.id;

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="rounded-2xl border border-slate-800 bg-slate-900 p-5"
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <p className="text-sm text-slate-400">{order.listing_type.toUpperCase()} LEAD</p>
                    <p className="text-lg font-semibold">₹ {order.price}</p>
                    <p className="text-xs text-slate-500">{new Date(order.created_at).toLocaleString()}</p>
                  </div>
                  <span className={`rounded-full px-3 py-1 text-xs font-semibold ${statusPillClass(stage)}`}>
                    {statusLabel(stage)}
                  </span>
                </div>

                <div className="mt-4 grid gap-2 sm:grid-cols-4">
                  {stageOrder.map((step, index) => {
                    const complete = activeStepIndex >= index;
                    return (
                      <div
                        key={`${order.id}-${step}`}
                        className={`rounded-xl border px-3 py-2 text-xs ${
                          complete
                            ? "border-emerald-500/40 bg-emerald-500/10 text-emerald-300"
                            : "border-slate-700 bg-slate-950 text-slate-500"
                        }`}
                      >
                        {statusLabel(step)}
                      </div>
                    );
                  })}
                </div>

                <div className="mt-4 flex flex-wrap gap-2">
                  {stage === "new_lead" && (
                    <>
                      <button
                        onClick={() => updateStatus(order.id, "quoted")}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium hover:bg-blue-500 disabled:opacity-70"
                      >
                        <Send size={14} />
                        Send Quote
                      </button>
                      <button
                        onClick={() => updateStatus(order.id, "rejected")}
                        disabled={isBusy}
                        className="inline-flex items-center gap-2 rounded-xl bg-red-600 px-4 py-2 text-sm font-medium hover:bg-red-500 disabled:opacity-70"
                      >
                        <XCircle size={14} />
                        Reject
                      </button>
                    </>
                  )}

                  {stage === "quoted" && (
                    <button
                      onClick={() => updateStatus(order.id, "accepted")}
                      disabled={isBusy}
                      className="inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-4 py-2 text-sm font-medium hover:bg-indigo-500 disabled:opacity-70"
                    >
                      <Clock3 size={14} />
                      Mark Accepted
                    </button>
                  )}

                  {stage === "accepted" && (
                    <button
                      onClick={() => updateStatus(order.id, "completed")}
                      disabled={isBusy}
                      className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2 text-sm font-medium hover:bg-emerald-500 disabled:opacity-70"
                    >
                      <CheckCircle2 size={14} />
                      Mark Completed
                    </button>
                  )}

                  {isBusy && (
                    <span className="inline-flex items-center gap-2 rounded-xl bg-slate-800 px-3 py-2 text-sm text-slate-300">
                      <Loader2 size={14} className="animate-spin" />
                      Updating...
                    </span>
                  )}
                </div>
              </motion.div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-slate-950/80 p-3">
      <p className="text-xs uppercase tracking-wide text-slate-400">{label}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
