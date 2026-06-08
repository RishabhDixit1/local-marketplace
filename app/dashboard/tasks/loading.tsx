import { ShimmerSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function TasksLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <ShimmerSkeleton className="h-8 w-36" />
          <ShimmerSkeleton className="h-4 w-48" />
        </div>
        <ShimmerSkeleton className="h-10 w-32 rounded-lg" />
      </div>
      <div className="flex gap-2">
        <ShimmerSkeleton className="h-9 w-24 rounded-full" />
        <ShimmerSkeleton className="h-9 w-28 rounded-full" />
        <ShimmerSkeleton className="h-9 w-20 rounded-full" />
        <ShimmerSkeleton className="h-9 w-32 rounded-full" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <div className="flex items-start justify-between">
              <div className="flex-1 space-y-2">
                <ShimmerSkeleton className="h-5 w-3/5" />
                <ShimmerSkeleton className="h-3 w-full" />
                <ShimmerSkeleton className="h-3 w-4/5" />
              </div>
              <ShimmerSkeleton className="h-8 w-20 rounded-lg" />
            </div>
            <div className="mt-3 flex items-center gap-4">
              <ShimmerSkeleton className="h-3 w-24" />
              <ShimmerSkeleton className="h-3 w-20" />
              <ShimmerSkeleton className="h-3 w-16" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
