import Link from "next/link";
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
  href?: string;
  ariaLabel?: string;
  onClick?: () => void;
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
  href,
  ariaLabel,
  onClick,
}: ServiQLogoProps) {
  const markClasses = joinClasses(
    "relative inline-flex items-center justify-center rounded-xl border shadow-sm",
    compact ? "h-9 w-9 text-base" : "h-11 w-11 text-lg",
    markClassName ||
      "border-slate-200 bg-[radial-gradient(circle_at_top_left,#ffffff_12%,#ecfeff_58%,#dbeafe_100%)] text-slate-900 shadow-slate-900/10"
  );
  const rootClasses = joinClasses(
    "inline-flex items-center",
    compact ? "gap-2" : "gap-3",
    href &&
      "group rounded-2xl transition-transform duration-200 hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2",
    className
  );

  if (markOnly) {
    const markOnlyContent = (
      <>
        <span className={markClasses} aria-hidden="true">
          <span className="brand-display text-[0.95em] font-semibold leading-none tracking-[-0.08em]">S</span>
          <span
            className={joinClasses(
              "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm",
              markDotClassName || "bg-[var(--brand-500)]"
            )}
          />
        </span>
        <span className="sr-only">{appName}</span>
      </>
    );

    if (href) {
      return (
        <Link href={href} aria-label={ariaLabel || `${appName} home`} className={rootClasses} onClick={onClick}>
          {markOnlyContent}
        </Link>
      );
    }

    return (
      <span className={joinClasses("inline-flex items-center", className)} onClick={onClick}>
        {markOnlyContent}
      </span>
    );
  }

  const logoContent = (
    <>
      <span className={markClasses} aria-hidden="true">
        <span className="brand-display text-[0.95em] font-semibold leading-none tracking-[-0.08em]">S</span>
        <span
          className={joinClasses(
            "absolute -bottom-0.5 -right-0.5 h-2.5 w-2.5 rounded-full border-2 border-white shadow-sm",
            markDotClassName || "bg-[var(--brand-500)]"
          )}
        />
      </span>
      <span className="min-w-0">
        <span
          className={joinClasses(
            "brand-display inline-flex items-baseline font-semibold leading-none tracking-[-0.07em]",
            compact ? "text-lg" : "text-2xl",
            wordmarkClassName || "text-slate-900"
          )}
        >
          <span className="relative pr-1 after:absolute after:-bottom-1 after:left-0 after:h-[3px] after:w-full after:rounded-full after:bg-current/15">
            Servi
          </span>
          <span
            className={joinClasses(
              "relative ml-0.5 inline-flex translate-y-[0.01em] items-center font-black tracking-[-0.09em]",
              qClassName || "text-[var(--brand-700)]"
            )}
          >
            Q
            <span
              aria-hidden="true"
              className={joinClasses(
                "pointer-events-none absolute -inset-1 rounded-full border -rotate-[12deg] transition-transform duration-200 group-hover:rotate-0",
                qRingClassName || "border-[color:var(--brand-300)]"
              )}
            />
            <span className="absolute -right-[1px] top-[1px] h-1.5 w-1.5 rounded-full bg-[var(--brand-500)]" aria-hidden="true" />
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
    </>
  );

  if (href) {
    return (
      <Link href={href} aria-label={ariaLabel || `${appName} home`} className={rootClasses} onClick={onClick}>
        {logoContent}
      </Link>
    );
  }

  return <div className={rootClasses} onClick={onClick}>{logoContent}</div>;
}
