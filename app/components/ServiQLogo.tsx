import { appName, appTagline } from "@/lib/branding";

type ServiQLogoProps = {
  className?: string;
  showTagline?: boolean;
  compact?: boolean;
  markOnly?: boolean;
  wordmarkClassName?: string;
  taglineClassName?: string;
  markClassName?: string;
  markDotClassName?: string;
  qClassName?: string;
  qRingClassName?: string;
};

const joinClasses = (...values: Array<string | undefined | false>) => values.filter(Boolean).join(" ");

export default function ServiQLogo({
  className,
  showTagline = false,
  compact = false,
  markOnly = false,
  wordmarkClassName,
  taglineClassName,
  markClassName,
  markDotClassName,
  qClassName,
  qRingClassName,
}: ServiQLogoProps) {
  const markClasses = joinClasses(
    "relative inline-flex items-center justify-center rounded-xl border shadow-sm",
    compact ? "h-9 w-9 text-base" : "h-11 w-11 text-lg",
    markClassName || "border-slate-200 bg-white text-slate-900 shadow-slate-900/10"
  );

  if (markOnly) {
    return (
      <span className={joinClasses("inline-flex items-center", className)}>
        <span className={markClasses} aria-hidden="true">
          <span className="brand-display text-[0.95em] font-semibold leading-none">S</span>
          <span
            className={joinClasses(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
              markDotClassName || "bg-[var(--brand-500)]"
            )}
          />
        </span>
        <span className="sr-only">{appName}</span>
      </span>
    );
  }

  return (
    <div className={joinClasses("inline-flex items-center", compact ? "gap-2" : "gap-3", className)}>
      <span className={markClasses} aria-hidden="true">
        <span className="brand-display text-[0.95em] font-semibold leading-none">S</span>
        <span
          className={joinClasses(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white",
            markDotClassName || "bg-[var(--brand-500)]"
          )}
        />
      </span>
      <span className="min-w-0">
        <span
          className={joinClasses(
            "brand-display inline-flex items-baseline font-semibold tracking-tight leading-none",
            compact ? "text-lg" : "text-2xl",
            wordmarkClassName || "text-slate-900"
          )}
        >
          Servi
          <span className={joinClasses("relative ml-0.5", qClassName || "text-[var(--brand-700)]")}>
            Q
            <span
              aria-hidden="true"
              className={joinClasses(
                "pointer-events-none absolute -inset-1 rounded-full border",
                qRingClassName || "border-[color:var(--brand-300)]"
              )}
            />
            <span className="absolute -right-[2px] top-[1px] h-1.5 w-1.5 rounded-full bg-[var(--brand-500)]" aria-hidden="true" />
          </span>
        </span>
        {showTagline ? (
          <span
            className={joinClasses(
              "block truncate",
              compact ? "mt-0.5 text-[10px]" : "mt-1 text-xs",
              taglineClassName || "text-slate-500"
            )}
          >
            {appTagline}
          </span>
        ) : null}
      </span>
      <span className="sr-only">{appName}</span>
    </div>
  );
}
