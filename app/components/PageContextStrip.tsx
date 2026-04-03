"use client";

type PageContextMetric = {
  label: string;
  value: string;
};

type PageContextAction = {
  label: string;
  onClick: () => void;
  tone?: "primary" | "secondary";
};

type PageContextStripProps = {
  eyebrow: string;
  title: string;
  description: string;
  metrics?: PageContextMetric[];
  actions?: PageContextAction[];
  className?: string;
};

const actionClassNames: Record<NonNullable<PageContextAction["tone"]>, string> = {
  primary:
    "inline-flex min-h-10 items-center justify-center rounded-full bg-[var(--brand-900)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]",
  secondary:
    "inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]",
};

export default function PageContextStrip({
  eyebrow,
  title,
  description,
  metrics = [],
  actions = [],
  className = "",
}: PageContextStripProps) {
  return (
    <section
      className={`overflow-hidden rounded-[1.6rem] border border-slate-200 bg-white shadow-sm ${className}`.trim()}
    >
      <div className="bg-[linear-gradient(135deg,rgba(14,165,164,0.12),rgba(255,255,255,0.88),rgba(17,70,106,0.08))] px-4 py-4 sm:px-5 sm:py-5">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
          <div className="min-w-0 space-y-2">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">
              {eyebrow}
            </p>
            <div>
              <h2 className="text-lg font-semibold leading-tight text-slate-950 sm:text-xl">{title}</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
            </div>
            {metrics.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {metrics.map((metric) => (
                  <div
                    key={`${metric.label}:${metric.value}`}
                    className="rounded-full border border-slate-200 bg-white/90 px-3 py-1.5 text-xs text-slate-600 shadow-sm"
                  >
                    <span className="font-semibold text-slate-900">{metric.value}</span>
                    <span className="ml-1">{metric.label}</span>
                  </div>
                ))}
              </div>
            ) : null}
          </div>

          {actions.length > 0 ? (
            <div className="flex flex-wrap gap-2 lg:justify-end">
              {actions.map((action, index) => {
                const tone = action.tone || (index === 0 ? "primary" : "secondary");
                return (
                  <button
                    key={action.label}
                    type="button"
                    onClick={action.onClick}
                    className={actionClassNames[tone]}
                  >
                    {action.label}
                  </button>
                );
              })}
            </div>
          ) : null}
        </div>
      </div>
    </section>
  );
}
