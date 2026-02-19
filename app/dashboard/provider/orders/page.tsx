"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { motion } from "framer-motion";
import {
  CheckCircle,
  XCircle,
  Clock,
  Loader2,
} from "lucide-react";

type Order = {
  id: string;
  listing_type: string;
  price: number;
  status: string;
  consumer_id: string;
  provider_id: string;
  created_at: string;
};

export default function OrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [userId, setUserId] = useState<string | null>(null);

  // ---------------- GET USER ----------------
  const getUser = async () => {
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (user) setUserId(user.id);
  };

  // ---------------- FETCH ORDERS ----------------
  const fetchOrders = async () => {
    const { data, error } = await supabase
      .from("orders")
      .select("*")
      .order("created_at", { ascending: false });

    if (!error && data) setOrders(data);
  };

  useEffect(() => {
    getUser();
    fetchOrders();
  }, []);

  // ---------------- UPDATE STATUS ----------------
  const updateStatus = async (
    orderId: string,
    status: string
  ) => {
    await supabase
      .from("orders")
      .update({ status })
      .eq("id", orderId);

    fetchOrders();
  };

  // ---------------- STATUS COLOR ----------------
  const statusColor = (status: string) => {
    switch (status) {
      case "pending":
        return "text-yellow-400";
      case "accepted":
        return "text-blue-400";
      case "in_progress":
        return "text-indigo-400";
      case "completed":
        return "text-emerald-400";
      case "rejected":
        return "text-red-400";
      default:
        return "text-white";
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-950 to-black text-white p-6">
      <h1 className="text-2xl font-bold mb-6">
        Orders / Job Tracker
      </h1>

      <div className="space-y-4">
        {orders.map((order) => {
          const isProvider = userId === order.provider_id;
          const isConsumer = userId === order.consumer_id;

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-5 bg-slate-900 border border-slate-800 rounded-2xl"
            >
              {/* HEADER */}
              <div className="flex justify-between items-center">
                <div>
                  <div className="font-semibold">
                    {order.listing_type.toUpperCase()} ORDER
                  </div>

                  <div className="text-sm text-slate-400">
                    ₹ {order.price}
                  </div>
                </div>

                <div
                  className={`font-semibold ${statusColor(
                    order.status
                  )}`}
                >
                  {order.status}
                </div>
              </div>

              {/* ACTIONS FOR PROVIDER */}
              {isProvider && order.status === "pending" && (
                <div className="flex gap-3 mt-4">
                  <button
                    onClick={() =>
                      updateStatus(order.id, "accepted")
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-xl"
                  >
                    <CheckCircle size={16} />
                    Accept
                  </button>

                  <button
                    onClick={() =>
                      updateStatus(order.id, "rejected")
                    }
                    className="flex items-center gap-2 px-4 py-2 bg-red-600 rounded-xl"
                  >
                    <XCircle size={16} />
                    Reject
                  </button>
                </div>
              )}

              {/* PROGRESS ACTIONS */}
              {isProvider && order.status === "accepted" && (
                <button
                  onClick={() =>
                    updateStatus(order.id, "in_progress")
                  }
                  className="mt-4 flex items-center gap-2 px-4 py-2 bg-indigo-600 rounded-xl"
                >
                  <Loader2 size={16} />
                  Start Work
                </button>
              )}

              {isProvider &&
                order.status === "in_progress" && (
                  <button
                    onClick={() =>
                      updateStatus(order.id, "completed")
                    }
                    className="mt-4 flex items-center gap-2 px-4 py-2 bg-emerald-600 rounded-xl"
                  >
                    <CheckCircle size={16} />
                    Mark Completed
                  </button>
                )}

              {/* CONSUMER VIEW */}
              {isConsumer && (
                <div className="mt-4 text-sm text-slate-400 flex items-center gap-2">
                  <Clock size={14} />
                  Waiting for provider update…
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
