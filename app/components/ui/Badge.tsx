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
  neutral: "bg-slate-100 text-slate-700",
  brand: "bg-[var(--brand-50)] text-[var(--brand-700)]",
  success: "border border-emerald-200 bg-emerald-50 text-emerald-700",
  warning: "border border-amber-200 bg-amber-50 text-amber-700",
  danger: "border border-rose-200 bg-rose-50 text-rose-700",
  info: "border border-blue-200 bg-blue-50 text-blue-700",
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
