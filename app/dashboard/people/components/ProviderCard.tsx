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
      className={`flex min-h-[21.5rem] cursor-pointer flex-col overflow-hidden rounded-[1.45rem] border bg-white shadow-[0_24px_80px_-58px_rgba(15,23,42,0.38)] transition sm:min-h-[25rem] sm:rounded-[1.7rem] ${
        isActive
          ? "border-[var(--brand-500)]/40 shadow-[0_30px_90px_-60px_rgba(14,165,164,0.36)]"
          : "border-slate-200 hover:border-[var(--brand-500)]/24 hover:shadow-[0_28px_80px_-60px_rgba(15,23,42,0.34)]"
      } focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2`}
    >
      <div className="relative h-24 overflow-hidden bg-[linear-gradient(135deg,#0f6da1_0%,#0ea5a4_48%,#0f172a_100%)] sm:h-28">
        {coverImage ? (
          <Image
            src={coverImage}
            alt={`${provider.name} cover`}
            fill
            unoptimized
            className="object-cover"
            sizes="(max-width: 640px) 100vw, (max-width: 1280px) 50vw, 25vw"
          />
        ) : (
          <div className="absolute inset-0 bg-[radial-gradient(circle_at_20%_20%,rgba(255,255,255,0.28),transparent_20%),radial-gradient(circle_at_80%_18%,rgba(255,255,255,0.2),transparent_16%)]" />
        )}
      </div>

      <div className="relative flex min-h-0 flex-1 flex-col px-4 pb-4 pt-0 sm:px-5 sm:pb-5">
        <div className="-mt-10 flex justify-center sm:-mt-12">
          <div className="relative">
            <Image
              src={provider.avatar}
              alt={provider.name}
              width={108}
              height={108}
              unoptimized
              className="h-[88px] w-[88px] rounded-full border-4 border-white object-cover shadow-[0_18px_30px_-24px_rgba(15,23,42,0.45)] sm:h-[108px] sm:w-[108px]"
            />
            <span
              className={`absolute right-1.5 top-1.5 h-3.5 w-3.5 rounded-full border-[3px] border-white sm:right-2 sm:top-2 sm:h-4 sm:w-4 ${presenceClasses[presenceTone]}`}
              aria-label={`presence-${presenceTone}`}
            />
          </div>
        </div>

        <div className="mt-3 min-w-0 text-center sm:mt-4">
          <div className="flex items-center justify-center gap-2">
            <h3 className="truncate text-base font-semibold leading-tight text-slate-950 sm:text-[1.15rem]">
              {provider.name}
            </h3>
            {provider.verified ? <BadgeCheck className="h-4.5 w-4.5 shrink-0 text-slate-600" /> : null}
          </div>

          {subheading ? (
            <p className="mt-1.5 line-clamp-2 text-[13px] leading-5 text-slate-500 sm:mt-2 sm:text-sm">{subheading}</p>
          ) : null}

          <p className="mt-2 line-clamp-3 text-[13px] leading-5 text-slate-600 sm:line-clamp-2 sm:text-sm">{description}</p>
        </div>

        <div className="mt-auto pt-4 sm:pt-5">
          <div className="flex flex-wrap gap-2">{renderConnectionAction()}</div>
        </div>
      </div>
    </article>
  );
};

const MemoizedProviderCard = memo(ProviderCard);
MemoizedProviderCard.displayName = "ProviderCard";

export default MemoizedProviderCard;
