import { ShimmerSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function RootLoading() {
  return (
    <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-4 pt-8 sm:px-6 lg:px-8">
      <div className="flex items-center gap-3">
        <ShimmerSkeleton className="h-8 w-32" />
        <ShimmerSkeleton className="ml-auto h-9 w-24 rounded-xl" />
      </div>
      <div className="mt-16 text-center">
        <ShimmerSkeleton className="mx-auto h-10 w-72 sm:h-12 sm:w-96" />
        <ShimmerSkeleton className="mx-auto mt-3 h-5 w-56" />
        <ShimmerSkeleton className="mx-auto mt-6 h-14 w-full max-w-2xl rounded-2xl" />
      </div>
      <div className="mt-8 flex flex-wrap justify-center gap-2">
        {Array.from({ length: 6 }).map((_, i) => (
          <ShimmerSkeleton key={i} className="h-8 w-24 rounded-xl" />
        ))}
      </div>
      <div className="mt-8 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <div key={i} className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
            <div className="flex items-start gap-3">
              <ShimmerSkeleton className="h-12 w-12 rounded-xl" />
              <div className="flex-1 space-y-2">
                <ShimmerSkeleton className="h-4 w-2/3" />
                <ShimmerSkeleton className="h-3 w-1/3" />
              </div>
            </div>
            <div className="mt-3 flex gap-3">
              <ShimmerSkeleton className="h-3 w-16" />
              <ShimmerSkeleton className="h-3 w-16" />
              <ShimmerSkeleton className="h-3 w-12" />
            </div>
            <ShimmerSkeleton className="mt-3 h-3 w-full" />
            <div className="mt-4 flex items-center justify-between">
              <ShimmerSkeleton className="h-5 w-20" />
              <ShimmerSkeleton className="h-8 w-20 rounded-xl" />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
