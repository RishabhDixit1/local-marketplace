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

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <ShieldCheck className={compact ? "h-3.5 w-3.5 text-[var(--brand-700)]" : "h-4 w-4 text-[var(--brand-700)]"} />
        <span>Trust Snapshot</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {items.map((item, index) => {
          const tone = item.tone || "neutral";
          const hideOnMobile =
            typeof mobileItemLimit === "number" && mobileItemLimit >= 0 && index >= mobileItemLimit
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
      </div>
    </div>
  );
}
