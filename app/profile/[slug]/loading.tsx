import { ShimmerSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function ProfileLoading() {
  return (
    <div className="mx-auto max-w-4xl">
      <ShimmerSkeleton className="h-48 w-full rounded-none sm:rounded-b-2xl" />
      <div className="relative px-4 sm:px-6">
        <div className="-mt-16 flex items-end gap-4">
          <ShimmerSkeleton className="h-32 w-32 rounded-full border-4 border-white" />
          <div className="flex-1 space-y-2 pb-2">
            <ShimmerSkeleton className="h-7 w-48" />
            <ShimmerSkeleton className="h-4 w-32" />
            <ShimmerSkeleton className="h-4 w-64" />
          </div>
        </div>
      </div>
      <div className="mt-6 border-b border-[var(--surface-border)] px-4 sm:px-6">
        <div className="flex gap-4">
          <ShimmerSkeleton className="h-10 w-28 rounded-t-lg" />
          <ShimmerSkeleton className="h-10 w-24 rounded-t-lg" />
          <ShimmerSkeleton className="h-10 w-20 rounded-t-lg" />
        </div>
      </div>
      <div className="p-4 sm:p-6">
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
              <div className="flex items-center gap-3">
                <ShimmerSkeleton className="h-10 w-10 rounded-full" />
                <div className="flex-1 space-y-2">
                  <ShimmerSkeleton className="h-4 w-2/5" />
                  <ShimmerSkeleton className="h-3 w-3/5" />
                </div>
              </div>
              <ShimmerSkeleton className="mt-3 h-3 w-full" />
              <ShimmerSkeleton className="mt-2 h-3 w-4/5" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
