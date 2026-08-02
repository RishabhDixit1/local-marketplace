"use client";

type Props = {
  count?: number;
};

export default function ProviderCardSkeleton({ count = 8 }: Props) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: count }).map((_, index) => (
        <div
          key={`provider-skeleton-${index}`}
          className="overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-sm sm:rounded-[var(--radius-3xl)]"
        >
          <div className="h-14 animate-pulse bg-[linear-gradient(135deg,rgba(14,165,164,0.18),rgba(var(--shadow-rgb),0.12))] sm:h-24" />

          <div className="px-3 pb-3 sm:px-5 sm:pb-5">
            <div className="-mt-5 flex justify-center sm:-mt-10">
              <div className="h-[72px] w-[72px] animate-pulse rounded-full border-[3px] border-[var(--surface-elevated)] bg-[var(--surface-soft)] sm:h-[96px] sm:w-[96px] sm:border-4" />
            </div>

            <div className="mt-2 space-y-2 text-center sm:mt-3 sm:space-y-3">
              <div className="mx-auto h-5 w-28 animate-pulse rounded-full bg-[var(--surface-soft)] sm:w-36" />
              <div className="mx-auto h-4 w-40 animate-pulse rounded-full bg-[var(--surface-soft)]" />
              <div className="mx-auto h-4 w-32 animate-pulse rounded-full bg-[var(--surface-soft)]" />
            </div>

            <div className="mt-3 h-9 animate-pulse rounded-lg bg-[var(--surface-soft)] sm:mt-5 sm:h-10" />
          </div>
        </div>
      ))}
    </div>
  );
}
