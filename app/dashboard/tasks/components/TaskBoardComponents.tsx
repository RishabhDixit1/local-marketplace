"use client";

import type { ReactNode } from "react";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight, CheckCircle2, Circle, Loader2 } from "lucide-react";

export type TaskBoardStatusTabValue = "inbox" | "active" | "in-progress" | "done" | "delivery";

export type TaskBoardTab = {
  value: TaskBoardStatusTabValue;
  label: string;
  count: number;
};

export type TaskTimelineStep = {
  id: string;
  label: string;
  helper?: string;
  state: "done" | "active" | "upcoming" | "blocked" | "cancelled";
  action?: {
    label: string;
    onClick: () => void;
    busy?: boolean;
  } | null;
};

export type NextActionPanelProps = {
  title: string;
  helper: string;
  actionLabel?: string;
  actionIcon?: LucideIcon;
  onAction?: () => void;
  busy?: boolean;
  disabled?: boolean;
  tone?: "default" | "progress" | "success" | "warning" | "danger";
  children?: ReactNode;
};

type TaskCardMeta = {
  icon: LucideIcon;
  label: string;
};

type TaskCardProps = {
  id: string;
  title: string;
  description: string;
  avatarUrl: string;
  avatarAlt: string;
  ownerName: string;
  ownerSummary: string;
  statusLabel: string;
  statusClassName: string;
  accentClassName: string;
  referenceLabel?: string;
  sourceLabel?: string;
  meta: TaskCardMeta[];
  nextAction: NextActionPanelProps;
  timelineSteps: TaskTimelineStep[];
  actions?: ReactNode;
  expanded?: boolean;
  children?: ReactNode;
  focused?: boolean;
  onProfileClick?: () => void;
  setNode?: (node: HTMLElement | null) => void;
};

const tabCountLabel = (count: number) => (count > 99 ? "99+" : String(count));

const timelineStateClassNames: Record<TaskTimelineStep["state"], { dot: string; line: string; text: string }> = {
  done: {
    dot: "border-emerald-200 bg-emerald-100 text-emerald-700",
    line: "bg-emerald-200",
    text: "text-slate-700",
  },
  active: {
    dot: "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]",
    line: "bg-[var(--brand-300)]",
    text: "text-slate-950",
  },
  upcoming: {
    dot: "border-slate-200 bg-white text-slate-400",
    line: "bg-slate-200",
    text: "text-slate-500",
  },
  blocked: {
    dot: "border-amber-200 bg-amber-100 text-amber-700",
    line: "bg-amber-200",
    text: "text-amber-800",
  },
  cancelled: {
    dot: "border-rose-200 bg-rose-100 text-rose-700",
    line: "bg-rose-200",
    text: "text-rose-700",
  },
};

const nextActionToneClassNames: Record<NonNullable<NextActionPanelProps["tone"]>, string> = {
  default: "border-slate-200 bg-slate-50 text-slate-700",
  progress: "border-sky-200 bg-sky-50 text-sky-800",
  success: "border-emerald-200 bg-emerald-50 text-emerald-800",
  warning: "border-amber-200 bg-amber-50 text-amber-900",
  danger: "border-rose-200 bg-rose-50 text-rose-800",
};

export function TaskStatusTabs({
  tabs,
  selected,
  onSelect,
}: {
  tabs: TaskBoardTab[];
  selected: TaskBoardStatusTabValue;
  onSelect: (value: TaskBoardStatusTabValue) => void;
}) {
  return (
    <div
      role="tablist"
      aria-label="Task status"
      className="grid grid-cols-2 gap-1 rounded-[var(--radius-card)] border border-slate-200 bg-slate-100/80 p-1 sm:flex sm:w-fit sm:max-w-full sm:overflow-x-auto"
    >
      {tabs.map((tab) => {
        const active = selected === tab.value;
        return (
          <button
            key={tab.value}
            role="tab"
            type="button"
            aria-selected={active}
            onClick={() => onSelect(tab.value)}
            className={`inline-flex min-h-10 min-w-0 items-center justify-center gap-2 rounded-[var(--radius-control)] px-3 text-sm font-semibold transition sm:min-w-[8rem] ${
              active
                ? "bg-white text-slate-950 shadow-[var(--shadow-soft)]"
                : "text-slate-500 hover:bg-white/70 hover:text-slate-900"
            }`}
          >
            <span className="truncate">{tab.label}</span>
            <span
              className={`inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded-full px-1.5 text-[11px] font-bold ${
                active ? "bg-[var(--brand-900)] text-white" : "bg-white text-slate-500"
              }`}
            >
              {tabCountLabel(tab.count)}
            </span>
          </button>
        );
      })}
    </div>
  );
}

export function NextActionPanel({
  title,
  helper,
  actionLabel,
  actionIcon: ActionIcon = ArrowUpRight,
  onAction,
  busy,
  disabled,
  tone = "default",
  children,
}: NextActionPanelProps) {
  return (
    <div className={`rounded-[var(--radius-card)] border px-3 py-3 ${nextActionToneClassNames[tone]}`}>
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] opacity-70">Next action</p>
          <p className="mt-1 text-sm font-semibold leading-5">{title}</p>
          <p className="mt-1 line-clamp-2 text-xs leading-5 opacity-80">{helper}</p>
        </div>
        {actionLabel && onAction ? (
          <button
            type="button"
            onClick={onAction}
            disabled={busy || disabled}
            className="inline-flex min-h-10 shrink-0 items-center justify-center gap-2 rounded-[var(--radius-control)] bg-slate-950 px-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <ActionIcon className="h-4 w-4" />}
            <span className="truncate">{busy ? "Updating..." : actionLabel}</span>
          </button>
        ) : null}
      </div>
      {children ? <div className="mt-3">{children}</div> : null}
    </div>
  );
}

export function TaskTimeline({ steps }: { steps: TaskTimelineStep[] }) {
  return (
    <div className="rounded-[var(--radius-card)] border border-slate-200 bg-white px-3 py-3">
      <div className="flex items-center justify-between gap-3">
        <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">Timeline</p>
        <p className="text-xs font-medium text-slate-400">{steps.filter((step) => step.state === "done").length}/{steps.length}</p>
      </div>

      <div className="mt-3 space-y-3">
        {steps.map((step, index) => {
          const state = timelineStateClassNames[step.state];
          const last = index === steps.length - 1;

          return (
            <div key={step.id} className="grid grid-cols-[1.5rem_minmax(0,1fr)] gap-3">
              <div className="flex flex-col items-center">
                <span className={`inline-flex h-6 w-6 items-center justify-center rounded-full border ${state.dot}`}>
                  {step.state === "done" ? <CheckCircle2 className="h-3.5 w-3.5" /> : <Circle className="h-2 w-2 fill-current" />}
                </span>
                {!last ? <span className={`mt-1 h-full min-h-5 w-px ${state.line}`} /> : null}
              </div>

              <div className="min-w-0 pb-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={`text-sm font-semibold leading-5 ${state.text}`}>{step.label}</p>
                    {step.helper ? <p className="mt-0.5 line-clamp-2 text-xs leading-5 text-slate-500">{step.helper}</p> : null}
                  </div>
                  {step.action ? (
                    <button
                      type="button"
                      onClick={step.action.onClick}
                      disabled={step.action.busy}
                      className="inline-flex min-h-8 shrink-0 items-center justify-center rounded-[var(--radius-control)] bg-[var(--brand-900)] px-2.5 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {step.action.busy ? "..." : step.action.label}
                    </button>
                  ) : null}
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function TaskCard({
  id,
  title,
  description,
  avatarUrl,
  avatarAlt,
  ownerName,
  ownerSummary,
  statusLabel,
  statusClassName,
  accentClassName,
  referenceLabel,
  sourceLabel,
  meta,
  nextAction,
  timelineSteps,
  actions,
  expanded,
  children,
  focused,
  onProfileClick,
  setNode,
}: TaskCardProps) {
  const profileButtonClassName =
    "truncate text-left text-sm font-semibold text-slate-900 transition hover:text-[var(--brand-700)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2";

  return (
    <article
      id={id}
      ref={setNode}
      className={`relative min-w-0 overflow-hidden rounded-[var(--radius-card-lg)] border bg-white p-3 shadow-[var(--shadow-card)] transition hover:border-slate-300 sm:p-4 ${
        focused ? "border-[var(--brand-500)] ring-4 ring-[var(--brand-ring)]" : "border-slate-200"
      }`}
    >
      <div className={`absolute inset-x-0 top-0 h-1 bg-gradient-to-r ${accentClassName}`} />

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex min-w-0 flex-wrap items-center gap-1.5">
            {sourceLabel ? (
              <span className="rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-600">
                {sourceLabel}
              </span>
            ) : null}
            <span className={`rounded-full px-2.5 py-1 text-[11px] font-semibold ${statusClassName}`}>{statusLabel}</span>
            {referenceLabel ? (
              <span className="rounded-full bg-slate-100 px-2.5 py-1 text-[11px] font-semibold text-slate-500">
                {referenceLabel}
              </span>
            ) : null}
          </div>
        </div>

        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
          <div className="min-w-0 space-y-3">
            <div className="flex min-w-0 items-start gap-3">
              {onProfileClick ? (
                <button
                  type="button"
                  onClick={onProfileClick}
                  className="shrink-0 rounded-[var(--radius-control)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
                >
                  {/^(data:image\/|blob:)/i.test(avatarUrl) ? (
                    /* eslint-disable-next-line @next/next/no-img-element */
                    <img src={avatarUrl} alt={avatarAlt} className="h-12 w-12 rounded-[var(--radius-control)] border border-slate-200 object-cover" />
                  ) : (
                    <Image src={avatarUrl} alt={avatarAlt} width={48} height={48} className="h-12 w-12 rounded-[var(--radius-control)] border border-slate-200 object-cover" />
                  )}
                </button>
              ) : (
                /^(data:image\/|blob:)/i.test(avatarUrl) ? (
                  /* eslint-disable-next-line @next/next/no-img-element */
                  <img src={avatarUrl} alt={avatarAlt} className="h-12 w-12 shrink-0 rounded-[var(--radius-control)] border border-slate-200 object-cover" />
                ) : (
                  <Image src={avatarUrl} alt={avatarAlt} width={48} height={48} className="h-12 w-12 shrink-0 rounded-[var(--radius-control)] border border-slate-200 object-cover" />
                )
              )}

              <div className="min-w-0 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-400">{ownerSummary}</p>
                {onProfileClick ? (
                  <button type="button" onClick={onProfileClick} className={profileButtonClassName}>
                    {ownerName}
                  </button>
                ) : (
                  <p className="truncate text-sm font-semibold text-slate-900">{ownerName}</p>
                )}
                <h3 className="mt-1 break-words text-[1.04rem] font-semibold leading-tight text-slate-950 sm:text-lg">{title}</h3>
                <p className="mt-1.5 line-clamp-2 break-words text-sm leading-6 text-slate-600">{description}</p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              {meta.map((item) => (
                <span
                  key={`${id}-${item.label}`}
                  className="inline-flex min-w-0 max-w-full items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700"
                >
                  <item.icon className="h-3.5 w-3.5 shrink-0 text-slate-400" />
                  <span className="truncate">{item.label}</span>
                </span>
              ))}
            </div>

            <NextActionPanel {...nextAction} />
          </div>

          <TaskTimeline steps={timelineSteps} />
        </div>

        {actions ? <div className="border-t border-slate-200 pt-3">{actions}</div> : null}

        {expanded && children ? <div className="rounded-[var(--radius-card)] border border-slate-200 bg-slate-50 p-3 sm:p-4">{children}</div> : null}
      </div>
    </article>
  );
}
