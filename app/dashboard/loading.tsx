export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-[1360px] space-y-4 px-3 pt-5 sm:space-y-5 sm:px-6 sm:pt-6">
      {/* Hero skeleton */}
      <div className="relative overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-4">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-56 animate-pulse rounded bg-[var(--surface-soft)]" />
            <div className="h-3 w-40 animate-pulse rounded bg-[var(--surface-soft)]" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
          <div className="h-9 w-36 animate-pulse rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)]" />
        </div>
      </div>

      {/* Provider scroll skeleton */}
      <div className="flex gap-3 overflow-hidden">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="min-w-[200px] shrink-0 space-y-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 animate-pulse rounded-full bg-[var(--surface-soft)]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-20 animate-pulse rounded bg-[var(--surface-soft)]" />
                <div className="h-2.5 w-16 animate-pulse rounded bg-[var(--surface-soft)]" />
              </div>
            </div>
            <div className="flex gap-2">
              <div className="h-6 w-14 animate-pulse rounded-full bg-[var(--surface-soft)]" />
              <div className="h-6 w-14 animate-pulse rounded-full bg-[var(--surface-soft)]" />
            </div>
          </div>
        ))}
      </div>

      {/* Feed skeleton — matches FeedGrid's auto-fit column layout */}
      <div className="grid gap-3 [grid-template-columns:repeat(auto-fit,minmax(min(100%,23rem),1fr))] 2xl:gap-4">
        {[1, 2, 3, 4, 5, 6].map((i) => (
          <div
            key={i}
            className="w-full max-w-[40rem] justify-self-center overflow-hidden rounded-[1.4rem] border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3.5 shadow-sm sm:rounded-[1.6rem] sm:p-4"
          >
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-full bg-[var(--surface-soft)]" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 animate-pulse rounded bg-[var(--surface-soft)]" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--surface-soft)]" />
              </div>
            </div>
            <div className="mt-3 h-40 animate-pulse rounded-[1.2rem] bg-[var(--surface-soft)] sm:h-44 sm:rounded-[1.4rem]" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-[var(--surface-soft)]" />
            <div className="mt-2 h-3 w-full animate-pulse rounded bg-[var(--surface-soft)]" />
            <div className="mt-4 flex gap-2">
              <div className="h-9 w-28 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
              <div className="h-9 w-28 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
              <div className="ml-auto h-9 w-9 animate-pulse rounded-full bg-[var(--surface-soft)]" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
