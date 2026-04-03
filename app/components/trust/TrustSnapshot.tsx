import { ShieldCheck } from "lucide-react";

type TrustSnapshotItem = {
  label: string;
  tone?: "neutral" | "good" | "caution";
};

type TrustSnapshotProps = {
  items: TrustSnapshotItem[];
  compact?: boolean;
  className?: string;
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
}: TrustSnapshotProps) {
  if (items.length === 0) return null;

  return (
    <div className={`space-y-2 ${className}`.trim()}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">
        <ShieldCheck className={compact ? "h-3.5 w-3.5 text-[var(--brand-700)]" : "h-4 w-4 text-[var(--brand-700)]"} />
        <span>Trust Snapshot</span>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => {
          const tone = item.tone || "neutral";
          return (
            <span
              key={`${item.label}:${tone}`}
              className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-medium ${
                toneClassNames[tone]
              }`}
            >
              {item.label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
