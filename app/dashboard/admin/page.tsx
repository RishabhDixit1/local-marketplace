"use client";

import { useCallback, useEffect, useState } from "react";
import { AlertTriangle, CheckCircle2, Flag, Gavel, Loader2, Search, Shield, XCircle } from "lucide-react";

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
  user_id: string;
  card_id: string | null;
  focus_id: string | null;
  reason: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string | null;
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

type TabId = "overview" | "reports" | "users" | "system" | "disputes";

const TAB_LABELS: Record<TabId, string> = {
  overview: "Overview",
  reports: "Reports",
  users: "Users",
  system: "System",
  disputes: "Disputes",
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
  const [reports, setReports] = useState<ReportRow[]>([]);
  const [users, setUsers] = useState<UserRow[]>([]);
  const [systemHealth, setSystemHealth] = useState<SystemHealth | null>(null);
  const [disputes, setDisputes] = useState<DisputeRow[]>([]);

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
    const data = await tryFetch<{ stats: AdminStats }>("/api/admin/stats");
    if (data) setStats(data.stats);
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

  const fetchSystem = useCallback(async () => {
    const data = await tryFetch<SystemHealth>("/api/admin/system");
    if (data) setSystemHealth(data);
  }, []);

  useEffect(() => {
    if (!isAdmin) return;
    void fetchStats();
    void fetchReports();
    void fetchDisputes();
    void fetchSystem();
  }, [isAdmin, fetchStats, fetchReports, fetchDisputes, fetchSystem]);

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
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard label="Total users" value={stats?.totalUsers ?? "—"} />
          <StatCard label="Providers" value={stats?.totalProviders ?? "—"} />
          <StatCard label="Seekers" value={stats?.totalSeekers ?? "—"} />
          <StatCard label="Total orders" value={stats?.totalOrders ?? "—"} />
          <StatCard label="Completed orders" value={stats?.completedOrders ?? "—"} />
          <StatCard label="Cancelled orders" value={stats?.cancelledOrders ?? "—"} />
          <StatCard label="Reviews" value={stats?.totalReviews ?? "—"} />
          <StatCard label="Avg rating" value={stats?.averageRating != null ? `${stats.averageRating} / 5` : "—"} />
          <StatCard label="Help requests" value={stats?.totalHelpRequests ?? "—"} />
          <StatCard label="Avg trust score" value={stats?.averageTrustScore != null ? `${stats.averageTrustScore}` : "—"} />
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
              const meta = dispute.metadata ?? {};
              const orderId = (meta.order_id as string) ?? dispute.card_id ?? "—";
              const reason = meta.reason as string ?? dispute.reason ?? "—";
              const description = meta.description as string | null;
              const status = meta.status as string ?? "open";

              return (
                <div key={dispute.id} className="rounded-2xl border border-slate-200 bg-white p-4">
                  <div className="flex items-start justify-between gap-4">
                    <div className="min-w-0 space-y-1">
                      <p className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                        <Gavel className="h-4 w-4 text-slate-500" />
                        Dispute
                      </p>
                      <p className="text-sm text-slate-600">Order: {orderId}</p>
                      <p className="text-sm text-slate-600">Reason: {reason}</p>
                      {description ? (
                        <p className="text-sm text-slate-500">{description}</p>
                      ) : null}
                      <p className="text-xs text-slate-400">Filed by: {dispute.user_id}</p>
                      <p className="text-xs text-slate-400">
                        Status: <span className="font-medium text-amber-600">{status}</span>
                      </p>
                      <p className="text-xs text-slate-400">{formatDate(dispute.created_at)}</p>
                    </div>
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
                  </div>
                </div>
              );
            })
          )}
        </div>
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

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white px-5 py-4">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">{label}</p>
      <p className="mt-1 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
    </div>
  );
}
