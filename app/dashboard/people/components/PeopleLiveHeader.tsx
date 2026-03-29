"use client";

import Image from "next/image";
import { useState } from "react";
import { Activity, Bell, Check, Clock3, UserCheck, X } from "lucide-react";
import type { ConnectionActionKey, ConnectionBucketEntry } from "@/lib/connectionState";
import { createAvatarFallback } from "@/lib/avatarFallback";
import type { ProviderPreview } from "../types";

type Props = {
  activeNow: number;
  connectionCount: number;
  outgoingCount: number;
  syncing: boolean;
  lastSyncedAt: string | null;
  incoming: ConnectionBucketEntry[];
  providerPreviewMap: Map<string, ProviderPreview>;
  busyRequestId: string | null;
  busyActionKey: ConnectionActionKey | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
};

const formatSyncLabel = (isoTimestamp: string | null, syncing: boolean) => {
  if (syncing) return "Syncing now";
  if (!isoTimestamp) return "Waiting for first sync";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "Waiting for first sync";
  return `Last sync ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};

const formatWhen = (value: string | null) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

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

export default function PeopleLiveHeader({
  activeNow,
  connectionCount,
  outgoingCount,
  syncing,
  lastSyncedAt,
  incoming,
  providerPreviewMap,
  busyRequestId,
  busyActionKey,
  onAccept,
  onDecline,
}: Props) {
  const [open, setOpen] = useState(false);

  return (
    <div className="relative">
      {open && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setOpen(false)}
          aria-hidden="true"
        />
      )}

      <header className="overflow-hidden rounded-[1.35rem] border border-white/70 bg-white/90 px-4 py-3 shadow-[0_20px_70px_-56px_rgba(15,23,42,0.46)] backdrop-blur sm:rounded-[1.6rem] sm:px-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">ServiQ Discovery</p>
            <h1 className="mt-1 text-base font-semibold text-slate-950 sm:text-xl">People Network</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-[13px] font-semibold text-emerald-800 sm:px-3.5 sm:py-2 sm:text-sm">
              <Activity className="h-4 w-4" />
              {activeNow} active now
            </span>
            <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-[13px] font-semibold text-slate-700 sm:px-3.5 sm:py-2 sm:text-sm">
              <UserCheck className="h-4 w-4 text-slate-500" />
              {connectionCount} connected
            </span>
            {outgoingCount > 0 && (
              <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-[13px] font-semibold text-amber-700 sm:px-3.5 sm:py-2 sm:text-sm">
                <Clock3 className="h-4 w-4" />
                {outgoingCount} pending
              </span>
            )}
            {incoming.length > 0 && (
              <button
                type="button"
                onClick={() => setOpen((prev) => !prev)}
                className="relative inline-flex items-center gap-2 rounded-full border border-rose-200 bg-rose-50 px-3 py-1.5 text-[13px] font-semibold text-rose-700 transition hover:bg-rose-100 sm:px-3.5 sm:py-2 sm:text-sm"
              >
                <span className="relative flex h-4 w-4 shrink-0 items-center justify-center">
                  <span className="absolute h-3 w-3 animate-ping rounded-full bg-rose-400/40" />
                  <Bell className="relative h-3.5 w-3.5" />
                </span>
                {incoming.length} {incoming.length === 1 ? "request" : "requests"}
              </button>
            )}
            <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-1.5 text-[13px] font-semibold text-[var(--brand-700)] sm:px-3.5 sm:py-2 sm:text-sm">
              <span className="relative flex h-4 w-4 items-center justify-center">
                <span
                  className={`absolute h-3 w-3 rounded-full bg-[var(--brand-500)]/25 ${
                    syncing ? "animate-ping" : ""
                  }`}
                />
                <span className="relative h-2 w-2 rounded-full bg-[var(--brand-500)]" />
              </span>
              <Clock3 className="h-4 w-4" />
              {formatSyncLabel(lastSyncedAt, syncing)}
            </span>
          </div>
        </div>
      </header>

      {open && incoming.length > 0 && (
        <div className="absolute left-0 right-0 top-full z-50 mt-2 overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white shadow-[0_24px_60px_-20px_rgba(15,23,42,0.28)] sm:rounded-[1.45rem]">
          <div className="flex items-center justify-between border-b border-slate-100 px-4 py-3 sm:px-5">
            <div>
              <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-rose-600 sm:text-[11px]">Incoming Requests</p>
              <p className="mt-0.5 text-[13px] font-semibold text-slate-900 sm:text-sm">Requests waiting for your response</p>
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              className="rounded-full p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="max-h-[22rem] overflow-y-auto p-3 sm:p-4">
            <div className="space-y-2.5 sm:space-y-3">
              {incoming.map((entry) => {
                const preview = providerPreviewMap.get(entry.userId) ?? fallbackPreview(entry.userId);
                const isBusy = busyRequestId === entry.requestId;
                return (
                  <article key={entry.requestId} className="rounded-[1rem] border border-slate-200 bg-slate-50/60 p-2.5 sm:rounded-[1.2rem] sm:p-3">
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <Image
                          src={preview.avatar}
                          alt={preview.name}
                          width={36}
                          height={36}
                          unoptimized
                          className="h-9 w-9 shrink-0 rounded-lg border border-slate-200 object-cover"
                        />
                        <div className="min-w-0">
                          <p className="truncate text-[13px] font-semibold text-slate-900">{preview.name}</p>
                          <p className="text-[11px] text-slate-500">{preview.role} · {formatWhen(entry.updatedAt)}</p>
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-2">
                        <button
                          type="button"
                          onClick={() => {
                            onAccept(entry.requestId);
                            if (incoming.length <= 1) setOpen(false);
                          }}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                        >
                          <Check className="h-3.5 w-3.5" />
                          {isBusy && busyActionKey === "accept" ? "…" : "Accept"}
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onDecline(entry.requestId);
                            if (incoming.length <= 1) setOpen(false);
                          }}
                          disabled={isBusy}
                          className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                        >
                          <X className="h-3.5 w-3.5" />
                          {isBusy && busyActionKey === "reject" ? "…" : "Decline"}
                        </button>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
