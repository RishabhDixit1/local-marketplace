"use client";

import { useCallback, useEffect, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { BadgeCheck, Banknote, CalendarDays, CheckCircle2, Clock, FileText, Loader2, Scale } from "lucide-react";
import { acceptQuoteDraft } from "@/lib/quotes/client";

type QuoteLineItem = {
  id: string;
  label: string;
  description: string | null;
  quantity: number;
  unit_price: number;
  amount: number;
  sort_order: number;
};

type Quote = {
  id: string;
  help_request_id: string;
  provider_id: string;
  consumer_id: string;
  status: string;
  summary: string | null;
  notes: string | null;
  subtotal: number;
  tax_amount: number;
  total: number;
  expires_at: string | null;
  sent_at: string | null;
  created_at: string;
  provider_name: string;
  provider_avatar: string | null;
  is_from_accepted_provider: boolean;
  quote_line_items: QuoteLineItem[];
};

export default function QuoteComparisonPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const helpRequestId = searchParams.get("id");

  const [quotes, setQuotes] = useState<Quote[]>([]);
  const [helpRequestTitle, setHelpRequestTitle] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [acceptingId, setAcceptingId] = useState<string | null>(null);
  const [acceptedId, setAcceptedId] = useState<string | null>(null);

  const fetchQuotes = useCallback(async () => {
    if (!helpRequestId) return;
    try {
      const res = await fetch(`/api/quotes/for-request?helpRequestId=${helpRequestId}`);
      const json = await res.json();
      if (json.ok) {
        setQuotes(json.quotes);
        setHelpRequestTitle(json.help_request_title);
      } else {
        setError(json.message || "Failed to load quotes.");
      }
    } catch {
      setError("Network error.");
    } finally {
      setLoading(false);
    }
  }, [helpRequestId]);

  useEffect(() => { void fetchQuotes(); }, [fetchQuotes]);

  const handleAccept = async (quoteId: string) => {
    setAcceptingId(quoteId);
    try {
      const result = await acceptQuoteDraft(quoteId);
      if (result.ok) {
        setAcceptedId(quoteId);
        setTimeout(() => router.push(`/orders/${result.orderId}`), 1200);
      } else {
        setError(result.message || "Failed to accept quote.");
      }
    } catch {
      setError("Failed to accept quote.");
    } finally {
      setAcceptingId(null);
    }
  };

  if (!helpRequestId) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12 text-center">
        <p className="text-sm text-slate-500">No help request specified.</p>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error && quotes.length === 0) {
    return (
      <div className="mx-auto max-w-2xl px-4 py-12">
        <p className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-600">{error}</p>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6">
      <div className="flex items-center gap-3">
        <div className="rounded-xl bg-slate-100 p-2.5">
          <Scale className="h-5 w-5 text-slate-600" />
        </div>
        <div className="min-w-0 flex-1">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900">Compare Quotes</h1>
          <p className="mt-1 truncate text-sm text-slate-500">{helpRequestTitle}</p>
        </div>
      </div>

      {acceptedId && (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-4 text-sm font-medium text-emerald-700">
          <CheckCircle2 className="mr-1.5 inline-block h-4 w-4" />
          Quote accepted! Redirecting to order...
        </div>
      )}

      {quotes.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center">
          <FileText className="mx-auto h-8 w-8 text-slate-300" />
          <p className="mt-3 text-sm font-medium text-slate-600">No quotes yet</p>
          <p className="mt-1 text-xs text-slate-400">
            When providers submit quotes for this request, they&apos;ll appear here.
          </p>
        </div>
      ) : (
        <div className="grid gap-6 lg:grid-cols-2 xl:grid-cols-3">
          {quotes.map((quote) => {
            const canAccept = quote.status === "sent" && !acceptedId;
            return (
              <div
                key={quote.id}
                className={`flex flex-col rounded-2xl border bg-white transition ${
                  quote.is_from_accepted_provider
                    ? "border-blue-200 ring-1 ring-blue-100"
                    : "border-slate-200"
                } ${acceptedId === quote.id ? "border-emerald-200 ring-1 ring-emerald-100" : ""}`}
              >
                {/* Provider header */}
                <div className="border-b border-slate-100 p-4">
                  <div className="flex items-center gap-3">
                    {quote.provider_avatar ? (
                      <img
                        src={quote.provider_avatar}
                        alt={quote.provider_name}
                        className="h-10 w-10 rounded-full object-cover"
                      />
                    ) : (
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-slate-200 text-sm font-semibold text-slate-600">
                        {quote.provider_name.charAt(0)}
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="flex items-center gap-1 text-sm font-semibold text-slate-900">
                        {quote.provider_name}
                        {quote.is_from_accepted_provider && (
                          <BadgeCheck className="h-3.5 w-3.5 text-blue-500" />
                        )}
                      </p>
                      <p className="text-xs text-slate-500 capitalize">
                        Status: <span className="font-medium">{quote.status}</span>
                      </p>
                    </div>
                  </div>
                </div>

                {/* Quote summary */}
                <div className="flex-1 space-y-3 p-4">
                  {quote.summary && (
                    <p className="text-sm leading-6 text-slate-700">{quote.summary}</p>
                  )}

                  {/* Line items */}
                  {quote.quote_line_items.length > 0 && (
                    <div className="space-y-1.5">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Items</p>
                      {quote.quote_line_items.map((item) => (
                        <div key={item.id} className="flex items-center justify-between text-xs">
                          <span className="text-slate-700">
                            {item.label}
                            {item.quantity > 1 && ` (x${item.quantity})`}
                          </span>
                          <span className="font-medium text-slate-900">
                            INR {item.amount.toLocaleString("en-IN")}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Total */}
                  <div className="border-t border-slate-100 pt-3">
                    <div className="flex items-center justify-between text-sm font-semibold text-slate-900">
                      <span>Total</span>
                      <span>INR {quote.total.toLocaleString("en-IN")}</span>
                    </div>
                    {quote.tax_amount > 0 && (
                      <p className="mt-0.5 text-right text-xs text-slate-500">
                        incl. INR {quote.tax_amount.toLocaleString("en-IN")} tax
                      </p>
                    )}
                  </div>

                  {/* Notes */}
                  {quote.notes && (
                    <p className="rounded-lg bg-slate-50 px-3 py-2 text-xs italic text-slate-500">
                      {quote.notes}
                    </p>
                  )}

                  {/* Dates */}
                  <div className="flex items-center gap-3 text-xs text-slate-400">
                    {quote.sent_at && (
                      <span className="inline-flex items-center gap-1">
                        <CalendarDays className="h-3 w-3" />
                        Sent {new Date(quote.sent_at).toLocaleDateString("en-IN")}
                      </span>
                    )}
                    {quote.expires_at && (
                      <span className="inline-flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Expires {new Date(quote.expires_at).toLocaleDateString("en-IN")}
                      </span>
                    )}
                  </div>
                </div>

                {/* Action */}
                <div className="border-t border-slate-100 p-4">
                  {quote.status === "accepted" ? (
                    <div className="flex items-center justify-center gap-2 rounded-xl bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
                      <CheckCircle2 className="h-4 w-4" />
                      Accepted
                    </div>
                  ) : canAccept ? (
                    <button
                      type="button"
                      disabled={acceptingId !== null}
                      onClick={() => void handleAccept(quote.id)}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
                    >
                      {acceptingId === quote.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Banknote className="h-4 w-4" />
                      )}
                      {acceptingId === quote.id ? "Accepting..." : "Accept this quote"}
                    </button>
                  ) : (
                    <p className="text-center text-xs text-slate-400">
                      {acceptedId ? "Another quote was accepted" : "This quote is no longer available"}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
