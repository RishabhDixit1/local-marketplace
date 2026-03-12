"use client";

import { Activity, Check, Loader2, UserCheck, UserPlus, XCircle } from "lucide-react";
import {
  getConnectionActionDescriptors,
  type ConnectionActionKey,
  type ConnectionState,
} from "@/lib/connectionState";

type Props = {
  state: ConnectionState;
  busy?: boolean;
  busyActionKey?: ConnectionActionKey | null;
  onConnect: () => void;
  onAccept: () => void;
  onReject: () => void;
  onCancel: () => void;
  size?: "compact" | "default";
  demoLabel?: string | null;
};

const toneClasses = {
  primary:
    "border border-indigo-200 bg-indigo-50 text-indigo-700 hover:bg-indigo-100 focus-visible:ring-indigo-500",
  success:
    "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 focus-visible:ring-emerald-500",
  danger: "border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100 focus-visible:ring-rose-500",
  neutral: "border border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100 focus-visible:ring-slate-500",
  status: "border border-amber-200 bg-amber-50 text-amber-700",
} as const;

const iconByAction: Record<ConnectionActionKey, typeof Activity> = {
  connect: UserPlus,
  accept: Check,
  reject: XCircle,
  cancel: XCircle,
  connected: UserCheck,
  sent: Activity,
};

export default function ConnectionActionGroup({
  state,
  busy = false,
  busyActionKey = null,
  onConnect,
  onAccept,
  onReject,
  onCancel,
  size = "default",
  demoLabel = null,
}: Props) {
  if (demoLabel) {
    return (
      <span className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-3 py-1.5 text-sm font-semibold text-slate-600">
        {demoLabel}
      </span>
    );
  }

  const actions = getConnectionActionDescriptors(state, { busy });
  if (!actions.length) return null;

  const sizeClasses =
    size === "compact"
      ? "min-h-9 rounded-lg px-3 py-1.5 text-xs sm:text-sm"
      : "min-h-10 rounded-lg px-3 py-1.5 text-sm";

  const handleAction = (actionKey: ConnectionActionKey) => {
    if (actionKey === "connect") return onConnect();
    if (actionKey === "accept") return onAccept();
    if (actionKey === "reject") return onReject();
    if (actionKey === "cancel") return onCancel();
    return undefined;
  };

  return (
    <>
      {actions.map((action) => {
        const Icon = iconByAction[action.key];
        const isBusyAction = busy && busyActionKey === action.key;
        const label = isBusyAction ? action.pendingLabel : action.label;
        const commonClasses = `inline-flex items-center gap-1.5 font-semibold transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-70 ${sizeClasses}`;

        if (action.key === "connected" || action.key === "sent") {
          return (
            <span key={action.key} className={`${commonClasses} ${toneClasses[action.tone]} cursor-default`}>
              {isBusyAction ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
              {label}
            </span>
          );
        }

        return (
          <button
            key={action.key}
            type="button"
            onClick={handleAction.bind(null, action.key)}
            disabled={action.disabled}
            className={`${commonClasses} ${toneClasses[action.tone]}`}
          >
            {isBusyAction ? <Loader2 size={14} className="animate-spin" /> : <Icon size={14} />}
            {label}
          </button>
        );
      })}
    </>
  );
}
