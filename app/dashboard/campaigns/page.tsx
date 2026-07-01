"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Loader2,
  Megaphone,
  Plus,
  Trash2,
  ToggleLeft,
  ToggleRight,
} from "lucide-react";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";
import { Input } from "@/app/components/ui/Input";

type Campaign = {
  id: string;
  title: string;
  campaign_type: string;
  channel: string;
  schedule_type: string;
  is_active: boolean;
  executions_count: number;
  last_executed_at: string | null;
  message_template: string;
  target_segment: Record<string, unknown>;
  delay_minutes: number | null;
  cron_expression: string | null;
  starts_at: string | null;
  ends_at: string | null;
  max_executions: number;
  created_at: string;
};

type FormData = {
  title: string;
  campaign_type: string;
  channel: string[];
  message_template: string;
  target_segment: string;
  schedule_type: string;
  delay_minutes: number;
  cron_expression: string;
};

const EMPTY_FORM: FormData = {
  title: "",
  campaign_type: "promotion",
  channel: ["push"],
  message_template: "",
  target_segment: "{}",
  schedule_type: "immediate",
  delay_minutes: 0,
  cron_expression: "",
};

const CHANNEL_OPTIONS = ["push", "email", "sms", "whatsapp"] as const;
const CAMPAIGN_TYPE_OPTIONS = [
  "referral",
  "promotion",
  "onboarding",
  "reactivation",
  "review_request",
] as const;
const SCHEDULE_TYPE_OPTIONS = ["immediate", "delay", "cron"] as const;

const TYPE_LABELS: Record<string, string> = {
  referral: "Referral",
  promotion: "Promotion",
  onboarding: "Onboarding",
  reactivation: "Reactivation",
  review_request: "Review Request",
};

const CHANNEL_BADGES: Record<string, string> = {
  push: "bg-indigo-50 text-indigo-700",
  email: "bg-blue-50 text-blue-700",
  sms: "bg-emerald-50 text-emerald-700",
  whatsapp: "bg-teal-50 text-teal-700",
};

const SCHEDULE_BADGES: Record<string, string> = {
  immediate: "bg-amber-50 text-amber-700",
  delay: "bg-purple-50 text-purple-700",
  cron: "bg-cyan-50 text-cyan-700",
};

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState<FormData>(EMPTY_FORM);
  const [submitting, setSubmitting] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchCampaigns = useCallback(async () => {
    const data = await fetchAuthedJson<{ ok: boolean; campaigns: Campaign[] }>(
      supabase,
      "/api/campaigns",
      { method: "GET" },
    );
    if (data?.ok) setCampaigns(data.campaigns);
  }, []);

  useEffect(() => {
    let cancelled = false;
    const load = async () => {
      setLoading(true);
      await fetchCampaigns();
      if (!cancelled) setLoading(false);
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [fetchCampaigns]);

  const handleCreate = async () => {
    setSubmitting(true);
    const data = await fetchAuthedJson<{ ok: boolean; campaign: Campaign }>(
      supabase,
      "/api/campaigns",
      {
        method: "POST",
        body: JSON.stringify({
          title: form.title,
          campaign_type: form.campaign_type,
          channel: form.channel.join(","),
          message_template: form.message_template,
          target_segment: form.target_segment,
          schedule_type: form.schedule_type,
          delay_minutes: form.schedule_type === "delay" ? form.delay_minutes : undefined,
          cron_expression: form.schedule_type === "cron" ? form.cron_expression : undefined,
        }),
      },
    );
    setSubmitting(false);
    if (data?.ok) {
      setShowForm(false);
      setForm(EMPTY_FORM);
      await fetchCampaigns();
    }
  };

  const handleToggle = async (campaign: Campaign) => {
    setTogglingId(campaign.id);
    await fetchAuthedJson(supabase, "/api/campaigns", {
      method: "PATCH",
      body: JSON.stringify({ id: campaign.id, is_active: !campaign.is_active }),
    });
    setTogglingId(null);
    await fetchCampaigns();
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    await fetchAuthedJson(supabase, `/api/campaigns?id=${encodeURIComponent(id)}`, {
      method: "DELETE",
    });
    setDeletingId(null);
    await fetchCampaigns();
  };

  const toggleChannel = (ch: string) => {
    setForm((prev) => ({
      ...prev,
      channel: prev.channel.includes(ch)
        ? prev.channel.filter((c) => c !== ch)
        : [...prev.channel, ch],
    }));
  };

  const formatDate = (d: string | null) =>
    d ? new Date(d).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" }) : "—";

  return (
    <div className="mx-auto max-w-5xl space-y-6 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-slate-900">Campaigns</h1>
          <p className="text-sm text-slate-500">
            Manage marketing campaigns across channels.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setShowForm(true)}
          className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
        >
          <Plus className="h-4 w-4" />
          New Campaign
        </button>
      </div>

      {showForm && (
        <div className="rounded-2xl border border-slate-200 bg-white p-5">
          <h2 className="mb-4 text-sm font-bold text-slate-900">
            Create Campaign
          </h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Title
              </label>
              <Input
                type="text"
                value={form.title}
                onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))}
                placeholder="Summer Sale"
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Campaign Type
                </label>
                <select
                  value={form.campaign_type}
                  onChange={(e) => setForm((p) => ({ ...p, campaign_type: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-400)]"
                >
                  {CAMPAIGN_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {TYPE_LABELS[t]}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Schedule Type
                </label>
                <select
                  value={form.schedule_type}
                  onChange={(e) => setForm((p) => ({ ...p, schedule_type: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-400)]"
                >
                  {SCHEDULE_TYPE_OPTIONS.map((t) => (
                    <option key={t} value={t}>
                      {t.charAt(0).toUpperCase() + t.slice(1)}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            {form.schedule_type === "delay" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Delay (minutes)
                </label>
                <Input
                  type="number"
                  min={1}
                  value={form.delay_minutes}
                  onChange={(e) => setForm((p) => ({ ...p, delay_minutes: parseInt(e.target.value) || 0 }))}
                />
              </div>
            )}

            {form.schedule_type === "cron" && (
              <div>
                <label className="mb-1 block text-xs font-semibold text-slate-600">
                  Cron Expression
                </label>
                <Input
                  type="text"
                  value={form.cron_expression}
                  onChange={(e) => setForm((p) => ({ ...p, cron_expression: e.target.value }))}
                  placeholder="0 9 * * 1"
                />
              </div>
            )}

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Channels
              </label>
              <div className="flex flex-wrap gap-2">
                {CHANNEL_OPTIONS.map((ch) => (
                  <button
                    key={ch}
                    type="button"
                    onClick={() => toggleChannel(ch)}
                    className={`rounded-xl border px-3 py-1.5 text-xs font-semibold transition ${
                      form.channel.includes(ch)
                        ? "border-[var(--brand-400)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "border-slate-200 text-slate-500 hover:border-slate-300"
                    }`}
                  >
                    {ch}
                  </button>
                ))}
              </div>
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Message Template
              </label>
              <textarea
                value={form.message_template}
                onChange={(e) => setForm((p) => ({ ...p, message_template: e.target.value }))}
                rows={3}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-[var(--brand-400)]"
                placeholder="Your message here..."
              />
            </div>

            <div>
              <label className="mb-1 block text-xs font-semibold text-slate-600">
                Target Segment (JSON)
              </label>
              <textarea
                value={form.target_segment}
                onChange={(e) => setForm((p) => ({ ...p, target_segment: e.target.value }))}
                rows={2}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm font-mono text-xs outline-none focus:border-[var(--brand-400)]"
                placeholder='{"tags": ["premium"]}'
              />
            </div>

            <div className="flex items-center gap-3 pt-2">
              <button
                type="button"
                onClick={handleCreate}
                disabled={submitting || !form.title || !form.message_template}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
              >
                {submitting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Create Campaign
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowForm(false);
                  setForm(EMPTY_FORM);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-white">
        {loading ? (
          <div className="flex justify-center py-10">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        ) : campaigns.length === 0 ? (
          <div className="flex flex-col items-center py-10 text-center">
            <Megaphone className="mb-2 h-8 w-8 text-slate-300" />
            <p className="text-sm text-slate-400">No campaigns yet.</p>
            <p className="text-xs text-slate-300">
              Create your first marketing campaign.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead>
                <tr className="border-b border-slate-100 text-xs font-semibold uppercase text-slate-400">
                  <th className="px-4 py-3">Title</th>
                  <th className="px-4 py-3">Type</th>
                  <th className="px-4 py-3">Channel</th>
                  <th className="px-4 py-3">Schedule</th>
                  <th className="px-4 py-3">Executions</th>
                  <th className="px-4 py-3">Last Run</th>
                  <th className="px-4 py-3">Active</th>
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody>
                {campaigns.map((c) => (
                  <tr
                    key={c.id}
                    className="border-b border-slate-50 transition hover:bg-slate-50/50"
                  >
                    <td className="max-w-[200px] truncate px-4 py-3 font-semibold text-slate-900">
                      {c.title}
                    </td>
                    <td className="px-4 py-3">
                      <span className="rounded-full bg-slate-100 px-2 py-0.5 text-xs font-semibold text-slate-600">
                        {TYPE_LABELS[c.campaign_type] || c.campaign_type}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          CHANNEL_BADGES[c.channel] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.channel}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                          SCHEDULE_BADGES[c.schedule_type] || "bg-slate-100 text-slate-600"
                        }`}
                      >
                        {c.schedule_type}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-slate-600">
                      {c.executions_count}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-400">
                      {formatDate(c.last_executed_at)}
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleToggle(c)}
                        disabled={togglingId === c.id}
                        className={`inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-semibold transition ${
                          c.is_active
                            ? "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        }`}
                        title={c.is_active ? "Deactivate" : "Activate"}
                      >
                        {togglingId === c.id ? (
                          <Loader2 className="h-3 w-3 animate-spin" />
                        ) : c.is_active ? (
                          <ToggleRight className="h-3.5 w-3.5" />
                        ) : (
                          <ToggleLeft className="h-3.5 w-3.5" />
                        )}
                        {c.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <button
                        type="button"
                        onClick={() => handleDelete(c.id)}
                        disabled={deletingId === c.id}
                        className="inline-flex items-center justify-center rounded-lg p-1.5 text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                        title="Delete campaign"
                      >
                        {deletingId === c.id ? (
                          <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        ) : (
                          <Trash2 className="h-3.5 w-3.5" />
                        )}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
