"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, BarChart3, Loader2, MapPin, Plus, Settings, ShieldCheck, Trash2, Users,
} from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

type Workspace = {
  id: string; name: string; slug: string; description: string | null;
  business_type: string | null; phone: string | null; email: string | null;
  max_members: number; is_active: boolean; created_at: string;
};
type Member = {
  id: string; user_id: string; role: string; is_active: boolean;
  joined_at: string; profiles: { id: string; full_name: string; avatar_url: string | null; email: string | null };
};
type Branch = {
  id: string; name: string; address: string | null;
  phone: string | null; latitude: number | null; longitude: number | null;
  service_area_radius_km: number; is_active: boolean;
};
type Rule = {
  id: string; name: string; category: string | null; priority: number;
  max_distance_km: number | null; max_leads_per_member: number;
  round_robin: boolean; sla_minutes: number; is_active: boolean;
};
type Analytics = {
  totalMembers: number; activeMembers: number; totalOrders: number;
  completedOrders: number; totalRevenue: number; avgOrderValue: number;
  recentActivity: Array<{ id: string; action: string; description: string; created_at: string }>;
  members: Array<{ user_id: string; role: string; is_active: boolean; profiles: { full_name: string } }>;
};

const TABS = ["Overview", "Members", "Branches", "Rules", "Analytics"] as const;

export default function WorkspaceDetailPage() {
  const router = useRouter();
  const params = useParams();
  const workspaceId = params.workspaceId as string;

  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [members, setMembers] = useState<Member[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [rules, setRules] = useState<Rule[]>([]);
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [tab, setTab] = useState<string>("Overview");
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const [wsData, memData, brData, rlData, anData] = await Promise.all([
        fetchAuthedJson<{ ok: boolean; workspace: Workspace }>(supabase, `/api/workspaces/${workspaceId}`, { method: "GET" }),
        fetchAuthedJson<{ ok: boolean; members: Member[] }>(supabase, `/api/workspaces/${workspaceId}/members`, { method: "GET" }),
        fetchAuthedJson<{ ok: boolean; branches: Branch[] }>(supabase, `/api/workspaces/${workspaceId}/branches`, { method: "GET" }),
        fetchAuthedJson<{ ok: boolean; rules: Rule[] }>(supabase, `/api/workspaces/${workspaceId}/rules`, { method: "GET" }),
        fetchAuthedJson<{ ok: boolean; analytics: Analytics }>(supabase, `/api/workspaces/${workspaceId}/analytics`, { method: "GET" }),
      ]);
      if (cancelled) return;
      if (wsData?.ok) setWorkspace(wsData.workspace);
      if (memData?.ok) setMembers(memData.members);
      if (brData?.ok) setBranches(brData.branches);
      if (rlData?.ok) setRules(rlData.rules);
      if (anData?.ok) setAnalytics(anData.analytics);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [workspaceId]);

  const loadAll = useCallback(async () => {
    setLoading(true);
    const [wsData, memData, brData, rlData, anData] = await Promise.all([
      fetchAuthedJson<{ ok: boolean; workspace: Workspace }>(supabase, `/api/workspaces/${workspaceId}`, { method: "GET" }),
      fetchAuthedJson<{ ok: boolean; members: Member[] }>(supabase, `/api/workspaces/${workspaceId}/members`, { method: "GET" }),
      fetchAuthedJson<{ ok: boolean; branches: Branch[] }>(supabase, `/api/workspaces/${workspaceId}/branches`, { method: "GET" }),
      fetchAuthedJson<{ ok: boolean; rules: Rule[] }>(supabase, `/api/workspaces/${workspaceId}/rules`, { method: "GET" }),
      fetchAuthedJson<{ ok: boolean; analytics: Analytics }>(supabase, `/api/workspaces/${workspaceId}/analytics`, { method: "GET" }),
    ]);
    if (wsData?.ok) setWorkspace(wsData.workspace);
    if (memData?.ok) setMembers(memData.members);
    if (brData?.ok) setBranches(brData.branches);
    if (rlData?.ok) setRules(rlData.rules);
    if (anData?.ok) setAnalytics(anData.analytics);
    setLoading(false);
  }, [workspaceId]);

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-slate-400" /></div>;
  if (!workspace) return <div className="p-10 text-center text-sm text-slate-500">Workspace not found.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <button type="button" onClick={() => router.push("/dashboard/workspaces")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-slate-500 hover:text-slate-900">
        <ArrowLeft className="h-4 w-4" /> Workspaces
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">{workspace.name}</h1>
          {workspace.description && <p className="text-sm text-slate-500">{workspace.description}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs text-slate-400">
          <Users className="h-3.5 w-3.5" /> {members.length}/{workspace.max_members} members
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-slate-200 bg-white p-1">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${tab === t ? "bg-[var(--brand-900)] text-white shadow-sm" : "text-slate-600 hover:bg-slate-50"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Total Orders</p>
            <p className="mt-1 text-2xl font-bold text-slate-900">{analytics?.totalOrders || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Completed Jobs</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{analytics?.completedOrders || 0}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-xs text-slate-500">Revenue</p>
            <p className="mt-1 text-2xl font-bold text-[var(--brand-700)]">₹{(analytics?.totalRevenue || 0).toLocaleString("en-IN")}</p>
          </div>
        </div>
      )}

      {tab === "Members" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{members.length} member{members.length === 1 ? "" : "s"}</p>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Plus className="h-3 w-3" /> Invite
            </button>
          </div>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-200)] text-sm font-bold text-[var(--brand-700)]">
                {m.profiles?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{m.profiles?.full_name || "Unknown"}</p>
                <p className="text-xs text-slate-500">{m.role} · {m.is_active ? "Active" : "Inactive"}</p>
              </div>
              <span className={`rounded-full px-2 py-0.5 text-[10px] font-semibold ${m.role === "owner" ? "bg-amber-50 text-amber-700" : "bg-blue-50 text-blue-700"}`}>
                {m.role}
              </span>
            </div>
          ))}
        </div>
      )}

      {tab === "Branches" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{branches.length} branch{branches.length === 1 ? "" : "es"}</p>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Plus className="h-3 w-3" /> Add Branch
            </button>
          </div>
          {branches.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-slate-100 text-slate-600">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-slate-900">{b.name}</p>
                {b.address && <p className="text-xs text-slate-500">{b.address}</p>}
                <p className="text-xs text-slate-400">{b.service_area_radius_km} km radius</p>
              </div>
            </div>
          ))}
          {branches.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No branches added yet.</p>
          )}
        </div>
      )}

      {tab === "Rules" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-slate-700">{rules.length} rule{rules.length === 1 ? "" : "s"}</p>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50">
              <Plus className="h-3 w-3" /> Add Rule
            </button>
          </div>
          {rules.map((r) => (
            <div key={r.id} className="rounded-2xl border border-slate-200 bg-white p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-slate-900">{r.name}</p>
                <span className="text-xs text-slate-400">Priority {r.priority}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-slate-500">
                {r.category && <span className="rounded-full bg-slate-100 px-2 py-0.5">{r.category}</span>}
                <span>SLA: {r.sla_minutes}m</span>
                <span>Max leads: {r.max_leads_per_member}</span>
                <span>{r.round_robin ? "Round-robin" : "Fixed"}</span>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-slate-400 text-center py-6">No assignment rules yet.</p>
          )}
        </div>
      )}

      {tab === "Analytics" && analytics && (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <StatBox label="Members" value={analytics.activeMembers} total={analytics.totalMembers} />
            <StatBox label="Orders" value={analytics.totalOrders} />
            <StatBox label="Completed" value={analytics.completedOrders} />
            <StatBox label="Avg Order" value={`₹${analytics.avgOrderValue.toLocaleString("en-IN")}`} />
          </div>
          {analytics.recentActivity.length > 0 && (
            <div className="rounded-2xl border border-slate-200 bg-white p-4">
              <h3 className="mb-3 text-sm font-bold text-slate-900">Recent Activity</h3>
              <div className="space-y-2">
                {analytics.recentActivity.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-slate-600">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-400)]" />
                    <span>{a.description || a.action}</span>
                    <span className="text-slate-400">{new Date(a.created_at).toLocaleDateString()}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function StatBox({ label, value, total }: { label: string; value: string | number; total?: number }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-4">
      <p className="text-xs text-slate-500">{label}</p>
      <p className="mt-1 text-xl font-bold text-slate-900">
        {value}{total != null && <span className="text-sm font-normal text-slate-400"> / {total}</span>}
      </p>
    </div>
  );
}
