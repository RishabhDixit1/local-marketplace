import { ShimmerSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function ProvidersLoading() {
  return (
    <div className="mx-auto max-w-7xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <ShimmerSkeleton className="h-8 w-48" />
        <ShimmerSkeleton className="h-4 w-72" />
      </div>
      <div className="flex items-center gap-3">
        <ShimmerSkeleton className="h-10 w-64 rounded-lg" />
        <ShimmerSkeleton className="h-10 w-32 rounded-lg" />
        <ShimmerSkeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <div className="flex items-center gap-3">
              <ShimmerSkeleton className="h-12 w-12 rounded-full" />
              <div className="flex-1 space-y-2">
                <ShimmerSkeleton className="h-4 w-3/5" />
                <ShimmerSkeleton className="h-3 w-2/5" />
              </div>
            </div>
            <ShimmerSkeleton className="mt-3 h-3 w-full" />
            <ShimmerSkeleton className="mt-2 h-3 w-4/5" />
            <div className="mt-3 flex flex-wrap gap-2">
              <ShimmerSkeleton className="h-6 w-16 rounded-full" />
              <ShimmerSkeleton className="h-6 w-20 rounded-full" />
              <ShimmerSkeleton className="h-6 w-14 rounded-full" />
            </div>
            <div className="mt-4 flex items-center gap-4">
              <ShimmerSkeleton className="h-4 w-16" />
              <ShimmerSkeleton className="h-4 w-20" />
              <ShimmerSkeleton className="h-4 w-14" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
