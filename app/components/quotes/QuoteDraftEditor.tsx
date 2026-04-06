"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, DollarSign, FileText, Loader2, MessageCircle, Plus, Receipt, Send, Sparkles, Trash2 } from "lucide-react";
import type {
  QuoteContextRecord,
  QuoteDraftInput,
  QuoteDraftRecord,
  QuoteLineItemInput,
  SaveQuoteDraftResponse,
  SendQuoteDraftResponse,
} from "@/lib/api/quotes";
import { generateQuoteDraft } from "@/lib/ai/quoteDrafting";
import { calculateQuoteTotals, toDateInputValue } from "@/lib/quotes/calculations";
import { acceptQuoteDraft, loadQuoteDraft, saveQuoteDraft, sendQuoteDraft } from "@/lib/quotes/client";

type EditableLineItem = {
  id: string;
  label: string;
  description: string;
  quantity: string;
  unitPrice: string;
};

type QuoteDraftEditorProps = {
  orderId?: string | null;
  helpRequestId?: string | null;
  conversationId?: string | null;
  surface?: "tasks" | "chat";
  onSaved?: (payload: SaveQuoteDraftResponse & { ok: true }) => void;
  onSent?: (payload: SendQuoteDraftResponse & { ok: true }) => void;
  onOpenChat?: () => void;
  onAccepted?: (quoteId: string, orderId: string) => void;
};

const buildLocalLineItemId = (prefix: string, index: number) => `${prefix}-${index}-${Math.random().toString(36).slice(2, 8)}`;

const formatCurrency = (value: number) => `INR ${value.toLocaleString("en-IN")}`;

const createDefaultLineItem = (context?: QuoteContextRecord | null): EditableLineItem => ({
  id: buildLocalLineItemId("new", 0),
  label: context?.taskTitle || "Scope item",
  description: context?.taskDescription || "",
  quantity: "1",
  unitPrice: context?.suggestedAmount && context.suggestedAmount > 0 ? `${context.suggestedAmount}` : "",
});

const toEditableLineItems = (context: QuoteContextRecord | null, draft?: QuoteDraftRecord | null) => {
  if (draft?.lineItems?.length) {
    return draft.lineItems.map((lineItem, index) => ({
      id: lineItem.id || buildLocalLineItemId("draft", index),
      label: lineItem.label,
      description: lineItem.description,
      quantity: `${lineItem.quantity}`,
      unitPrice: `${lineItem.unitPrice}`,
    }));
  }

  return [createDefaultLineItem(context)];
};

const toLineItemInput = (items: EditableLineItem[]): QuoteLineItemInput[] =>
  items.map((item) => ({
    label: item.label,
    description: item.description,
    quantity: Number(item.quantity),
    unitPrice: Number(item.unitPrice),
  }));

const buildDraftPayload = (params: {
  orderId?: string | null;
  helpRequestId?: string | null;
  conversationId?: string | null;
  summary: string;
  notes: string;
  taxAmount: string;
  expiresAt: string;
  lineItems: EditableLineItem[];
}): QuoteDraftInput => ({
  orderId: params.orderId || undefined,
  helpRequestId: params.helpRequestId || undefined,
  conversationId: params.conversationId || undefined,
  summary: params.summary,
  notes: params.notes,
  taxAmount: Number(params.taxAmount || 0),
  expiresAt: params.expiresAt || null,
  lineItems: toLineItemInput(params.lineItems),
});

export default function QuoteDraftEditor({
  orderId,
  helpRequestId,
  conversationId,
  surface = "tasks",
  onSaved,
  onSent,
  onOpenChat,
  onAccepted,
}: QuoteDraftEditorProps) {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [sending, setSending] = useState(false);
  const [accepting, setAccepting] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [context, setContext] = useState<QuoteContextRecord | null>(null);
  const [currentDraftId, setCurrentDraftId] = useState<string | null>(null);
  const [summary, setSummary] = useState("");
  const [notes, setNotes] = useState("");
  const [taxAmount, setTaxAmount] = useState("0");
  const [expiresAt, setExpiresAt] = useState("");
  const [lineItems, setLineItems] = useState<EditableLineItem[]>([]);

  useEffect(() => {
    if (!orderId && !helpRequestId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const run = async () => {
      setLoading(true);
      setErrorMessage(null);

      try {
        const result = await loadQuoteDraft({
          orderId,
          helpRequestId,
        });

        if (!result.ok) {
          throw new Error(result.message || "Unable to load quote workspace.");
        }

        if (cancelled) return;

        const nextSummary =
          result.draft?.summary || (result.context.taskTitle ? `Quote for ${result.context.taskTitle}` : "Quote");

        setContext(result.context);
        setCurrentDraftId(result.draft?.id ?? null);
        setSummary(nextSummary);
        setNotes(result.draft?.notes || "");
        setTaxAmount(`${result.draft?.taxAmount ?? 0}`);
        setExpiresAt(toDateInputValue(result.draft?.expiresAt));
        setLineItems(toEditableLineItems(result.context, result.draft));
      } catch (error) {
        if (cancelled) return;
        setErrorMessage(error instanceof Error ? error.message : "Unable to load quote workspace.");
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void run();

    return () => {
      cancelled = true;
    };
  }, [helpRequestId, orderId]);

  const totals = useMemo(
    () =>
      calculateQuoteTotals({
        lineItems: toLineItemInput(lineItems),
        taxAmount: Number(taxAmount || 0),
      }),
    [lineItems, taxAmount]
  );

  const canEdit = Boolean(context?.canEdit);
  const panelToneClassName =
    surface === "chat"
      ? "border-sky-200 bg-white/95 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)]"
      : "border-slate-200 bg-white shadow-[0_18px_48px_-38px_rgba(15,23,42,0.28)]";

  const saveCurrentDraft = async (intent: "save" | "send") => {
    if (!context) return;

    const payload = buildDraftPayload({
      orderId,
      helpRequestId,
      conversationId,
      summary,
      notes,
      taxAmount,
      expiresAt,
      lineItems,
    });

    setErrorMessage(null);
    setSuccessMessage(null);

    if (intent === "save") {
      setSaving(true);
    } else {
      setSending(true);
    }

    try {
      if (intent === "save") {
        const result = await saveQuoteDraft(payload);
        if (!result.ok) {
          throw new Error(result.message || "Unable to save quote.");
        }

        setContext(result.context);
        setCurrentDraftId(result.draft.id);
        setSummary(result.draft.summary || summary);
        setNotes(result.draft.notes || "");
        setTaxAmount(`${result.draft.taxAmount}`);
        setExpiresAt(toDateInputValue(result.draft.expiresAt));
        setLineItems(toEditableLineItems(result.context, result.draft));
        setSuccessMessage("Quote draft saved. You can keep refining it before sending.");
        onSaved?.(result);
      } else {
        const result = await sendQuoteDraft(payload);
        if (!result.ok) {
          throw new Error(result.message || "Unable to send quote.");
        }

        setContext(result.context);
        setCurrentDraftId(result.draft.id);
        setSummary(result.draft.summary || summary);
        setNotes(result.draft.notes || "");
        setTaxAmount(`${result.draft.taxAmount}`);
        setExpiresAt(toDateInputValue(result.draft.expiresAt));
        setLineItems(toEditableLineItems(result.context, result.draft));
        setSuccessMessage("Quote sent. The buyer will be notified and can accept or counter. Track it in Tasks.");
        onSent?.(result);
      }
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : `Unable to ${intent} quote.`);
    } finally {
      setSaving(false);
      setSending(false);
    }
  };

  const handleGenerate = () => {
    if (!context) return;
    const generated = generateQuoteDraft(context);
    setSummary(generated.summary);
    setNotes(generated.notes);
    setExpiresAt(generated.expiresAt);
    setLineItems(
      generated.lineItems.map((item, index) => ({
        id: buildLocalLineItemId("gen", index),
        label: item.label,
        description: item.description,
        quantity: `${item.quantity}`,
        unitPrice: item.unitPrice > 0 ? `${item.unitPrice}` : "",
      }))
    );
    setErrorMessage(null);
    setSuccessMessage(null);
  };

  const handleAccept = async () => {
    if (!currentDraftId) return;
    setAccepting(true);
    setErrorMessage(null);
    setSuccessMessage(null);
    try {
      const result = await acceptQuoteDraft(currentDraftId);
      if (!result.ok) throw new Error(result.message || "Unable to accept quote.");
      setSuccessMessage("Quote accepted. The provider has been notified and the job is now in progress.");
      onAccepted?.(result.quoteId, result.orderId);
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to accept quote.");
    } finally {
      setAccepting(false);
    }
  };

  if (!orderId && !helpRequestId) {
    return null;
  }

  if (loading) {
    return (
      <div className={`rounded-[1.6rem] border p-5 ${panelToneClassName}`}>
        <div className="flex items-center gap-2 text-sm text-slate-600">
          <Loader2 className="h-4 w-4 animate-spin" />
          Loading quote workspace...
        </div>
      </div>
    );
  }

  return (
    <section className={`rounded-[1.6rem] border p-5 sm:p-6 ${panelToneClassName}`}>
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
            <Receipt className="h-3.5 w-3.5" />
            Quote Flow
          </div>
          <h3 className="mt-3 text-lg font-semibold text-slate-950">Review scope and send the quote</h3>
          <p className="mt-1 text-sm text-slate-600">
            {context
              ? `For ${context.counterpartyName} on ${context.taskTitle}. Keep it clear, line-itemed, and easy to approve.`
              : "Prepare the quote, save your draft, and send when it is ready."}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {context?.currentStatus ? (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold text-slate-600">
              {context.currentStatus.replace(/_/g, " ")}
            </span>
          ) : null}
          {context?.suggestedAmount ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700">
              Suggested {formatCurrency(context.suggestedAmount)}
            </span>
          ) : null}
          {canEdit ? (
            <button
              type="button"
              onClick={handleGenerate}
              className="inline-flex items-center gap-1.5 rounded-full border border-violet-200 bg-violet-50 px-3 py-1 text-xs font-semibold text-violet-700 transition hover:bg-violet-100"
            >
              <Sparkles className="h-3.5 w-3.5" />
              Generate draft
            </button>
          ) : null}
        </div>
      </div>

      {errorMessage ? (
        <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}

      {successMessage ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <div className="mt-5 grid gap-4 xl:grid-cols-[minmax(0,1.3fr)_320px]">
        <div className="space-y-4">
          <div className="grid gap-4 md:grid-cols-2">
            <label className="space-y-2 text-sm">
              <span className="font-semibold text-slate-800">Quote summary</span>
              <input
                value={summary}
                onChange={(event) => setSummary(event.target.value)}
                disabled={!canEdit}
                maxLength={120}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                placeholder="What is this quote for?"
              />
            </label>

            <label className="space-y-2 text-sm">
              <span className="font-semibold text-slate-800">Valid until</span>
              <input
                type="date"
                value={expiresAt}
                onChange={(event) => setExpiresAt(event.target.value)}
                disabled={!canEdit}
                className="w-full rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              />
            </label>
          </div>

          <label className="space-y-2 text-sm">
            <span className="font-semibold text-slate-800">Notes</span>
            <textarea
              value={notes}
              onChange={(event) => setNotes(event.target.value)}
              disabled={!canEdit}
              rows={3}
              maxLength={600}
              className="w-full rounded-[1.4rem] border border-slate-300 bg-white px-4 py-3 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
              placeholder="Timelines, assumptions, what is included, or what needs approval."
            />
          </label>

          <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <p className="text-sm font-semibold text-slate-900">Line items</p>
                <p className="text-xs text-slate-500">Break the quote into clean, approval-friendly scope items.</p>
              </div>
              {canEdit ? (
                <button
                  type="button"
                  onClick={() =>
                    setLineItems((current) => [
                      ...current,
                      {
                        id: buildLocalLineItemId("new", current.length),
                        label: "",
                        description: "",
                        quantity: "1",
                        unitPrice: "",
                      },
                    ])
                  }
                  className="inline-flex items-center gap-2 rounded-full border border-slate-300 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add item
                </button>
              ) : null}
            </div>

            <div className="mt-4 space-y-3">
              {lineItems.map((item, index) => {
                const quantity = Number(item.quantity || 0);
                const unitPrice = Number(item.unitPrice || 0);
                const amount = Number.isFinite(quantity * unitPrice) ? quantity * unitPrice : 0;

                return (
                  <div key={item.id} className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                    <div className="grid gap-3 lg:grid-cols-[minmax(0,1.2fr)_110px_140px_auto]">
                      <div className="space-y-3">
                        <input
                          value={item.label}
                          onChange={(event) =>
                            setLineItems((current) =>
                              current.map((entry) =>
                                entry.id === item.id ? { ...entry, label: event.target.value } : entry
                              )
                            )
                          }
                          disabled={!canEdit}
                          maxLength={80}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder={`Line item ${index + 1}`}
                        />
                        <textarea
                          value={item.description}
                          onChange={(event) =>
                            setLineItems((current) =>
                              current.map((entry) =>
                                entry.id === item.id ? { ...entry, description: event.target.value } : entry
                              )
                            )
                          }
                          disabled={!canEdit}
                          rows={2}
                          maxLength={240}
                          className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                          placeholder="Optional detail or deliverable note"
                        />
                      </div>

                      <input
                        type="number"
                        min="1"
                        step="1"
                        value={item.quantity}
                        onChange={(event) =>
                          setLineItems((current) =>
                            current.map((entry) =>
                              entry.id === item.id ? { ...entry, quantity: event.target.value } : entry
                            )
                          )
                        }
                        disabled={!canEdit}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder="Qty"
                      />

                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice}
                        onChange={(event) =>
                          setLineItems((current) =>
                            current.map((entry) =>
                              entry.id === item.id ? { ...entry, unitPrice: event.target.value } : entry
                            )
                          )
                        }
                        disabled={!canEdit}
                        className="rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                        placeholder="Unit price"
                      />

                      <div className="flex items-start justify-between gap-2 lg:flex-col lg:items-end">
                        <div className="rounded-xl bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">
                          {formatCurrency(amount)}
                        </div>
                        {canEdit ? (
                          <button
                            type="button"
                            onClick={() =>
                              setLineItems((current) => (current.length === 1 ? current : current.filter((entry) => entry.id !== item.id)))
                            }
                            disabled={lineItems.length === 1}
                            className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:cursor-not-allowed disabled:opacity-60"
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                            Remove
                          </button>
                        ) : null}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-[1.45rem] border border-slate-200 bg-slate-50/80 p-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
              <FileText className="h-3.5 w-3.5" />
              Quote totals
            </div>

            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 text-slate-600">
                <span>Subtotal</span>
                <span className="font-semibold text-slate-900">{formatCurrency(totals.subtotal)}</span>
              </div>

              <label className="space-y-2">
                <span className="block font-medium text-slate-700">Tax or fees</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={taxAmount}
                  onChange={(event) => setTaxAmount(event.target.value)}
                  disabled={!canEdit}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400 disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500"
                />
              </label>

              <div className="rounded-[1.25rem] border border-slate-200 bg-white p-4">
                <div className="flex items-center justify-between gap-3">
                  <span className="text-sm font-semibold text-slate-700">Total</span>
                  <span className="text-lg font-semibold text-slate-950">{formatCurrency(totals.total)}</span>
                </div>
              </div>
            </div>
          </div>

          <div className="rounded-[1.45rem] border border-slate-200 bg-white p-4">
            <div className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-amber-700">
              <DollarSign className="h-3.5 w-3.5" />
              Approval ready
            </div>

            <div className="mt-4 space-y-3 text-sm text-slate-600">
              <p>Keep the scope plain-language, the numbers clean, and the expiry explicit so the customer can say yes quickly.</p>
              {context?.locationLabel ? (
                <p className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-slate-700">
                  Location: {context.locationLabel}
                </p>
              ) : null}
            </div>

            <div className="mt-5 space-y-2">
              <button
                type="button"
                onClick={() => void saveCurrentDraft("save")}
                disabled={!canEdit || saving || sending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Receipt className="h-4 w-4" />}
                {saving ? "Saving draft..." : "Save draft"}
              </button>

              <button
                type="button"
                onClick={() => void saveCurrentDraft("send")}
                disabled={!canEdit || saving || sending}
                className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {sending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                {sending ? "Sending quote..." : "Send quote"}
              </button>

              {onOpenChat ? (
                <button
                  type="button"
                  onClick={onOpenChat}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl border border-sky-200 bg-sky-50 px-4 py-3 text-sm font-semibold text-sky-700 transition hover:bg-sky-100"
                >
                  <MessageCircle className="h-4 w-4" />
                  Continue in chat
                </button>
              ) : null}
            </div>

            {!canEdit && context?.actorRole === "consumer" && currentDraftId && (context.currentStatus === "quoted" || context.currentStatus === "sent") ? (
              <div className="mt-5 space-y-2">
                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={accepting}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {accepting ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                  {accepting ? "Accepting..." : "Accept quote"}
                </button>
                <p className="text-xs text-slate-500 text-center">Accepting will notify the provider and move the job into active work.</p>
              </div>
            ) : !canEdit ? (
              <p className="mt-4 text-xs text-slate-500">This quote is view-only here. The assigned provider controls edits and sending.</p>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}
