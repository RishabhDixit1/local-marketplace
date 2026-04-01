"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BadgeIndianRupee,
  CheckCircle2,
  Clock3,
  Loader2,
  Package,
  TrendingUp,
} from "lucide-react";
import { supabase } from "@/lib/supabase";

const INR = (v: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v);

type Order = {
  id: string;
  status: string;
  price: number | null;
  listing_type: string;
  created_at: string;
  metadata: Record<string, unknown>;
};

const MONTH_NAMES = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default function ProviderEarningsPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data } = await supabase
        .from("orders")
        .select("id,status,price,listing_type,created_at,metadata")
        .eq("provider_id", user.id)
        .order("created_at", { ascending: false });

      setOrders((data as Order[] | null) ?? []);
      setLoading(false);
    })();
  }, []);

  const completed = orders.filter((o) => ["completed", "closed"].includes(o.status));
  const pending = orders.filter((o) => ["new_lead", "accepted", "in_progress", "quoted"].includes(o.status));
  const totalEarned = completed.reduce((sum, o) => sum + (o.price ?? 0), 0);
  const totalPending = pending.reduce((sum, o) => sum + (o.price ?? 0), 0);

  // Monthly breakdown for last 6 months
  const now = new Date();
  const monthly: { label: string; earned: number; orders: number }[] = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1);
    const label = MONTH_NAMES[d.getMonth()];
    const monthOrders = completed.filter((o) => {
      const dd = new Date(o.created_at);
      return dd.getFullYear() === d.getFullYear() && dd.getMonth() === d.getMonth();
    });
    return { label, earned: monthOrders.reduce((s, o) => s + (o.price ?? 0), 0), orders: monthOrders.length };
  });

  const maxEarned = Math.max(...monthly.map((m) => m.earned), 1);

  if (loading) {
    return (
      <div className="flex min-h-[40vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-bold text-slate-900">Earnings</h1>
        <Link href="/dashboard/provider/orders"
          className="flex items-center gap-1 text-sm font-medium text-blue-600 hover:underline">
          View Orders <ArrowRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4">
        {[
          { icon: BadgeIndianRupee, label: "Total Earned", value: INR(totalEarned), color: "text-emerald-600", bg: "bg-emerald-50" },
          { icon: Clock3, label: "Pending", value: INR(totalPending), color: "text-amber-600", bg: "bg-amber-50" },
          { icon: CheckCircle2, label: "Completed", value: `${completed.length} orders`, color: "text-blue-600", bg: "bg-blue-50" },
          { icon: Package, label: "Total Orders", value: `${orders.length}`, color: "text-purple-600", bg: "bg-purple-50" },
        ].map((card) => (
          <div key={card.label} className="rounded-2xl bg-white p-4 shadow-sm">
            <div className={`mb-2 flex h-9 w-9 items-center justify-center rounded-xl ${card.bg}`}>
              <card.icon className={`h-4.5 w-4.5 ${card.color}`} />
            </div>
            <p className="text-xs text-slate-500">{card.label}</p>
            <p className="mt-0.5 text-lg font-bold text-slate-900">{card.value}</p>
          </div>
        ))}
      </div>

      {/* Monthly chart */}
      <div className="rounded-2xl bg-white p-5 shadow-sm">
        <div className="mb-4 flex items-center gap-2">
          <TrendingUp className="h-4 w-4 text-slate-500" />
          <h2 className="text-sm font-semibold text-slate-900">Monthly Revenue (Last 6 months)</h2>
        </div>
        <div className="flex h-36 items-end gap-2">
          {monthly.map((m) => {
            const height = maxEarned > 0 ? Math.max((m.earned / maxEarned) * 100, m.orders > 0 ? 8 : 0) : 0;
            return (
              <div key={m.label} className="flex flex-1 flex-col items-center gap-1">
                <div className="group relative w-full cursor-default">
                  {m.earned > 0 && (
                    <div className="absolute -top-6 left-1/2 -translate-x-1/2 hidden whitespace-nowrap rounded-lg bg-slate-800 px-2 py-1 text-[10px] text-white group-hover:block">
                      {INR(m.earned)}
                    </div>
                  )}
                  <div
                    className="w-full rounded-t-lg bg-blue-500 transition-all"
                    style={{ height: `${height}%`, minHeight: height > 0 ? "4px" : "0" }}
                  />
                </div>
                <span className="text-[10px] text-slate-500">{m.label}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Recent completed orders */}
      {completed.length > 0 && (
        <div className="rounded-2xl bg-white p-5 shadow-sm">
          <h2 className="mb-3 text-sm font-semibold text-slate-900">Recent Earnings</h2>
          <div className="space-y-3">
            {completed.slice(0, 8).map((order) => (
              <Link key={order.id} href={`/orders/${order.id}`} className="flex items-center gap-3 rounded-xl p-2 hover:bg-slate-50 transition">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-emerald-50">
                  <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-slate-900">
                    {(order.metadata?.title as string | undefined) ?? `${order.listing_type} order`}
                  </p>
                  <p className="text-xs text-slate-500">
                    {new Date(order.created_at).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}
                  </p>
                </div>
                <p className="shrink-0 text-sm font-bold text-emerald-600">{order.price ? INR(order.price) : "—"}</p>
              </Link>
            ))}
          </div>
        </div>
      )}

      {orders.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-dashed border-slate-200 bg-white p-10 text-center">
          <BadgeIndianRupee className="h-10 w-10 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">No orders yet</p>
          <p className="text-xs text-slate-400">Start listing your services and products to earn.</p>
        </div>
      )}
    </div>
  );
}
