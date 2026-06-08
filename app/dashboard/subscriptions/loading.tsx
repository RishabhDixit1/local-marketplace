import { ShimmerSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function SubscriptionsLoading() {
  return (
    <div className="mx-auto max-w-5xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <ShimmerSkeleton className="h-8 w-52" />
        <ShimmerSkeleton className="h-4 w-80" />
      </div>
      <div className="grid gap-6 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className={`rounded-2xl border p-6 ${i === 1 ? "border-blue-300 bg-blue-50/50" : "border-[var(--surface-border)] bg-[var(--surface-elevated)]"}`}>
            <ShimmerSkeleton className="h-5 w-24" />
            <ShimmerSkeleton className="mt-4 h-8 w-28" />
            <ShimmerSkeleton className="mt-1 h-3 w-20" />
            <div className="mt-6 space-y-3">
              {Array.from({ length: 4 }).map((_, j) => (
                <div key={j} className="flex items-center gap-2">
                  <ShimmerSkeleton className="h-4 w-4 rounded-full" />
                  <ShimmerSkeleton className="h-3 flex-1" />
                </div>
              ))}
            </div>
            <ShimmerSkeleton className="mt-6 h-10 w-full rounded-xl" />
          </div>
        ))}
      </div>
    </div>
  );
}
