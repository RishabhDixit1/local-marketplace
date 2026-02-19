"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { Loader2 } from "lucide-react";

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

  const fetchOrders = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) return;

    const { data } = await supabase
      .from("orders")
      .select("*")
      .eq("consumer_id", user.id)
      .order("created_at", { ascending: false });

    if (data) setOrders(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchOrders();
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
              {order.listing_type.toUpperCase()}
            </div>
            <div className="text-sm text-slate-400">
              ₹ {order.price}
            </div>
            <div className="text-xs text-slate-500">
              Status: {order.status}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
