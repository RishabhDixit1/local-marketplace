"use client";

import { type ElementType, type HTMLAttributes, forwardRef } from "react";

type CardVariant = "elevated" | "elevated-lg" | "outlined" | "ghost";

type CardTone = "default" | "brand" | "success" | "warning" | "danger";

type CardRadius = "sm" | "md" | "lg" | "xl" | "2xl" | "3xl";

const variantStyles: Record<CardVariant, string> = {
  elevated:
    "border border-slate-200 bg-white shadow-[var(--shadow-card)]",
  "elevated-lg":
    "border border-slate-200 bg-white shadow-[var(--shadow-elevated)]",
  outlined:
    "border border-slate-200 bg-white shadow-sm",
  ghost:
    "border border-transparent bg-transparent",
};

const toneStyles: Record<CardTone, string> = {
  default: "",
  brand: "border-[var(--brand-500)]/40 shadow-[var(--shadow-card-hover)]",
  success: "border-emerald-200 bg-emerald-50",
  warning: "border-amber-200 bg-amber-50",
  danger: "border-rose-200 bg-rose-50",
};

const radiusStyles: Record<CardRadius, string> = {
  sm: "rounded-[var(--radius-sm)]",
  md: "rounded-[var(--radius-md)]",
  lg: "rounded-[var(--radius-lg)]",
  xl: "rounded-[var(--radius-xl)]",
  "2xl": "rounded-[var(--radius-2xl)]",
  "3xl": "rounded-[var(--radius-3xl)]",
};

type CardProps = {
  variant?: CardVariant;
  tone?: CardTone;
  radius?: CardRadius;
  radiusSm?: CardRadius;
  padding?: "sm" | "md" | "lg" | "none";
  isActive?: boolean;
  isHoverable?: boolean;
  as?: ElementType;
} & HTMLAttributes<HTMLDivElement>;

const paddingStyles: Record<string, string> = {
  sm: "p-3 sm:p-3.5",
  md: "p-4 sm:p-5",
  lg: "p-5 sm:p-6",
  none: "",
};

export const Card = forwardRef<HTMLDivElement, CardProps>(
  (
    {
      variant = "elevated",
      tone: _tone = "default",
      radius = "xl",
      radiusSm,
      padding = "sm",
      isActive = false,
      isHoverable = false,
      as: Component = "div",
      className = "",
      children,
      ...props
    },
    ref,
  ) => {
    const r = radiusStyles[radius];
    const rSm = radiusSm ? radiusStyles[radiusSm] : "";
    const radiusClass = rSm ? `${r} ${rSm}` : r;

    return (
      <Component
        ref={ref}
        className={[
          radiusClass,
          variantStyles[variant],
          isActive ? toneStyles["brand"] : "",
          isHoverable
            ? "transition hover:border-[var(--brand-500)]/24 hover:shadow-[var(--shadow-card-hover)]"
            : "",
          paddingStyles[padding],
          className,
        ]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </Component>
    );
  },
);

Card.displayName = "Card";
