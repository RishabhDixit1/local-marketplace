import { ListSkeleton } from "@/app/components/motion/ShimmerSkeleton";

export default function SavedLoading() {
  return (
    <div className="mx-auto max-w-3xl space-y-6 px-4 py-6 sm:px-6">
      <div className="space-y-1">
        <div className="h-8 w-24 animate-pulse rounded-lg bg-slate-200" />
        <div className="h-4 w-48 animate-pulse rounded-lg bg-slate-100" />
      </div>
      <ListSkeleton count={4} />
    </div>
  );
}
