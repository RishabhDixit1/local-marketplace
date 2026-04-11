"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { usePathname } from "next/navigation";
import { Search, Sparkles } from "lucide-react";
import type { LucideIcon } from "lucide-react";

export type DashboardPromptAction = {
  id: string;
  label: string;
  icon?: LucideIcon;
  onClick: () => void | Promise<void>;
  variant?: "primary" | "secondary";
  disabled?: boolean;
  busy?: boolean;
};

export type DashboardPromptConfig = {
  placeholder: string;
  value: string;
  onValueChange: (value: string) => void;
  onSubmit?: () => void | Promise<void>;
  actions?: DashboardPromptAction[];
};

type DashboardPromptContextValue = {
  setPagePrompt: (prompt: DashboardPromptConfig | null) => void;
  effectivePrompt: DashboardPromptConfig;
  showPrompt: boolean;
};

const DEFAULT_PLACEHOLDER = "Search within ServiQ";

const PROMPT_ROUTE_SET = new Set([
  "/dashboard",
  "/dashboard/welcome",
  "/dashboard/people",
  "/dashboard/tasks",
  "/dashboard/chat",
]);

const getRoutePlaceholder = (pathname: string) => {
  if (pathname === "/dashboard") return "Search posts, services, products, or nearby needs";
  if (pathname === "/dashboard/people") return "Search people by name, role, location, or expertise";
  if (pathname === "/dashboard/tasks") return "Search tasks by title, status, category, or owner";
  if (pathname === "/dashboard/chat") return "Search chats by member name or message keyword";
  if (pathname === "/dashboard/welcome") return "Ask what to do next in ServiQ";
  return DEFAULT_PLACEHOLDER;
};

const DashboardPromptContext = createContext<DashboardPromptContextValue | null>(null);

export function DashboardPromptProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const [pagePromptState, setPagePromptState] = useState<{ route: string; prompt: DashboardPromptConfig } | null>(null);
  const [routeDrafts, setRouteDrafts] = useState<Record<string, string>>({});

  const showPrompt = PROMPT_ROUTE_SET.has(pathname);

  const defaultPrompt = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: getRoutePlaceholder(pathname),
      value: routeDrafts[pathname] || "",
      onValueChange: (nextValue: string) => {
        setRouteDrafts((current) => ({
          ...current,
          [pathname]: nextValue,
        }));
      },
      onSubmit: () => {
        // Default prompt submit is intentionally passive until a page registers behavior.
      },
      actions: [],
    }),
    [pathname, routeDrafts]
  );

  const setPagePrompt = useCallback(
    (nextPrompt: DashboardPromptConfig | null) => {
      setPagePromptState((current) => {
        if (!nextPrompt) {
          return current === null ? current : null;
        }

        if (current?.route === pathname && current.prompt === nextPrompt) {
          return current;
        }

        return {
          route: pathname,
          prompt: nextPrompt,
        };
      });
    },
    [pathname]
  );

  const effectivePrompt =
    pagePromptState && pagePromptState.route === pathname ? pagePromptState.prompt : defaultPrompt;

  const contextValue = useMemo<DashboardPromptContextValue>(
    () => ({
      setPagePrompt,
      effectivePrompt,
      showPrompt,
    }),
    [effectivePrompt, setPagePrompt, showPrompt]
  );

  return <DashboardPromptContext.Provider value={contextValue}>{children}</DashboardPromptContext.Provider>;
}

const useDashboardPromptContext = () => {
  const context = useContext(DashboardPromptContext);
  if (!context) {
    throw new Error("useDashboardPrompt must be used inside DashboardPromptProvider.");
  }
  return context;
};

export const useDashboardPromptState = () => useDashboardPromptContext();

export const useDashboardPrompt = (prompt: DashboardPromptConfig | null) => {
  const { setPagePrompt } = useDashboardPromptContext();

  useEffect(() => {
    setPagePrompt(prompt);
    return () => {
      setPagePrompt(null);
    };
  }, [prompt, setPagePrompt]);
};

export function DashboardPromptBar({ placement = "header" }: { placement?: "header" | "page" }) {
  const { effectivePrompt, showPrompt } = useDashboardPromptContext();
  const [focused, setFocused] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const runSubmit = useCallback(async () => {
    if (!effectivePrompt.onSubmit) return;
    setSubmitting(true);
    try {
      await effectivePrompt.onSubmit();
    } finally {
      setSubmitting(false);
    }
  }, [effectivePrompt]);

  if (!showPrompt) return null;

  const actions = effectivePrompt.actions || [];

  if (placement === "header") {
    return (
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSubmit();
        }}
        className="w-full max-w-none space-y-2 md:max-w-[760px]"
      >
        <div className="flex items-center gap-1.5 sm:gap-2">
          <div
            className={`group relative min-w-0 flex-1 overflow-hidden rounded-2xl border bg-white transition-all duration-250 ${
              focused
                ? "border-[var(--brand-500)]/60 shadow-[0_0_0_3px_var(--brand-ring)]"
                : "border-slate-200 shadow-[0_10px_26px_-22px_rgba(15,23,42,0.45)]"
            }`}
          >
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />

            <input
              value={effectivePrompt.value}
              onChange={(event) => effectivePrompt.onValueChange(event.target.value)}
              onFocus={() => setFocused(true)}
              onBlur={() => setFocused(false)}
              placeholder={effectivePrompt.placeholder}
              className="h-11 w-full bg-transparent px-9 pr-14 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 sm:h-10 sm:pr-16"
              aria-label="Dashboard prompt"
            />

            <button
              type="submit"
              disabled={submitting}
              className="absolute right-1.5 top-1/2 inline-flex h-8 -translate-y-1/2 items-center gap-1 rounded-full bg-slate-900 px-2.5 text-[11px] font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
            >
              <Sparkles size={11} />
              <span className="hidden sm:inline lg:inline">{submitting ? "Working..." : "Search"}</span>
            </button>
          </div>

          {actions.length > 0 && (
            <div className="hidden xl:flex items-center gap-1">
              {actions.slice(0, 2).map((action) => {
                const Icon = action.icon;
                const isPrimary = action.variant === "primary";

                return (
                  <button
                    key={action.id}
                    type="button"
                    onClick={() => {
                      void action.onClick();
                    }}
                    disabled={action.disabled}
                    className={`inline-flex h-9 items-center gap-1 rounded-full px-3 text-[11px] font-semibold transition ${
                      isPrimary
                        ? "bg-[var(--brand-900)] text-white hover:bg-[var(--brand-700)]"
                        : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                    } disabled:cursor-not-allowed disabled:opacity-60`}
                  >
                    {Icon ? <Icon size={12} className={action.busy ? "animate-spin" : ""} /> : null}
                    {action.label}
                  </button>
                );
              })}
            </div>
          )}
        </div>
        {actions.length > 0 && (
          <div className="flex flex-wrap items-center gap-1.5 xl:hidden">
            {actions.slice(0, 2).map((action) => {
              const Icon = action.icon;
              const isPrimary = action.variant === "primary";

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    void action.onClick();
                  }}
                  disabled={action.disabled}
                  className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-[11px] font-semibold transition ${
                    isPrimary
                      ? "bg-[var(--brand-900)] text-white hover:bg-[var(--brand-700)]"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {Icon ? (
                    <Icon size={12} className={action.busy ? "animate-spin" : ""} />
                  ) : null}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </form>
    );
  }

  return (
    <section className="sticky top-[4.5rem] z-30 mx-auto mb-4 w-full max-w-[960px] rounded-3xl border border-slate-200/90 bg-white/95 p-3 shadow-[0_18px_36px_-28px_rgba(15,23,42,0.5)] backdrop-blur-md sm:mb-5 sm:p-4">
      <form
        onSubmit={(event) => {
          event.preventDefault();
          void runSubmit();
        }}
        className="space-y-2"
      >
        <div
          className={`group relative overflow-hidden rounded-2xl border bg-white transition-all duration-250 ${
            focused
              ? "border-[var(--brand-500)]/60 shadow-[0_0_0_4px_var(--brand-ring)]"
              : "border-slate-200 shadow-[0_10px_26px_-22px_rgba(15,23,42,0.45)]"
          }`}
        >
          <div className="pointer-events-none absolute inset-y-0 left-0 w-14 bg-gradient-to-r from-slate-100/90 to-transparent" />
          <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-500" />

          <input
            value={effectivePrompt.value}
            onChange={(event) => effectivePrompt.onValueChange(event.target.value)}
            onFocus={() => setFocused(true)}
            onBlur={() => setFocused(false)}
            placeholder={effectivePrompt.placeholder}
            className="h-12 w-full bg-transparent px-12 pr-24 text-sm font-medium text-slate-900 outline-none placeholder:text-slate-400 sm:h-14 sm:text-base"
            aria-label="Dashboard prompt"
          />

          <button
            type="submit"
            disabled={submitting}
            className="absolute right-2 top-1/2 inline-flex min-h-8 -translate-y-1/2 items-center gap-1 rounded-full bg-slate-900 px-3 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
          >
            <Sparkles size={12} />
            {submitting ? "Working..." : "Search"}
          </button>
        </div>

        {actions.length > 0 && (
          <div className="flex items-center justify-end gap-2">
            {actions.map((action) => {
              const Icon = action.icon;
              const isPrimary = action.variant === "primary";

              return (
                <button
                  key={action.id}
                  type="button"
                  onClick={() => {
                    void action.onClick();
                  }}
                  disabled={action.disabled}
                  className={`inline-flex min-h-9 items-center gap-1 rounded-full px-3 text-xs font-semibold transition ${
                    isPrimary
                      ? "bg-[var(--brand-900)] text-white hover:bg-[var(--brand-700)]"
                      : "border border-slate-200 bg-white text-slate-600 hover:border-slate-300 hover:text-slate-900"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  {Icon ? (
                    <Icon size={13} className={action.busy ? "animate-spin" : ""} />
                  ) : null}
                  {action.label}
                </button>
              );
            })}
          </div>
        )}
      </form>
    </section>
  );
}
