"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

type Order = {
  id: string;
  status: string;
  price: number;
  created_at: string;
};

const normalizeLeadStatus = (status: string) => {
  const lower = (status || "").toLowerCase();
  if (["new_lead", "lead", "pending"].includes(lower)) return "new_lead";
  if (lower === "quoted") return "quoted";
  if (["accepted", "in_progress"].includes(lower)) return "accepted";
  if (["completed", "closed"].includes(lower)) return "completed";
  if (["rejected", "cancelled"].includes(lower)) return "rejected";
  return "new_lead";
};

const statusLabel = (status: string) => {
  const stage = normalizeLeadStatus(status);
  if (stage === "new_lead") return "New lead received";
  if (stage === "quoted") return "Provider sent quote";
  if (stage === "accepted") return "Quote accepted";
  if (stage === "completed") return "Completed";
  return "Rejected";
};

export default function ConsumerOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;

    void supabase.auth.getUser().then(async ({ data }) => {
      if (!isMounted) return;
      if (!data.user) {
        setLoading(false);
        return;
      }

      const { data: orderRows } = await supabase
        .from("orders")
        .select("*")
        .eq("consumer_id", data.user.id)
        .order("created_at", { ascending: false });

      if (!isMounted) return;
      if (orderRows) setOrders(orderRows);
      setLoading(false);
    });

    return () => {
      isMounted = false;
    };
  }, []);

  if (loading)
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin" />
      </div>
    );

  return (
    <div className="min-h-screen bg-slate-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">My Orders</h1>

      <div className="space-y-4">
        {orders.map((order) => (
          <div
            key={order.id}
            className="p-5 bg-slate-900 rounded-xl border border-slate-800"
          >
            <div className="font-semibold">
              LOCAL LEAD
            </div>
            <div className="text-sm text-slate-400">
              ₹ {order.price}
            </div>
            <div className="mt-2 text-xs">
              <span className="rounded-full bg-slate-800 px-2 py-1 text-slate-300">
                {statusLabel(order.status)}
              </span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
