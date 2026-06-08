import { ShimmerSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function PeopleLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-6 p-4 sm:p-6">
      <div className="space-y-1">
        <ShimmerSkeleton className="h-8 w-40" />
        <ShimmerSkeleton className="h-4 w-56" />
      </div>
      <div className="space-y-3">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <ShimmerSkeleton className="h-12 w-12 rounded-full" />
            <div className="flex-1 space-y-2">
              <ShimmerSkeleton className="h-4 w-2/5" />
              <ShimmerSkeleton className="h-3 w-1/3" />
            </div>
            <ShimmerSkeleton className="h-8 w-24 rounded-lg" />
          </div>
        ))}
      </div>
    </div>
  );
}
