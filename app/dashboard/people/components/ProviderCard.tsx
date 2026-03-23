"use client";

import Image from "next/image";
import { memo, type KeyboardEvent } from "react";
import { BadgeCheck, Clock3, UserCheck, UserPlus, XCircle } from "lucide-react";
import type { ConnectionActionKey } from "@/lib/connectionState";
import type { PresenceTone, ProviderCard as ProviderCardModel, ProviderCardConnectionState } from "../types";

type Props = {
  provider: ProviderCardModel;
  presenceTone: PresenceTone;
  connectionState: ProviderCardConnectionState;
  busy: boolean;
  busyActionKey: ConnectionActionKey | null;
  chatBusy: boolean;
  isActive: boolean;
  saved: boolean;
  saveBusy: boolean;
  shareBusy: boolean;
  onActivate: (providerId: string) => void;
  onConnect: (providerId: string) => void;
  onAccept: (requestId: string) => void;
  onDecline: (requestId: string) => void;
  onCancel: (requestId: string) => void;
  onMessage: (providerId: string) => void;
  onToggleSave: (providerId: string) => void;
  onShare: (providerId: string) => void;
  onViewProfile: (providerId: string) => void;
  onOpenTrust: (providerId: string) => void;
};

const presenceClasses: Record<PresenceTone, string> = {
  online: "border-emerald-400 bg-emerald-400",
  away: "border-amber-400 bg-amber-400",
  offline: "border-slate-300 bg-slate-300",
};

const actionButtonClassName =
  "inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-full px-4 py-2.5 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-65";

const primaryActionClassName = `${actionButtonClassName} border border-[#1f6fd1] bg-white text-[#1f6fd1] hover:bg-[#edf5ff]`;

const ProviderCard = (props: Props) => {
  const { provider, presenceTone, connectionState, busy, busyActionKey, isActive, onActivate, onConnect, onAccept, onDecline, onViewProfile } =
    props;

  const description = provider.bio?.trim() || provider.trustBlurb?.trim() || `${provider.role} on ServiQ.`;
  const coverImage = provider.media[0]?.url || "";
  const subheading = provider.role?.trim() || provider.primarySkill?.trim() || provider.location;
  const requestId = connectionState.requestId;

  const handleOpenProfile = () => {
    onViewProfile(provider.id);
  };

  const handleCardKeyDown = (event: KeyboardEvent<HTMLElement>) => {
    if (event.target !== event.currentTarget) return;
    if (event.key !== "Enter" && event.key !== " ") return;
    event.preventDefault();
    handleOpenProfile();
  };

  const renderConnectionAction = () => {
    if (connectionState.kind === "incoming_pending" && requestId) {
      return (
        <>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onAccept(requestId);
            }}
            disabled={busy}
            className={`${actionButtonClassName} bg-emerald-600 text-white hover:bg-emerald-500`}
          >
            <UserCheck className="h-4 w-4" />
            {busy && busyActionKey === "accept" ? "Accepting..." : "Accept"}
          </button>
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onDecline(requestId);
            }}
            disabled={busy}
            className={`${actionButtonClassName} border border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100`}
          >
            <XCircle className="h-4 w-4" />
            {busy && busyActionKey === "reject" ? "Declining..." : "Decline"}
          </button>
        </>
      );
    }

    if (connectionState.kind === "outgoing_pending" && requestId) {
      return (
        <div className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-semibold text-amber-700">
          <Clock3 className="h-4 w-4" />
          Pending
        </div>
      );
    }

    if (connectionState.kind === "accepted") {
      return (
        <div className="inline-flex w-full min-h-11 items-center justify-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 py-2.5 text-sm font-semibold text-emerald-700">
          <UserCheck className="h-4 w-4" />
          Connected
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onConnect(provider.id);
        }}
        disabled={busy}
        className={primaryActionClassName}
      >
        <UserPlus className="h-4 w-4" />
        {busy && busyActionKey === "connect"
          ? "Pending..."
          : connectionState.kind === "rejected" || connectionState.kind === "cancelled"
          ? "Connect again"
          : "Connect"}
      </button>
    );
  };

  return (
    <article
      role="link"
      tabIndex={0}
      onClick={handleOpenProfile}
      onKeyDown={handleCardKeyDown}
      onMouseEnter={() => onActivate(provider.id)}
      onFocus={() => onActivate(provider.id)}
      aria-current={isActive}
      className={`flex h-[25rem] cursor-pointer flex-col overflow-hidden rounded-[1.7rem] border bg-white shadow-[0_24px_80px_-58px_rgba(15,23,42,0.38)] transition ${
        isActive
          ? "border-[var(--brand-500)]/40 shadow-[0_30px_90px_-60px_rgba(14,165,164,0.36)]"
          : "border-slate-200 hover:border-[var(--brand-500)]/24 hover:shadow-[0_28px_80px_-60px_rgba(15,23,42,0.34)]"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2`}
    >
      <div className="relative h-28 overflow-hidden bg-[linear-gradient(135deg,#0f6da1_0%,#0ea5a4_48%,#0f172a_100%)]">
        {coverImage ? (
          <Image src={coverImage} alt={`${provider.name} cover`} fill unoptimized className="object-cover" sizes="(max-width: 1280px) 50vw, 25vw" />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_20%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.2),transparent_16%)]" />
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-5 pb-5 pt-0">
        <div className="-mt-12 flex justify-center">
          <div className="relative">
            <Image
              src={provider.avatar}
              alt={provider.name}
              width={108}
              height={108}
              unoptimized
              className="h-[108px] w-[108px] rounded-full border-4 border-white object-cover shadow-[0_18px_30px_-24px_rgba(15,23,42,0.45)]"
            />
            <span
              className={`absolute right-2 top-2 h-4 w-4 rounded-full border-[3px] border-white ${presenceClasses[presenceTone]}`}
              aria-label={`presence-${presenceTone}`}
            />
          </div>
        </div>

        <div className="mt-4 min-w-0 text-center">
          <div className="flex items-center justify-center gap-2">
            <h3 className="truncate text-[1.05rem] font-semibold leading-tight text-slate-950 sm:text-[1.15rem]">
              {provider.name}
            </h3>
            {provider.verified ? <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-slate-600" /> : null}
          </div>

          {subheading ? (
            <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-500">{subheading}</p>
          ) : null}

          <p className="mt-2 line-clamp-2 text-sm leading-5 text-slate-600">{description}</p>
        </div>

        <div className="mt-auto pt-5">
          <div className="flex flex-wrap gap-2">{renderConnectionAction()}</div>
        </div>
      </div>
    </article>
  );
};

const MemoizedProviderCard = memo(ProviderCard);
MemoizedProviderCard.displayName = "ProviderCard";

export default MemoizedProviderCard;
