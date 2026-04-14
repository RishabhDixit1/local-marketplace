"use client";

import { RotateCcw, Zap } from "lucide-react";

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
    <div className="rounded-3xl border border-slate-200 bg-white px-5 py-10 text-center shadow-sm">
      <p className="text-lg font-semibold text-slate-900">
        {!hasAnyFeed ? (feedError ? "Unable to load live posts right now" : "No live posts nearby yet") : "No posts match your current filters"}
      </p>
      <p className="mt-1 text-sm text-slate-500">
        {!hasAnyFeed
          ? feedError
            ? "Check your connection and retry. ServiQ will show live marketplace activity as soon as Supabase responds."
            : "Create the first service, product, or help request to start the local marketplace feed."
          : "Try a broader search or publish a new need for your area."}
      </p>
      <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          onClick={onResetOrRefresh}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl border border-slate-200 bg-white px-4 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-100"
        >
          <RotateCcw size={14} />
          {!hasAnyFeed ? "Try again" : "Reset filters"}
        </button>
        <button
          type="button"
          onClick={onOpenComposer}
          className="inline-flex min-h-10 items-center gap-1 rounded-xl bg-slate-900 px-4 text-sm font-semibold text-white transition hover:bg-slate-800"
        >
          <Zap size={14} />
          Create Post
        </button>
      </div>
    </div>
  );
}
