"use client";

import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
} from "react";
import { createPortal } from "react-dom";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";

type ModalSize = "sm" | "md" | "lg" | "xl";

type ModalProps = {
  open: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
  subtitle?: string;
  size?: ModalSize;
  showCloseButton?: boolean;
  closeOnOutsideClick?: boolean;
  closeOnEscape?: boolean;
  className?: string;
};

const sizeMaxWidth: Record<ModalSize, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
  xl: "max-w-xl",
};

export function Modal({
  open,
  onClose,
  children,
  title,
  subtitle,
  size = "lg",
  showCloseButton = true,
  closeOnOutsideClick = true,
  closeOnEscape = true,
  className = "",
}: ModalProps) {
  const previousActiveElement = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!open) return;

    previousActiveElement.current = document.activeElement as HTMLElement;

    document.body.style.overflow = "hidden";

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && closeOnEscape) {
        onClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      document.body.style.overflow = "";
      document.removeEventListener("keydown", handleEscape);
      previousActiveElement.current?.focus();
    };
  }, [open, closeOnEscape, onClose]);

  const handleBackdropClick = useCallback(() => {
    if (closeOnOutsideClick) {
      onClose();
    }
  }, [closeOnOutsideClick, onClose]);

  if (typeof window === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center px-4 py-6"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.15 }}
        >
          <div
            className="absolute inset-0 bg-slate-950/55 backdrop-blur-sm"
            onClick={handleBackdropClick}
          />

          <motion.div
            role="dialog"
            aria-modal="true"
            aria-label={title}
            className={`relative z-[1] w-full ${sizeMaxWidth[size]} rounded-[28px] border border-slate-200 bg-white shadow-2xl ${className}`}
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            transition={{ duration: 0.15, ease: "easeOut" }}
            onClick={(e) => e.stopPropagation()}
          >
            {(title || showCloseButton) && (
              <div className="flex items-start justify-between gap-4 px-6 pt-6">
                <div className="min-w-0 flex-1">
                  {title && (
                    <h2 className="text-lg font-semibold text-slate-900">
                      {title}
                    </h2>
                  )}
                  {subtitle && (
                    <p className="mt-1 text-sm text-slate-600">
                      {subtitle}
                    </p>
                  )}
                </div>
                {showCloseButton && (
                  <button
                    type="button"
                    onClick={onClose}
                    className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-slate-200 text-slate-500 hover:bg-slate-100"
                    aria-label="Close"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            )}

            <div className="px-6 pb-6 pt-4">{children}</div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body,
  );
}
