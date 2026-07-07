export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      {/* Hero skeleton */}
      <div className="rounded-2xl border border-slate-100 bg-[var(--surface-elevated)] p-5">
        <div className="flex items-center gap-3">
          <div className="h-10 w-10 animate-pulse rounded-xl bg-slate-200" />
          <div className="flex-1 space-y-2">
            <div className="h-4 w-56 animate-pulse rounded bg-slate-200" />
            <div className="h-3 w-40 animate-pulse rounded bg-[var(--surface-soft)]" />
          </div>
        </div>
        <div className="mt-4 flex gap-2">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} className="h-7 w-20 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
          ))}
        </div>
        <div className="mt-4 flex gap-2">
          <div className="h-9 w-28 animate-pulse rounded-xl bg-slate-200" />
          <div className="h-9 w-36 animate-pulse rounded-xl border border-slate-100 bg-[var(--surface-elevated)]" />
        </div>
      </div>

      {/* Filter bar skeleton */}
      <div className="flex gap-2">
        <div className="h-8 w-16 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
        <div className="h-8 w-16 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
        <div className="h-8 w-20 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
        <div className="ml-auto h-8 w-24 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
      </div>

      {/* Feed skeleton */}
      <div className="grid gap-3 sm:grid-cols-2">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="overflow-hidden rounded-[1.4rem] border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-3.5 shadow-sm sm:rounded-[1.6rem] sm:p-4">
            <div className="flex items-center gap-3">
              <div className="h-11 w-11 animate-pulse rounded-full bg-slate-200" />
              <div className="flex-1 space-y-1.5">
                <div className="h-3 w-1/3 animate-pulse rounded bg-slate-200" />
                <div className="h-2.5 w-1/2 animate-pulse rounded bg-[var(--surface-soft)]" />
              </div>
            </div>
            <div className="mt-3 h-40 animate-pulse rounded-[1.2rem] bg-[var(--surface-soft)] sm:h-44 sm:rounded-[1.4rem]" />
            <div className="mt-3 h-4 w-3/4 animate-pulse rounded bg-slate-200" />
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
