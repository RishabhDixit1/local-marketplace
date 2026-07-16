"use client";

import { type ComponentProps, type ReactNode, forwardRef } from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant =
  | "primary"
  | "secondary"
  | "ghost"
  | "brand-outline"
  | "success"
  | "danger";

type ButtonSize = "sm" | "md" | "lg";

const variantStyles: Record<ButtonVariant, string> = {
  primary:
    "bg-[var(--brand-900)] text-white hover:bg-[var(--brand-700)] disabled:hover:bg-[var(--brand-900)]",
  secondary:
    "border border-[var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--ink-700)] hover:border-[var(--surface-border-strong)] hover:text-[var(--ink-950)] disabled:hover:border-[var(--surface-border)]",
  ghost:
    "bg-transparent text-[var(--ink-700)] hover:bg-[var(--surface-soft)] hover:text-[var(--ink-950)] disabled:hover:bg-transparent",
  "brand-outline":
    "border border-[var(--brand-200)] bg-[var(--brand-50)] text-[var(--brand-700)] hover:bg-[var(--brand-100)] disabled:hover:bg-[var(--brand-50)]",
  success:
    "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 disabled:hover:bg-emerald-50",
  danger:
    "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 disabled:hover:bg-rose-50",
};

const sizeStyles: Record<ButtonSize, string> = {
  sm: "px-3 py-1.5 text-xs font-semibold rounded-xl",
  md: "px-5 py-2.5 text-sm font-semibold rounded-xl",
  lg: "px-6 py-3 text-sm font-bold rounded-2xl",
};

type ButtonProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
} & ComponentProps<"button">;

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(
  (
    {
      variant = "primary",
      size = "md",
      loading = false,
      leftIcon,
      rightIcon,
      className = "",
      children,
      disabled,
      ...props
    },
    ref,
  ) => {
    const isDisabled = disabled || loading;

    return (
      <button
        ref={ref}
        disabled={isDisabled}
        className={[
          "inline-flex items-center justify-center gap-2 transition active:scale-[0.97]",
          "disabled:cursor-not-allowed disabled:opacity-60 disabled:active:scale-100",
          variantStyles[variant],
          sizeStyles[size],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {loading ? (
          <Loader2 className="h-4 w-4 animate-spin shrink-0" />
        ) : leftIcon ? (
          <span className="shrink-0">{leftIcon}</span>
        ) : null}
        {children}
        {!loading && rightIcon && (
          <span className="shrink-0">{rightIcon}</span>
        )}
      </button>
    );
  },
);

Button.displayName = "Button";
