"use client";

import { AlertCircle, CheckCircle2, Loader2, Save } from "lucide-react";

type SaveState = "idle" | "saving" | "saved" | "error" | "blocked";

const statusCopy: Record<SaveState, { label: string; className: string; icon: typeof Save }> = {
  idle: {
    label: "All changes saved.",
    className: "text-slate-600",
    icon: CheckCircle2,
  },
  saving: {
    label: "Saving draft to Supabase...",
    className: "text-indigo-600",
    icon: Loader2,
  },
  saved: {
    label: "Profile saved.",
    className: "text-emerald-600",
    icon: CheckCircle2,
  },
  error: {
    label: "Save failed. Retry when the network is stable.",
    className: "text-rose-600",
    icon: AlertCircle,
  },
  blocked: {
    label: "Fix validation issues before saving.",
    className: "text-amber-600",
    icon: AlertCircle,
  },
};

export default function ProfileStickySaveBar({
  dirty,
  saveState,
  saveDisabled,
  buttonLabel,
  onSave,
}: {
  dirty: boolean;
  saveState: SaveState;
  saveDisabled?: boolean;
  buttonLabel: string;
  onSave: () => void;
}) {
  const status = statusCopy[saveState];
  const Icon = status.icon;

  return (
    <div className="sticky bottom-4 z-30">
      <div className="rounded-[26px] border border-slate-200/80 bg-white/92 p-4 shadow-[0_20px_60px_-30px_rgba(15,23,42,0.35)] backdrop-blur">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <div className={`flex items-center gap-2 text-sm font-semibold ${status.className}`}>
              <Icon className={`h-4 w-4 ${saveState === "saving" ? "animate-spin" : ""}`} />
              {status.label}
            </div>
            <p className="mt-1 text-sm text-slate-500">
              {dirty ? "You have unpublished local changes." : "Realtime updates stay in sync with your saved profile."}
            </p>
          </div>
          <button
            type="button"
            disabled={saveDisabled}
            onClick={onSave}
            className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {saveState === "saving" ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
            {buttonLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
