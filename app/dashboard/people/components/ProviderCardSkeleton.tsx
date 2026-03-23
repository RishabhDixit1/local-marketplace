"use client";

type Props = {
  count?: number;
};

export default function ProviderCardSkeleton({ count = 8 }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-4">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`provider-skeleton-${index}`}
          className="overflow-hidden rounded-[1.7rem] border border-slate-200 bg-white shadow-sm"
        >
          <div className="h-28 animate-pulse bg-[linear-gradient(135deg,rgba(14,165,164,0.18),rgba(15,23,42,0.12))]" />

          <div className="px-5 pb-5">
            <div className="-mt-12 flex justify-center">
              <div className="h-[108px] w-[108px] animate-pulse rounded-full border-4 border-white bg-slate-200" />
            </div>

            <div className="mt-4 space-y-3 text-center">
              <div className="mx-auto h-6 w-36 animate-pulse rounded-full bg-slate-200" />
              <div className="mx-auto h-4 w-40 animate-pulse rounded-full bg-slate-100" />
              <div className="mx-auto h-4 w-32 animate-pulse rounded-full bg-slate-100" />
              <div className="mx-auto h-4 w-44 animate-pulse rounded-full bg-slate-100" />
            </div>

            <div className="mt-6 h-11 animate-pulse rounded-full bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
