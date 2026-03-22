"use client";

import { Activity, Clock3, Users } from "lucide-react";

type Props = {
  activeNow: number;
  connectionCount: number;
  syncing: boolean;
  lastSyncedAt: string | null;
};

const formatSyncLabel = (isoTimestamp: string | null, syncing: boolean) => {
  if (syncing) return "Syncing now";
  if (!isoTimestamp) return "Waiting for first sync";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "Waiting for first sync";
  return `Last sync ${date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" })}`;
};

export default function PeopleLiveHeader({
  activeNow,
  connectionCount,
  syncing,
  lastSyncedAt,
}: Props) {
  return (
    <header className="overflow-hidden rounded-[1.6rem] border border-white/70 bg-white/90 px-4 py-3 shadow-[0_20px_70px_-56px_rgba(15,23,42,0.46)] backdrop-blur sm:px-5">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">ServiQ Discovery</p>
          <h1 className="mt-1 text-lg font-semibold text-slate-950 sm:text-xl">People Network</h1>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3.5 py-2 text-sm font-semibold text-emerald-800">
            <Activity className="h-4 w-4" />
            {activeNow} active now
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3.5 py-2 text-sm font-semibold text-slate-700">
            <Users className="h-4 w-4 text-slate-500" />
            {connectionCount} connections
          </span>
          <span className="inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3.5 py-2 text-sm font-semibold text-[var(--brand-700)]">
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
  );
}
