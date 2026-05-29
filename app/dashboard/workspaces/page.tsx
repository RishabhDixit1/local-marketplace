"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, Settings, Users } from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

type Workspace = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  business_type: string | null;
  max_members: number;
  is_active: boolean;
  created_at: string;
};

export default function WorkspacesPage() {
  const router = useRouter();
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [formName, setFormName] = useState("");
  const [formDesc, setFormDesc] = useState("");
  const [formType, setFormType] = useState("");
  const [creating, setCreating] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      const data = await fetchAuthedJson<{ ok: boolean; workspaces: Workspace[] }>(
        supabase, "/api/workspaces", { method: "GET" }
      );
      if (cancelled) return;
      if (data?.ok) setWorkspaces(data.workspaces || []);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, []);

  const handleCreate = async () => {
    if (!formName.trim()) return;
    setCreating(true);
    const data = await fetchAuthedJson<{ ok: boolean; workspace: Workspace }>(
      supabase, "/api/workspaces", {
        method: "POST",
        body: JSON.stringify({ name: formName, description: formDesc, business_type: formType }),
      }
    );
    if (data?.ok) {
      setShowForm(false);
      setFormName("");
      setFormDesc("");
      setFormType("");
      router.push(`/dashboard/workspaces/${data.workspace.id}`);
    }
    setCreating(false);
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Team Workspaces</h1>
          <p className="text-sm text-slate-500">Manage your team, branches, and routing rules.</p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(!showForm)}
          className="inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--brand-700)]"
        >
          <Plus className="h-4 w-4" /> New Workspace
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm space-y-4">
          <input
            type="text"
            value={formName}
            onChange={(e) => setFormName(e.target.value)}
            placeholder="Business name"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-400)]"
          />
          <input
            type="text"
            value={formDesc}
            onChange={(e) => setFormDesc(e.target.value)}
            placeholder="Short description (optional)"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-400)]"
          />
          <input
            type="text"
            value={formType}
            onChange={(e) => setFormType(e.target.value)}
            placeholder="Business type (optional)"
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--brand-400)]"
          />
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleCreate}
              disabled={creating || !formName.trim()}
              className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-2.5 text-sm font-bold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
            >
              {creating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              Create
            </button>
            <button type="button" onClick={() => setShowForm(false)} className="rounded-xl border border-slate-200 px-4 py-2.5 text-sm font-semibold text-slate-600">
              Cancel
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-slate-400" /></div>
      ) : workspaces.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
          <Building2 className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No workspaces yet</p>
          <p className="mt-1 text-xs text-slate-500">Create a workspace to add team members and branches.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {workspaces.map((ws) => (
            <button
              key={ws.id}
              type="button"
              onClick={() => router.push(`/dashboard/workspaces/${ws.id}`)}
              className="w-full rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:border-[var(--brand-300)] hover:shadow-md"
            >
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{ws.name}</h3>
                  {ws.description && <p className="mt-0.5 text-sm text-slate-500">{ws.description}</p>}
                  <div className="mt-2 flex items-center gap-3 text-xs text-slate-400">
                    <span className="flex items-center gap-1"><Users className="h-3 w-3" /> Max {ws.max_members} members</span>
                    {ws.business_type && <span>{ws.business_type}</span>}
                  </div>
                </div>
                <Settings className="h-5 w-5 text-slate-300" />
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
