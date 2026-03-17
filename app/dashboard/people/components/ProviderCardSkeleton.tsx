"use client";

type Props = {
  count?: number;
};

export default function ProviderCardSkeleton({ count = 3 }: Props) {
  return (
    <div className="space-y-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`provider-skeleton-${index}`}
          className="overflow-hidden rounded-[2rem] border border-slate-200 bg-white p-5 shadow-sm sm:p-6 xl:min-h-[72vh]"
        >
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
            <div className="space-y-5">
              <div className="flex flex-wrap items-start justify-between gap-4">
                <div className="flex items-start gap-4">
                  <div className="h-[88px] w-[88px] animate-pulse rounded-[1.6rem] bg-slate-100" />
                  <div className="space-y-3">
                    <div className="h-8 w-56 animate-pulse rounded-full bg-slate-200" />
                    <div className="h-4 w-36 animate-pulse rounded-full bg-slate-100" />
                    <div className="flex gap-2">
                      <div className="h-9 w-32 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-9 w-36 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
                <div className="grid gap-2 sm:grid-cols-2">
                  <div className="h-20 w-32 animate-pulse rounded-2xl bg-slate-100" />
                  <div className="h-20 w-32 animate-pulse rounded-2xl bg-slate-100" />
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-slate-200 p-5">
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-100" />
                <div className="mt-2 h-4 w-11/12 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-2 h-4 w-9/12 animate-pulse rounded-full bg-slate-100" />
              </div>

              <div className="rounded-[1.7rem] border border-slate-200 p-5">
                <div className="h-3 w-28 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="h-32 animate-pulse rounded-[1.4rem] bg-slate-100" />
                  <div className="h-32 animate-pulse rounded-[1.4rem] bg-slate-100" />
                </div>
              </div>

              <div className="rounded-[1.7rem] border border-slate-200 p-5">
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, metricIndex) => (
                    <div key={`metric-${metricIndex}`} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="aspect-[4/3] animate-pulse rounded-[1.8rem] bg-slate-100" />
              <div className="h-52 animate-pulse rounded-[1.8rem] bg-slate-100" />
            </div>
          </div>

          <div className="mt-6 flex flex-wrap gap-2.5 border-t border-slate-200 pt-5">
            <div className="h-12 w-36 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-12 w-28 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-12 w-28 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-12 w-28 animate-pulse rounded-2xl bg-slate-100" />
            <div className="h-12 w-40 animate-pulse rounded-2xl bg-slate-100" />
          </div>
        </div>
      ))}
    </div>
  );
}
