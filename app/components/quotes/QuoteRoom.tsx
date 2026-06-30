"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  DollarSign,
  FileText,
  Image as ImageIcon,
  Loader2,
  MapPin,
  MessageCircle,
  Paperclip,
  PenTool,
  Plus,
  Receipt,
  RefreshCw,
  Send,
  Trash2,
  XCircle,
} from "lucide-react";
import type {
  DealRoomContext,
  DealRoomTimelineItem,
  ProviderCatalogItem,
  QuoteAttachmentRecord,
  QuoteDraftRecord,
  QuoteVersionRecord,
  SaveQuoteDraftResponse,
  SendQuoteDraftResponse,
} from "@/lib/api/quotes";
import QuoteDraftEditor, { type QuoteDraftEditorHandle } from "@/app/components/quotes/QuoteDraftEditor";
import WhatHappensNext from "@/app/components/trust/WhatHappensNext";
import {
  loadQuoteRoom,
  rejectQuoteDraft,
  uploadQuoteMedia,
  addQuoteAttachment,
  removeQuoteAttachment,
} from "@/lib/quotes/quoteRoom";
import {
  getOrderStatusLabel,
  getOrderStatusPillClass,
  normalizeOrderStatus,
  stageOrder,
} from "@/lib/orderWorkflow";

 type DealRoomProps = {
   orderId?: string | null;
   helpRequestId?: string | null;
   conversationId?: string | null;
   surface?: "chat" | "tasks";
   onBack?: () => void;
   onClose?: () => void;
   onSaved?: (payload: SaveQuoteDraftResponse & { ok: true }) => void;
   onSent?: (payload: SendQuoteDraftResponse & { ok: true }) => void;
   onAccepted?: (quoteId: string, orderId: string) => void;
   onQuoteSaved?: () => void;
    onQuoteSent?: (result: SendQuoteDraftResponse & { ok: true }) => void;
   onQuoteAccepted?: () => void;
   onQuoteRejected?: () => void;
   onOpenChat?: () => void;
 };

const formatCurrency = (value: number) => `INR ${value.toLocaleString("en-IN")}`;

const formatAgo = (timestamp: string | null | undefined) => {
  if (!timestamp) return "";
  const now = Date.now();
  const then = new Date(timestamp).getTime();
  const diffMs = now - then;
  const diffMins = Math.floor(diffMs / 60000);
  const diffHours = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMins < 1) return "Just now";
  if (diffMins < 60) return `${diffMins}m ago`;
  if (diffHours < 24) return `${diffHours}h ago`;
  if (diffDays < 7) return `${diffDays}d ago`;
  return new Date(timestamp).toLocaleDateString("en-IN", { day: "numeric", month: "short" });
};

export default function QuoteRoom({
  orderId,
  helpRequestId,
  conversationId,
  surface = "tasks",
  onBack,
  onClose,
  onSaved,
  onSent,
  onAccepted,
  onQuoteSaved,
  onQuoteSent,
  onQuoteAccepted,
  onQuoteRejected,
  onOpenChat,
}: DealRoomProps) {
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dealRoomContext, setDealRoomContext] = useState<DealRoomContext | null>(null);
  const [quoteDraft, setQuoteDraft] = useState<QuoteDraftRecord | null>(null);
  const [versions, setVersions] = useState<QuoteVersionRecord[]>([]);
  const [attachments, setAttachments] = useState<QuoteAttachmentRecord[]>([]);
  const [catalogItems, setCatalogItems] = useState<ProviderCatalogItem[]>([]);
  const [timeline, setTimeline] = useState<DealRoomTimelineItem[]>([]);
  const [showTimeline, setShowTimeline] = useState(false);
  const [showVersions, setShowVersions] = useState(false);
  const [showCatalog, setShowCatalog] = useState(false);
  const draftEditorRef = useRef<QuoteDraftEditorHandle | null>(null);
  const [quoteSent, setQuoteSent] = useState(false);
  const [quoteAccepted, setQuoteAccepted] = useState(false);
  const [rejecting, setRejecting] = useState(false);
  const [showRejectModal, setShowRejectModal] = useState(false);
  const [rejectReason, setRejectReason] = useState("");
  const [requestCounterOffer, setRequestCounterOffer] = useState(false);
  const [counterAmount, setCounterAmount] = useState<number | null>(null);
  const [uploadingAttachment, setUploadingAttachment] = useState(false);

  const handleClose = useCallback(() => {
    onBack?.();
    onClose?.();
  }, [onBack, onClose]);

  const handleOpenRejectModal = useCallback(() => {
    setRejectReason("");
    setRequestCounterOffer(false);
    setCounterAmount(null);
    setShowRejectModal(true);
  }, []);

  const handleCloseRejectModal = useCallback(() => {
    setShowRejectModal(false);
    setRejectReason("");
    setRequestCounterOffer(false);
    setCounterAmount(null);
  }, []);

  const handleConfirmReject = useCallback(async () => {
    if (!quoteDraft?.id) return;
    setRejecting(true);
    setError(null);
    try {
      const result = await rejectQuoteDraft(
        quoteDraft.id,
        rejectReason || undefined,
        requestCounterOffer,
        requestCounterOffer ? counterAmount : null
      );
      if (!result.ok) {
        setError(result.message || "Failed to reject quote");
        return;
      }
      setQuoteDraft((current) => {
        if (!current) return current;
        const newMetadata = {
          ...current.metadata,
          rejected_reason: rejectReason || null,
          rejected_at: new Date().toISOString(),
          is_counter_request: requestCounterOffer || false,
          counter_amount: requestCounterOffer ? counterAmount : null,
        };
        return {
          ...current,
          status: requestCounterOffer ? "countered" : "rejected",
          metadata: newMetadata,
        };
      });
      onQuoteRejected?.();
      handleCloseRejectModal();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reject quote");
    } finally {
      setRejecting(false);
    }
  }, [quoteDraft?.id, rejectReason, requestCounterOffer, onQuoteRejected, handleCloseRejectModal]);

  const handleFileUpload = useCallback(
    async (file: File) => {
      if (!quoteDraft?.id) return;
      setUploadingAttachment(true);
      setError(null);
      try {
        const uploaded = await uploadQuoteMedia(file);
        const result = await addQuoteAttachment(quoteDraft.id, {
          fileName: uploaded.name,
          filePath: uploaded.path,
          fileUrl: uploaded.url,
          fileSizeBytes: uploaded.size,
          mimeType: uploaded.type,
          kind: "attachment",
        });
        if (!result.ok) {
          throw new Error(result.message || "Failed to save attachment");
        }
        setAttachments((prev) => [result.attachment, ...prev]);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to upload attachment");
      } finally {
        setUploadingAttachment(false);
      }
    },
    [quoteDraft?.id]
  );

  const handleRemoveAttachment = useCallback(
    async (attachmentId: string) => {
      setError(null);
      try {
        const result = await removeQuoteAttachment(attachmentId);
        if (!result.ok) {
          throw new Error(result.message || "Failed to remove attachment");
        }
        setAttachments((prev) => prev.filter((a) => a.id !== attachmentId));
      } catch (err) {
        setError(err instanceof Error ? err.message : "Failed to remove attachment");
      }
    },
    []
  );

  useEffect(() => {
    if (!orderId && !helpRequestId) {
      setLoading(false);
      return;
    }

    let cancelled = false;

    const load = async () => {
      setLoading(true);
      setError(null);

      try {
        const result = await loadQuoteRoom({ orderId, helpRequestId });

        if (cancelled) return;

        if (!result.ok) {
          setError(result.message || "Failed to load deal room");
          return;
        }

        setDealRoomContext(result.context);
        setQuoteDraft(result.draft);
        setVersions(result.versions);
        setAttachments(result.attachments);
        setCatalogItems(result.catalogItems);
        setTimeline(result.timeline);
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Failed to load deal room");
        }
      } finally {
        if (!cancelled) {
          setLoading(false);
        }
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [orderId, helpRequestId]);

  const canonicalStatus = useMemo(
    () => normalizeOrderStatus(dealRoomContext?.status),
    [dealRoomContext?.status]
  );

  const timelineSteps = useMemo(() => {
    const statusIndex = stageOrder.indexOf(canonicalStatus);
    return stageOrder.slice(0, Math.max(0, statusIndex + 1));
  }, [canonicalStatus]);

  const panelToneClassName =
    surface === "chat"
      ? "border-sky-200 bg-white/95 shadow-[0_18px_48px_-36px_rgba(15,23,42,0.55)]"
      : "border-slate-200 bg-white shadow-[0_18px_48px_-38px_rgba(15,23,42,0.28)]";

  if (!orderId && !helpRequestId) {
    return null;
  }

  if (loading) {
    return (
      <div className={`rounded-[1.6rem] border p-6 ${panelToneClassName}`}>
        <div className="flex items-center justify-center gap-3 py-8 text-sm text-slate-600">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Loading deal room...</span>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={`rounded-[1.6rem] border p-6 ${panelToneClassName}`}>
        <div className="flex flex-col items-center gap-3 text-center py-6">
          <XCircle className="h-8 w-8 text-rose-500" />
          <p className="text-sm font-semibold text-slate-900">Something went wrong</p>
          <p className="text-sm text-slate-600">{error}</p>
           {(onBack || onClose) && (
             <button
               type="button"
               onClick={handleClose}
               className="inline-flex items-center gap-1.5 rounded-xl bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-200"
             >
               <ArrowLeft className="h-4 w-4" />
               Go back
             </button>
           )}
        </div>
      </div>
    );
  }

  if (!dealRoomContext) {
    return null;
  }

  return (
    <section className={`rounded-[1.6rem] border p-5 sm:p-6 ${panelToneClassName}`}>
      {/* Header */}
      <div className="flex flex-wrap items-start justify-between gap-3 pb-4 border-b border-slate-200">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
           {(onBack || onClose) && (
               <button
                 type="button"
                 onClick={handleClose}
                 className="inline-flex items-center gap-1.5 rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-semibold text-slate-600 transition hover:bg-slate-200"
               >
                 <ArrowLeft className="h-3.5 w-3.5" />
                 Back
               </button>
             )}
            <span className="inline-flex items-center gap-1.5 rounded-full border border-sky-200 bg-sky-50 px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-sky-700">
              <Receipt className="h-3.5 w-3.5" />
              Quote Room
            </span>
            <span className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[11px] font-semibold ${getOrderStatusPillClass(canonicalStatus)}`}>
              {getOrderStatusLabel(canonicalStatus)}
            </span>
          </div>

          <h3 className="mt-3 text-lg font-semibold text-slate-950">
            {dealRoomContext.scope.taskTitle || "Job details"}
          </h3>
          <p className="mt-1 text-sm text-slate-600">
            With <span className="font-semibold text-slate-900">{dealRoomContext.counterpartyName}</span>
            {dealRoomContext.scope.locationLabel && (
              <span className="ml-1 inline-flex items-center gap-1 text-slate-500">
                <MapPin className="h-3.5 w-3.5" />
                {dealRoomContext.scope.locationLabel}
              </span>
            )}
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {onOpenChat && (
            <button
              type="button"
              onClick={onOpenChat}
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-sky-300 hover:text-sky-700"
            >
              <MessageCircle className="h-3.5 w-3.5" />
              Open Chat
            </button>
          )}
          {canonicalStatus === "countered" && dealRoomContext?.canEditQuote && (
            <button
              type="button"
              onClick={() => draftEditorRef.current?.focus?.()}
              className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-800 transition hover:border-amber-300 hover:bg-amber-100"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Revise & Resend
            </button>
          )}
        </div>
      </div>

      {/* Timeline */}
      <div className="py-4 border-b border-slate-200">
        <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-3">Progress</p>
        <div className="flex flex-wrap items-center gap-2">
          {stageOrder.map((step, idx) => {
            const isComplete = timelineSteps.includes(step);
            const isCurrent = step === canonicalStatus;
            return (
              <div key={step} className="flex items-center gap-2">
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-xs font-bold ${
                      isCurrent
                        ? "bg-[var(--brand-900)] text-white"
                        : isComplete
                          ? "bg-emerald-100 text-emerald-700"
                          : "bg-slate-100 text-slate-400"
                    }`}
                  >
                    {isComplete && !isCurrent ? <CheckCircle2 className="h-3 w-3" /> : idx + 1}
                  </span>
                  <span
                    className={`text-xs font-semibold ${
                      isCurrent
                        ? "text-slate-900"
                        : isComplete
                          ? "text-slate-600"
                          : "text-slate-400"
                    }`}
                  >
                    {getOrderStatusLabel(step)}
                  </span>
                </div>
                {idx < stageOrder.length - 1 && (
                  <div
                    className={`h-0.5 w-6 ${isComplete && timelineSteps.includes(stageOrder[idx + 1]) ? "bg-emerald-200" : "bg-slate-200"}`}
                  />
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Scope Summary */}
      {dealRoomContext.scope.taskDescription && (
        <div className="py-4 border-b border-slate-200">
          <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-500 mb-2">Scope</p>
          <p className="text-sm text-slate-700 leading-relaxed">
            {dealRoomContext.scope.taskDescription}
          </p>
          {(dealRoomContext.scope.budgetMin != null || dealRoomContext.scope.budgetMax != null) && (
            <div className="mt-3 flex flex-wrap items-center gap-3">
              {dealRoomContext.scope.budgetMin != null && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  <DollarSign className="h-3.5 w-3.5" />
                  Min: {formatCurrency(dealRoomContext.scope.budgetMin)}
                </span>
              )}
              {dealRoomContext.scope.budgetMax != null && (
                <span className="inline-flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-700">
                  <DollarSign className="h-3.5 w-3.5" />
                  Max: {formatCurrency(dealRoomContext.scope.budgetMax)}
                </span>
              )}
            </div>
          )}
        </div>
      )}

       {/* Timeline */}
      {timeline.length > 0 && (
        <div className="py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowTimeline((prev) => !prev)}
            className="flex w-full items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-amber-100">
                <FileText className="h-3.5 w-3.5 text-amber-700" />
              </span>
              <span className="font-semibold text-slate-700">Activity</span>
              <span className="text-xs text-slate-400">({timeline.length} events)</span>
            </div>
            {showTimeline ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showTimeline && (
            <div className="mt-3 space-y-1">
              {timeline.map((event, idx) => (
                <div key={event.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <span className={`inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-xs ${
                      event.kind === "quote_accepted"
                        ? "bg-emerald-100 text-emerald-700"
                        : event.kind === "quote_sent"
                          ? "bg-sky-100 text-sky-700"
                          : event.kind === "attachment"
                            ? "bg-teal-100 text-teal-700"
                            : "bg-slate-100 text-slate-500"
                    }`}>
                      {event.kind === "quote_accepted" ? (
                        <CheckCircle2 className="h-3.5 w-3.5" />
                      ) : event.kind === "quote_sent" ? (
                        <Send className="h-3.5 w-3.5" />
                      ) : event.kind === "attachment" ? (
                        <Paperclip className="h-3.5 w-3.5" />
                      ) : (
                        <FileText className="h-3.5 w-3.5" />
                      )}
                    </span>
                    {idx < timeline.length - 1 && (
                      <div className="mt-1 h-full w-px bg-slate-200" />
                    )}
                  </div>
                  <div className="min-w-0 pb-4">
                    <p className="text-sm font-semibold text-slate-900">{event.title}</p>
                    {event.description && (
                      <p className="text-xs text-slate-500 mt-0.5">{event.description}</p>
                    )}
                    <p className="text-xs text-slate-400 mt-0.5">{formatAgo(event.timestamp)}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

       {/* Counter-offer banner for providers */}
       {canonicalStatus === "countered" && dealRoomContext?.canEditQuote && quoteDraft && (
         <div className="mt-4 rounded-xl border border-amber-200 bg-amber-50 p-4">
           <div className="flex items-start gap-3">
             <span className="inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-amber-100">
               <AlertTriangle className="h-4 w-4 text-amber-700" />
             </span>
             <div className="min-w-0 flex-1">
               <h4 className="text-sm font-bold text-amber-900">Customer requested changes</h4>
               {quoteDraft.metadata?.rejected_reason && (
                 <p className="mt-1 text-xs text-amber-700 leading-relaxed">
                   {String(quoteDraft.metadata.rejected_reason)}
                 </p>
               )}
               {quoteDraft.metadata?.counter_amount != null && (
                 <p className="mt-2 text-sm font-semibold text-amber-900">
                   Suggested budget: {formatCurrency(Number(quoteDraft.metadata.counter_amount))}
                 </p>
               )}
             </div>
           </div>
         </div>
       )}

       {/* Quote Draft Editor */}
      <div className="py-4">
        <QuoteDraftEditor
          ref={draftEditorRef}
          orderId={orderId}
          helpRequestId={helpRequestId}
          conversationId={conversationId}
          surface={surface}
          onSaved={(result) => {
            setQuoteDraft(result.draft);
            onSaved?.(result);
            onQuoteSaved?.();
          }}
          onSent={(result) => {
            setQuoteDraft(result.draft);
            setQuoteSent(true);
            onSent?.(result);
            onQuoteSent?.(result);
          }}
          onOpenChat={onOpenChat}
          onAccepted={(qId, oId) => {
            setQuoteAccepted(true);
            onAccepted?.(qId, oId);
            onQuoteAccepted?.();
          }}
          onReject={
            dealRoomContext?.canAddAttachment
              ? handleOpenRejectModal
              : undefined
          }
        />
      </div>

      {/* Catalog Quick-Add (for providers) */}
      {dealRoomContext.canEditQuote && catalogItems.length > 0 && (
        <div className="py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowCatalog((prev) => !prev)}
            className="flex w-full items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[var(--brand-50)]">
                <FileText className="h-3.5 w-3.5 text-[var(--brand-700)]" />
              </span>
              <span className="font-semibold text-slate-700">Quick-add from your service catalog</span>
              <span className="text-xs text-slate-400">({catalogItems.length} services)</span>
            </div>
            {showCatalog ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showCatalog && (
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {catalogItems.map((item) => (
                <div
                  key={item.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">{item.title}</p>
                    {item.price && item.price > 0 && (
                      <p className="text-xs font-semibold text-[var(--brand-700)]">{formatCurrency(item.price)}</p>
                    )}
                    {item.description && (
                      <p className="mt-0.5 text-xs text-slate-500 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => draftEditorRef.current?.addLineItem(item.title, item.description || "", item.price ?? 0)}
                    className="inline-flex shrink-0 items-center gap-1 rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700"
                    title="Add to quote line items"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Add
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Version History */}
      {versions.length > 0 && (
        <div className="py-4 border-t border-slate-200">
          <button
            type="button"
            onClick={() => setShowVersions((prev) => !prev)}
            className="flex w-full items-center justify-between text-sm"
          >
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-purple-100">
                <PenTool className="h-3.5 w-3.5 text-purple-700" />
              </span>
              <span className="font-semibold text-slate-700">Version history</span>
              <span className="text-xs text-slate-400">({versions.length} versions)</span>
            </div>
            {showVersions ? (
              <ChevronUp className="h-4 w-4 text-slate-400" />
            ) : (
              <ChevronDown className="h-4 w-4 text-slate-400" />
            )}
          </button>

          {showVersions && (
            <div className="mt-3 space-y-2">
              {versions.map((version, idx) => (
                <div
                  key={version.id}
                  className="flex items-start justify-between gap-3 rounded-xl border border-slate-200 bg-white px-3 py-2.5"
                >
                  <div className="min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-slate-900">v{version.versionNumber}</span>
                      {idx === 0 && (
                        <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-semibold text-emerald-700">
                          Current
                        </span>
                      )}
                      <span className="text-xs text-slate-400">{formatAgo(version.createdAt)}</span>
                    </div>
                    <p className="mt-0.5 text-xs text-slate-600">
                      {version.summary || "Quote draft"} · {formatCurrency(version.total)}
                    </p>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {version.lineItems.length} line item{version.lineItems.length !== 1 ? "s" : ""}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Attachments */}
      {(dealRoomContext?.canAddAttachment || attachments.length > 0) && (
        <div className="py-4 border-t border-slate-200">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="flex items-center gap-2">
              <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-teal-100">
                <Paperclip className="h-3.5 w-3.5 text-teal-700" />
              </span>
              <span className="text-sm font-semibold text-slate-700">
                Attachments
                {attachments.length > 0 && ` (${attachments.length})`}
              </span>
            </div>
            {dealRoomContext?.canAddAttachment && quoteDraft && (
              <label className="inline-flex cursor-pointer items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 transition hover:border-sky-300 hover:text-sky-700">
                {uploadingAttachment ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Plus className="h-3.5 w-3.5" />
                )}
                {uploadingAttachment ? "Uploading..." : "Add file"}
                <input
                  type="file"
                  className="hidden"
                  accept="image/jpeg,image/jpg,image/png,image/webp,image/gif,video/mp4,video/webm,audio/mpeg,audio/mp3,application/pdf"
                  disabled={uploadingAttachment || !quoteDraft}
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) {
                      void handleFileUpload(file);
                    }
                    e.target.value = "";
                  }}
                />
              </label>
            )}
          </div>

          {attachments.length === 0 ? (
            <div className="rounded-xl border border-dashed border-slate-200 bg-slate-50/50 p-4 text-center">
              <Paperclip className="mx-auto h-8 w-8 text-slate-300" />
              <p className="mt-2 text-xs text-slate-500">
                No attachments yet. Add photos, PDFs, receipts, or proof of work.
              </p>
            </div>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {attachments.map((attachment) => (
                <div
                  key={attachment.id}
                  className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5"
                >
                  <a
                    href={attachment.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-w-0 flex-1 items-center gap-3"
                  >
                    <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-white">
                      {attachment.mimeType?.startsWith("image/") ? (
                        <ImageIcon className="h-4.5 w-4.5 text-sky-600" />
                      ) : (
                        <FileText className="h-4.5 w-4.5 text-slate-600" />
                      )}
                    </span>
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {attachment.fileName}
                      </p>
                      <p className="text-xs text-slate-500">
                        {formatAgo(attachment.createdAt)}
                        {attachment.fileSizeBytes != null &&
                          attachment.fileSizeBytes > 0 &&
                          ` · ${(attachment.fileSizeBytes / 1024).toFixed(1)} KB`}
                      </p>
                    </div>
                  </a>
                  {dealRoomContext?.currentUserId === attachment.uploadedBy && (
                    <button
                      type="button"
                      onClick={() => void handleRemoveAttachment(attachment.id)}
                      className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-slate-400 transition hover:bg-rose-50 hover:text-rose-600"
                      title="Remove attachment"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Success states */}
      {quoteSent && <WhatHappensNext kind="quote" className="mt-4" />}
      {quoteAccepted && <WhatHappensNext kind="accept" className="mt-4" />}

      {/* Reject Modal */}
      {showRejectModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4">
          <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-5 shadow-xl">
            <div className="flex items-start gap-3">
              <span className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-rose-100">
                <XCircle className="h-5 w-5 text-rose-600" />
              </span>
              <div className="min-w-0">
                <h3 className="text-base font-bold text-slate-900">Reject or request changes</h3>
                <p className="mt-1 text-xs text-slate-500">
                  Let the provider know what you&apos;d like to adjust.
                </p>
              </div>
            </div>

            <div className="mt-4 space-y-4">
              <label className="space-y-2 text-sm">
                <span className="block font-semibold text-slate-800">
                  What would you like to change?
                </span>
                <textarea
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  placeholder="Price too high? Need different scope? Add your feedback here..."
                  rows={3}
                  className="w-full rounded-xl border border-slate-300 bg-white px-3 py-2.5 text-sm text-slate-800 outline-none transition focus:border-sky-400"
                />
              </label>

              <label className="flex cursor-pointer items-start gap-3 rounded-xl border border-slate-200 bg-slate-50/50 p-3 transition hover:bg-slate-50">
                <div className="mt-0.5">
                  <input
                    type="checkbox"
                    checked={requestCounterOffer}
                    onChange={(e) => setRequestCounterOffer(e.target.checked)}
                    className="h-4 w-4 rounded border-slate-300 text-[var(--brand-900)] focus:ring-[var(--brand-900)]"
                  />
                </div>
                <div>
                  <p className="text-sm font-semibold text-slate-800">
                    Request a revised quote
                  </p>
                  <p className="mt-0.5 text-xs text-slate-500">
                    Check this if you want the provider to send a different quote based on your
                    feedback, instead of declining entirely.
                  </p>
                </div>
              </label>

              {requestCounterOffer && (
                <label className="space-y-2 text-sm">
                  <span className="block font-semibold text-slate-800">
                    Your desired amount
                  </span>
                  <div className="relative">
                    <DollarSign className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      type="number"
                      min={0}
                      step={0.01}
                      value={counterAmount ?? ""}
                      onChange={(e) => setCounterAmount(e.target.value ? Number(e.target.value) : null)}
                      placeholder="0.00"
                      className="w-full rounded-xl border border-slate-300 bg-white py-2.5 pl-9 pr-3 text-sm text-slate-800 outline-none transition focus:border-sky-400"
                    />
                  </div>
                  <p className="text-xs text-slate-500">
                    Suggest a price you&apos;d be comfortable paying for this job.
                  </p>
                </label>
              )}
            </div>

            <div className="mt-5 flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleCloseRejectModal}
                disabled={rejecting}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 disabled:cursor-not-allowed disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmReject()}
                disabled={rejecting}
                className={`inline-flex items-center gap-1.5 rounded-xl px-4 py-2 text-sm font-semibold text-white transition disabled:cursor-not-allowed disabled:opacity-60 ${
                  requestCounterOffer
                    ? "bg-slate-700 hover:bg-slate-800"
                    : "bg-rose-600 hover:bg-rose-700"
                }`}
              >
                {rejecting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <XCircle className="h-4 w-4" />
                )}
                {rejecting
                  ? "Processing..."
                  : requestCounterOffer
                    ? "Request changes"
                    : "Reject quote"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
