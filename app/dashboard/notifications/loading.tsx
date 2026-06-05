import { ListSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function NotificationsLoading() {
  return (
    <div className="mx-auto max-w-2xl space-y-4 p-4 sm:p-6">
      <div className="h-8 w-40 animate-pulse rounded-lg bg-slate-200" />
      <ListSkeleton count={5} />
    </div>
  );
}
