"use client";

import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  CheckCircle2,
  Clock,
  Eye,
  Loader2,
  MapPin,
  MessageCircle,
  ThumbsDown,
  TrendingUp,
  XCircle,
  Zap,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import { type LeadScoreBreakdown } from "@/lib/leads/scoring";

type LeadAssignment = {
  id: string;
  help_request_id: string;
  score: number;
  score_breakdown: LeadScoreBreakdown;
  status: "assigned" | "viewed" | "responded" | "expired" | "converted" | "lost";
  assigned_at: string;
  responded_at: string | null;
  help_requests: {
    title: string;
    category: string;
    location_label: string | null;
    budget_min: number | null;
    budget_max: number | null;
    status: string;
    created_at: string;
  };
};

type LeadsResponse = {
  ok: boolean;
  leads: LeadAssignment[];
};

type StatusFilter = "all" | "assigned" | "converted" | "lost";

const URGENCY_MAP: Record<string, string> = {
  urgent: "Urgent",
  today: "Today",
  "24h": "Within 24h",
  week: "This week",
  flexible: "Flexible",
};

function getUrgencyLabel(category: string): string {
  return URGENCY_MAP[category] || category;
}

function getScoreColor(score: number): string {
  if (score >= 70) return "text-emerald-600";
  if (score >= 40) return "text-amber-600";
  return "text-slate-500";
}

function getScoreBg(score: number): string {
  if (score >= 70) return "bg-emerald-50 border-emerald-200";
  if (score >= 40) return "bg-amber-50 border-amber-200";
  return "bg-slate-50 border-slate-200";
}

function getStatusBadge(status: string): { label: string; className: string } {
  switch (status) {
    case "assigned":
      return { label: "New", className: "bg-blue-50 text-blue-700 border-blue-200" };
    case "viewed":
      return { label: "Viewed", className: "bg-slate-50 text-slate-600 border-slate-200" };
    case "responded":
      return { label: "Responded", className: "bg-emerald-50 text-emerald-700 border-emerald-200" };
    case "expired":
      return { label: "Expired", className: "bg-red-50 text-red-600 border-red-200" };
    case "converted":
      return { label: "Converted", className: "bg-purple-50 text-purple-700 border-purple-200" };
    case "lost":
      return { label: "Lost", className: "bg-rose-50 text-rose-600 border-rose-200" };
    default:
      return { label: status, className: "bg-slate-50 text-slate-600 border-slate-200" };
  }
}

const SCORE_LABELS: Record<string, string> = {
  categoryFitScore: "Category Fit",
  distanceScore: "Distance",
  availabilityScore: "Availability",
  responsivenessScore: "Responsiveness",
  trustScoreComponent: "Trust",
  experienceScore: "Experience",
};

const STATUS_FILTERS: { value: StatusFilter; label: string }[] = [
  { value: "all", label: "All" },
  { value: "assigned", label: "New" },
  { value: "converted", label: "Converted" },
  { value: "lost", label: "Lost" },
];

function LeadCard({
  lead,
  highlighted,
  onStatusChange,
}: {
  lead: LeadAssignment;
  highlighted: boolean;
  onStatusChange: (leadId: string, newStatus: string) => void;
}) {
  const [updating, setUpdating] = useState(false);
  const { label: statusLabel, className: statusClass } = getStatusBadge(lead.status);
  const urgency = getUrgencyLabel(lead.help_requests.category);
  const now = new Date();
  const assignedAt = new Date(lead.assigned_at);
  const daysAgo = Math.floor((now.getTime() - assignedAt.getTime()) / 86400000);

  const active = lead.status === "assigned" || lead.status === "viewed" || lead.status === "responded";

  const updateStatus = async (action: "dismiss" | "convert") => {
    setUpdating(true);
    try {
      const res = await fetchAuthedJson<{ ok: boolean; status: string }>(
        supabase,
        "/api/leads/status",
        {
          method: "POST",
          body: JSON.stringify({ leadId: lead.id, action }),
        }
      );
      if (res?.ok) {
        onStatusChange(lead.id, res.status);
      }
    } finally {
      setUpdating(false);
    }
  };

  return (
    <div
      className={`rounded-2xl border bg-white p-5 shadow-sm transition-all hover:shadow-md ${
        highlighted ? "ring-2 ring-[var(--brand-500)] border-[var(--brand-300)]" : "border-slate-200"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <h3 className="truncate text-base font-bold text-slate-900">
              {lead.help_requests.title}
            </h3>
            <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold ${statusClass}`}>
              {statusLabel}
            </span>
          </div>

          <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-slate-500">
            <span className="inline-flex items-center gap-1">
              <TrendingUp className="h-3 w-3" />
              {lead.help_requests.category}
            </span>
            {lead.help_requests.location_label && (
              <span className="inline-flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {lead.help_requests.location_label}
              </span>
            )}
            <span className="inline-flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {urgency}
            </span>
          </div>

          {(lead.help_requests.budget_min != null || lead.help_requests.budget_max != null) && (
            <p className="mt-2 text-sm font-semibold text-slate-700">
              {lead.help_requests.budget_min != null
                ? `$${lead.help_requests.budget_min.toLocaleString()}`
                : ""}
              {lead.help_requests.budget_min != null && lead.help_requests.budget_max != null
                ? " – "
                : ""}
              {lead.help_requests.budget_max != null
                ? `$${lead.help_requests.budget_max.toLocaleString()}`
                : ""}
            </p>
          )}
        </div>

        <div className={`flex shrink-0 flex-col items-center rounded-xl border px-3 py-2 ${getScoreBg(lead.score)}`}>
          <span className={`text-lg font-bold ${getScoreColor(lead.score)}`}>
            {Math.round(lead.score)}
          </span>
          <span className="text-[10px] font-medium text-slate-500">Score</span>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-1.5">
        {Object.entries(lead.score_breakdown).filter(([k]) => k !== "total").map(([key, value]) => (
          <span
            key={key}
            className="inline-flex items-center gap-1 rounded-lg bg-slate-50 px-2 py-1 text-[10px] font-medium text-slate-600"
          >
            {SCORE_LABELS[key] || key}: {Math.round(value)}
          </span>
        ))}
      </div>

      <div className="mt-4 flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex items-center gap-2">
          {active && (
            <>
              <Link
                href={`/dashboard/chat?recipientId=${encodeURIComponent(lead.help_request_id)}&draft_kind=interest`}
                className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3.5 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)]"
              >
                <MessageCircle className="h-3.5 w-3.5" />
                Respond
              </Link>
              <button
                type="button"
                onClick={() => void updateStatus("dismiss")}
                disabled={updating}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-500 transition hover:border-rose-200 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <XCircle className="h-3.5 w-3.5" />
                )}
                Dismiss
              </button>
              <button
                type="button"
                onClick={() => void updateStatus("convert")}
                disabled={updating}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-xs font-semibold text-emerald-700 transition hover:border-emerald-300 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {updating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <CheckCircle2 className="h-3.5 w-3.5" />
                )}
                Closed
              </button>
            </>
          )}
          <Link
            href={`/dashboard/market?helpRequestId=${lead.help_request_id}`}
            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
          >
            <Eye className="h-3.5 w-3.5" />
            View Request
          </Link>
        </div>
        <span className="text-[10px] text-slate-400">
          {daysAgo === 0 ? "Today" : daysAgo === 1 ? "1 day ago" : `${daysAgo} days ago`}
        </span>
      </div>
    </div>
  );
}

function LeadCardSkeleton() {
  return (
    <div className="space-y-3 rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1 space-y-2">
          <div className="h-5 w-48 animate-pulse rounded-full bg-slate-200" />
          <div className="flex gap-2">
            <div className="h-3 w-20 animate-pulse rounded-full bg-slate-100" />
            <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
          </div>
          <div className="h-4 w-32 animate-pulse rounded bg-slate-100" />
        </div>
        <div className="h-14 w-14 animate-pulse rounded-xl bg-slate-200" />
      </div>
      <div className="flex gap-1.5">
        <div className="h-5 w-16 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-5 w-16 animate-pulse rounded-lg bg-slate-100" />
        <div className="h-5 w-16 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <div className="flex items-center justify-between border-t border-slate-100 pt-3">
        <div className="flex gap-2">
          <div className="h-8 w-24 animate-pulse rounded-xl bg-slate-100" />
          <div className="h-8 w-28 animate-pulse rounded-xl bg-slate-100" />
        </div>
        <div className="h-3 w-16 animate-pulse rounded bg-slate-100" />
      </div>
    </div>
  );
}

export default function LeadsPage() {
  const searchParams = useSearchParams();
  const highlightedLeadId = searchParams.get("help_request_id");

  const [leads, setLeads] = useState<LeadAssignment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [providerId, setProviderId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [minScore, setMinScore] = useState(0);

  const handleStatusChange = useCallback((leadId: string, newStatus: string) => {
    setLeads((prev) =>
      prev.map((l) => (l.id === leadId ? { ...l, status: newStatus as LeadAssignment["status"] } : l))
    );
  }, []);

  const fetchLeads = useCallback(async () => {
    if (!providerId) return;
    setLoading(true);
    setError(null);

    try {
      const data = await fetchAuthedJson<LeadsResponse>(
        supabase,
        `/api/leads/score?providerId=${encodeURIComponent(providerId)}`,
        { method: "GET" },
      );

      if (data?.ok) {
        setLeads(data.leads || []);
      } else {
        setError("Failed to load leads. Please try again.");
      }
    } catch {
      setError("Failed to load leads. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [providerId]);

  useEffect(() => {
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (user?.id) {
        setProviderId(user.id);
      } else {
        setError("You must be signed in to view leads.");
        setLoading(false);
      }
    });
  }, []);

  useEffect(() => {
    if (providerId) {
      fetchLeads();
    }
  }, [providerId, fetchLeads]);

  const filteredLeads = useMemo(() => {
    let result = leads;
    if (statusFilter !== "all") {
      result = result.filter((l) => l.status === statusFilter);
    }
    if (minScore > 0) {
      result = result.filter((l) => l.score >= minScore);
    }
    return result;
  }, [leads, statusFilter, minScore]);

  const unreadLeads = leads.filter((l) => l.status === "assigned").length;

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex items-start gap-3">
        <Link
          href="/dashboard"
          className="mt-0.5 inline-flex h-9 w-9 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="flex items-center gap-2 text-xl font-bold text-slate-900">
            <Zap className="h-5 w-5 text-amber-500" />
            Leads
          </h1>
          <p className="mt-0.5 text-sm text-slate-500">
            Service opportunities matched to your skills
            {unreadLeads > 0 && (
              <span className="ml-2 inline-flex items-center gap-1 rounded-full bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                {unreadLeads} new
              </span>
            )}
          </p>
        </div>
      </div>

      {!loading && leads.length > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          <div className="flex rounded-xl border border-slate-200 bg-white p-0.5">
            {STATUS_FILTERS.map((f) => (
              <button
                key={f.value}
                type="button"
                onClick={() => setStatusFilter(f.value)}
                className={`rounded-lg px-3 py-1.5 text-xs font-semibold transition ${
                  statusFilter === f.value
                    ? "bg-[var(--brand-900)] text-white"
                    : "text-slate-500 hover:text-slate-800"
                }`}
              >
                {f.label}
              </button>
            ))}
          </div>
          <select
            value={minScore}
            onChange={(e) => setMinScore(Number(e.target.value))}
            className="rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 outline-none transition focus:border-sky-400"
          >
            <option value={0}>All scores</option>
            <option value={70}>70+ (hot)</option>
            <option value={40}>40+ (warm)</option>
          </select>
        </div>
      )}

      {loading && (
        <div className="grid gap-4 sm:grid-cols-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <LeadCardSkeleton key={i} />
          ))}
        </div>
      )}

      {error && !loading && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-red-50">
            <TrendingUp className="h-6 w-6 text-red-400" />
          </div>
          <p className="text-sm font-medium text-slate-600">{error}</p>
          <button
            type="button"
            onClick={fetchLeads}
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)]"
          >
            <Loader2 className="h-3.5 w-3.5" />
            Try Again
          </button>
        </div>
      )}

      {!loading && !error && leads.length === 0 && (
        <div className="flex flex-col items-center gap-3 rounded-2xl border border-slate-200 bg-white px-6 py-16 text-center shadow-sm">
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-amber-50">
            <Zap className="h-7 w-7 text-amber-400" />
          </div>
          <h3 className="text-lg font-bold text-slate-900">No leads yet</h3>
          <p className="max-w-sm text-sm text-slate-500">
            When customers post requests that match your services, they&apos;ll appear here.
          </p>
          <Link
            href="/dashboard/profile"
            className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-800)]"
          >
            <Eye className="h-3.5 w-3.5" />
            Update Your Profile
          </Link>
        </div>
      )}

      {!loading && !error && leads.length > 0 && filteredLeads.length === 0 && (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-slate-200 bg-white px-6 py-12 text-center shadow-sm">
          <p className="text-sm text-slate-500">No leads match the current filters.</p>
          <button
            type="button"
            onClick={() => { setStatusFilter("all"); setMinScore(0); }}
            className="text-xs font-semibold text-[var(--brand-900)] underline transition hover:text-[var(--brand-800)]"
          >
            Clear filters
          </button>
        </div>
      )}

      {!loading && !error && filteredLeads.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2">
          {filteredLeads.map((lead) => (
            <LeadCard
              key={lead.id}
              lead={lead}
              highlighted={lead.help_request_id === highlightedLeadId}
              onStatusChange={handleStatusChange}
            />
          ))}
        </div>
      )}
    </div>
  );
}
