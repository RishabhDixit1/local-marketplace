"use client";

import { useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";
import {
  canTransitionOrderStatus,
  getAllowedTransitions,
  getOrderStatusDescription,
  getOrderStatusLabel,
  getOrderStatusPillClass,
  getTransitionActionLabel,
  normalizeOrderStatus,
  type CanonicalOrderStatus,
} from "@/lib/orderWorkflow";

type Order = {
  id: string;
  listing_type: string;
  status: string;
  price: number;
  created_at: string;
};

export default function ConsumerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [consumerId, setConsumerId] = useState<string | null>(null);
  const [busyOrderId, setBusyOrderId] = useState<string | null>(null);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getUser().then(async ({ data }) => {
      if (!isMounted) return;
      if (!data.user) {
        setLoading(false);
        return;
      }

      setConsumerId(data.user.id);

      const { data: orderRows } = await supabase
        .from("orders")
        .select("id,listing_type,status,price,created_at")
        .eq("consumer_id", data.user.id)
        .order("created_at", { ascending: false });

      if (!isMounted) return;
      setOrders((orderRows as Order[] | null) || []);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  const orderSummary = useMemo(() => {
    return {
      total: orders.length,
      active: orders.filter((order) => ["new_lead", "quoted", "accepted", "in_progress"].includes(normalizeOrderStatus(order.status))).length,
      completed: orders.filter((order) => ["completed", "closed"].includes(normalizeOrderStatus(order.status))).length,
    };
  }, [orders]);

  const updateStatus = async (orderId: string, nextStatus: CanonicalOrderStatus) => {
    const currentOrder = orders.find((order) => order.id === orderId);
    if (!currentOrder || !consumerId) return;

    const canTransition = canTransitionOrderStatus({
      from: currentOrder.status,
      to: nextStatus,
      actor: "consumer",
    });

    if (!canTransition) {
      alert("Invalid status transition for consumer workflow.");
      return;
    }

    setBusyOrderId(orderId);
    const { error } = await supabase
      .from("orders")
      .update({ status: nextStatus })
      .eq("id", orderId)
      .eq("consumer_id", consumerId);

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

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  if (!consumerId) {
    return (
      <div className="w-full max-w-[2200px] mx-auto">
        <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4 text-slate-700">
          Please log in to view your orders.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full max-w-[2200px] mx-auto space-y-6">
      <div className="rounded-3xl bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-900 p-5 sm:p-6 text-white shadow-lg">
        <h1 className="text-2xl font-bold">My Orders</h1>
        <p className="mt-1 text-sm text-white/85">Consumer workflow with validated transitions.</p>
        <div className="mt-4 grid grid-cols-3 gap-3 text-sm">
          <Metric label="Total" value={orderSummary.total} />
          <Metric label="Active" value={orderSummary.active} />
          <Metric label="Completed" value={orderSummary.completed} />
        </div>
      </div>

      <div className="space-y-4">
        {orders.map((order) => {
          const normalizedStatus = normalizeOrderStatus(order.status);
          const transitions = getAllowedTransitions(order.status, "consumer");
          const isBusy = busyOrderId === order.id;

          return (
            <div
              key={order.id}
              className="p-5 bg-white rounded-xl border border-slate-200 shadow-sm"
            >
              <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="font-semibold text-slate-900">
                    {order.listing_type.toUpperCase()}
                  </div>
                  <div className="text-sm text-slate-500">₹ {order.price}</div>
                  <div className="text-xs text-slate-400 mt-1">{new Date(order.created_at).toLocaleString()}</div>
                </div>
                <span className={`rounded-full px-3 py-1 text-xs font-semibold ${getOrderStatusPillClass(normalizedStatus)}`}>
                  {getOrderStatusLabel(normalizedStatus)}
                </span>
              </div>

              <p className="mt-2 text-xs text-slate-500">{getOrderStatusDescription(normalizedStatus)}</p>

              {!!transitions.length && (
                <div className="mt-4 flex flex-wrap gap-2">
                  {transitions.map((nextStatus) => (
                    <button
                      key={`${order.id}-${nextStatus}`}
                      onClick={() => void updateStatus(order.id, nextStatus)}
                      disabled={isBusy}
                      className={`rounded-lg px-3 py-1.5 text-sm font-semibold transition-colors disabled:opacity-70 ${
                        ["cancelled"].includes(nextStatus)
                          ? "bg-rose-100 text-rose-700 hover:bg-rose-200"
                          : ["completed", "closed"].includes(nextStatus)
                          ? "bg-emerald-100 text-emerald-700 hover:bg-emerald-200"
                          : "bg-indigo-100 text-indigo-700 hover:bg-indigo-200"
                      }`}
                    >
                      {getTransitionActionLabel({ actor: "consumer", nextStatus })}
                    </button>
                  ))}
                </div>
              )}

              {!transitions.length && (
                <p className="mt-3 text-xs text-slate-400">No further actions for this order.</p>
              )}

              {isBusy && (
                <div className="mt-3 inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-xs text-slate-600">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  Updating...
                </div>
              )}
            </div>
          );
        })}

        {orders.length === 0 && (
          <div className="rounded-xl border border-slate-200 bg-white p-6 text-slate-500">
            No orders yet.
          </div>
        )}
      </div>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl border border-white/20 bg-white/10 p-3">
      <p className="text-xs uppercase tracking-wide text-white/80">{label}</p>
      <p className="mt-1 text-2xl font-semibold text-white">{value}</p>
    </div>
  );
}
