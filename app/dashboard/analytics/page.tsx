"use client";

import { useCallback, useEffect, useState } from "react";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell, LineChart, Line,
} from "recharts";
import {
  ArrowUpRight, ArrowDownRight, DollarSign, Lightbulb, Loader2, ShoppingCart, TrendingUp, Users, Zap,
} from "lucide-react";
import TrustStats from "@/app/components/profile/TrustStats";
import { supabase } from "@/lib/supabase";
import type { ProfileRecord } from "@/lib/profile/types";

const INR = (paise: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(paise / 100);

const PCT = (v: number) => `${v > 0 ? "+" : ""}${v}%`;

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
    repeatCustomerRate: number;
    earningsGrowth: number;
    avgOrderValuePaise: number;
    priorYearEarnedPaise: number;
  };
  topCustomers: { id: string; name: string; orders: number; spentPaise: number }[];
  funnelData: { stage: string; count: number }[];
};

type PricingInsight = {
  category: string;
  myPrice: number;
  avgPrice: number;
  minPrice: number;
  maxPrice: number;
  sampleSize: number;
  listingCount: number;
  pricePosition: "above" | "below" | "competitive";
  suggestedPrice: number;
  rationale: string;
};

type ListingScore = {
  listingId: string;
  title: string;
  category: string;
  score: number;
  suggestions: { field: string; severity: string; message: string }[];
};

const STATUS_LABELS: Record<string, string> = {
  new_lead: "New Lead", quoted: "Quoted", accepted: "Accepted",
  in_progress: "In Progress", completed: "Completed", closed: "Closed",
  cancelled: "Cancelled", rejected: "Rejected",
};

const FUNNEL_LABELS: Record<string, string> = {
  new_lead: "Lead", quoted: "Quoted", accepted: "Accepted",
  paid: "Paid", in_progress: "Started", completed: "Completed",
};

export default function AnalyticsPage() {
  const [data, setData] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);
  const [year, setYear] = useState(new Date().getFullYear());
  const [profile, setProfile] = useState<ProfileRecord | null>(null);

  const [pricingInsights, setPricingInsights] = useState<PricingInsight[]>([]);
  const [listingScores, setListingScores] = useState<ListingScore[]>([]);
  const [aiLoading, setAiLoading] = useState(false);

  useEffect(() => {
    let active = true;
    void supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user || !active) return;
      void supabase.from("profiles").select("*").eq("id", user.id).maybeSingle().then(({ data }) => {
        if (active && data) setProfile(data as ProfileRecord);
      });
    });
    return () => { active = false; };
  }, []);

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

  // Fetch AI-powered insights
  const fetchAiInsights = useCallback(async () => {
    setAiLoading(true);
    try {
      const [pricingRes, scoreRes] = await Promise.all([
        fetch("/api/provider/pricing-insights"),
        fetch("/api/provider/listing-score"),
      ]);
      const pricingJson = await pricingRes.json();
      const scoreJson = await scoreRes.json();
      if (pricingJson.ok) setPricingInsights(pricingJson.insights ?? []);
      if (scoreJson.ok) setListingScores(scoreJson.listings ?? []);
    } catch {
      // ignore
    } finally {
      setAiLoading(false);
    }
  }, []);

  // Fetch AI insights once on mount
  useEffect(() => {
    void fetchAiInsights();
  }, [fetchAiInsights]);

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

  const avgScore = listingScores.length > 0
    ? Math.round(listingScores.reduce((s, l) => s + l.score, 0) / listingScores.length)
    : 0;

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Analytics</h1>
          <p className="mt-1 text-sm text-slate-600">Your performance, earnings, and AI-powered insights.</p>
        </div>
        <select value={year} onChange={(e) => setYear(parseInt(e.target.value))}
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none">
          {[2024, 2025, 2026, 2027].map((y) => (
            <option key={y} value={y}>{y}</option>
          ))}
        </select>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <SummaryCard icon={<DollarSign className="h-4 w-4" />} label="Total earned" value={INR(data?.summary.totalEarnedPaise ?? 0)} />
        <SummaryCard icon={<TrendingUp className="h-4 w-4" />} label="Revenue" value={INR(data?.summary.totalRevenuePaise ?? 0)} />
        <SummaryCard icon={<ShoppingCart className="h-4 w-4" />} label="Orders" value={String(data?.summary.totalOrders ?? 0)} />
        <SummaryCard icon={<Users className="h-4 w-4" />} label="Customers" value={String(data?.summary.uniqueCustomers ?? 0)} />
      </div>

      {/* KPI row */}
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <KpiCard label="Avg order value" value={INR(data?.summary.avgOrderValuePaise ?? 0)} />
        <KpiCard label="Repeat rate" value={`${data?.summary.repeatCustomerRate ?? 0}%`}
          trend={data ? (data.summary.repeatCustomerRate >= 30 ? "up" : "neutral") : undefined} />
        <KpiCard label="YoY earnings" value={PCT(data?.summary.earningsGrowth ?? 0)}
          trend={data ? (data.summary.earningsGrowth >= 0 ? "up" : "down") : undefined} />
        <KpiCard label="Listing score" value={listingScores.length > 0 ? `${avgScore}/100` : "—"}
          trend={avgScore >= 70 ? "up" : avgScore >= 40 ? "neutral" : "down"} />
      </div>

      {/* Conversion funnel */}
      {data && data.funnelData && (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
          <h2 className="mb-4 text-base font-semibold text-slate-900">Conversion funnel</h2>
          <div className="space-y-2">
            {data.funnelData.map((step, i) => {
              const maxCount = data.funnelData[0]?.count ?? 1;
              const pct = Math.round((step.count / maxCount) * 100);
              const drop = i > 0 && data.funnelData[i - 1].count > 0
                ? Math.round((1 - step.count / data.funnelData[i - 1].count) * 100)
                : 0;
              return (
                <div key={step.stage} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-medium text-slate-600">{FUNNEL_LABELS[step.stage] ?? step.stage}</span>
                  <div className="flex-1">
                    <div className="h-6 rounded-full bg-slate-100 overflow-hidden">
                      <div className="h-full rounded-full bg-slate-800 transition-all"
                        style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                  <span className="w-16 text-right text-xs font-semibold text-slate-700">{step.count}</span>
                  {drop > 0 && (
                    <span className="w-12 text-right text-[10px] font-medium text-rose-500">-{drop}%</span>
                  )}
                </div>
              );
            })}
          </div>
          <p className="mt-3 text-xs text-slate-500">
            {data.conversionRate}% of leads convert to completed orders
          </p>
        </section>
      )}

      {/* Trust stats */}
      {profile && (
        <TrustStats
          profile={profile}
          averageRating={data?.summary.avgRating ?? 0}
          reviewCount={0}
          completionPercent={Math.round(profile.profile_completion_percent ?? 0)}
          trustScore={profile.trust_score ?? 0}
        />
      )}

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

      {/* AI-powered insights */}
      {aiLoading && listingScores.length === 0 ? (
        <div className="flex items-center justify-center py-8">
          <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          <span className="ml-2 text-sm text-slate-500">Loading AI insights...</span>
        </div>
      ) : (
        <>
          {/* Pricing insights */}
          {pricingInsights.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Lightbulb className="h-5 w-5 text-amber-500" />
                <h2 className="text-base font-semibold text-slate-900">Pricing insights</h2>
                <span className="rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold text-amber-700">AI</span>
              </div>
              <div className="space-y-3">
                {pricingInsights.map((insight) => (
                  <div key={insight.category} className="rounded-xl border border-slate-100 bg-slate-50 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-sm font-semibold text-slate-900 capitalize">{insight.category}</span>
                      <span className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold ${
                        insight.pricePosition === "competitive" ? "bg-emerald-50 text-emerald-700" :
                        insight.pricePosition === "above" ? "bg-rose-50 text-rose-700" :
                        "bg-blue-50 text-blue-700"
                      }`}>
                        {insight.pricePosition === "competitive" ? "On market" :
                         insight.pricePosition === "above" ? "Above market" : "Below market"}
                      </span>
                    </div>
                    <div className="grid grid-cols-3 gap-3 mb-2 text-xs">
                      <div><span className="text-slate-500">Your price</span><p className="font-semibold text-slate-900">{INR(insight.myPrice * 100)}</p></div>
                      <div><span className="text-slate-500">Market avg</span><p className="font-semibold text-slate-900">{INR(insight.avgPrice * 100)}</p></div>
                      <div><span className="text-slate-500">Suggested</span><p className="font-semibold text-emerald-700">{INR(insight.suggestedPrice * 100)}</p></div>
                    </div>
                    <p className="text-xs text-slate-600">{insight.rationale}</p>
                  </div>
                ))}
              </div>
            </section>
          )}

          {/* Listing optimization scores */}
          {listingScores.length > 0 && (
            <section className="rounded-2xl border border-slate-200 bg-white p-5 sm:p-6">
              <div className="flex items-center gap-2 mb-4">
                <Zap className="h-5 w-5 text-purple-500" />
                <h2 className="text-base font-semibold text-slate-900">Listing optimization</h2>
                <span className="rounded-full bg-purple-50 px-2 py-0.5 text-[10px] font-semibold text-purple-700">AI</span>
                <span className="ml-auto text-xs text-slate-500">Avg score: {avgScore}/100</span>
              </div>
              <div className="space-y-3">
                {listingScores.slice(0, 5).map((listing) => (
                  <div key={listing.listingId} className="rounded-xl border border-slate-100 p-4">
                    <div className="flex items-center justify-between mb-2">
                      <div className="min-w-0 flex-1">
                        <p className="text-sm font-semibold text-slate-900 truncate">{listing.title}</p>
                        <p className="text-[10px] text-slate-500 capitalize">{listing.category}</p>
                      </div>
                      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-xs font-bold ${
                        listing.score >= 70 ? "bg-emerald-50 text-emerald-700" :
                        listing.score >= 40 ? "bg-amber-50 text-amber-700" :
                        "bg-rose-50 text-rose-700"
                      }`}>
                        {listing.score}
                      </div>
                    </div>
                    {listing.suggestions.length > 0 && (
                      <ul className="space-y-1">
                        {listing.suggestions.map((s, i) => (
                          <li key={i} className="flex items-start gap-2 text-[11px]">
                            <span className={`mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full ${
                              s.severity === "high" ? "bg-rose-400" :
                              s.severity === "medium" ? "bg-amber-400" : "bg-slate-300"
                            }`} />
                            <span className="text-slate-600">{s.message}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}
        </>
      )}

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

function KpiCard({ label, value, trend }: { label: string; value: string; trend?: "up" | "down" | "neutral" }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
      <div className="flex items-center gap-1 text-slate-500">
        {trend === "up" && <ArrowUpRight className="h-3 w-3 text-emerald-500" />}
        {trend === "down" && <ArrowDownRight className="h-3 w-3 text-rose-500" />}
        <span className="text-[10px] font-medium">{label}</span>
      </div>
      <p className={`mt-1 text-base font-bold tracking-tight ${
        trend === "up" ? "text-emerald-700" : trend === "down" ? "text-rose-700" : "text-slate-900"
      }`}>{value}</p>
    </div>
  );
}
