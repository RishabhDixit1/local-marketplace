"use client";

import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { AlertTriangle, Loader2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type ConfirmDialogProps = {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  variant?: "danger" | "warning" | "info";
  busy?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

const variantStyles = {
  danger: {
    icon: "text-rose-600",
    bg: "bg-rose-50",
    border: "border-rose-200",
    button: "bg-rose-600 hover:bg-rose-700",
  },
  warning: {
    icon: "text-amber-600",
    bg: "bg-amber-50",
    border: "border-amber-200",
    button: "bg-amber-600 hover:bg-amber-700",
  },
  info: {
    icon: "text-[var(--brand-700)]",
    bg: "bg-[var(--brand-50)]",
    border: "border-[var(--brand-200)]",
    button: "bg-[var(--brand-900)] hover:bg-[var(--brand-700)]",
  },
};

export function ConfirmDialog({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Cancel",
  variant = "danger",
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;
    previousActiveElement.current = document.activeElement as HTMLElement;
    document.body.style.overflow = "hidden";

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleEscape);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", handleEscape);
      previousActiveElement.current?.focus();
    };
  }, [open, onCancel]);

  const style = variantStyles[variant];

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center p-4"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-slate-950/40 backdrop-blur-sm"
            onClick={busy ? undefined : onCancel}
          />
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="confirm-dialog-title"
            className={`relative w-full max-w-sm overflow-hidden rounded-2xl border bg-white shadow-2xl ${style.border}`}
            initial={{ opacity: 0, scale: 0.92, y: 12 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.92, y: 12 }}
            transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
          >
            <div className="p-5">
              <div className="flex items-start gap-3.5">
                <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl ${style.bg}`}>
                  <AlertTriangle size={18} className={style.icon} />
                </div>
                <div className="min-w-0 flex-1 pt-0.5">
                  <h3 id="confirm-dialog-title" className="text-sm font-bold text-slate-900">{title}</h3>
                  <p className="mt-1 text-sm leading-[1.55] text-slate-600">{message}</p>
                </div>
              </div>
            </div>
            <div className="flex gap-2.5 border-t border-slate-100 px-5 py-3.5">
              <button
                type="button"
                onClick={onCancel}
                disabled={busy}
                className="flex-1 rounded-xl border border-slate-200 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={busy}
                className={`flex flex-1 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm font-semibold text-white transition disabled:opacity-50 ${style.button}`}
              >
                {busy ? <Loader2 size={14} className="animate-spin" /> : null}
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
