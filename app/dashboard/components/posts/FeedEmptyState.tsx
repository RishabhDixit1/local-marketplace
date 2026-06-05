"use client";

import { motion } from "framer-motion";
import { Inbox, RotateCcw, Sparkles, Zap } from "lucide-react";

type FeedEmptyStateProps = {
  hasAnyFeed: boolean;
  feedError: string | null;
  onResetOrRefresh: () => void;
  onOpenComposer: () => void;
};

export default function FeedEmptyState({
  hasAnyFeed,
  feedError,
  onResetOrRefresh,
  onOpenComposer,
}: FeedEmptyStateProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.2, 0.8, 0.2, 1] }}
      className="rounded-3xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-12 text-center shadow-sm"
    >
      <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-50)]">
        {feedError ? (
          <RotateCcw size={28} className="text-[var(--ink-500)]" />
        ) : (
          <Inbox size={28} className="text-[var(--brand-500)]" />
        )}
      </div>

      <p className="text-lg font-bold text-[var(--ink-950)]">
        {!hasAnyFeed
          ? feedError
            ? "Couldn't load your feed"
            : "Nothing here yet"
          : "No matches for this filter"}
      </p>

      <p className="mx-auto mt-2 max-w-sm text-sm text-[var(--ink-500)] leading-relaxed">
        {!hasAnyFeed
          ? feedError
            ? "Check your connection and try again. The feed will show live marketplace activity once it loads."
            : "Be the first in your area! Create a service listing, product, or help request to kick things off."
          : "Try a broader search or publish a new need to get responses from nearby providers."}
      </p>

      <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
        <button
          type="button"
          onClick={onResetOrRefresh}
          className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)]"
        >
          <RotateCcw size={14} />
          {!hasAnyFeed ? "Try again" : "Reset filters"}
        </button>
        {!feedError && (
          <button
            type="button"
            onClick={onOpenComposer}
            className="inline-flex min-h-10 items-center gap-2 rounded-xl bg-[var(--brand-500)] px-4 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <Sparkles size={14} />
            Create Post
          </button>
        )}
      </div>
    </motion.div>
  );
}
