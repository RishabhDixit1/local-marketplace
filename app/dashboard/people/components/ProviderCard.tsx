"use client";

import Image from "next/image";
import { memo, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  ChevronDown,
  ChevronUp,
  Clock3,
  ExternalLink,
  Globe,
  Mail,
  MapPin,
  MessageCircle,
  Phone,
  Share2,
  ShieldCheck,
  Star,
  UserCheck,
  UserPlus,
  XCircle,
} from "lucide-react";
import type { ConnectionActionKey } from "@/lib/connectionState";
import type {
  PresenceTone,
  ProviderCard as ProviderCardModel,
  ProviderCardConnectionState,
  ProviderOffering,
} from "../types";

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

const presenceClasses: Record<PresenceTone, { ring: string; pill: string; label: string }> = {
  online: {
    ring: "border-emerald-400 bg-emerald-400",
    pill: "border-emerald-200 bg-emerald-50 text-emerald-700",
    label: "Available now",
  },
  away: {
    ring: "border-amber-400 bg-amber-400",
    pill: "border-amber-200 bg-amber-50 text-amber-700",
    label: "Away",
  },
  offline: {
    ring: "border-slate-300 bg-slate-300",
    pill: "border-slate-200 bg-slate-100 text-slate-600",
    label: "Offline",
  },
};

const sectionLabelClassName = "text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400";

const clampOfferings = (offerings: ProviderOffering[]) => offerings.slice(0, 3);

const formatJoinedLabel = (value: string | null) => {
  if (!value) return "Recently active on ServiQ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently active on ServiQ";
  return `On ServiQ since ${date.toLocaleDateString([], { month: "short", year: "numeric" })}`;
};

const formatDistanceLabel = (distanceKm: number) => `${Math.max(0, distanceKm).toFixed(1)} km away`;

const formatResponseLabel = (minutes: number) => `Replies in ~${minutes} min`;

const formatReviewSignal = (rating: number | null, reviews: number) => {
  if (rating !== null && reviews > 0) {
    return `${rating.toFixed(1)} rating (${reviews} review${reviews === 1 ? "" : "s"})`;
  }

  return "No reviews yet";
};

const actionButtonClassName =
  "inline-flex min-h-10 items-center justify-center gap-2 rounded-xl px-3 py-2 text-sm leading-5 font-semibold transition disabled:cursor-not-allowed disabled:opacity-65";

const surfaceActionClassName = `${actionButtonClassName} border border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]`;
const primaryActionClassName = `${actionButtonClassName} bg-[var(--brand-900)] text-white hover:bg-[var(--brand-700)]`;
const chatActionClassName = `${actionButtonClassName} bg-slate-900 text-white hover:bg-slate-800`;
const savedActionClassName = `${actionButtonClassName} border border-[var(--brand-500)]/30 bg-cyan-50 text-[var(--brand-700)] hover:border-[var(--brand-500)]/40`;
const compactStatClassName = "rounded-[1rem] border border-slate-200 bg-white/95 px-3 py-2.5 sm:rounded-[1.1rem] sm:px-3.5 sm:py-3";

const ProviderCard = ({
  provider,
  presenceTone,
  connectionState,
  busy,
  busyActionKey,
  chatBusy,
  isActive,
  saved,
  saveBusy,
  shareBusy,
  onActivate,
  onConnect,
  onAccept,
  onDecline,
  onCancel,
  onMessage,
  onToggleSave,
  onShare,
  onViewProfile,
  onOpenTrust,
}: Props) => {
  const [mediaIndex, setMediaIndex] = useState(0);
  const [detailsOpen, setDetailsOpen] = useState(false);
  const mediaItems = provider.media;
  const boundedMediaIndex = mediaItems.length ? mediaIndex % mediaItems.length : 0;
  const activeMedia = mediaItems[boundedMediaIndex] || null;
  const visibleOfferings = useMemo(() => clampOfferings(provider.offerings), [provider.offerings]);
  const requestId = connectionState.requestId;
  const presenceMeta = presenceClasses[presenceTone];
  const hasContactActions = Boolean(provider.website || provider.phone || provider.email);

  const renderConnectionAction = () => {
    if (connectionState.kind === "incoming_pending" && requestId) {
      return (
        <>
          <button
            type="button"
            onClick={() => onAccept(requestId)}
            disabled={busy}
            className={`${actionButtonClassName} bg-emerald-600 text-white hover:bg-emerald-500`}
          >
            <UserCheck className="h-4 w-4" />
            {busy && busyActionKey === "accept" ? "Accepting..." : "Accept"}
          </button>
          <button
            type="button"
            onClick={() => onDecline(requestId)}
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
        <>
          <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3.5 py-2.5 text-sm font-semibold text-amber-700">
            Request sent
          </div>
          <button
            type="button"
            onClick={() => onCancel(requestId)}
            disabled={busy}
            className={surfaceActionClassName}
          >
            {busy && busyActionKey === "cancel" ? "Cancelling..." : "Cancel request"}
          </button>
        </>
      );
    }

    if (connectionState.kind === "accepted") {
      return (
        <div className="inline-flex min-h-11 items-center justify-center gap-2 rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-sm font-semibold text-emerald-700">
          <UserCheck className="h-4 w-4" />
          Connected
        </div>
      );
    }

    return (
      <button
        type="button"
        onClick={() => onConnect(provider.id)}
        disabled={busy}
        className={primaryActionClassName}
      >
        <UserPlus className="h-4 w-4" />
        {busy && busyActionKey === "connect"
          ? "Connecting..."
          : connectionState.kind === "rejected" || connectionState.kind === "cancelled"
          ? "Connect again"
          : "Connect"}
      </button>
    );
  };

  return (
    <article
      className={`group relative overflow-hidden rounded-[1.65rem] border bg-white p-3.5 shadow-[0_22px_75px_-58px_rgba(15,23,42,0.38)] transition duration-300 sm:rounded-[1.8rem] sm:p-5 lg:p-6 ${
        isActive
          ? "border-[var(--brand-500)]/40 shadow-[0_32px_100px_-64px_rgba(14,165,164,0.42)]"
          : "border-slate-200/90 hover:border-[var(--brand-500)]/24 hover:shadow-[0_30px_90px_-64px_rgba(15,23,42,0.36)]"
      }`}
      onMouseEnter={() => onActivate(provider.id)}
      onFocus={() => onActivate(provider.id)}
      aria-current={isActive}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.08),transparent_28%),radial-gradient(circle_at_92%_12%,rgba(17,70,106,0.1),transparent_24%),linear-gradient(180deg,rgba(255,255,255,0.94),rgba(255,255,255,1))]" />

      <div className="relative space-y-4 sm:space-y-5">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-0 items-start gap-3 sm:gap-4">
            <button
              type="button"
              onClick={() => onOpenTrust(provider.id)}
              className="relative shrink-0 rounded-[1.2rem] focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-500)]"
            >
              <Image
                src={provider.avatar}
                alt={provider.name}
                width={72}
                height={72}
                unoptimized
                className="h-16 w-16 rounded-[1.2rem] border border-white object-cover shadow-sm sm:h-[72px] sm:w-[72px] lg:h-[76px] lg:w-[76px] lg:rounded-[1.35rem]"
              />
              <span
                className={`absolute -right-1 -top-1 h-3.5 w-3.5 rounded-full border-[3px] border-white sm:h-4 sm:w-4 ${presenceMeta.ring}`}
                aria-label={`presence-${presenceTone}`}
              />
            </button>

            <div className="min-w-0 flex-1">
              <div className="min-w-0 space-y-2">
                <button type="button" onClick={() => onOpenTrust(provider.id)} className="block max-w-full text-left">
                  <h3 className="brand-display max-w-full text-[1.28rem] font-semibold leading-[1.08] text-slate-950 line-clamp-2 [overflow-wrap:anywhere] sm:text-[1.55rem] xl:text-[1.8rem]">
                    {provider.name}
                  </h3>
                </button>

                <div className="flex flex-wrap items-center gap-2">
                  {provider.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}

                  <span
                    className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${presenceMeta.pill}`}
                  >
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {presenceMeta.label}
                  </span>
                </div>
              </div>

              <p className="mt-2 text-sm font-medium text-slate-700 [overflow-wrap:anywhere] sm:text-base">
                {provider.role}
              </p>

              <div className="mt-2.5 flex flex-wrap items-center gap-2 text-xs text-slate-600 sm:text-sm">
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{provider.location}</span>
                </span>
                <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                  <Clock3 className="h-4 w-4 text-slate-400" />
                  {formatResponseLabel(provider.responseMinutes)}
                </span>
                <span className="inline-flex max-w-full items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">
                  <Star
                    className={`h-4 w-4 ${provider.rating !== null ? "fill-amber-400 text-amber-400" : "text-amber-500"}`}
                  />
                  <span className="min-w-0 [overflow-wrap:anywhere]">
                    {formatReviewSignal(provider.rating, provider.reviews)}
                  </span>
                </span>
              </div>
            </div>
          </div>

          <div className="grid w-full grid-cols-2 gap-2 xl:max-w-[300px]">
            <div className={compactStatClassName}>
              <p className={sectionLabelClassName}>Distance</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 sm:text-base">
                {formatDistanceLabel(provider.distanceKm)}
              </p>
            </div>
            <div className={compactStatClassName}>
              <p className={sectionLabelClassName}>Starting point</p>
              <p className="mt-2 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere] sm:text-base">
                {provider.minPriceLabel ? `From ${provider.minPriceLabel}` : "Ask for pricing"}
              </p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 2xl:grid-cols-6">
          {renderConnectionAction()}

          <button
            type="button"
            onClick={() => onMessage(provider.id)}
            disabled={chatBusy}
            className={chatActionClassName}
          >
            <MessageCircle className="h-4 w-4" />
            {chatBusy ? "Opening..." : "Chat"}
          </button>

          <button
            type="button"
            onClick={() => onToggleSave(provider.id)}
            disabled={saveBusy}
            className={saved ? savedActionClassName : surfaceActionClassName}
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saveBusy ? "Saving..." : saved ? "Saved" : "Save"}
          </button>

          <button
            type="button"
            onClick={() => onShare(provider.id)}
            disabled={shareBusy}
            className={surfaceActionClassName}
          >
            <Share2 className="h-4 w-4" />
            {shareBusy ? "Sharing..." : "Share"}
          </button>

          <button
            type="button"
            onClick={() => onViewProfile(provider.id)}
            className={surfaceActionClassName}
          >
            <ExternalLink className="h-4 w-4" />
            View profile
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>

        <div className="grid gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
          <section className="rounded-[1.25rem] border border-slate-200 bg-white/95 p-3.5 sm:rounded-[1.35rem] sm:p-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0 flex-1">
                <p className={sectionLabelClassName}>Business Summary</p>
                <p className="mt-2 line-clamp-2 text-sm leading-6 text-slate-600 sm:line-clamp-3">{provider.bio}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenTrust(provider.id)}
                className="inline-flex w-full items-center justify-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)] sm:w-auto"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Trust details
              </button>
            </div>

            <div className="mt-4 grid grid-cols-2 gap-2 xl:grid-cols-4">
              <div className={compactStatClassName}>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Primary skill</p>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                  {provider.primarySkill}
                </p>
              </div>
              <div className={compactStatClassName}>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Catalog</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">
                  {provider.serviceCount} services / {provider.productCount} products
                </p>
              </div>
              <div className={compactStatClassName}>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Profile strength</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{provider.profileCompletion}%</p>
              </div>
              <div className={compactStatClassName}>
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">
                  {provider.completedJobs !== null ? "Completed work" : "Activity"}
                </p>
                <p className="mt-2 line-clamp-2 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                  {provider.completedJobs !== null ? provider.completedJobs : provider.recentActivityLabel}
                </p>
              </div>
            </div>

            {provider.tags.length > 0 ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {provider.tags.slice(0, 4).map((tag) => (
                  <span
                    key={`${provider.id}-${tag}`}
                    className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                  >
                    {tag}
                  </span>
                ))}
              </div>
            ) : null}

            {visibleOfferings.length > 0 ? (
              <div className="mt-4 grid gap-2 md:grid-cols-2 xl:grid-cols-3">
                {visibleOfferings.map((offering) => (
                  <div key={offering.id} className="rounded-[1.15rem] border border-slate-200 bg-slate-50/90 p-3">
                    <div className="flex items-center justify-between gap-2">
                      <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                        {offering.kind}
                      </span>
                      {offering.priceLabel ? (
                        <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700">
                          {offering.priceLabel}
                        </span>
                      ) : null}
                    </div>
                    <p className="mt-3 line-clamp-2 text-sm font-semibold text-slate-900 [overflow-wrap:anywhere]">
                      {offering.title}
                    </p>
                    <p className="mt-1 line-clamp-2 text-sm leading-5 text-slate-600">{offering.description}</p>
                  </div>
                ))}
              </div>
            ) : null}

            {hasContactActions ? (
              <div className="mt-4 flex flex-wrap gap-2">
                {provider.website ? (
                  <a
                    href={provider.website}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                  >
                    <Globe className="h-3.5 w-3.5" />
                    Website
                  </a>
                ) : null}
                {provider.phone ? (
                  <a
                    href={`tel:${provider.phone}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                  >
                    <Phone className="h-3.5 w-3.5" />
                    Call
                  </a>
                ) : null}
                {provider.email ? (
                  <a
                    href={`mailto:${provider.email}`}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                  >
                    <Mail className="h-3.5 w-3.5" />
                    Email
                  </a>
                ) : null}
              </div>
            ) : null}
          </section>

          <section className="rounded-[1.25rem] border border-slate-200 bg-white/95 p-3.5 sm:rounded-[1.35rem] sm:p-4">
            <p className={sectionLabelClassName}>Trust Snapshot</p>
            <p className="mt-2 text-sm leading-6 text-slate-600">{provider.trustBlurb}</p>
            <p className="mt-3 text-xs font-medium text-slate-500">{formatJoinedLabel(provider.joinedAt)}</p>

            <button
              type="button"
              onClick={() => setDetailsOpen((current) => !current)}
              className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
            >
              {detailsOpen ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              {detailsOpen ? "Hide extra details" : "More details"}
            </button>
          </section>
        </div>

        {detailsOpen ? (
          <div className="grid gap-3 lg:gap-4 xl:grid-cols-[minmax(0,1fr)_300px]">
            <section className="rounded-[1.25rem] border border-slate-200 bg-white/95 p-3.5 sm:rounded-[1.35rem] sm:p-4">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <p className={sectionLabelClassName}>Published Services</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {provider.listingCount > 0
                      ? `${provider.listingCount} live listing${provider.listingCount === 1 ? "" : "s"} connected to this profile.`
                      : "No published services or products yet. You can still connect, chat, or view the full profile."}
                  </p>
                </div>
                <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                  {provider.primarySkill}
                </span>
              </div>
            </section>

            {activeMedia ? (
              <section className="overflow-hidden rounded-[1.25rem] border border-slate-200 bg-white/95 sm:rounded-[1.35rem]">
                <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
                  <div>
                    <p className={sectionLabelClassName}>Media Showcase</p>
                    <p className="mt-1 text-sm text-slate-500">
                      {mediaItems.length} published visual{mediaItems.length === 1 ? "" : "s"}
                    </p>
                  </div>
                  {mediaItems.length > 1 ? (
                    <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                      <button
                        type="button"
                        onClick={() => setMediaIndex((current) => (current - 1 + mediaItems.length) % mediaItems.length)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                        aria-label="Previous media"
                      >
                        <span aria-hidden="true">&lt;</span>
                      </button>
                      <span>
                        {boundedMediaIndex + 1}/{mediaItems.length}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMediaIndex((current) => (current + 1) % mediaItems.length)}
                        className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                        aria-label="Next media"
                      >
                        <span aria-hidden="true">&gt;</span>
                      </button>
                    </div>
                  ) : null}
                </div>

                <div className="relative aspect-[5/4] overflow-hidden bg-slate-100">
                  <Image
                    src={activeMedia.url}
                    alt={activeMedia.title}
                    fill
                    unoptimized
                    sizes="(max-width: 1280px) 100vw, 300px"
                    className="object-cover"
                  />
                  <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/70 via-slate-950/10 to-transparent px-4 py-4 text-white">
                    <p className="line-clamp-2 text-sm font-semibold [overflow-wrap:anywhere]">{activeMedia.title}</p>
                    <p className="mt-1 text-xs text-white/80">Published from the provider&apos;s ServiQ catalog</p>
                  </div>
                </div>
              </section>
            ) : null}
          </div>
        ) : null}
      </div>
    </article>
  );
};

const MemoizedProviderCard = memo(ProviderCard);
MemoizedProviderCard.displayName = "ProviderCard";

export default MemoizedProviderCard;
