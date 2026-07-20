"use client";

type Props = {
  count?: number;
};

export default function HorizontalProviderCardSkeleton({ count = 4 }: Props) {
  return (
    <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`horizontal-skeleton-${index}`}
          className="group flex min-w-[200px] sm:min-w-[240px] max-w-[280px] shrink-0 flex-col gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4"
        >
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 shrink-0 animate-pulse items-center justify-center rounded-full bg-[var(--surface-soft)]" />
            <div className="min-w-0 flex-1 space-y-1.5">
              <div className="h-4 w-24 animate-pulse rounded bg-[var(--surface-soft)]" />
              <div className="h-3 w-32 animate-pulse rounded bg-[var(--surface-soft)]" />
            </div>
          </div>
          <div className="space-y-1">
            <div className="h-3 w-full animate-pulse rounded bg-[var(--surface-soft)]" />
            <div className="h-3 w-3/4 animate-pulse rounded bg-[var(--surface-soft)]" />
          </div>
          <div className="flex items-center gap-3">
            <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-soft)]" />
            <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-soft)]" />
          </div>
          <div className="flex flex-wrap gap-1">
            <div className="h-5 w-16 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
            <div className="h-5 w-20 animate-pulse rounded-lg bg-[var(--surface-soft)]" />
          </div>
          <div className="flex items-center gap-1.5 border-t border-[var(--surface-border)] pt-2">
            <div className="h-6 w-16 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
            <div className="h-6 w-20 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
            <div className="h-6 w-16 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
          </div>
        </div>
      ))}
    </div>
  );
}
