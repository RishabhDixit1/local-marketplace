"use client";

import React, { useCallback, useEffect, useState } from "react";
import { AlertTriangle, BadgeCheck, CheckCircle2, Flag, Gavel, Loader2, Search, Shield, TrendingUp, Users, ShoppingCart, XCircle } from "lucide-react";

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

type TabId = "overview" | "reports" | "users" | "providers" | "orders" | "system" | "disputes" | "verifications" | "payouts";

const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  reports: "Reports",
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
    const res = await fetch(url, options);
    const json = await res.json();
    if (json?.ok) return json as T;
    return null;
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

  const [orders, setOrders] = useState<Record<string, unknown>[]>([]);
  const [userQuery, setUserQuery] = useState("");
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    const check = async () => {
      try {
        const res = await fetch("/api/system/startup-check");
        const json = await res.json();
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

  const fetchOrders = useCallback(async (status: string = "") => {
    const data = await tryFetch<{ orders: Record<string, unknown>[] }>(`/api/admin/orders?status=${status}&limit=50`);
    if (data) setOrders(data.orders);
  }, []);

  const fetchSystem = useCallback(async () => {
    const data = await tryFetch<SystemHealth>("/api/admin/system");
    if (data) setSystemHealth(data);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchStats();
    void fetchReports();
    void fetchOrders();
    void fetchProviders();
    void fetchDisputes();
    void fetchSystem();
    void fetchVerifications();
  }, [isAdmin, fetchStats, fetchReports, fetchOrders, fetchProviders, fetchDisputes, fetchSystem, fetchVerifications]);

  const handleDismiss = async (id: string) => {
    setBusyId(id);
    setError("");
    try {
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "dismiss" }),
      });
      const json = await res.json();
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
      const res = await fetch("/api/admin/reports", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
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
      const res = await fetch("/api/admin/verifications", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
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

  const handleResolveDispute = async (id: string, action: "dismiss" | "resolve_for_consumer" | "resolve_for_provider") => {
    setBusyId(`${id}_${action}`);
    setError("");
    try {
      const res = await fetch("/api/admin/disputes", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action }),
      });
      const json = await res.json();
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
      const res = await fetch("/api/admin/orders", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id, action: "refund" }),
      });
      const json = await res.json();
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

  if (isAdmin === null) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 px-4 text-center">
        <Shield className="h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-semibold text-slate-900">Admin access only</h1>
        <p className="max-w-md text-sm text-slate-600">
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
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Admin</h1>
          <p className="mt-1 text-sm text-slate-600">Platform overview, moderation, and system health.</p>
        </div>
      </div>

      <div className="flex gap-1 rounded-2xl border border-slate-200 bg-slate-100 p-1">
        {(Object.keys(TAB_LABELS) as TabId[]).map((tab) => (
          <button
            key={tab}
            type="button"
            onClick={() => setActiveTab(tab)}
            className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
              activeTab === tab ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {TAB_LABELS[tab]}
          </button>
        ))}
      </div>

      {error ? (
        <div className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</div>
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
          <p className="text-sm text-slate-600">
            {reports.length > 0 ? `${reports.length} reported item${reports.length === 1 ? "" : "s"}.` : "No reports to review."}
          </p>
          {reports.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              All clear — no reported content.
            </div>
          ) : (
            reports.map((report) => (
              <div key={report.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-slate-900">
                      {report.card_type ? `${report.card_type} card` : "Unknown type"}
                    </p>
                    {report.reason ? (
                      <p className="text-sm text-slate-600">Reason: {report.reason}</p>
                    ) : null}
                    {report.focus_id ? (
                      <p className="text-xs text-slate-500">Focus ID: {report.focus_id}</p>
                    ) : null}
                    {report.card_id ? (
                      <p className="text-xs text-slate-500">Card ID: {report.card_id}</p>
                    ) : null}
                    <p className="text-xs text-slate-400">Reporter: {report.user_id}</p>
                    <p className="text-xs text-slate-400">{formatDate(report.created_at)}</p>
                  </div>
                  <div className="flex shrink-0 flex-col gap-1.5">
                    <button
                      type="button"
                      disabled={busyId === report.id}
                      onClick={() => void handleDismiss(report.id)}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
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
            ))
          )}
        </div>
      ) : null}

      {activeTab === "users" ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={userQuery}
              onChange={(e) => {
                setUserQuery(e.target.value);
                void fetchUsers(e.target.value);
              }}
              placeholder="Search by name, email, or phone..."
              className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#0a66c2]"
            />
          </div>

          {users.length === 0 && userQuery.trim() ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No users match your search.
            </div>
          ) : null}

          {users.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Role</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Location</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Trust</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Reports</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {users.map((user) => (
                    <tr key={user.id} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {user.full_name || user.name || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.email || "—"}</td>
                      <td className="px-4 py-3">
                        <span className="inline-flex rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-700">
                          {user.role || "seeker"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{user.location || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{user.trust_score ?? "—"}</td>
                      <td className="px-4 py-3">
                        {user.abuse_reports && user.abuse_reports > 0 ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-rose-100 px-2.5 py-0.5 text-xs font-medium text-rose-700">
                            <AlertTriangle className="h-3 w-3" />
                            {user.abuse_reports}
                          </span>
                        ) : (
                          <span className="text-slate-400">0</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(user.created_at)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "providers" ? (
        <div className="space-y-4">
          <div className="relative">
            <Search className="pointer-events-none absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <input
              value={providerQuery}
              onChange={(e) => {
                setProviderQuery(e.target.value);
                void fetchProviders(e.target.value);
              }}
              placeholder="Search providers by name, email, or phone..."
              className="w-full rounded-2xl border border-slate-200 py-3 pl-11 pr-4 text-sm text-slate-900 outline-none transition focus:border-[#0a66c2]"
            />
          </div>

          {providerRows.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-700">Name</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Email</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Location</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Verification</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Trust</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {providerRows.map((p) => (
                    <tr key={p.id as string} className="border-b border-slate-100 last:border-0">
                      <td className="px-4 py-3 font-medium text-slate-900">
                        {(p.full_name as string) || (p.name as string) || "—"}
                      </td>
                      <td className="px-4 py-3 text-slate-600">{(p.email as string) || "—"}</td>
                      <td className="px-4 py-3 text-slate-600">{(p.location as string) || "—"}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                          (p.verification_status as string) === "verified"
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-amber-100 text-amber-800"
                        }`}>
                          {(p.verification_status as string) || "unverified"}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{p.trust_score != null ? `${p.trust_score}` : "—"}</td>
                      <td className="px-4 py-3 text-slate-500">{formatDate(p.created_at as string | null)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              {providerQuery.trim() ? "No providers match your search." : "No providers found."}
            </div>
          )}
        </div>
      ) : null}

      {activeTab === "disputes" ? (
        <div className="space-y-3">
          <p className="text-sm text-slate-600">
            {disputes.length > 0 ? `${disputes.length} open dispute${disputes.length === 1 ? "" : "s"}.` : "No disputes to review."}
          </p>
          {disputes.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No disputes filed.
            </div>
          ) : (
            disputes.map((dispute) => {
              const order = (dispute.orders ?? {}) as Record<string, unknown>;
              const orderId = dispute.order_id ?? "—";
              const status = dispute.status ?? "open";

              return (
                <div key={dispute.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Gavel className="h-4 w-4 text-slate-500" />
                        Dispute
                      </p>
                      <p className="text-sm text-slate-600">Order: {orderId}</p>
                      <p className="text-sm text-slate-600">Reason: {dispute.reason}</p>
                      {dispute.description ? (
                        <p className="text-sm text-slate-500">{dispute.description}</p>
                      ) : null}
                      <p className="text-xs text-slate-400">Filed by: {dispute.filed_by}</p>
                      <p className="text-xs text-slate-400">
                        Status: <span className={`font-medium ${status === "open" ? "text-amber-600" : status === "resolved_for_consumer" ? "text-emerald-600" : "text-slate-600"}`}>{status}</span>
                      </p>
                      {order.price != null ? (
                        <p className="text-xs text-slate-400">Order value: ₹{Number(order.price)}</p>
                      ) : null}
                      <p className="text-xs text-slate-400">{formatDate(dispute.created_at)}</p>
                    </div>
                    {status === "open" ? (
                      <div className="flex shrink-0 flex-col gap-1.5">
                        <button
                          type="button"
                          disabled={busyId === `${dispute.id}_dismiss`}
                          onClick={() => void handleResolveDispute(dispute.id, "dismiss")}
                          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
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
                          className="inline-flex items-center gap-1.5 rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
                        >
                          {busyId === `${dispute.id}_resolve_for_provider` ? <Loader2 className="h-3 w-3 animate-spin" /> : <CheckCircle2 className="h-3 w-3" />}
                          For provider
                        </button>
                      </div>
                    ) : (
                      <div className="text-xs text-slate-400 italic">Resolved</div>
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
          <p className="text-sm text-slate-600">
            {verifications.length > 0 ? `${verifications.length} pending verification${verifications.length === 1 ? "" : "s"}.` : "No pending verifications."}
          </p>
          {verifications.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              All caught up — no pending verifications.
            </div>
          ) : (
            verifications.map((v) => {
              const doc = v as Record<string, unknown>;
              return (
                <div key={doc.id as string} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <BadgeCheck className="h-4 w-4 text-sky-500" />
                        {doc.applicantName as string}
                      </p>
                      <p className="text-sm text-slate-600">
                        Document: <span className="font-medium">{doc.document_type as string}</span>
                      </p>
                      {doc.applicantEmail ? (
                        <p className="text-xs text-slate-500">Email: {doc.applicantEmail as string}</p>
                      ) : null}
                      {doc.applicantPhone ? (
                        <p className="text-xs text-slate-500">Phone: {doc.applicantPhone as string}</p>
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
                      <p className="text-xs text-slate-400">{formatDate(doc.created_at as string | null)}</p>
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
          <div className="flex items-center gap-2">
            <span className="text-sm text-slate-600">
              {orders.length > 0 ? `${orders.length} recent orders` : "No orders found."}
            </span>
            <select
              onChange={(e) => { void fetchOrders(e.target.value); }}
              className="ml-auto rounded-lg border border-slate-200 px-3 py-1.5 text-xs font-medium text-slate-700"
            >
              <option value="">All statuses</option>
              <option value="new_lead">New lead</option>
              <option value="quoted">Quoted</option>
              <option value="accepted">Accepted</option>
              <option value="in_progress">In progress</option>
              <option value="completed">Completed</option>
              <option value="cancelled">Cancelled</option>
            </select>
          </div>
          {orders.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
              No orders to display.
            </div>
          ) : (
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-left text-sm">
                <thead>
                  <tr className="border-b border-slate-200 bg-slate-50">
                    <th className="px-4 py-3 font-semibold text-slate-700">Order ID</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Price</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Payment</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Date</th>
                    <th className="px-4 py-3 font-semibold text-slate-700">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {orders.map((order) => {
                    const meta = (order.metadata as Record<string, unknown>) ?? {};
                    const paymentStatus = (meta.payment_status as string) ?? "—";
                    return (
                      <tr key={order.id as string} className="border-b border-slate-100 last:border-0">
                        <td className="max-w-[120px] truncate px-4 py-3 font-mono text-xs text-slate-900">
                          {order.id as string}
                        </td>
                        <td className="px-4 py-3">
                          <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${
                            order.status === "completed" ? "bg-emerald-100 text-emerald-800" :
                            order.status === "cancelled" ? "bg-rose-100 text-rose-800" :
                            order.status === "in_progress" ? "bg-blue-100 text-blue-800" :
                            "bg-slate-100 text-slate-800"
                          }`}>
                            {(order.status as string)?.replace(/_/g, " ") ?? "—"}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-slate-900">₹{Number(order.price ?? 0).toFixed(0)}</td>
                        <td className="px-4 py-3 text-xs text-slate-600">
                          <span className={`font-medium ${
                            paymentStatus === "paid" ? "text-emerald-700" :
                            paymentStatus === "refunded" ? "text-rose-700" :
                            "text-slate-500"
                          }`}>{paymentStatus}</span>
                        </td>
                        <td className="px-4 py-3 text-xs text-slate-500">{formatDate(order.created_at as string | null)}</td>
                        <td className="px-4 py-3">
                          {(order.status as string) === "completed" && paymentStatus === "paid" ? (
                            <button
                              type="button"
                              disabled={busyId === `refund_${order.id}`}
                              onClick={() => void handleRefundOrder(order.id as string)}
                              className="inline-flex items-center gap-1 rounded-full border border-rose-200 px-3 py-1 text-xs font-semibold text-rose-700 transition hover:bg-rose-50 disabled:opacity-50"
                            >
                              {busyId === `refund_${order.id}` ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
                              Refund
                            </button>
                          ) : (
                            <span className="text-xs text-slate-400">—</span>
                          )}
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
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white px-5 py-4">
            {systemHealth?.healthy ? (
              <>
                <CheckCircle2 className="h-5 w-5 text-emerald-600" />
                <span className="text-sm font-semibold text-slate-900">All systems healthy</span>
              </>
            ) : (
              <>
                <AlertTriangle className="h-5 w-5 text-amber-600" />
                <span className="text-sm font-semibold text-slate-900">
                  {systemHealth?.summary.missing ?? 0} table{systemHealth?.summary.missing !== 1 ? "s" : ""} missing
                </span>
              </>
            )}
            <span className="ml-auto text-xs text-slate-500">
              {systemHealth?.summary.present ?? "—"} / {systemHealth?.summary.total ?? "—"} tables present
            </span>
          </div>

          <div className="overflow-hidden rounded-2xl border border-slate-200">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-200 bg-slate-50">
                  <th className="px-4 py-3 font-semibold text-slate-700">Table</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Status</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Rows</th>
                  <th className="px-4 py-3 font-semibold text-slate-700">Error</th>
                </tr>
              </thead>
              <tbody>
                {systemHealth?.tables.map((t) => (
                  <tr key={t.table} className="border-b border-slate-100 last:border-0">
                    <td className="px-4 py-3 font-medium text-slate-900">{t.table}</td>
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
                    <td className="px-4 py-3 text-slate-600">{t.rowCount ?? "—"}</td>
                    <td className="px-4 py-3 text-rose-600">{t.error || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon?: React.ReactNode }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
        {icon ? <span className="opacity-60">{icon}</span> : null}
      </div>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}

function TrendChart({ title, data, icon, barColor }: { title: string; data: DayBucket[]; icon: React.ReactNode; barColor: string }) {
  const maxVal = Math.max(...data.map((d) => d.count), 1);
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-5">
      <div className="flex items-center gap-2 mb-4">
        {icon}
        <h3 className="text-sm font-semibold text-slate-700">{title}</h3>
        <span className="ml-auto text-xs text-slate-400">{data.length} days</span>
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
        <div className="flex justify-between mt-2 text-[10px] text-slate-400">
          <span>{data[0]?.date}</span>
          <span>{data[data.length - 1]?.date}</span>
        </div>
      ) : null}
    </div>
  );
}

const PAYOUT_STATUS_STYLES: Record<string, string> = {
  pending: "bg-amber-50 text-amber-700 border-amber-200",
  approved: "bg-blue-50 text-blue-700 border-blue-200",
  processing: "bg-indigo-50 text-indigo-700 border-indigo-200",
  completed: "bg-emerald-50 text-emerald-700 border-emerald-200",
  failed: "bg-rose-50 text-rose-700 border-rose-200",
  cancelled: "bg-slate-50 text-slate-500 border-slate-200",
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
      const res = await fetch(`/api/admin/payouts?status=${status}`);
      const json = await res.json();
      if (json.ok) setPayouts(json.payouts);
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
      const res = await fetch("/api/admin/payouts", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ payoutId, action }),
      });
      const json = await res.json();
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
          className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none">
          <option value="pending">Pending</option>
          <option value="approved">Approved</option>
          <option value="processing">Processing</option>
          <option value="completed">Completed</option>
          <option value="failed">Failed</option>
          <option value="cancelled">Cancelled</option>
        </select>
        <span className="text-sm text-slate-500">{payouts.length} payout{payouts.length !== 1 ? "s" : ""}</span>
        <button
          type="button"
          disabled={batchRunning}
          onClick={async () => {
            setBatchRunning(true);
            setBatchResult(null);
            try {
              const res = await fetch("/api/admin/batch-payouts", { method: "POST" });
              const json = await res.json();
              if (json.ok) {
                setBatchResult(`Processed: ${json.processed}, Failed: ${json.failed}`);
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
          className="ml-auto inline-flex items-center gap-1.5 rounded-full border border-blue-200 px-3 py-1.5 text-xs font-semibold text-blue-700 transition hover:bg-blue-50 disabled:opacity-50"
        >
          {batchRunning ? <Loader2 className="h-3 w-3 animate-spin" /> : null}
          Process All Pending Payouts
        </button>
      </div>

      {batchResult ? (
        <div className="rounded-2xl bg-blue-50 px-4 py-3 text-sm font-medium text-blue-700">{batchResult}</div>
      ) : null}

      {loading ? (
        <div className="flex justify-center py-8"><Loader2 className="h-5 w-5 animate-spin text-slate-400" /></div>
      ) : payouts.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50 p-8 text-center text-sm text-slate-500">
          No {filterStatus} payouts.
        </div>
      ) : (
        payouts.map((p: Record<string, unknown>) => (
          <div key={p.id as string} className="rounded-2xl border border-slate-200 bg-white p-4">
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0 space-y-1">
                <p className="text-sm font-semibold text-slate-900">{INR(p.net_amount_paise)}</p>
                <p className="text-xs text-slate-500">{p.payout_method as string} — {p.payout_detail as string || "No details"}</p>
                <p className="text-xs text-slate-400">{(p as Record<string, { full_name: string }>).profiles?.full_name || (p as Record<string, string>).provider_id}</p>
                <p className="text-xs text-slate-400">{new Date(p.created_at as string).toLocaleDateString("en-IN")}</p>
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
