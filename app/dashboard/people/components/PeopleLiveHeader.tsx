"use client";

import { Activity, Clock3, Users } from "lucide-react";

type Props = {
  activeNow: number;
  nearbyCount: number;
  coveragePercent: number;
  connectionCount: number;
  syncing: boolean;
  lastSyncedAt: string | null;
};

const formatSyncTime = (isoTimestamp: string | null) => {
  if (!isoTimestamp) return "waiting for first sync";
  const date = new Date(isoTimestamp);
  if (Number.isNaN(date.getTime())) return "waiting for first sync";
  return date.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
};

export default function PeopleLiveHeader({
  activeNow,
  nearbyCount,
  coveragePercent,
  connectionCount,
  syncing,
  lastSyncedAt,
}: Props) {
  return (
    <header className="market-hero-surface overflow-hidden rounded-[2rem] border border-white/70 bg-white/85 p-4 shadow-[0_24px_80px_-52px_rgba(15,23,42,0.5)] backdrop-blur sm:p-5">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.16),transparent_32%),radial-gradient(circle_at_top_right,rgba(17,70,106,0.12),transparent_30%)]" />

      <div className="relative flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-[var(--brand-700)]">ServiQ Discovery</p>
          <div className="mt-1 flex flex-wrap items-center gap-2">
            <h1 className="brand-display text-2xl font-semibold text-slate-950 sm:text-[2rem]">People Network</h1>
            <span className="rounded-full border border-slate-200 bg-white/85 px-2.5 py-1 text-[11px] font-medium text-slate-500">
              Human-centered services near you
            </span>
          </div>
        </div>

        <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2 text-sm font-semibold text-emerald-800 shadow-sm">
          <span className="relative flex h-3 w-3 items-center justify-center">
            <span className={`absolute h-5 w-5 rounded-full bg-emerald-300/55 ${syncing ? "animate-ping" : "animate-pulse"}`} />
            <span className="relative h-3 w-3 rounded-full bg-emerald-500" />
          </span>
          {activeNow} active now
        </div>
      </div>

      <div className="relative mt-4 rounded-[1.4rem] border border-slate-200/80 bg-white/80 px-4 py-3 text-sm text-slate-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.7)]">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          <span className="inline-flex items-center gap-2 font-semibold text-slate-800">
            <Users className="h-4 w-4 text-slate-500" />
            Nearby {nearbyCount}
          </span>
          <span className="text-slate-300">•</span>
          <span className="font-semibold text-slate-800">Coverage {coveragePercent}%</span>
          <span className="text-slate-300">•</span>
          <span className="font-semibold text-slate-800">{connectionCount} connections</span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-2 font-semibold text-[var(--brand-700)]">
            <span className="relative flex h-4 w-4 items-center justify-center">
              <span className="absolute h-4 w-4 rounded-full border border-[var(--brand-500)]/45" />
              <span
                className={`absolute h-5 w-5 rounded-full border border-[var(--brand-500)]/20 ${
                  syncing ? "animate-ping" : ""
                }`}
              />
              <Activity className="relative h-3 w-3" />
            </span>
            Auto-syncing every 30s
          </span>
          <span className="text-slate-300">•</span>
          <span className="inline-flex items-center gap-2 text-slate-500">
            <Clock3 className="h-4 w-4" />
            Last sync {formatSyncTime(lastSyncedAt)}
          </span>
        </div>
      </div>
    </header>
  );
}
