import { ListSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function OrdersLoading() {
  return (
    <div className="mx-auto max-w-4xl space-y-4 p-4 sm:p-6">
      <div className="h-8 w-36 animate-pulse rounded-lg bg-slate-200" />
      <ListSkeleton count={3} />
    </div>
  );
}
