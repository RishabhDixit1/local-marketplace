"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import {
  ArrowLeft, Loader2, MapPin, Plus, Users,
} from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";
import { Input } from "@/app/components/ui/Input";

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
  const [addingBranch, setAddingBranch] = useState(false);
  const [branchName, setBranchName] = useState("");
  const [branchAddress, setBranchAddress] = useState("");
  const [addingRule, setAddingRule] = useState(false);
  const [ruleName, setRuleName] = useState("");
  const [ruleCategory, setRuleCategory] = useState("");
  const [busy, setBusy] = useState(false);

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

  const reload = useCallback(async () => {
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

  const handleAddBranch = async () => {
    if (!branchName.trim()) return;
    setBusy(true);
    const data = await fetchAuthedJson<{ ok: boolean; branch: Branch }>(
      supabase, `/api/workspaces/${workspaceId}/branches`, {
        method: "POST",
        body: JSON.stringify({ name: branchName.trim(), address: branchAddress.trim() || undefined }),
      }
    );
    if (data?.ok) {
      setBranchName("");
      setBranchAddress("");
      setAddingBranch(false);
      await reload();
    }
    setBusy(false);
  };

  const handleAddRule = async () => {
    if (!ruleName.trim()) return;
    setBusy(true);
    const data = await fetchAuthedJson<{ ok: boolean; rule: Rule }>(
      supabase, `/api/workspaces/${workspaceId}/rules`, {
        method: "POST",
        body: JSON.stringify({ name: ruleName.trim(), category: ruleCategory.trim() || undefined }),
      }
    );
    if (data?.ok) {
      setRuleName("");
      setRuleCategory("");
      setAddingRule(false);
      await reload();
    }
    setBusy(false);
  };

  if (loading) return <div className="flex justify-center py-20"><Loader2 className="h-7 w-7 animate-spin text-[var(--ink-500)]" /></div>;
  if (!workspace) return <div className="p-10 text-center text-sm text-[var(--ink-500)]">Workspace not found.</div>;

  return (
    <div className="mx-auto max-w-4xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <button type="button" onClick={() => router.push("/dashboard/workspaces")} className="inline-flex items-center gap-1.5 text-sm font-semibold text-[var(--ink-500)] hover:text-[var(--ink-950)]">
        <ArrowLeft className="h-4 w-4" /> Workspaces
      </button>

      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-extrabold text-[var(--ink-950)]">{workspace.name}</h1>
          {workspace.description && <p className="text-sm text-[var(--ink-500)]">{workspace.description}</p>}
        </div>
        <div className="flex items-center gap-2 text-xs text-[var(--ink-500)]">
          <Users className="h-3.5 w-3.5" /> {members.length}/{workspace.max_members} members
        </div>
      </div>

      <div className="flex gap-1 overflow-x-auto rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-1">
        {TABS.map((t) => (
          <button key={t} type="button" onClick={() => setTab(t)}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition ${tab === t ? "bg-[var(--brand-900)] text-white shadow-sm" : "text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === "Overview" && (
        <div className="grid gap-4 sm:grid-cols-3">
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <p className="text-xs text-[var(--ink-500)]">Total Orders</p>
            <p className="mt-1 text-2xl font-bold text-[var(--ink-950)]">{analytics?.totalOrders || 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <p className="text-xs text-[var(--ink-500)]">Completed Jobs</p>
            <p className="mt-1 text-2xl font-bold text-emerald-600">{analytics?.completedOrders || 0}</p>
          </div>
          <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <p className="text-xs text-[var(--ink-500)]">Revenue</p>
            <p className="mt-1 text-2xl font-bold text-[var(--brand-700)]">₹{(analytics?.totalRevenue || 0).toLocaleString("en-IN")}</p>
          </div>
        </div>
      )}

      {tab === "Members" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--ink-700)]">{members.length} member{members.length === 1 ? "" : "s"}</p>
            <button type="button" className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] hover:bg-[var(--surface-soft)]">
              <Plus className="h-3 w-3" /> Invite
            </button>
          </div>
          {members.map((m) => (
            <div key={m.id} className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-200)] text-sm font-bold text-[var(--brand-700)]">
                {m.profiles?.full_name?.charAt(0)?.toUpperCase() || "?"}
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--ink-950)]">{m.profiles?.full_name || "Unknown"}</p>
                <p className="text-xs text-[var(--ink-500)]">{m.role} · {m.is_active ? "Active" : "Inactive"}</p>
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
            <p className="text-sm font-semibold text-[var(--ink-700)]">{branches.length} branch{branches.length === 1 ? "" : "es"}</p>
            <button
              type="button"
              onClick={() => setAddingBranch(!addingBranch)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
            >
              <Plus className="h-3 w-3" /> Add Branch
            </button>
          </div>
          {addingBranch && (
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 space-y-3">
              <Input
                type="text"
                value={branchName}
                onChange={(e) => setBranchName(e.target.value)}
                placeholder="Branch name"
              />
              <Input
                type="text"
                value={branchAddress}
                onChange={(e) => setBranchAddress(e.target.value)}
                placeholder="Address (optional)"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddBranch}
                  disabled={busy || !branchName.trim()}
                  className="rounded-xl bg-[var(--brand-900)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--brand-700)] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </button>
                <button type="button" onClick={() => setAddingBranch(false)} className="rounded-xl border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)]">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {branches.map((b) => (
            <div key={b.id} className="flex items-center gap-3 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-[var(--surface-soft)] text-[var(--ink-700)]">
                <MapPin className="h-4 w-4" />
              </div>
              <div className="flex-1">
                <p className="text-sm font-semibold text-[var(--ink-950)]">{b.name}</p>
                {b.address && <p className="text-xs text-[var(--ink-500)]">{b.address}</p>}
                <p className="text-xs text-[var(--ink-500)]">{b.service_area_radius_km} km radius</p>
              </div>
            </div>
          ))}
          {branches.length === 0 && (
            <p className="text-sm text-[var(--ink-500)] text-center py-6">No branches added yet.</p>
          )}
        </div>
      )}

      {tab === "Rules" && (
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-[var(--ink-700)]">{rules.length} rule{rules.length === 1 ? "" : "s"}</p>
            <button
              type="button"
              onClick={() => setAddingRule(!addingRule)}
              className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
            >
              <Plus className="h-3 w-3" /> Add Rule
            </button>
          </div>
          {addingRule && (
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 space-y-3">
              <Input
                type="text"
                value={ruleName}
                onChange={(e) => setRuleName(e.target.value)}
                placeholder="Rule name"
              />
              <Input
                type="text"
                value={ruleCategory}
                onChange={(e) => setRuleCategory(e.target.value)}
                placeholder="Category (optional)"
              />
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleAddRule}
                  disabled={busy || !ruleName.trim()}
                  className="rounded-xl bg-[var(--brand-900)] px-3 py-1.5 text-xs font-bold text-white hover:bg-[var(--brand-700)] disabled:opacity-60"
                >
                  {busy ? <Loader2 className="h-3 w-3 animate-spin" /> : "Save"}
                </button>
                <button type="button" onClick={() => setAddingRule(false)} className="rounded-xl border border-[var(--surface-border)] px-3 py-1.5 text-xs font-semibold text-[var(--ink-700)]">
                  Cancel
                </button>
              </div>
            </div>
          )}
          {rules.map((r) => (
            <div key={r.id} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3">
              <div className="flex items-center justify-between">
                <p className="text-sm font-semibold text-[var(--ink-950)]">{r.name}</p>
                <span className="text-xs text-[var(--ink-500)]">Priority {r.priority}</span>
              </div>
              <div className="mt-1 flex flex-wrap gap-2 text-[10px] text-[var(--ink-500)]">
                {r.category && <span className="rounded-full bg-[var(--surface-soft)] px-2 py-0.5">{r.category}</span>}
                <span>SLA: {r.sla_minutes}m</span>
                <span>Max leads: {r.max_leads_per_member}</span>
                <span>{r.round_robin ? "Round-robin" : "Fixed"}</span>
              </div>
            </div>
          ))}
          {rules.length === 0 && (
            <p className="text-sm text-[var(--ink-500)] text-center py-6">No assignment rules yet.</p>
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
            <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
              <h3 className="mb-3 text-sm font-extrabold text-[var(--ink-950)]">Recent Activity</h3>
              <div className="space-y-2">
                {analytics.recentActivity.slice(0, 10).map((a) => (
                  <div key={a.id} className="flex items-center gap-2 text-xs text-[var(--ink-700)]">
                    <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-400)]" />
                    <span>{a.description || a.action}</span>
                    <span className="text-[var(--ink-500)]">{new Date(a.created_at).toLocaleDateString()}</span>
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
    <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
      <p className="text-xs text-[var(--ink-500)]">{label}</p>
      <p className="mt-1 text-xl font-bold text-[var(--ink-950)]">
        {value}{total != null && <span className="text-sm font-normal text-[var(--ink-500)]"> / {total}</span>}
      </p>
    </div>
  );
}
