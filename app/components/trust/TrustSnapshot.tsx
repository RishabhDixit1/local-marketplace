import { ShieldCheck } from "lucide-react";

type TrustSnapshotItem = {
  label: string;
  tone?: "neutral" | "good" | "caution";
};

type TrustSnapshotProps = {
  items: TrustSnapshotItem[];
  compact?: boolean;
  className?: string;
  mobileItemLimit?: number;
};

const toneClassNames: Record<NonNullable<TrustSnapshotItem["tone"]>, string> = {
  neutral: "border-slate-200 bg-slate-50 text-slate-600",
  good: "border-emerald-200 bg-emerald-50 text-emerald-700",
  caution: "border-amber-200 bg-amber-50 text-amber-700",
};

export default function TrustSnapshot({
  items,
  compact = false,
  className = "",
  mobileItemLimit,
}: TrustSnapshotProps) {
  if (items.length === 0) return null;

  const resolvedMobileLimit =
    typeof mobileItemLimit === "number" && mobileItemLimit >= 0
      ? mobileItemLimit
      : null;
  const hiddenItemCount =
    resolvedMobileLimit === null
      ? 0
      : Math.max(0, items.length - resolvedMobileLimit);

  return (
    <div className={`space-y-1.5 ${className}`.trim()}>
      <div className="flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500 sm:text-[11px]">
        <ShieldCheck
          className={
            compact
              ? "h-3.5 w-3.5 text-[var(--brand-700)]"
              : "h-4 w-4 text-[var(--brand-700)]"
          }
        />
        <span>Trust Snapshot</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {items.map((item, index) => {
          const tone = item.tone || "neutral";
          const hideOnMobile =
            resolvedMobileLimit !== null && index >= resolvedMobileLimit
              ? "hidden sm:inline-flex"
              : "";
          return (
            <span
              key={`${item.label}:${tone}`}
              title={item.label}
              className={`inline-flex max-w-full items-center overflow-hidden rounded-full border px-2.5 py-1 text-[11px] font-medium ${hideOnMobile} ${toneClassNames[tone]}`}
            >
              <span className="truncate">{item.label}</span>
            </span>
          );
        })}
        {hiddenItemCount > 0 ? (
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-500 sm:hidden">
            +{hiddenItemCount} more
          </span>
        ) : null}
      </div>
    </div>
  );
}
