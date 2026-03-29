"use client";

import Image from "next/image";
import { Check, X } from "lucide-react";
import type { ConnectionActionKey, ConnectionBucketEntry } from "@/lib/connectionState";
import { createAvatarFallback } from "@/lib/avatarFallback";
import type { ProviderPreview } from "../types";

type Props = {
  incoming: ConnectionBucketEntry[];
  providerPreviewMap: Map<string, ProviderPreview>;
  busyRequestId: string | null;
  busyActionKey: ConnectionActionKey | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  className?: string;
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

const presenceDotByTone = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-slate-400",
} as const;

export default function ConnectionsPanel({
  incoming,
  providerPreviewMap,
  busyRequestId,
  busyActionKey,
  onAccept,
  onDecline,
  className,
}: Props) {

  return (
    <section
      className={`rounded-[1.45rem] border border-white/70 bg-white/92 p-3 shadow-[0_18px_48px_-40px_rgba(15,23,42,0.38)] backdrop-blur sm:rounded-[1.85rem] sm:p-4 ${className || ""}`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2.5">
        <div className="min-w-0">
          <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-700)] sm:text-[11px]">Human Network</p>
          <h2 className="mt-1 text-base font-semibold text-slate-950 sm:text-lg">Connections</h2>
        </div>
        {incoming.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            {incoming.length} new
          </span>
        )}
      </div>

      <p className="mt-1.5 text-[12px] leading-5 text-slate-500 sm:mt-2 sm:text-[13px] sm:leading-6">
        Accept requests, keep warm leads moving, and jump straight into chat.
      </p>

      <div className="mt-3">
      <div className="self-start rounded-[1.2rem] border border-amber-200/70 bg-amber-50/60 p-2.5 sm:rounded-[1.45rem] sm:p-3">
        <div className="flex flex-wrap items-start justify-between gap-2.5">
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.16em] text-amber-700 sm:text-[11px]">Incoming Requests</p>
            <h3 className="mt-1 text-[13px] font-semibold text-slate-950 sm:text-sm">Requests waiting for your response</h3>
          </div>
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <span className={`h-2 w-2 rounded-full ${incoming.length > 0 ? "animate-pulse bg-amber-500" : "bg-slate-300"}`} />
            {incoming.length}
          </span>
        </div>

        {!incoming.length ? (
          <div className="mt-2.5 rounded-[1rem] border border-dashed border-amber-200 bg-white/85 px-3 py-3 text-center sm:rounded-[1.1rem] sm:px-3.5 sm:py-3.5">
            <p className="text-[12px] font-semibold text-slate-700 sm:text-[13px]">No incoming requests right now</p>
            <p className="mt-1 text-[10px] leading-5 text-slate-500 sm:text-[11px]">New requests will appear here first so you can respond quickly.</p>
          </div>
        ) : (
          <div className="mt-3 space-y-2.5 sm:space-y-3">
            {incoming.map((entry) => {
              const preview = providerPreviewMap.get(entry.userId) || fallbackPreview(entry.userId);
              const isBusy = busyRequestId === entry.requestId;

              return (
                <article key={entry.requestId} className="rounded-[1rem] border border-slate-200 bg-white p-2.5 sm:rounded-[1.2rem] sm:p-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex min-w-0 items-start gap-2">
                      <span className="relative inline-flex">
                        <Image
                          src={preview.avatar}
                          alt={preview.name}
                          width={36}
                          height={36}
                          unoptimized
                          className="h-9 w-9 rounded-lg border border-slate-200 object-cover"
                        />
                        <span
                          className={`absolute -right-1 -top-1 h-3 w-3 rounded-full border-2 border-white ${presenceDotByTone[preview.presenceTone]}`}
                        />
                      </span>
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-slate-900">{preview.name}</p>
                        <p className="mt-0.5 text-[11px] text-slate-500">{preview.role}</p>
                        <p className="mt-1 text-[11px] text-slate-500">{formatWhen(entry.updatedAt)}</p>
                      </div>
                    </div>
                  </div>

                  <div className="mt-2 grid grid-cols-1 gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={() => onAccept(entry.requestId)}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center gap-1 rounded-lg bg-emerald-600 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                    >
                      <Check className="h-3.5 w-3.5" />
                      {isBusy && busyActionKey === "accept" ? "Accepting..." : "Accept"}
                    </button>
                    <button
                      type="button"
                      onClick={() => onDecline(entry.requestId)}
                      disabled={isBusy}
                      className="inline-flex items-center justify-center gap-1 rounded-lg border border-rose-200 bg-rose-50 px-2.5 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-70"
                    >
                      <X className="h-3.5 w-3.5" />
                      {isBusy && busyActionKey === "reject" ? "Declining..." : "Decline"}
                    </button>
                  </div>
                </article>
              );
            })}
          </div>
        )}
      </div>
      </div>
    </section>
  );
}
