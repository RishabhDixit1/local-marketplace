"use client";

import { useState } from "react";
import { CheckCircle2, Loader2, X } from "lucide-react";
import type { MarketplaceDisplayFeedItem } from "@/lib/marketplaceFeed";
import WhatHappensNext from "@/app/components/trust/WhatHappensNext";

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
  const [confirmed, setConfirmed] = useState(false);

  if (!open || !listing) return null;

  if (confirmed) {
    return (
      <div className="fixed inset-0 z-[var(--layer-modal)] grid place-items-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
        <div className="w-full max-w-md rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6 shadow-[0_30px_70px_-35px_rgba(var(--shadow-rgb),0.55)]">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2">
              <CheckCircle2 size={18} className="text-emerald-600" />
              <p className="text-sm font-semibold text-[var(--ink-950)]">Interest sent to {listing.displayCreator}</p>
            </div>
            <button
              type="button"
              onClick={() => { setConfirmed(false); onCancel(); }}
              className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--ink-500)] transition hover:bg-[var(--surface-soft)]"
              aria-label="Close"
            >
              <X size={14} />
            </button>
          </div>
          <WhatHappensNext kind="accept" className="mt-4" />
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-[var(--layer-modal)] grid place-items-center bg-slate-950/50 px-4 py-8 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-6 shadow-[0_30px_70px_-35px_rgba(var(--shadow-rgb),0.55)]">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-[var(--ink-950)]">Send interest in this task</p>
            <p className="mt-1 text-sm text-[var(--ink-700)]">The requester will see your interest and choose a provider.</p>
          </div>
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-[var(--surface-border)] text-[var(--ink-500)] transition hover:bg-[var(--surface-soft)] disabled:opacity-50"
            aria-label="Close confirmation"
          >
            <X size={14} />
          </button>
        </div>

        <div className="mt-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-3">
          <p className="line-clamp-1 text-sm font-semibold text-[var(--ink-950)]">{listing.displayTitle}</p>
          <p className="mt-1 line-clamp-2 text-xs text-[var(--ink-700)]">{listing.displayDescription}</p>
        </div>

        <div className="mt-5 flex items-center justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="inline-flex min-h-10 items-center rounded-xl border border-[var(--surface-border)] px-4 py-2 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)] disabled:opacity-60"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => {
              setConfirmed(true);
              onConfirm();
            }}
            disabled={busy}
            className="inline-flex min-h-10 items-center gap-1.5 rounded-xl bg-[var(--ink-950)] px-4 py-2 text-sm font-semibold text-[var(--ink-50)] transition hover:bg-[var(--ink)] disabled:cursor-not-allowed disabled:opacity-65"
          >
            {busy ? <Loader2 size={14} className="animate-spin" /> : <CheckCircle2 size={14} />}
            {busy ? "Sending..." : "Send Interest"}
          </button>
        </div>
      </div>
    </div>
  );
}
