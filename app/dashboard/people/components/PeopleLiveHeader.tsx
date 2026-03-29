"use client";

import Image from "next/image";
import { useState } from "react";
import {
  Activity,
  Bell,
  Check,
  Clock3,
  UserCheck,
  UserMinus,
  Users,
  X,
  XCircle,
  Inbox,
} from "lucide-react";
import type { ConnectionActionKey, ConnectionBucketEntry } from "@/lib/connectionState";
import { createAvatarFallback } from "@/lib/avatarFallback";
import type { ProviderPreview } from "../types";

type ActivePanel = "incoming" | "outgoing" | "connected" | null;

type Props = {
  activeNow: number;
  connectionCount: number;
  outgoingCount: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  incoming: ConnectionBucketEntry[];
  outgoing: ConnectionBucketEntry[];
  accepted: ConnectionBucketEntry[];
  providerPreviewMap: Map<string, ProviderPreview>;
  busyRequestId: string | null;
  busyActionKey: ConnectionActionKey | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onCancel: (requestId: string) => void;
  onDisconnect: (requestId: string) => void;
};

const formatSyncLabel = (isoTimestamp: string | null, syncing: boolean) => {
  if (syncing) return "Syncing";
  if (!isoTimestamp) return "Not synced yet";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "Not synced yet";
  return `Synced ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};

const formatWhen = (value: string | null) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  const diffMs = Date.now() - date.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "Just now";
  if (diffMin < 60) return `${diffMin}m ago`;
  if (diffMin < 24 * 60) return `${Math.floor(diffMin / 60)}h ago`;
  return date.toLocaleDateString([], { month: "short", day: "numeric" });
};

const presenceDotByTone = {
  online: "bg-emerald-500",
  away: "bg-amber-400",
  offline: "bg-slate-300",
} as const;

const fallbackPreview = (userId: string): ProviderPreview => ({
  id: userId,
  name: "Community member",
  avatar: createAvatarFallback({ label: "Community member", seed: userId }),
  role: "Community member",
  presenceTone: "offline",
  distanceLabel: "Nearby",
  ratingLabel: "Profile preview unavailable",
  tagline: "Visible in your ServiQ network.",
});

function PersonRow({
  entry,
  preview,
  isBusy,
  busyActionKey,
  meta,
  actions,
}: {
  entry: ConnectionBucketEntry;
  preview: ProviderPreview;
  isBusy: boolean;
  busyActionKey: ConnectionActionKey | null;
  meta: string;
  actions: React.ReactNode;
}) {
  return (
    <article className="group flex items-center justify-between gap-3 rounded-2xl border border-slate-100 bg-white p-3 shadow-[0_1px_4px_0_rgba(15,23,42,0.06)] transition hover:border-slate-200 hover:shadow-[0_2px_10px_0_rgba(15,23,42,0.09)] sm:p-3.5">
      <div className="flex min-w-0 items-center gap-3">
        <span className="relative inline-flex shrink-0">
          <Image
            src={preview.avatar}
            alt={preview.name}
            width={40}
            height={40}
            unoptimized
            className="h-10 w-10 rounded-xl border border-slate-100 object-cover"
          />
          <span
            className={`absolute -right-0.5 -top-0.5 h-3 w-3 rounded-full border-2 border-white ${presenceDotByTone[preview.presenceTone]}`}
          />
        </span>
        <div className="min-w-0">
          <p className="truncate text-sm font-semibold text-slate-900 group-hover:text-slate-950">
            {preview.name}
          </p>
          <p className="truncate text-[11px] text-slate-500">{meta}</p>
        </div>
      </div>
      <div className="flex shrink-0 items-center gap-2">{actions}</div>
    </article>
  );
}

function Panel({
  label,
  title,
  labelColor,
  count,
  onClose,
  children,
}: {
  label: string;
  title: string;
  labelColor: string;
  count: number;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-2xl border border-slate-200/80 bg-white/98 shadow-[0_32px_80px_-24px_rgba(15,23,42,0.22)] ring-1 ring-slate-900/[0.04] backdrop-blur-sm sm:rounded-[1.45rem]">
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
        <div className="flex items-center gap-3">
          <div>
            <p className={`text-[10px] font-bold uppercase tracking-[0.18em] ${labelColor}`}>{label}</p>
            <p className="mt-0.5 text-sm font-semibold text-slate-900">{title}</p>
          </div>
          {count > 0 && (
            <span className="inline-flex h-5 min-w-5 items-center justify-center rounded-full bg-slate-900 px-1.5 text-[10px] font-bold text-white">
              {count}
            </span>
          )}
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-700"
          aria-label="Close panel"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      {children}
    </div>
  );
}

export default function PeopleLiveHeader({
  activeNow,
  connectionCount,
  outgoingCount,
  syncing,
  lastSyncedAt,
  incoming,
  outgoing,
  accepted,
  providerPreviewMap,
  busyRequestId,
  busyActionKey,
  onAccept,
  onDecline,
  onCancel,
  onDisconnect,
}: Props) {
  const [activePanel, setActivePanel] = useState<ActivePanel>(null);

  const toggle = (panel: ActivePanel) =>
    setActivePanel((prev) => (prev === panel ? null : panel));

  const hasIncoming = incoming.length > 0;

  return (
    <div className="relative">
      {activePanel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActivePanel(null)}
          aria-hidden="true"
        />
      )}

      <header className="rounded-[1.35rem] border border-white/80 bg-white/93 px-4 py-3.5 shadow-[0_16px_60px_-40px_rgba(15,23,42,0.4)] backdrop-blur-md sm:rounded-[1.6rem] sm:px-5 sm:py-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[10px] font-bold uppercase tracking-[0.22em] text-[var(--brand-600)]">
              ServiQ Discovery
            </p>
            <h1 className="mt-1 text-[17px] font-bold tracking-tight text-slate-950 sm:text-xl">
              People Network
            </h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">

            <span className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[12px] font-semibold text-emerald-800 sm:px-3.5 sm:text-[13px]">
              <Activity className="h-3.5 w-3.5" />
              {activeNow} active
            </span>

            <button
              type="button"
              onClick={() => toggle("connected")}
              aria-pressed={activePanel === "connected"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all sm:px-3.5 sm:text-[13px] ${
                activePanel === "connected"
                  ? "border-[var(--brand-300)] bg-[var(--brand-50)] text-[var(--brand-800)] ring-2 ring-[var(--brand-200)]"
                  : "border-slate-200 bg-slate-50 text-slate-700 hover:border-slate-300 hover:bg-slate-100"
              }`}
            >
              <UserCheck className={`h-3.5 w-3.5 ${activePanel === "connected" ? "text-[var(--brand-600)]" : "text-slate-500"}`} />
              <span>{connectionCount}</span>
              <span className="hidden sm:inline">connected</span>
            </button>

            <button
              type="button"
              onClick={() => toggle("outgoing")}
              aria-pressed={activePanel === "outgoing"}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all sm:px-3.5 sm:text-[13px] ${
                activePanel === "outgoing"
                  ? "border-amber-400 bg-amber-100 text-amber-900 ring-2 ring-amber-200"
                  : outgoingCount > 0
                  ? "border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <Clock3 className={`h-3.5 w-3.5 ${outgoingCount > 0 ? "text-amber-500" : "text-slate-400"}`} />
              <span>{outgoingCount}</span>
              <span className="hidden sm:inline">pending</span>
            </button>

            <button
              type="button"
              onClick={() => toggle("incoming")}
              aria-pressed={activePanel === "incoming"}
              className={`relative inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-[12px] font-semibold transition-all sm:px-3.5 sm:text-[13px] ${
                activePanel === "incoming"
                  ? "border-rose-400 bg-rose-100 text-rose-900 ring-2 ring-rose-200"
                  : hasIncoming
                  ? "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  : "border-slate-200 bg-slate-50 text-slate-500 hover:bg-slate-100"
              }`}
            >
              <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                {hasIncoming && activePanel !== "incoming" && (
                  <span className="absolute inset-0 animate-ping rounded-full bg-rose-400/50" />
                )}
                {hasIncoming ? (
                  <Bell className="relative h-3.5 w-3.5" />
                ) : (
                  <Inbox className="relative h-3.5 w-3.5" />
                )}
              </span>
              <span>{incoming.length}</span>
              <span className="hidden sm:inline">{incoming.length === 1 ? "request" : "requests"}</span>
              {hasIncoming && activePanel !== "incoming" && (
                <span className="absolute -right-1 -top-1 flex h-4 w-4 items-center justify-center rounded-full bg-rose-500 text-[9px] font-bold text-white ring-2 ring-white">
                  {incoming.length > 9 ? "9+" : incoming.length}
                </span>
              )}
            </button>

            <span className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[12px] font-medium text-slate-500 sm:px-3.5 sm:text-[13px]">
              <span className="relative flex h-3.5 w-3.5 shrink-0 items-center justify-center">
                <span
                  className={`absolute h-3 w-3 rounded-full bg-[var(--brand-400)]/30 ${syncing ? "animate-ping" : ""}`}
                />
                <span className={`relative h-2 w-2 rounded-full ${syncing ? "bg-[var(--brand-500)]" : "bg-emerald-500"}`} />
              </span>
              {formatSyncLabel(lastSyncedAt, syncing)}
            </span>
          </div>
        </div>
      </header>

      {activePanel === "incoming" && (
        <Panel
          label="Incoming Requests"
          title={hasIncoming ? "Respond to connection requests" : "No pending requests"}
          labelColor="text-rose-600"
          count={incoming.length}
          onClose={() => setActivePanel(null)}
        >
          {!hasIncoming ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <Inbox className="h-5 w-5 text-slate-400" />
              </span>
              <p className="text-sm font-semibold text-slate-700">You are all caught up</p>
              <p className="max-w-xs text-[12px] leading-5 text-slate-400">
                New connection requests will appear here. We will notify you in real time.
              </p>
            </div>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto p-3 sm:p-4">
              <div className="space-y-2">
                {incoming.map((entry) => {
                  const preview = providerPreviewMap.get(entry.userId) ?? fallbackPreview(entry.userId);
                  const isBusy = busyRequestId === entry.requestId;
                  return (
                    <PersonRow
                      key={entry.requestId}
                      entry={entry}
                      preview={preview}
                      isBusy={isBusy}
                      busyActionKey={busyActionKey}
                      meta={`${preview.role}  ${formatWhen(entry.updatedAt)}`}
                      actions={
                        <>
                          <button
                            type="button"
                            onClick={() => {
                              onAccept(entry.requestId);
                              if (incoming.length <= 1) setActivePanel(null);
                            }}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-1.5 text-[12px] font-semibold text-white shadow-sm transition hover:bg-emerald-500 active:scale-95 disabled:opacity-60"
                          >
                            <Check className="h-3.5 w-3.5" />
                            {isBusy && busyActionKey === "accept" ? "Accepting..." : "Accept"}
                          </button>
                          <button
                            type="button"
                            onClick={() => {
                              onDecline(entry.requestId);
                              if (incoming.length <= 1) setActivePanel(null);
                            }}
                            disabled={isBusy}
                            className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-1.5 text-[12px] font-semibold text-slate-600 shadow-sm transition hover:bg-slate-50 active:scale-95 disabled:opacity-60"
                          >
                            <X className="h-3.5 w-3.5" />
                            {isBusy && busyActionKey === "reject" ? "Declining..." : "Decline"}
                          </button>
                        </>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      )}

      {activePanel === "outgoing" && (
        <Panel
          label="Sent Requests"
          title={outgoing.length > 0 ? "Waiting for their response" : "No sent requests"}
          labelColor="text-amber-600"
          count={outgoing.length}
          onClose={() => setActivePanel(null)}
        >
          {!outgoing.length ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <Clock3 className="h-5 w-5 text-slate-400" />
              </span>
              <p className="text-sm font-semibold text-slate-700">No sent requests</p>
              <p className="max-w-xs text-[12px] leading-5 text-slate-400">
                When you send a connection request, it will appear here until accepted or cancelled.
              </p>
            </div>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto p-3 sm:p-4">
              <div className="space-y-2">
                {outgoing.map((entry) => {
                  const preview = providerPreviewMap.get(entry.userId) ?? fallbackPreview(entry.userId);
                  const isBusy = busyRequestId === entry.requestId;
                  return (
                    <PersonRow
                      key={entry.requestId}
                      entry={entry}
                      preview={preview}
                      isBusy={isBusy}
                      busyActionKey={busyActionKey}
                      meta={`${preview.role}  Sent ${formatWhen(entry.updatedAt)}`}
                      actions={
                        <button
                          type="button"
                          onClick={() => {
                            onCancel(entry.requestId);
                            if (outgoing.length <= 1) setActivePanel(null);
                          }}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-amber-200 bg-amber-50 px-3 py-1.5 text-[12px] font-semibold text-amber-700 shadow-sm transition hover:bg-amber-100 active:scale-95 disabled:opacity-60"
                        >
                          <XCircle className="h-3.5 w-3.5" />
                          {isBusy && busyActionKey === "cancel" ? "Cancelling..." : "Cancel"}
                        </button>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      )}

      {activePanel === "connected" && (
        <Panel
          label="Connected People"
          title={accepted.length > 0 ? "Your active connections" : "No connections yet"}
          labelColor="text-[var(--brand-700)]"
          count={accepted.length}
          onClose={() => setActivePanel(null)}
        >
          {!accepted.length ? (
            <div className="flex flex-col items-center gap-2 px-5 py-8 text-center">
              <span className="flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-100">
                <Users className="h-5 w-5 text-slate-400" />
              </span>
              <p className="text-sm font-semibold text-slate-700">No connections yet</p>
              <p className="max-w-xs text-[12px] leading-5 text-slate-400">
                Send connection requests to people below and grow your professional network.
              </p>
            </div>
          ) : (
            <div className="max-h-[24rem] overflow-y-auto p-3 sm:p-4">
              <div className="space-y-2">
                {accepted.map((entry) => {
                  const preview = providerPreviewMap.get(entry.userId) ?? fallbackPreview(entry.userId);
                  const isBusy = busyRequestId === entry.requestId;
                  return (
                    <PersonRow
                      key={entry.requestId}
                      entry={entry}
                      preview={preview}
                      isBusy={isBusy}
                      busyActionKey={busyActionKey}
                      meta={`${preview.role}  Connected ${formatWhen(entry.updatedAt)}`}
                      actions={
                        <button
                          type="button"
                          onClick={() => onDisconnect(entry.requestId)}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1.5 rounded-xl border border-rose-200 bg-rose-50 px-3 py-1.5 text-[12px] font-semibold text-rose-700 shadow-sm transition hover:bg-rose-100 active:scale-95 disabled:opacity-60"
                        >
                          <UserMinus className="h-3.5 w-3.5" />
                          {isBusy ? "Removing..." : "Disconnect"}
                        </button>
                      }
                    />
                  );
                })}
              </div>
            </div>
          )}
        </Panel>
      )}
    </div>
  );
}
