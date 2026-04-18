"use client";

import { CheckCircle2, Loader2, X } from "lucide-react";
import type { MarketplaceDisplayFeedItem } from "@/lib/marketplaceFeed";

type AcceptConfirmDialogProps = {
  open: boolean;
  listing: MarketplaceDisplayFeedItem | null;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
};

export default function AcceptConfirmDialog({
  open,
  listing,
  busy,
  onCancel,
  onConfirm,
}: AcceptConfirmDialogProps) {
  if (!open || !listing) return null;

  return (
    <div className="fixed inset-0 z-[var(--layer-modal)] grid place-items-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-6 shadow-[0_30px_70px_-35px_rgba(15,23,42,0.55)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900">Send interest in this task</p>
            <p className="mt-1 text-sm text-slate-600">The requester will see your interest and choose a provider.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-3">
          <p className="line-clamp-1 text-sm font-semibold text-slate-900">{listing.displayTitle}</p>
          <p className="mt-1 line-clamp-2 text-xs text-slate-600">{listing.displayDescription}</p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-10 items-center rounded-xl border border-slate-200 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-65"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {busy ? "Sending..." : "Send Interest"}
          </button>
        </div>
      </div>
    </div>
  );
}
