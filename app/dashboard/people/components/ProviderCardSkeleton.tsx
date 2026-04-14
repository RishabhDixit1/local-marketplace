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
          className="overflow-hidden rounded-[1.45rem] border border-slate-200 bg-white shadow-sm sm:rounded-[1.7rem]"
        >
          <div className="h-14 animate-pulse bg-[linear-gradient(135deg,rgba(14,165,164,0.18),rgba(15,23,42,0.12))] sm:h-24" />

          <div className="px-3 pb-3 sm:px-5 sm:pb-5">
            <div className="-mt-5 flex justify-center sm:-mt-10">
              <div className="h-[72px] w-[72px] animate-pulse rounded-full border-[3px] border-white bg-slate-200 sm:h-[96px] sm:w-[96px] sm:border-4" />
            </div>

            <div className="mt-2 space-y-2 text-center sm:mt-3 sm:space-y-3">
              <div className="mx-auto h-5 w-28 animate-pulse rounded-full bg-slate-200 sm:w-36" />
              <div className="mx-auto h-4 w-40 animate-pulse rounded-full bg-slate-100" />
              <div className="mx-auto h-4 w-32 animate-pulse rounded-full bg-slate-100" />
            </div>

            <div className="mt-3 h-9 animate-pulse rounded-lg bg-slate-100 sm:mt-5 sm:h-10" />
          </div>
        </div>
      ))}
    </div>
  );
}
