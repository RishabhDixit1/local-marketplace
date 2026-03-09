"use client";

import { AlertCircle, CheckCircle2, Info, X } from "lucide-react";

export type ProfileToast = {
  id: string;
  kind: "success" | "error" | "info";
  message: string;
};

const toastStyles = {
  success: {
    icon: CheckCircle2,
    shell: "border-emerald-200 bg-emerald-50 text-emerald-800",
    iconClassName: "text-emerald-600",
  },
  error: {
    icon: AlertCircle,
    shell: "border-rose-200 bg-rose-50 text-rose-800",
    iconClassName: "text-rose-600",
  },
  info: {
    icon: Info,
    shell: "border-slate-200 bg-white text-slate-800",
    iconClassName: "text-indigo-600",
  },
};

export default function ProfileToastViewport({
  toasts,
  onDismiss,
}: {
  toasts: ProfileToast[];
  onDismiss: (id: string) => void;
}) {
  return (
    <div className="pointer-events-none fixed bottom-4 right-4 z-[1500] flex w-[min(92vw,380px)] flex-col gap-3">
      {toasts.map((toast) => {
        const styles = toastStyles[toast.kind];
        const Icon = styles.icon;

        return (
          <div
            key={toast.id}
            role="status"
            className={`pointer-events-auto rounded-2xl border px-4 py-3 shadow-lg shadow-slate-200/70 ${styles.shell}`}
          >
            <div className="flex items-start gap-3">
              <Icon className={`mt-0.5 h-5 w-5 shrink-0 ${styles.iconClassName}`} />
              <p className="min-w-0 flex-1 text-sm font-medium leading-6">{toast.message}</p>
              <button
                type="button"
                onClick={() => onDismiss(toast.id)}
                className="rounded-full p-1 text-slate-400 transition hover:bg-black/5 hover:text-slate-700"
                aria-label="Dismiss notification"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}
