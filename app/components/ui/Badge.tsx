"use client";

import { type ReactNode, forwardRef } from "react";

type BadgeVariant =
  | "neutral"
  | "brand"
  | "success"
  | "warning"
  | "danger"
  | "info";

type BadgeSize = "sm" | "md";

const variantStyles: Record<BadgeVariant, string> = {
  neutral: "bg-[var(--surface-soft)] text-[var(--ink-700)]",
  brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
  success: "border border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300",
  warning: "border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/50 text-amber-700 dark:text-amber-300",
  danger: "border border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300",
  info: "border border-blue-200 dark:border-blue-800 bg-blue-50 dark:bg-blue-950/50 text-blue-700 dark:text-blue-300",
};

const sizeStyles: Record<BadgeSize, string> = {
  sm: "px-2 py-0.5 text-[10px] font-semibold",
  md: "px-2.5 py-1 text-xs font-semibold",
};

type BadgeProps = {
  variant?: BadgeVariant;
  size?: BadgeSize;
  leftIcon?: ReactNode;
  children: ReactNode;
};

export const Badge = forwardRef<HTMLSpanElement, BadgeProps>(
  (
    {
      variant = "neutral",
      size = "md",
      leftIcon,
      children,
    },
    ref,
  ) => {
    return (
      <span
        ref={ref}
        className={[
          "inline-flex items-center gap-1 rounded-full",
          variantStyles[variant],
          sizeStyles[size],
        ]
          .filter(Boolean)
          .join(" ")}
      >
        {leftIcon && <span className="shrink-0">{leftIcon}</span>}
        {children}
      </span>
    );
  },
);

Badge.displayName = "Badge";
