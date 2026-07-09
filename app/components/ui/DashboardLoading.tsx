import { ListSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export function DashboardLoading({ count = 3 }: { count?: number }) {
  return (
    <div role="status" aria-busy="true" className="space-y-4 p-4">
      <div className="h-8 w-48 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
      <ListSkeleton count={count} />
    </div>
  );
}
