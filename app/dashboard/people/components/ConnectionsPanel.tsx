"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { Check, Clock3, MessageCircle, UserCheck, UserPlus, X } from "lucide-react";
import type { ConnectionActionKey, ConnectionBucketEntry } from "@/lib/connectionState";
import type { ProviderPreview } from "../types";

type PanelTab = "incoming" | "outgoing" | "accepted";

type Props = {
  incoming: ConnectionBucketEntry[];
  outgoing: ConnectionBucketEntry[];
  accepted: ConnectionBucketEntry[];
  providerPreviewMap: Map<string, ProviderPreview>;
  busyRequestId: string | null;
  busyActionKey: ConnectionActionKey | null;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onCancel: (requestId: string) => void;
  onChat: (userId: string) => void;
  chatBusyUserId: string | null;
  className?: string;
};

const tabMeta: Record<PanelTab, { label: string; icon: typeof UserPlus }> = {
  incoming: { label: "Incoming", icon: UserPlus },
  outgoing: { label: "Sent", icon: Clock3 },
  accepted: { label: "Connected", icon: UserCheck },
};

const formatWhen = (value: string | null) => {
  if (!value) return "Just now";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Just now";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const fallbackPreview = (userId: string): ProviderPreview => ({
  id: userId,
  name: `Member ${userId.slice(0, 4).toUpperCase()}`,
  avatar: `https://i.pravatar.cc/120?u=${encodeURIComponent(userId)}`,
  role: "Local member",
  presenceTone: "offline",
  distanceLabel: "Nearby",
  ratingLabel: "New connection",
  tagline: "Visible in your ServiQ network.",
});

const presenceDotByTone = {
  online: "bg-emerald-500",
  away: "bg-amber-500",
  offline: "bg-slate-400",
} as const;

export default function ConnectionsPanel({
  incoming,
  outgoing,
  accepted,
  providerPreviewMap,
  busyRequestId,
  busyActionKey,
  onAccept,
  onDecline,
  onCancel,
  onChat,
  chatBusyUserId,
  className,
}: Props) {
  const [activeTab, setActiveTab] = useState<PanelTab>("incoming");
  const tabRows = useMemo(
    () => ({
      incoming,
      outgoing,
      accepted,
    }),
    [accepted, incoming, outgoing]
  );

  const currentRows = tabRows[activeTab];
  const hasAnyRows = incoming.length + outgoing.length + accepted.length > 0;

  return (
    <section
      className={`rounded-[2rem] border border-white/70 bg-white/92 p-4 shadow-[0_24px_70px_-50px_rgba(15,23,42,0.48)] backdrop-blur sm:p-5 ${className || ""}`}
    >
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-700)]">Human Network</p>
          <h2 className="mt-1 text-lg font-semibold text-slate-950">Connections</h2>
        </div>
        {incoming.length > 0 && (
          <span className="inline-flex items-center gap-1 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-700">
            <span className="h-2 w-2 animate-pulse rounded-full bg-amber-500" />
            {incoming.length} new
          </span>
        )}
      </div>

      <p className="mt-2 text-sm text-slate-500">Accept requests, keep warm leads moving, and jump straight into chat.</p>

      <div className="mt-4 grid grid-cols-3 gap-1 rounded-2xl border border-slate-200 bg-slate-50/90 p-1.5">
        {(Object.keys(tabMeta) as PanelTab[]).map((tab) => {
          const TabIcon = tabMeta[tab].icon;
          const count = tabRows[tab].length;
          const isActive = activeTab === tab;
          return (
            <button
              key={tab}
              type="button"
              onClick={() => setActiveTab(tab)}
              className={`relative inline-flex items-center justify-center gap-1 rounded-lg px-2 py-2 text-xs font-semibold transition ${
                isActive ? "bg-white text-slate-900 shadow-sm" : "text-slate-600 hover:text-slate-800"
              }`}
            >
              <TabIcon className="h-3.5 w-3.5" />
              {tabMeta[tab].label}
              <span className={`rounded-full px-1.5 py-0.5 text-[10px] ${isActive ? "bg-slate-900 text-white" : "bg-slate-200 text-slate-700"}`}>
                {count}
              </span>
              {tab === "incoming" && incoming.length > 0 && (
                <span className="absolute right-1 top-1 h-1.5 w-1.5 animate-pulse rounded-full bg-amber-500" />
              )}
            </button>
          );
        })}
      </div>

      {!hasAnyRows ? (
        <div className="mt-4 rounded-[1.6rem] border border-dashed border-slate-200 bg-slate-50 px-4 py-7 text-center">
          <p className="text-base font-semibold text-slate-700">No connections yet</p>
          <p className="mt-1 text-xs text-slate-500">
            You haven&apos;t connected with anyone yet - start by messaging a nearby provider.
          </p>
        </div>
      ) : !currentRows.length ? (
        <div className="mt-4 rounded-[1.4rem] border border-slate-200 bg-slate-50 px-3 py-4 text-center text-xs text-slate-500">
          Nothing here right now.
        </div>
      ) : (
        <div className="mt-4 space-y-3">
          {currentRows.map((entry) => {
            const preview = providerPreviewMap.get(entry.userId) || fallbackPreview(entry.userId);
            const isBusy = busyRequestId === entry.requestId;
            const isAcceptedTab = activeTab === "accepted";
            const isIncomingTab = activeTab === "incoming";
            const isOutgoingTab = activeTab === "outgoing";

            return (
              <article key={entry.requestId} className="rounded-[1.5rem] border border-slate-200 bg-white p-3.5">
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
                  {isAcceptedTab && (
                    <button
                      type="button"
                      onClick={() => onChat(entry.userId)}
                      disabled={chatBusyUserId === entry.userId}
                      className="inline-flex items-center gap-1 rounded-lg bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white transition hover:bg-slate-800 disabled:opacity-70"
                    >
                      <MessageCircle className="h-3.5 w-3.5" />
                      {chatBusyUserId === entry.userId ? "Opening..." : "Chat"}
                    </button>
                  )}
                </div>

                {isIncomingTab && (
                  <div className="mt-2 grid grid-cols-2 gap-2">
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
                )}

                {isOutgoingTab && (
                  <div className="mt-2">
                    <button
                      type="button"
                      onClick={() => onCancel(entry.requestId)}
                      disabled={isBusy}
                      className="inline-flex w-full items-center justify-center gap-1 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                    >
                      {isBusy && busyActionKey === "cancel" ? "Cancelling..." : "Cancel request"}
                    </button>
                  </div>
                )}
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
