import { ShimmerSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function AnalyticsLoading() {
  return (
    <div className="mx-auto max-w-6xl space-y-6 p-4 sm:p-6">
      <ShimmerSkeleton className="h-8 w-44" />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <ShimmerSkeleton className="h-3 w-20" />
            <ShimmerSkeleton className="mt-2 h-7 w-28" />
            <ShimmerSkeleton className="mt-1 h-3 w-16" />
          </div>
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
          <ShimmerSkeleton className="h-5 w-40" />
          <div className="mt-4 h-64">
            <ShimmerSkeleton className="h-full w-full" />
          </div>
        </div>
        <div className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
          <ShimmerSkeleton className="h-5 w-36" />
          <div className="mt-4 h-64">
            <ShimmerSkeleton className="h-full w-full" />
          </div>
        </div>
      </div>
    </div>
  );
}
