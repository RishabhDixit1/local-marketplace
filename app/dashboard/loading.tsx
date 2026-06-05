import { ListSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function DashboardLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="h-8 w-48 animate-pulse rounded-lg bg-slate-200" />
      <div className="h-4 w-72 animate-pulse rounded-lg bg-slate-100" />
      <div className="mt-6">
        <ListSkeleton count={3} />
      </div>
    </div>
  );
}
