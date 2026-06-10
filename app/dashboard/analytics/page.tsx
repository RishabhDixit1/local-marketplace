"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  ArrowUpRight, DollarSign, Loader2, ShoppingCart, Star, TrendingUp, Users,
} from "lucide-react";

const INR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

const COLORS = ["#0f172a", "#3b82f6", "#10b981", "#f59e0b", "#ef4444", "#8b5cf6"];

type Analytics = {
  earningsChartData: { month: string; earned: number; revenue: number; orders: number }[];
  statusBreakdown: Record<string, number>;
  conversionRate: number;
  summary: {
    totalEarnedPaise: number;
    totalRevenuePaise: number;
    totalOrders: number;
    completedOrders: number;
    uniqueCustomers: number;
    avgRating: number | null;
  };
  topCustomers: { id: string; name: string; orders: number; spentPaise: number }[];
};

const STATUS_LABELS: Record<string, string> = {
  new_lead: "New Lead", quoted: "Quoted", accepted: "Accepted",
  in_progress: "In Progress", completed: "Completed", closed: "Closed",
  cancelled: "Cancelled", rejected: "Rejected",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());

  const fetchAnalytics = useCallback(async (signal?: AbortSignal) => {
    setLoading(true);
    try {
      const res = await fetch(`/api/provider/analytics?year=${year}`, { signal });
      const json = await res.json();
      if (json.ok && !signal?.aborted) setData(json.analytics);
    } catch {
      // ignore
    } finally {
      if (!signal?.aborted) setLoading(false);
    }
  }, [year]);

  useEffect(() => {
    const abort = new AbortController();
    void fetchAnalytics(abort.signal);
    return () => abort.abort();
  }, [fetchAnalytics]);

  if (loading && !data) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  const statusData = data ? Object.entries(data.statusBreakdown).map(([key, value]) => ({
    name: STATUS_LABELS[key] ?? key,
    value,
  })) : [];

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-600">Your performance and earnings overview.</p>
        </div>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none">
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Total earned" value={INR(data?.summary.totalEarnedPaise ?? 0)} />
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Revenue" value={INR(data?.summary.totalRevenuePaise ?? 0)} />
        <SummaryCard icon={<ShoppingCart className="h-4 w-4" />} label="Orders" value={String(data?.summary.totalOrders ?? 0)} />
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Customers" value={String(data?.summary.uniqueCustomers ?? 0)} />
        <SummaryCard icon={<Star className="h-4 w-4" />} label="Rating" value={data?.summary.avgRating != null ? `${data.summary.avgRating}/5` : "—"} />
      </div>

      {/* Earnings chart */}
      <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-base font-semibold text-slate-900">Earnings <span className="text-xs font-normal text-slate-500">({year})</span></h2>
          {data && (
            <span className="inline-flex items-center gap-1 text-xs font-semibold text-emerald-600">
              <ArrowUpRight className="h-3 w-3" />
              {data.conversionRate}% conversion
            </span>
          )}
        </div>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data?.earningsChartData ?? []}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
              <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" tickFormatter={(v) => `${(v / 100).toFixed(0)}`} />
              <Tooltip formatter={(value) => [INR(value as number), undefined]} />
              <Bar dataKey="earned" fill="#0f172a" radius={[4, 4, 0, 0]} name="Earned" />
              <Bar dataKey="revenue" fill="#3b82f6" radius={[4, 4, 0, 0]} name="Revenue" />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </section>

      {/* Status breakdown pie + orders line */}
      <div className="grid gap-6 lg:grid-cols-2">
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Order status breakdown</h2>
          {statusData.length > 0 ? (
            <div className="h-56">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={statusData} cx="50%" cy="50%" innerRadius={50} outerRadius={80} paddingAngle={4} dataKey="value">
                    {statusData.map((_, idx) => (
                      <Cell key={idx} fill={COLORS[idx % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(value, name) => [value, name]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <p className="text-sm text-slate-500">No orders yet this year.</p>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            {statusData.map((s, i) => (
              <span key={s.name} className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold"
                style={{ backgroundColor: `${COLORS[i % COLORS.length]}15`, color: COLORS[i % COLORS.length] }}>
                <span className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
                {s.name}: {s.value}
              </span>
            ))}
          </div>
        </section>

        {/* Orders per month line */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Orders by month <span className="text-xs font-normal text-slate-500">({year})</span></h2>
          <div className="h-56">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data?.earningsChartData ?? []}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} stroke="#94a3b8" />
                <YAxis tick={{ fontSize: 12 }} stroke="#94a3b8" allowDecimals={false} />
                <Tooltip />
                <Line type="monotone" dataKey="orders" stroke="#10b981" strokeWidth={2} dot={{ r: 3 }} name="Orders" />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>

      {/* Top customers */}
      {data && data.topCustomers.length > 0 && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Top customers</h2>
          <div className="space-y-2">
            {data.topCustomers.map((c, i) => (
              <div key={c.id} className="flex items-center justify-between rounded-xl border border-slate-100 px-4 py-3">
                <div className="flex items-center gap-3 min-w-0">
                  <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-bold text-slate-600">
                    {i + 1}
                  </span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-slate-900 truncate">{c.name}</p>
                    <p className="text-xs text-slate-500">{c.orders} order{c.orders !== 1 ? "s" : ""}</p>
                  </div>
                </div>
                <span className="text-sm font-semibold text-slate-900">{INR(c.spentPaise)}</span>
              </div>
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

function SummaryCard({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-4">
      <div className="flex items-center gap-2 text-slate-500">{icon}<span className="text-xs font-medium">{label}</span></div>
      <p className="mt-1.5 text-lg font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
