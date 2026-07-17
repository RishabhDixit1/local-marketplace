"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, Flag, Gavel, Loader2, Search, Shield, Users, ShoppingCart, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

type AdminStats = {
  totalUsers: number;
  totalProviders: number;
  totalSeekers: number;
  totalOrders: number;
  completedOrders: number;
  cancelledOrders: number;
  totalReviews: number;
  averageRating: number | null;
  totalHelpRequests: number;
  averageTrustScore: number | null;
};

type DayBucket = { date: string; count: number };

type TrendData = {
  ordersByDay: DayBucket[];
  registrationsByDay: DayBucket[];
};

type ReportRow = {
  id: string;
  user_id: string;
  card_id: string | null;
  focus_id: string | null;
  card_type: string | null;
  feedback_type: string;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
};

type DisputeRow = {
  id: string;
  order_id: string;
  filed_by: string;
  reason: string;
  description: string | null;
  status: string;
  created_at: string;
  orders: {
    consumer_id: string;
    provider_id: string;
    price: number;
    status: string;
  } | null;
};

type UserRow = {
  id: string;
  full_name: string | null;
  name: string | null;
  email: string | null;
  phone: string | null;
  role: string | null;
  location: string | null;
  onboarding_completed: boolean;
  created_at: string | null;
  trust_score: number | null;
  abuse_reports: number | null;
};

type TableCheck = {
  table: string;
  exists: boolean;
  rowCount: number | null;
  error: string | null;
};

type SystemHealth = {
  healthy: boolean;
  tables: TableCheck[];
  summary: { total: number; present: number; missing: number };
};

type TabId = "overview" | "reports" | "listings" | "users" | "providers" | "orders" | "system" | "disputes" | "verifications" | "payouts";

const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  reports: "Reports",
  listings: "Listings",
  users: "Users",
  providers: "Providers",
  orders: "Orders",
  system: "System",
  disputes: "Disputes",
  verifications: "Verifications",
  payouts: "Payouts",
};

const tryFetch = async <T,>(url: string, options?: RequestInit): Promise<T | null> => {
  try {
    const json = await fetchAuthedJson<T>(supabase, url, options ?? {});
    return json;
  } catch {
    return null;
  }
};

export default function AdminPage() {
  const [activeTab, setActiveTab] = useState<TabId>("overview");
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);

  const [stats, setStats] = useState<AdminStats | null>(null);
  const [trend, setTrend] = useState<TrendData | null>(null);
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [providerRows, setProviderRows] = useState<Record<string, unknown>[]>([]);
  const [providerQuery, setProviderQuery] = useState("");
  const [users, setUsers] = useState<UserRow[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);
  const [verifications, setVerifications] = useState<Record<string, unknown>[]>([]);

  const [listings, setListings] = useState<Record<string, unknown>[]>([]);
  const [listingsTable, setListingsTable] = useState<"posts" | "service_listings" | "product_catalog">("posts");
  const [listingsFilter, setListingsFilter] = useState<"all" | "flagged" | "removed">("all");

  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [orderStatusFilter, setOrderStatusFilter] = useState("");
  const [orderDeliveryFilter, setOrderDeliveryFilter] = useState("");
  const [orderProviderFilter, setOrderProviderFilter] = useState("");
  const [orderDateFrom, setOrderDateFrom] = useState("");
  const [orderDateTo, setOrderDateTo] = useState("");

  useEffect(() => {
    const check = async () => {
      try {
        const json = await fetchAuthedJson<{ admin?: boolean }>(supabase, "/api/system/startup-check");
        setIsAdmin(json?.admin === true);
      } catch {
        setIsAdmin(false);
      }
    };
    void check();
  }, []);

  const fetchStats = useCallback(async () => {
    const data = await tryFetch<{ stats: AdminStats; trend?: TrendData }>("/api/admin/stats");
    if (data) {
      setStats(data.stats);
      if (data.trend) setTrend(data.trend);
    }
  }, []);

  const fetchReports = useCallback(async () => {
    const data = await tryFetch<{ reports: ReportRow[] }>("/api/admin/reports?feedbackType=report");
    if (data) setReports(data.reports);
  }, []);

  const fetchDisputes = useCallback(async () => {
    const data = await tryFetch<{ disputes: DisputeRow[] }>("/api/admin/disputes");
    if (data) setDisputes(data.disputes);
  }, []);

  const fetchUsers = useCallback(async (q: string) => {
    if (!q.trim()) { setUsers([]); return; }
    const data = await tryFetch<{ users: UserRow[] }>(`/api/admin/users?q=${encodeURIComponent(q.trim())}`);
    if (data) setUsers(data.users);
  }, []);

  const fetchProviders = useCallback(async (q: string = "") => {
    const url = q.trim()
      ? `/api/admin/users?role=provider&q=${encodeURIComponent(q.trim())}&limit=50`
      : "/api/admin/users?role=provider&limit=50";
    const data = await tryFetch<{ users: Record<string, unknown>[] }>(url);
    if (data) setProviderRows(data.users);
  }, []);

  const fetchVerifications = useCallback(async (status: string = "pending") => {
    const data = await tryFetch<{ verifications: Record<string, unknown>[] }>(`/api/admin/verifications?status=${status}`);
    if (data) setVerifications(data.verifications);
  }, []);

  const fetchListings = useCallback(async (table?: string, filter?: string) => {
    const t = table || listingsTable;
    const f = filter || listingsFilter;
    const data = await tryFetch<{ listings: Record<string, unknown>[] }>(`/api/admin/listings?table=${t}&filter=${f}&limit=50`);
    if (data) setListings(data.listings);
  }, [listingsTable, listingsFilter]);

  const fetchOrders = useCallback(async (overrides?: {
    status?: string; deliveryStatus?: string; providerId?: string;
    from?: string; to?: string;
  }) => {
    const params = new URLSearchParams();
    const s = overrides?.status ?? orderStatusFilter;
    if (s) params.set("status", s);
    const ds = overrides?.deliveryStatus ?? orderDeliveryFilter;
    if (ds) params.set("delivery_status", ds);
    const pid = overrides?.providerId ?? orderProviderFilter;
    if (pid) params.set("provider_id", pid);
    const f = overrides?.from ?? orderDateFrom;
    if (f) params.set("from", f);
    const t = overrides?.to ?? orderDateTo;
    if (t) params.set("to", t);
    params.set("limit", "50");
    const data = await tryFetch<{ orders: Record<string, unknown>[] }>(`/api/admin/orders?${params.toString()}`);
    if (data) setOrders(data.orders);
  }, [orderStatusFilter, orderDeliveryFilter, orderProviderFilter, orderDateFrom, orderDateTo]);

  const fetchSystem = useCallback(async () => {
    const data = await tryFetch<SystemHealth>("/api/admin/system");
    if (data) setSystemHealth(data);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchStats();
    void fetchReports();
    void fetchOrders({});
    void fetchProviders();
    void fetchDisputes();
    void fetchSystem();
    void fetchVerifications();
    void fetchListings();
  }, [isAdmin, fetchStats, fetchReports, fetchOrders, fetchProviders, fetchDisputes, fetchSystem, fetchVerifications, fetchListings]);

  const handleDismiss = async (id: string) => {
    setBusyId(id);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/admin/reports", {
        method: "PATCH",
        body: JSON.stringify({ id, action: "dismiss" }),
      });
      if (json?.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      } else {
        setError(json?.message || "Failed to dismiss.");
      }
    } catch {
      setError("Failed to dismiss report.");
    } finally {
      setBusyId(null);
    }
  };

  const handleModerate = async (id: string, action: "remove_content" | "suspend_user") => {
    setBusyId(`${id}_${action}`);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/admin/reports", {
        method: "PATCH",
        body: JSON.stringify({ id, action }),
      });
      if (json?.ok) {
        setReports((prev) => prev.filter((r) => r.id !== id));
      } else {
        setError(json?.message || `Failed to ${action}.`);
      }
    } catch {
      setError(`Failed to ${action}.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleVerificationAction = async (id: string, action: "approve" | "reject") => {
    setBusyId(`${id}_${action}`);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/admin/verifications", {
        method: "PATCH",
        body: JSON.stringify({ id, action }),
      });
      if (json?.ok) {
        setVerifications((prev) => prev.filter((v: Record<string, unknown>) => v.id !== id));
      } else {
        setError(json?.message || `Failed to ${action}.`);
      }
    } catch {
      setError(`Failed to ${action}.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleListingModeration = async (id: string, table: string, action: "flag" | "unflag" | "remove" | "restore", reason?: string) => {
    setBusyId(`${id}_${action}`);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/admin/listings", {
        method: "PATCH",
        body: JSON.stringify({ id, table, action, reason }),
      });
      if (json?.ok) {
        await fetchListings();
      } else {
        setError(json?.message || `Failed to ${action} listing.`);
      }
    } catch {
      setError(`Failed to ${action} listing.`);
    } finally {
      setBusyId(null);
    }
  };

  const handleResolveDispute = async (id: string, action: "dismiss" | "resolve_for_consumer" | "resolve_for_provider") => {
    setBusyId(`${id}_${action}`);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/admin/disputes", {
        method: "PATCH",
        body: JSON.stringify({ id, action }),
      });
      if (json?.ok) {
        setDisputes((prev) => prev.filter((d) => d.id !== id));
      } else {
        setError(json?.message || "Failed to resolve dispute.");
      }
    } catch {
      setError("Failed to resolve dispute.");
    } finally {
      setBusyId(null);
    }
  };

  const handleRefundOrder = async (id: string) => {
    setBusyId(`refund_${id}`);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify({ id, action: "refund" }),
      });
      if (json?.ok) {
        setOrders((prev) => prev.filter((o) => o.id !== id));
      } else {
        setError(json?.message || "Failed to refund.");
      }
    } catch {
      setError("Failed to refund order.");
    } finally {
      setBusyId(null);
    }
  };

  const handleStatusOverride = async (id: string, status: string) => {
    setBusyId(`override_${id}`);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify({ id, action: "status_override", status }),
      });
      if (json?.ok) {
        await fetchOrders({});
      } else {
        setError(json?.message || "Failed to override status.");
      }
    } catch {
      setError("Failed to override status.");
    } finally {
      setBusyId(null);
    }
  };

  const handleCreatePayout = async (id: string) => {
    setBusyId(`payout_${id}`);
    setError("");
    try {
      const json = await fetchAuthedJson<{ ok: boolean; message?: string }>(supabase, "/api/admin/orders", {
        method: "PATCH",
        body: JSON.stringify({ id, action: "create_payout" }),
      });
      if (json?.ok) {
        setError("");
      } else {
        setError(json?.message || "Failed to create payout.");
      }
    } catch {
      setError("Failed to create payout.");
    } finally {
      setBusyId(null);
    }
  };

  if (isAdmin === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ink-500)]" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Shield className="h-12 w-12 text-[var(--ink-500)]" />
        <h1 className="text-xl font-semibold text-[var(--ink-950)]">Admin access only</h1>
        <p className="max-w-md text-sm text-[var(--ink-700)]">
          This dashboard is available to authorized administrators. If you believe you should have access, contact the platform owner.
        </p>
      </div>
    );
  }

  const formatDate = (value: string | null) => {
    if (!value) return "—";
    try {
      return new Intl.DateTimeFormat("en-US", {
        month: "short", day: "numeric", year: "numeric", hour: "2-digit", minute: "2-digit",
      }).format(new Date(value));
    } catch {
      return value;
    }
  };

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[var(--ink-950)]">Admin</h1>
          <p className="mt-1 text-sm text-[var(--ink-700)]">Platform overview, moderation, and system health.</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl border-[var(--surface-border)] bg-[var(--surface-soft)] p-1">
        {(Object.keys(TAB_LABELS) as TabId[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab ? "bg-[var(--surface-elevated)] text-[var(--ink-950)] shadow-sm" : "text-[var(--ink-700)] hover:text-[var(--ink-950)]"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-50 dark:bg-rose-950/30 px-4 py-3 text-sm font-medium text-rose-700 dark:text-rose-300">{error}</div>
      ) : null}

      {activeTab === "overview" ? (
        <div className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <StatCard label="Total users" value={stats?.totalUsers ?? "—"} icon={<Users className="h-4 w-4" />} />
            <StatCard label="Providers" value={stats?.totalProviders ?? "—"} />
            <StatCard label="Seekers" value={stats?.totalSeekers ?? "—"} />
            <StatCard label="Total orders" value={stats?.totalOrders ?? "—"} icon={<ShoppingCart className="h-4 w-4" />} />
            <StatCard label="Completed orders" value={stats?.completedOrders ?? "—"} />
            <StatCard label="Cancelled orders" value={stats?.cancelledOrders ?? "—"} />
            <StatCard label="Reviews" value={stats?.totalReviews ?? "—"} />
            <StatCard label="Avg rating" value={stats?.averageRating != null ? `${stats.averageRating} / 5` : "—"} />
            <StatCard label="Help requests" value={stats?.totalHelpRequests ?? "—"} />
            <StatCard label="Avg trust score" value={stats?.averageTrustScore != null ? `${stats.averageTrustScore}` : "—"} />
          </div>

          {trend ? (
            <div className="grid gap-6 sm:grid-cols-2">
              <TrendChart
                title="Orders (30 days)"
                data={trend.ordersByDay}
                icon={<ShoppingCart className="h-4 w-4 text-blue-600" />}
                barColor="bg-blue-500"
              />
              <TrendChart
                title="Registrations (30 days)"
                data={trend.registrationsByDay}
                icon={<Users className="h-4 w-4 text-emerald-600" />}
                barColor="bg-emerald-500"
              />
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "reports" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink-700)]">
            {reports.length > 0 ? `${reports.length} reported item${reports.length === 1 ? "" : "s"}.` : "No reports to review."}
          </p>
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--ink-500)]">
              All clear — no reported content.
            </div>
          ) : (
            reports.map((report) => {
              const meta = report.metadata ?? {};
              const description = meta.description as string | undefined;
              const targetType = meta.target_type as string | undefined;
              const targetId = meta.target_id as string | undefined;
              const reasonLabel = report.reason
                ? report.reason.charAt(0).toUpperCase() + report.reason.slice(1)
                : "Unknown";
              const reasonBadgeColor =
                report.reason === "spam" ? "bg-[var(--surface-soft)] text-[var(--ink-700)]" :
                report.reason === "harassment" ? "bg-rose-100 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300" :
                report.reason === "scam" || report.reason === "fake" ? "bg-amber-100 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300" :
                "bg-[var(--surface-soft)] text-[var(--ink-700)]";

              return (
              <div key={report.id} className="rounded-2xl border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <div className="flex items-center gap-2">
                      <p className="text-sm font-semibold text-[var(--ink-950)]">
                        {targetType ? `${targetType.replace(/_/g, " ")} report` : report.card_type ? `${report.card_type} card` : "Report"}
                      </p>
                      <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wider ${reasonBadgeColor}`}>
                        {reasonLabel}
                      </span>
                    </div>
                    {description ? (
                      <p className="text-sm leading-5 text-[var(--ink-700)]">
                        {description.length > 120 ? `${description.slice(0, 120)}…` : description}
                      </p>
                    ) : null}
                    <div className="flex flex-wrap gap-x-4 gap-y-0.5 text-xs text-[var(--ink-500)]">
                      <span>Reporter: {report.user_id}</span>
                      <span>Target: {targetId ?? report.focus_id ?? report.card_id ?? "—"}</span>
                      <span>{formatDate(report.created_at)}</span>
                    </div>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={busyId === report.id}
                      onClick={() => void handleDismiss(report.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                    >
                      {busyId === report.id ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                      Dismiss
                    </button>
                    <button
                      type="button"
                      disabled={busyId === `${report.id}_remove_content`}
                      onClick={() => void handleModerate(report.id, "remove_content")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 px-3 py-1.5 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                    >
                      {busyId === `${report.id}_remove_content` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                      Remove
                    </button>
                    <button
                      type="button"
                      disabled={busyId === `${report.id}_suspend_user`}
                      onClick={() => void handleModerate(report.id, "suspend_user")}
                      className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                    >
                      {busyId === `${report.id}_suspend_user` ? <Loader2 className="h-3 w-3 animate-spin" /> : <AlertTriangle className="h-3 w-3" />}
                      Suspend
                    </button>
                  </div>
                </div>
              </div>
            );
          })
          )}
        </div>
      ) : null}

      {activeTab === "listings" ? (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center gap-2">
            <select
              value={listingsTable}
              onChange={(e) => {
                const t = e.target.value as typeof listingsTable;
                setListingsTable(t);
                void fetchListings(t, listingsFilter);
              }}
              className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)]"
            >
              <option value="posts">Posts</option>
              <option value="service_listings">Service Listings</option>
              <option value="product_catalog">Product Catalog</option>
            </select>
            <select
              value={listingsFilter}
              onChange={(e) => {
                const f = e.target.value as typeof listingsFilter;
                setListingsFilter(f);
                void fetchListings(listingsTable, f);
              }}
              className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)]"
            >
              <option value="all">All</option>
              <option value="flagged">Flagged</option>
              <option value="removed">Removed</option>
            </select>
            <span className="text-sm text-[var(--ink-500)]">
              {listings.length} listing{listings.length !== 1 ? "s" : ""}
            </span>
          </div>
          {listings.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--ink-500)]">
              No listings match the current filter.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--surface-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-soft)]">
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Title</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Owner</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Category</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Status</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Created</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {listings.map((item) => {
                    const id = item.id as string;
                    const title = (item.title || item.name || "—") as string;
                    const owner = (item.provider_id || item.user_id || item.author_id || item.created_by || "—") as string;
                    const category = (item.category || "—") as string;
                    const isFlagged = item.is_flagged === true;
                    const isRemoved = item.removed_at != null;
                    return (
                      <tr key={id} className="border-b border-slate-100 last:border-0">
                        <td className="max-w-[200px] truncate px-4 py-3 font-medium text-[var(--ink-950)]">{title}</td>
                        <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-[var(--ink-500)]">{owner}</td>
                        <td className="px-4 py-3 text-[var(--ink-700)]">{category}</td>
                        <td className="px-4 py-3">
                          {isRemoved ? (
                            <span className="inline-flex items-center rounded-full bg-rose-100 dark:bg-rose-950/50 px-2 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300">Removed</span>
                          ) : isFlagged ? (
                            <span className="inline-flex items-center rounded-full bg-amber-100 dark:bg-amber-950/50 px-2 py-0.5 text-xs font-medium text-amber-700 dark:text-amber-300">Flagged</span>
                          ) : (
                            <span className="inline-flex items-center rounded-full bg-emerald-100 dark:bg-emerald-950/50 px-2 py-0.5 text-xs font-medium text-emerald-700 dark:text-emerald-300">Active</span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--ink-500)]">{formatDate(item.created_at as string | null)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {isRemoved ? (
                              <button
                                type="button"
                                disabled={busyId === `${id}_restore`}
                                onClick={() => void handleListingModeration(id, listingsTable, "restore")}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                              >
                                {busyId === `${id}_restore` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                                Restore
                              </button>
                            ) : isFlagged ? (
                              <>
                                <button
                                  type="button"
                                  disabled={busyId === `${id}_remove`}
                                  onClick={() => void handleListingModeration(id, listingsTable, "remove")}
                                  className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                                >
                                  {busyId === `${id}_remove` ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                                  Remove
                                </button>
                                <button
                                  type="button"
                                  disabled={busyId === `${id}_unflag`}
                                  onClick={() => void handleListingModeration(id, listingsTable, "unflag")}
                                  className="inline-flex items-center gap-1 rounded-full border border-[var(--surface-border)] px-2 py-1 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                                >
                                  Unflag
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                disabled={busyId === `${id}_flag`}
                                onClick={() => void handleListingModeration(id, listingsTable, "flag", "Flagged by admin")}
                                className="inline-flex items-center gap-1 rounded-full border border-amber-200 px-2 py-1 text-xs font-semibold text-amber-700 transition hover:bg-amber-50 disabled:opacity-50"
                              >
                                {busyId === `${id}_flag` ? <Loader2 className="h-3 w-3 animate-spin" /> : <Flag className="h-3 w-3" />}
                                Flag
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "users" ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-500)]" />
            <input
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                void fetchUsers(e.target.value);
              }}
              placeholder="Search by name, email, or phone..."
              className="w-full rounded-2xl border border-[var(--surface-border)] py-3 pl-11 pr-4 text-sm text-[var(--ink-950)] outline-none transition focus:border-[#0a66c2]"
            />
          </div>

          {users.length === 0 && userQuery.trim() ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--ink-500)]">
              No users match your search.
            </div>
          ) : null}

          {users.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-soft)]">
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Name</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Email</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Role</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Location</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Trust</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Reports</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-[var(--ink-950)]">
                        {user.full_name || user.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-700)]">{user.email || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-[var(--surface-soft)] px-2.5 py-0.5 text-xs font-medium text-[var(--ink-700)]">
                          {user.role || "seeker"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-700)]">{user.location || "—"}</td>
                      <td className="px-4 py-3 text-[var(--ink-700)]">{user.trust_score ?? "—"}</td>
                      <td className="px-4 py-3">
                        {user.abuse_reports && user.abuse_reports > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 dark:bg-rose-950/50 px-2.5 py-0.5 text-xs font-medium text-rose-700 dark:text-rose-300">
                            <AlertTriangle className="h-3 w-3" />
                            {user.abuse_reports}
                          </span>
                        ) : (
                          <span className="text-[var(--ink-500)]">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-500)]">{formatDate(user.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "providers" ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-[var(--ink-500)]" />
            <input
              value={providerQuery}
              onChange={(e) => {
                setProviderQuery(e.target.value);
                void fetchProviders(e.target.value);
              }}
              placeholder="Search providers by name, email, or phone..."
              className="w-full rounded-2xl border border-[var(--surface-border)] py-3 pl-11 pr-4 text-sm text-[var(--ink-950)] outline-none transition focus:border-[#0a66c2]"
            />
          </div>
          {providerRows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
              <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">

                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-soft)]">
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Name</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Email</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Location</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Verification</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Trust</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {providerRows.map((p) => (
                    <tr key={p.id as string} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-[var(--ink-950)]">
                        {(p.full_name as string) || (p.name as string) || "—"}
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-700)]">{(p.email as string) || "—"}</td>
                      <td className="px-4 py-3 text-[var(--ink-700)]">{(p.location as string) || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          (p.verification_status as string) === "verified"
                            ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300"
                            : "bg-amber-100 dark:bg-amber-950/50 text-amber-800 dark:text-amber-300"
                        }`}>
                          {(p.verification_status as string) || "unverified"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-[var(--ink-700)]">{p.trust_score != null ? `${p.trust_score}` : "—"}</td>
                      <td className="px-4 py-3 text-[var(--ink-500)]">{formatDate(p.created_at as string | null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              </div>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--ink-500)]">
              {providerQuery.trim() ? "No providers match your search." : "No providers found."}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "disputes" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink-700)]">
            {disputes.length > 0 ? `${disputes.length} open dispute${disputes.length === 1 ? "" : "s"}.` : "No disputes to review."}
          </p>
          {disputes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--ink-500)]">
              No disputes filed.
            </div>
          ) : (
            disputes.map((dispute) => {
              const order = (dispute.orders ?? {}) as Record<string, unknown>;
              const orderId = dispute.order_id ?? "—";
              const status = dispute.status ?? "open";

              return (
                <div key={dispute.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)]">
                        <Gavel className="h-4 w-4 text-[var(--ink-500)]" />
                        Dispute
                      </p>
                      <p className="text-sm text-[var(--ink-700)]">Order: {orderId}</p>
                      <p className="text-sm text-[var(--ink-700)]">Reason: {dispute.reason}</p>
                      {dispute.description ? (
                        <p className="text-sm text-[var(--ink-500)]">{dispute.description}</p>
                      ) : null}
                      <p className="text-xs text-[var(--ink-500)]">Filed by: {dispute.filed_by}</p>
                      <p className="text-xs text-[var(--ink-500)]">
                        Status: <span className={`font-medium ${status === "open" ? "text-amber-600" : status === "resolved_for_consumer" ? "text-emerald-600" : "text-[var(--ink-700)]"}`}>{status}</span>
                      </p>
                      {order.price != null ? (
                        <p className="text-xs text-[var(--ink-500)]">Order value: ₹{Number(order.price)}</p>
                      ) : null}
                      <p className="text-xs text-[var(--ink-500)]">{formatDate(dispute.created_at)}</p>
                    </div>
                    {status === "open" ? (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === `${dispute.id}_dismiss`}
                          onClick={() => void handleResolveDispute(dispute.id, "dismiss")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
                        >
                          {busyId === `${dispute.id}_dismiss` ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                          Dismiss
                        </button>
                        <button
                          type="button"
                          disabled={busyId === `${dispute.id}_resolve_for_consumer`}
                          onClick={() => void handleResolveDispute(dispute.id, "resolve_for_consumer")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {busyId === `${dispute.id}_resolve_for_consumer` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          For consumer
                        </button>
                        <button
                          type="button"
                          disabled={busyId === `${dispute.id}_resolve_for_provider`}
                          onClick={() => void handleResolveDispute(dispute.id, "resolve_for_provider")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-700 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 transition hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50"
                        >
                          {busyId === `${dispute.id}_resolve_for_provider` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          For provider
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-[var(--ink-500)] italic">Resolved</div>
                    )}
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {activeTab === "verifications" ? (
        <div className="space-y-3">
          <p className="text-sm text-[var(--ink-700)]">
            {verifications.length > 0 ? `${verifications.length} pending verification${verifications.length === 1 ? "" : "s"}.` : "No pending verifications."}
          </p>
          {verifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--ink-500)]">
              All caught up — no pending verifications.
            </div>
          ) : (
            verifications.map((v) => {
              const doc = v as Record<string, unknown>;
              return (
                <div key={doc.id as string} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-[var(--ink-950)]">
                        <BadgeCheck className="h-4 w-4 text-sky-500" />
                        {doc.applicantName as string}
                      </p>
                      <p className="text-sm text-[var(--ink-700)]">
                        Document: <span className="font-medium">{doc.document_type as string}</span>
                      </p>
                      {doc.applicantEmail ? (
                        <p className="text-xs text-[var(--ink-500)]">Email: {doc.applicantEmail as string}</p>
                      ) : null}
                      {doc.applicantPhone ? (
                        <p className="text-xs text-[var(--ink-500)]">Phone: {doc.applicantPhone as string}</p>
                      ) : null}
                      {doc.file_url ? (
                        <a
                          href={doc.file_url as string}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800"
                        >
                          View document →
                        </a>
                      ) : null}
                      <p className="text-xs text-[var(--ink-500)]">{formatDate(doc.created_at as string | null)}</p>
                    </div>
                    <div className="flex shrink-0 flex-col gap-1.5">
                      <button
                        type="button"
                        disabled={busyId === `${doc.id}_approve`}
                        onClick={() => void handleVerificationAction(doc.id as string, "approve")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 px-3 py-1.5 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                      >
                        {busyId === `${doc.id}_approve` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                        Approve
                      </button>
                      <button
                        type="button"
                        disabled={busyId === `${doc.id}_reject`}
                        onClick={() => void handleVerificationAction(doc.id as string, "reject")}
                        className="inline-flex items-center gap-1.5 rounded-full border border-rose-200 px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                      >
                        {busyId === `${doc.id}_reject` ? <Loader2 className="h-3 w-3 animate-spin" /> : <XCircle className="h-3 w-3" />}
                        Reject
                      </button>
                    </div>
                  </div>
                </div>
              );
            })
          )}
        </div>
      ) : null}

      {activeTab === "orders" ? (
        <div className="space-y-3">
          {/* Filters */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm text-[var(--ink-700)]">
              {orders.length > 0 ? `${orders.length} orders` : "No orders found."}
            </span>
            <select value={orderStatusFilter}
              onChange={(e) => { setOrderStatusFilter(e.target.value); void fetchOrders({ status: e.target.value }); }}
              className="ml-auto rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)]"
            >
              <option value="">All statuses</option>
              <option value="new_lead">New lead</option>
              <option value="quoted">Quoted</option>
              <option value="accepted">Accepted</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
            <select value={orderDeliveryFilter}
              onChange={(e) => { setOrderDeliveryFilter(e.target.value); void fetchOrders({ deliveryStatus: e.target.value }); }}
              className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs font-medium text-[var(--ink-700)]"
            >
              <option value="">All delivery</option>
              <option value="pending">Pending</option>
              <option value="assigned">Assigned</option>
              <option value="picked_up">Picked up</option>
              <option value="in_transit">In transit</option>
              <option value="delivered">Delivered</option>
              <option value="failed">Failed</option>
            </select>
            <input type="text" placeholder="Provider ID..."
              value={orderProviderFilter}
              onChange={(e) => setOrderProviderFilter(e.target.value)}
              onBlur={() => void fetchOrders({})}
              onKeyDown={(e) => { if (e.key === "Enter") void fetchOrders({}); }}
              className="w-40 rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs text-[var(--ink-700)] placeholder:text-[var(--ink-500)]"
            />
            <input type="date" value={orderDateFrom}
              onChange={(e) => { setOrderDateFrom(e.target.value); void fetchOrders({ from: e.target.value }); }}
              className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs text-[var(--ink-700)]"
            />
            <span className="text-xs text-[var(--ink-500)]">—</span>
            <input type="date" value={orderDateTo}
              onChange={(e) => { setOrderDateTo(e.target.value); void fetchOrders({ to: e.target.value }); }}
              className="rounded-lg border border-[var(--surface-border)] px-3 py-1.5 text-xs text-[var(--ink-700)]"
            />
          </div>
          {error && <p className="text-xs text-rose-600">{error}</p>}
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--ink-500)]">
              No orders to display.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-2xl border border-[var(--surface-border)]">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-soft)]">
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Order ID</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Status</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Delivery</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Price</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Fee</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Payment</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Date</th>
                    <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const meta = (order.metadata as Record<string, unknown>) ?? {};
                    const paymentStatus = (meta.payment_status as string) ?? "—";
                    const deliveryMeta = meta.delivery as Record<string, unknown> | undefined;
                    const deliveryStatus = deliveryMeta?.status as string ?? "";
                    const orderStatus = order.status as string;
                    const price = Number(order.price ?? 0);
                    const fee = Number(order.platform_fee_paise ?? 0);
                    const completed = orderStatus === "completed";
                    const paid = paymentStatus === "paid";
                    const canRefund = completed && paid;
                    const canCreatePayout = completed && paid && !fee;
                    return (
                      <tr key={order.id as string} className="border-b border-slate-100 last:border-0">
                        <td className="max-w-[100px] truncate px-4 py-3 font-mono text-xs text-[var(--ink-950)]">
                          {order.id as string}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            orderStatus === "completed" ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300" :
                            orderStatus === "cancelled" ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300" :
                            orderStatus === "in_progress" ? "bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300" :
                            "bg-[var(--surface-soft)] text-[var(--ink-950)]"
                          }`}>
                            {orderStatus.replace(/_/g, " ") || "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3">
                          {deliveryStatus ? (
                            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                              deliveryStatus === "delivered" ? "bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-300" :
                              deliveryStatus === "failed" ? "bg-rose-100 dark:bg-rose-950/50 text-rose-800 dark:text-rose-300" :
                              deliveryStatus === "in_transit" ? "bg-blue-100 dark:bg-blue-950/50 text-blue-800 dark:text-blue-300" :
                              "bg-[var(--surface-soft)] text-[var(--ink-950)]"
                            }`}>
                              {deliveryStatus.replace(/_/g, " ")}
                            </span>
                          ) : <span className="text-xs text-[var(--ink-500)]">—</span>}
                        </td>
                        <td className="px-4 py-3 text-[var(--ink-950)]">₹{price.toFixed(0)}</td>
                        <td className="px-4 py-3 text-xs text-[var(--ink-500)]">₹{(fee / 100).toFixed(2)}</td>
                        <td className="px-4 py-3 text-xs text-[var(--ink-700)]">
                          <span className={`font-medium ${
                            paid ? "text-emerald-700" :
                            paymentStatus === "refunded" ? "text-rose-700" :
                            "text-[var(--ink-500)]"
                          }`}>{paymentStatus}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-[var(--ink-500)]">{formatDate(order.created_at as string | null)}</td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-1">
                            {canRefund ? (
                              <button type="button" disabled={busyId === `refund_${order.id}`}
                                onClick={() => void handleRefundOrder(order.id as string)}
                                className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-2 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                              >
                                {busyId === `refund_${order.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Refund
                              </button>
                            ) : null}
                            {canCreatePayout ? (
                              <button type="button" disabled={busyId === `payout_${order.id}`}
                                onClick={() => void handleCreatePayout(order.id as string)}
                                className="inline-flex items-center gap-1 rounded-full border border-emerald-200 px-2 py-1 text-xs font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50"
                              >
                                {busyId === `payout_${order.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                                Payout
                              </button>
                            ) : null}
                            {orderStatus !== "cancelled" && orderStatus !== "closed" ? (
                              <select
                                disabled={busyId === `override_${order.id}`}
                                onChange={(e) => { if (e.target.value) void handleStatusOverride(order.id as string, e.target.value); }}
                                className="rounded-lg border border-[var(--surface-border)] px-2 py-1 text-xs text-[var(--ink-700)]"
                                defaultValue=""
                              >
                                <option value="" disabled>Override</option>
                                <option value="cancelled">Cancel</option>
                                <option value="closed">Close</option>
                                <option value="completed">Complete</option>
                              </select>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "payouts" ? (
        <AdminPayoutsTab />
      ) : null}

      {activeTab === "system" ? (
        <div className="space-y-4">
          <div className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
            {systemHealth?.healthy ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-[var(--ink-950)]">All systems healthy</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-semibold text-[var(--ink-950)]">
                  {systemHealth?.summary.missing ?? 0} table{systemHealth?.summary.missing !== 1 ? "s" : ""} missing
                </span>
              </>
            )}
            <span className="ml-auto text-xs text-[var(--ink-500)]">
              {systemHealth?.summary.present ?? "—"} / {systemHealth?.summary.total ?? "—"} tables present
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-[var(--surface-border)]">
            <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-[var(--surface-border)] bg-[var(--surface-soft)]">
                  <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Table</th>
                  <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Status</th>
                  <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Rows</th>
                  <th className="px-4 py-3 font-semibold text-[var(--ink-700)]">Error</th>
                </tr>
              </thead>
              <tbody>
                {systemHealth?.tables.map((t) => (
                  <tr key={t.table} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-[var(--ink-950)]">{t.table}</td>
                    <td className="px-4 py-3">
                      {t.exists ? (
                        <span className="inline-flex items-center gap-1 text-emerald-700">
                          <CheckCircle2 className="h-3.5 w-3.5" /> Present
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 text-rose-700">
                          <XCircle className="h-3.5 w-3.5" /> Missing
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-[var(--ink-700)]">{t.rowCount ?? "—"}</td>
                    <td className="px-4 py-3 text-rose-600">{t.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-[var(--ink-500)]">{label}</p>
        {icon ? <span className="opacity-60">{icon}</span> : null}
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight text-[var(--ink-950)]">{value}</p>
    </div>
  );
}

function TrendChart({ title, data, icon, barColor }: { title: string; data: DayBucket[]; icon: React.ReactNode; barColor: string }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-[var(--ink-700)]">{title}</h3>
        <span className="ml-auto text-xs text-[var(--ink-500)]">{data.length} days</span>
      </div>
      <div className="flex items-end gap-[2px] h-24">
        {data.map((d) => (
          <div key={d.date} className="flex-1 flex flex-col items-center justify-end h-full">
            <div
              className={`w-full rounded-t ${barColor} transition-all duration-300`}
              style={{ height: `${Math.max((d.count / maxVal) * 100, 1)}%` }}
              title={`${d.date}: ${d.count}`}
            />
          </div>
        ))}
      </div>
      {data.length > 0 ? (
        <div className="flex justify-between mt-2 text-[10px] text-[var(--ink-500)]">
          <span>{data[0]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      ) : null}
    </div>
  );
}

const PAYOUT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 dark:bg-amber-950/30 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50",
  approved: "bg-blue-50 dark:bg-blue-950/30 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50",
  processing: "bg-indigo-50 dark:bg-indigo-950/30 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50",
  completed: "bg-emerald-50 dark:bg-emerald-950/30 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50",
  failed: "bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50",
  cancelled: "bg-[var(--surface-soft)] text-[var(--ink-500)] border-[var(--surface-border)]",
};

function AdminPayoutsTab() {
  const [payouts, setPayouts] = useState<Record<string, unknown>[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState("pending");
  const [batchRunning, setBatchRunning] = useState(false);
  const [batchResult, setBatchResult] = useState<string | null>(null);

  const fetchPayouts = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const json = await fetchAuthedJson<{ ok: boolean; payouts?: Record<string, unknown>[] }>(supabase, `/api/admin/payouts?status=${status}`);
      if (json.ok) setPayouts(json.payouts ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { void fetchPayouts(filterStatus); }, [filterStatus, fetchPayouts]);

  const handleAction = async (payoutId: string, action: string) => {
    setBusyId(`${payoutId}_${action}`);
    try {
      const json = await fetchAuthedJson<{ ok: boolean }>(supabase, "/api/admin/payouts", {
        method: "PATCH",
        body: JSON.stringify({ payoutId, action }),
      });
      if (json.ok) {
        setPayouts((prev) => prev.filter((p) => (p.id as string) !== payoutId));
      }
    } catch {
      // ignore
    } finally {
      setBusyId(null);
    }
  };

  const INR = (paise: unknown) => {
    const v = typeof paise === "number" ? paise : Number(paise) || 0;
    return new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(v / 100);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2">
        <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}
          className="rounded-xl border border-[var(--surface-border)] px-3 py-2 text-sm outline-none">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-sm text-[var(--ink-500)]">{payouts.length} payout{payouts.length !== 1 ? "s" : ""}</span>
        <button
          type="button"
          disabled={batchRunning}
          onClick={async () => {
            setBatchRunning(true);
            setBatchResult(null);
            try {
              const json = await fetchAuthedJson<{ ok: boolean; processed?: number; failed?: number; message?: string }>(supabase, "/api/admin/batch-payouts", { method: "POST" });
              if (json.ok) {
                setBatchResult(`Processed: ${json.processed ?? 0}, Failed: ${json.failed ?? 0}`);
                void fetchPayouts(filterStatus);
              } else {
                setBatchResult(json.message || "Batch failed");
              }
            } catch {
              setBatchResult("Network error");
            } finally {
              setBatchRunning(false);
            }
          }}
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-blue-200 dark:border-blue-700 px-3 py-1.5 text-xs font-semibold text-blue-700 dark:text-blue-300 transition hover:bg-blue-50 dark:hover:bg-blue-950/40 disabled:opacity-50"
        >
          {batchRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Process All Pending Payouts
        </button>
      </div>

      {batchResult ? (
        <div className="rounded-2xl bg-blue-50 dark:bg-blue-950/30 px-4 py-3 text-sm font-medium text-blue-700 dark:text-blue-300">{batchResult}</div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-[var(--ink-500)]" /></div>
      ) : payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)] p-8 text-center text-sm text-[var(--ink-500)]">
          No {filterStatus} payouts.
        </div>
      ) : (
        payouts.map((p: Record<string, unknown>) => (
          <div key={p.id as string} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-[var(--ink-950)]">{INR(p.net_amount_paise)}</p>
                <p className="text-xs text-[var(--ink-500)]">{p.payout_method as string} — {p.payout_detail as string || "No details"}</p>
                <p className="text-xs text-[var(--ink-500)]">{(p as Record<string, { full_name: string }>).profiles?.full_name || (p as Record<string, string>).provider_id}</p>
                <p className="text-xs text-[var(--ink-500)]">{new Date(p.created_at as string).toLocaleDateString("en-IN")}</p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-1.5">
                <span className={`rounded-full border px-2.5 py-1 text-[11px] font-semibold ${PAYOUT_STATUS_STYLES[p.status as string] ?? ""}`}>
                  {p.status as string}
                </span>
                <div className="flex gap-1.5 mt-1">
                  {p.status === "pending" && (
                    <>
                      <button type="button" disabled={busyId === `${p.id}_approve`}
                        onClick={() => void handleAction(p.id as string, "approve")}
                        className="rounded-full border border-emerald-200 px-2.5 py-1 text-[11px] font-semibold text-emerald-700 transition hover:bg-emerald-50 disabled:opacity-50">
                        {busyId === `${p.id}_approve` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Approve"}
                      </button>
                      <button type="button" disabled={busyId === `${p.id}_reject`}
                        onClick={() => void handleAction(p.id as string, "reject")}
                        className="rounded-full border border-rose-200 px-2.5 py-1 text-[11px] font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50">
                        {busyId === `${p.id}_reject` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Reject"}
                      </button>
                    </>
                  )}
                  {p.status === "approved" && (
                    <button type="button" disabled={busyId === `${p.id}_complete`}
                      onClick={() => void handleAction(p.id as string, "complete")}
                      className="rounded-full border border-blue-200 px-2.5 py-1 text-[11px] font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50">
                      {busyId === `${p.id}_complete` ? <Loader2 className="h-3 w-3 animate-spin" /> : "Mark completed"}
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        ))
      )}
    </div>
  );
}
