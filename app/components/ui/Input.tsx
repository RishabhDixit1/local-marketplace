"use client";

import {
  type ComponentProps,
  type ReactNode,
  forwardRef,
  useId,
} from "react";

type InputSize = "md" | "lg";

type InputProps = {
  label?: string;
  helperText?: string;
  error?: string;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  size?: InputSize;
} & Omit<ComponentProps<"input">, "size">;

const sizeStyles: Record<InputSize, string> = {
  md: "px-3 py-2.5 text-sm rounded-xl",
  lg: "px-4 py-3.5 text-base rounded-2xl",
};

const iconPadding: Record<InputSize, { left: string; right: string }> = {
  md: { left: "pl-9", right: "pr-9" },
  lg: { left: "pl-10", right: "pr-10" },
};

export const Input = forwardRef<HTMLInputElement, InputProps>(
  (
    {
      label,
      helperText,
      error,
      leftIcon,
      rightIcon,
      size = "md",
      className = "",
      id: idProp,
      ...props
    },
    ref,
  ) => {
    const autoId = useId();
    const inputId = idProp ?? autoId;
    const hasIcon = Boolean(leftIcon || rightIcon);
    const pad = iconPadding[size];

    const inputClasses = [
      "w-full border bg-white text-slate-900 outline-none transition",
      "placeholder:text-slate-400",
      "disabled:cursor-not-allowed disabled:bg-slate-50 disabled:text-slate-500",
      error
        ? "border-rose-300 focus:border-rose-400 focus:ring-1 focus:ring-rose-400"
        : "border-slate-200 focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]",
      sizeStyles[size],
      hasIcon && (leftIcon ? pad.left : "") + (rightIcon ? pad.right : ""),
      className,
    ]
      .filter(Boolean)
      .join(" ");

    const inputElement = (
      <input
        ref={ref}
        id={inputId}
        aria-invalid={error ? true : undefined}
        aria-describedby={
          error
            ? `${inputId}-error`
            : helperText
              ? `${inputId}-helper`
              : undefined
        }
        className={inputClasses}
        {...props}
      />
    );

    return (
      <div className="space-y-1.5">
        {label && (
          <label
            htmlFor={inputId}
            className="block text-xs font-semibold text-slate-600"
          >
            {label}
          </label>
        )}

        {leftIcon || rightIcon ? (
          <div className="relative">
            {leftIcon && (
              <span
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${size === "md" ? "left-3" : "left-4"}`}
              >
                {leftIcon}
              </span>
            )}
            {inputElement}
            {rightIcon && (
              <span
                className={`pointer-events-none absolute top-1/2 -translate-y-1/2 text-slate-400 ${size === "md" ? "right-3" : "right-4"}`}
              >
                {rightIcon}
              </span>
            )}
          </div>
        ) : (
          inputElement
        )}

        {error && (
          <p id={`${inputId}-error`} className="text-sm text-rose-600">
            {error}
          </p>
        )}

        {helperText && !error && (
          <p id={`${inputId}-helper`} className="text-xs text-slate-500">
            {helperText}
          </p>
        )}
      </div>
    );
  },
);

Input.displayName = "Input";
