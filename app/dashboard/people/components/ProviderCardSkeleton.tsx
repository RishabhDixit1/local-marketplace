"use client";

type Props = {
  count?: number;
};

export default function ProviderCardSkeleton({ count = 3 }: Props) {
  return (
    <div className="space-y-4 sm:space-y-6">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`provider-skeleton-${index}`}
          className="overflow-hidden rounded-[1.75rem] border border-slate-200 bg-white p-4 shadow-sm sm:rounded-[2rem] sm:p-5 lg:p-6 xl:min-h-[58vh]"
        >
          <div className="grid gap-4 lg:gap-6 xl:grid-cols-[minmax(0,1.2fr)_320px]">
            <div className="space-y-4 sm:space-y-5">
              <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
                <div className="flex items-start gap-3 sm:gap-4">
                  <div className="h-16 w-16 animate-pulse rounded-[1.2rem] bg-slate-100 sm:h-[72px] sm:w-[72px] sm:rounded-[1.4rem]" />
                  <div className="space-y-3">
                    <div className="h-7 w-44 animate-pulse rounded-full bg-slate-200 sm:w-56" />
                    <div className="h-5 w-32 animate-pulse rounded-full bg-slate-100 sm:w-40" />
                    <div className="h-4 w-36 animate-pulse rounded-full bg-slate-100" />
                    <div className="flex flex-wrap gap-2">
                      <div className="h-8 w-28 animate-pulse rounded-full bg-slate-100" />
                      <div className="h-8 w-32 animate-pulse rounded-full bg-slate-100" />
                    </div>
                  </div>
                </div>
                <div className="grid grid-cols-2 gap-2 xl:w-[300px]">
                  <div className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100" />
                  <div className="h-[4.5rem] animate-pulse rounded-2xl bg-slate-100" />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
                <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
                <div className="h-11 animate-pulse rounded-2xl bg-slate-100" />
                <div className="col-span-2 h-11 animate-pulse rounded-2xl bg-slate-100 sm:col-span-1" />
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 p-4 sm:rounded-[1.7rem] sm:p-5">
                <div className="h-3 w-24 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-4 h-4 w-full animate-pulse rounded-full bg-slate-100" />
                <div className="mt-2 h-4 w-11/12 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-2 h-4 w-9/12 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
                  {Array.from({ length: 4 }).map((_, metricIndex) => (
                    <div key={`stat-${metricIndex}`} className="h-24 animate-pulse rounded-2xl bg-slate-100" />
                  ))}
                </div>
              </div>

              <div className="rounded-[1.5rem] border border-slate-200 p-4 sm:rounded-[1.7rem] sm:p-5">
                <div className="h-3 w-28 animate-pulse rounded-full bg-slate-100" />
                <div className="mt-4 grid gap-3 lg:grid-cols-2">
                  <div className="h-32 animate-pulse rounded-[1.4rem] bg-slate-100" />
                  <div className="h-32 animate-pulse rounded-[1.4rem] bg-slate-100" />
                </div>
              </div>
            </div>

            <div className="space-y-3 sm:space-y-4">
              <div className="aspect-[4/3] animate-pulse rounded-[1.8rem] bg-slate-100" />
              <div className="h-44 animate-pulse rounded-[1.8rem] bg-slate-100 sm:h-52" />
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}
