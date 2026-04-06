"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowUpRight,
  CheckCircle2,
  Clock,
  FileText,
  Inbox,
  Loader2,
  Receipt,
  XCircle,
} from "lucide-react";
import ProviderControlNav from "@/app/components/provider/ProviderControlNav";
import { supabase } from "@/lib/supabase";

type QuoteDraftStatus = "draft" | "sent" | "accepted" | "expired" | "cancelled";

type QuoteRow = {
  id: string;
  order_id: string | null;
  help_request_id: string | null;
  consumer_id: string | null;
  status: string | null;
  summary: string | null;
  total: number | null;
  expires_at: string | null;
  sent_at: string | null;
  created_at: string | null;
  updated_at: string | null;
  metadata: Record<string, unknown> | null;
};

type QuoteItem = {
  id: string;
  orderId: string | null;
  helpRequestId: string | null;
  consumerId: string | null;
  status: QuoteDraftStatus;
  summary: string;
  total: number;
  expiresAt: string | null;
  sentAt: string | null;
  taskTitle: string;
  locationLabel: string;
  updatedAt: string | null;
};

const STATUS_ORDER: QuoteDraftStatus[] = ["sent", "accepted", "draft", "expired", "cancelled"];

const normalizeStatus = (value: string | null | undefined): QuoteDraftStatus => {
  if (value === "sent") return "sent";
  if (value === "accepted") return "accepted";
  if (value === "expired") return "expired";
  if (value === "cancelled") return "cancelled";
  return "draft";
};

const formatCurrency = (value: number) =>
  value > 0 ? `INR ${value.toLocaleString("en-IN")}` : "—";

const formatDate = (value: string | null) => {
  if (!value) return null;
  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return null;
  return parsed.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
};

const statusConfig: Record<
  QuoteDraftStatus,
  { label: string; pillClass: string; icon: React.ReactNode }
> = {
  draft: {
    label: "Draft",
    pillClass: "border-slate-200 bg-slate-50 text-slate-600",
    icon: <FileText className="h-3.5 w-3.5" />,
  },
  sent: {
    label: "Sent",
    pillClass: "border-sky-200 bg-sky-50 text-sky-700",
    icon: <Clock className="h-3.5 w-3.5" />,
  },
  accepted: {
    label: "Accepted",
    pillClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: <CheckCircle2 className="h-3.5 w-3.5" />,
  },
  expired: {
    label: "Expired",
    pillClass: "border-amber-200 bg-amber-50 text-amber-700",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
  cancelled: {
    label: "Cancelled",
    pillClass: "border-rose-200 bg-rose-50 text-rose-700",
    icon: <XCircle className="h-3.5 w-3.5" />,
  },
};

const mapRow = (row: QuoteRow): QuoteItem => {
  const meta = row.metadata && typeof row.metadata === "object" ? row.metadata : {};
  return {
    id: row.id,
    orderId: row.order_id ?? null,
    helpRequestId: row.help_request_id ?? null,
    consumerId: row.consumer_id ?? null,
    status: normalizeStatus(row.status),
    summary: (row.summary ?? "").trim() || "Untitled quote",
    total: typeof row.total === "number" ? row.total : 0,
    expiresAt: row.expires_at ?? null,
    sentAt: row.sent_at ?? null,
    taskTitle: (meta.task_title as string | undefined)?.trim() || (row.summary ?? "").trim() || "Untitled",
    locationLabel: (meta.location_label as string | undefined)?.trim() || "",
    updatedAt: row.updated_at ?? row.created_at ?? null,
  };
};

export default function ProviderQuotesPage() {
  const [quotes, setQuotes] = useState<QuoteItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeStatus, setActiveStatus] = useState<QuoteDraftStatus | "all">("all");

  const loadQuotes = useCallback(async () => {
    setLoading(true);
    setError(null);

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      setLoading(false);
      return;
    }

    const { data, error: dbError } = await supabase
      .from("quote_drafts")
      .select(
        "id,order_id,help_request_id,consumer_id,status,summary,total,expires_at,sent_at,created_at,updated_at,metadata"
      )
      .eq("provider_id", user.id)
      .order("updated_at", { ascending: false })
      .limit(120);

    if (dbError) {
      setError(dbError.message || "Unable to load quotes.");
    } else {
      setQuotes(((data as QuoteRow[] | null) || []).map(mapRow));
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    void loadQuotes();
  }, [loadQuotes]);

  const grouped = useMemo(() => {
    const filtered =
      activeStatus === "all" ? quotes : quotes.filter((q) => q.status === activeStatus);
    return filtered;
  }, [quotes, activeStatus]);

  const counts = useMemo(
    () =>
      STATUS_ORDER.reduce<Record<QuoteDraftStatus | "all", number>>(
        (acc, status) => {
          acc[status] = quotes.filter((q) => q.status === status).length;
          return acc;
        },
        { all: quotes.length, draft: 0, sent: 0, accepted: 0, expired: 0, cancelled: 0 }
      ),
    [quotes]
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 to-white">
      <ProviderControlNav />

      <div className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-6">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
            <Receipt className="h-3.5 w-3.5" />
            Quote Flow
          </div>
          <h1 className="mt-3 text-2xl font-semibold text-slate-950">Your quotes</h1>
          <p className="mt-1 text-sm text-slate-500">
            All quotes you have drafted or sent. Open a quote to review, edit, or track it in Tasks.
          </p>
        </div>

        {/* Status filter tabs */}
        <div className="mb-5 flex flex-wrap gap-2">
          {(["all", ...STATUS_ORDER] as const).map((status) => {
            const count = counts[status];
            const isActive = activeStatus === status;
            const cfg = status === "all" ? null : statusConfig[status];
            return (
              <button
                key={status}
                type="button"
                onClick={() => setActiveStatus(status)}
                className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                  isActive
                    ? "border-slate-800 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-800"
                }`}
              >
                {cfg?.icon ?? <Inbox className="h-3.5 w-3.5" />}
                {status === "all" ? "All" : cfg?.label ?? status}
                {count > 0 && (
                  <span
                    className={`rounded-full px-1.5 text-[10px] font-bold ${
                      isActive ? "bg-white/20" : "bg-slate-100"
                    }`}
                  >
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>

        {loading ? (
          <div className="flex items-center gap-2 py-12 text-sm text-slate-500">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading quotes...
          </div>
        ) : error ? (
          <div className="rounded-2xl border border-rose-200 bg-rose-50 px-5 py-4 text-sm text-rose-700">
            {error}
          </div>
        ) : grouped.length === 0 ? (
          <div className="rounded-[1.5rem] border border-slate-200 bg-slate-50 px-6 py-12 text-center">
            <Receipt className="mx-auto h-8 w-8 text-slate-300" />
            <p className="mt-3 text-sm font-semibold text-slate-700">
              {activeStatus === "all" ? "No quotes yet" : `No ${statusConfig[activeStatus as QuoteDraftStatus]?.label.toLowerCase()} quotes`}
            </p>
            <p className="mt-1 text-xs text-slate-500">
              Quotes are created when you respond to a matched lead or accept a help request.
            </p>
            <Link
              href="/dashboard/tasks"
              className="mt-4 inline-flex items-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            >
              Go to Tasks
              <ArrowUpRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="space-y-3">
            {grouped.map((quote) => {
              const cfg = statusConfig[quote.status];
              const taskPath = quote.orderId
                ? `/dashboard/tasks?task=${quote.orderId}`
                : quote.helpRequestId
                ? `/dashboard/tasks?helpRequest=${quote.helpRequestId}`
                : "/dashboard/tasks";

              return (
                <div
                  key={quote.id}
                  className="rounded-[1.5rem] border border-slate-200 bg-white px-5 py-4 shadow-sm transition hover:border-slate-300"
                >
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <div className="min-w-0">
                      <div className="flex flex-wrap items-center gap-2">
                        <span
                          className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-[11px] font-semibold ${cfg.pillClass}`}
                        >
                          {cfg.icon}
                          {cfg.label}
                        </span>
                        {quote.locationLabel ? (
                          <span className="text-xs text-slate-500">{quote.locationLabel}</span>
                        ) : null}
                      </div>
                      <p className="mt-2 truncate text-sm font-semibold text-slate-900">
                        {quote.summary}
                      </p>
                      {quote.taskTitle !== quote.summary ? (
                        <p className="mt-0.5 text-xs text-slate-500">{quote.taskTitle}</p>
                      ) : null}
                    </div>

                    <div className="flex shrink-0 flex-col items-end gap-1">
                      <span className="text-base font-semibold text-slate-900">
                        {formatCurrency(quote.total)}
                      </span>
                      {quote.status === "sent" && quote.expiresAt ? (
                        <span className="text-[11px] text-amber-600">
                          Expires {formatDate(quote.expiresAt)}
                        </span>
                      ) : quote.updatedAt ? (
                        <span className="text-[11px] text-slate-400">
                          {formatDate(quote.updatedAt)}
                        </span>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-3 flex items-center gap-2">
                    <Link
                      href={taskPath}
                      className="inline-flex items-center gap-1.5 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                    >
                      <ArrowUpRight className="h-3.5 w-3.5" />
                      Open in Tasks
                    </Link>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
