import { Activity, Clock3, UserCheck, Users } from "lucide-react";

type Props = {
  activeNow: number;
  connectionCount: number;
  outgoingCount: number;
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
  outgoingCount,
  syncing,
  lastSyncedAt,
}: Props) {
  return (
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
  );
}
