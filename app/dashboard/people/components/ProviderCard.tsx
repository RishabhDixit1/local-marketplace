"use client";

import Image from "next/image";
import { memo, useMemo, useState } from "react";
import {
  ArrowUpRight,
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Clock3,
  ExternalLink,
  Globe,
  ImageIcon,
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

const clampOfferings = (offerings: ProviderOffering[]) => offerings.slice(0, 4);

const formatJoinedLabel = (value: string | null) => {
  if (!value) return "Recently active on ServiQ";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Recently active on ServiQ";
  return `On ServiQ since ${date.toLocaleDateString([], { month: "short", year: "numeric" })}`;
};

const formatDistanceLabel = (distanceKm: number) => `${Math.max(0, distanceKm).toFixed(1)} km away`;

const formatResponseLabel = (minutes: number) => `Replies in ~${minutes} min`;

const actionButtonClassName =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-65";

const secondaryActionClassName = `${actionButtonClassName} border border-slate-200 bg-white text-slate-700 hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]`;

const iconOnlyActionClassName =
  "inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-65";

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
  const mediaItems = provider.media;
  const boundedMediaIndex = mediaItems.length ? mediaIndex % mediaItems.length : 0;
  const activeMedia = mediaItems[boundedMediaIndex] || null;
  const visibleOfferings = useMemo(() => clampOfferings(provider.offerings), [provider.offerings]);
  const requestId = connectionState.requestId;
  const presenceMeta = presenceClasses[presenceTone];

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
          <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-semibold text-amber-700">
            Request sent
          </div>
          <button
            type="button"
            onClick={() => onCancel(requestId)}
            disabled={busy}
            className={secondaryActionClassName}
          >
            {busy && busyActionKey === "cancel" ? "Cancelling..." : "Cancel request"}
          </button>
        </>
      );
    }

    if (connectionState.kind === "accepted") {
      return (
        <div className="inline-flex min-h-12 items-center justify-center gap-2 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-semibold text-emerald-700">
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
        className={`${actionButtonClassName} bg-[var(--brand-900)] text-white hover:bg-[var(--brand-700)]`}
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
      className={`group relative overflow-hidden rounded-[2.1rem] border bg-white p-5 shadow-[0_28px_90px_-60px_rgba(15,23,42,0.55)] transition duration-300 sm:p-6 xl:min-h-[76vh] ${
        isActive
          ? "border-[var(--brand-500)]/45 shadow-[0_34px_110px_-62px_rgba(14,165,164,0.5)]"
          : "border-slate-200/90 hover:border-[var(--brand-500)]/28 hover:shadow-[0_32px_90px_-58px_rgba(15,23,42,0.45)]"
      }`}
      onMouseEnter={() => onActivate(provider.id)}
      onFocus={() => onActivate(provider.id)}
      aria-current={isActive}
    >
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.1),transparent_30%),radial-gradient(circle_at_90%_15%,rgba(17,70,106,0.12),transparent_28%),linear-gradient(180deg,rgba(255,255,255,0.88),rgba(255,255,255,1))]" />

      <div className="relative grid gap-6 xl:grid-cols-[minmax(0,1.2fr)_360px]">
        <div className="space-y-6">
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="flex min-w-0 items-start gap-4">
              <button type="button" onClick={() => onOpenTrust(provider.id)} className="relative shrink-0">
                <Image
                  src={provider.avatar}
                  alt={provider.name}
                  width={88}
                  height={88}
                  unoptimized
                  className="h-[88px] w-[88px] rounded-[1.6rem] border border-white object-cover shadow-sm"
                />
                <span
                  className={`absolute -right-1 -top-1 h-4 w-4 rounded-full border-[3px] border-white ${presenceMeta.ring}`}
                  aria-label={`presence-${presenceTone}`}
                />
              </button>

              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <button type="button" onClick={() => onOpenTrust(provider.id)} className="text-left">
                    <h3 className="brand-display text-[1.9rem] font-semibold leading-tight text-slate-950 sm:text-[2.2rem]">
                      {provider.name}
                    </h3>
                  </button>
                  {provider.verified ? (
                    <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700">
                      <BadgeCheck className="h-3.5 w-3.5" />
                      Verified
                    </span>
                  ) : null}
                  <span className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${presenceMeta.pill}`}>
                    <span className="h-2 w-2 rounded-full bg-current" />
                    {presenceMeta.label}
                  </span>
                </div>

                <p className="mt-2 text-base font-medium text-slate-700">{provider.role}</p>

                <div className="mt-3 flex flex-wrap items-center gap-2 text-sm text-slate-600">
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                    <MapPin className="h-4 w-4 text-slate-400" />
                    {provider.location}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-1.5">
                    <Clock3 className="h-4 w-4 text-slate-400" />
                    {formatResponseLabel(provider.responseMinutes)}
                  </span>
                  <span className="inline-flex items-center gap-2 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-amber-700">
                    <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
                    {provider.rating.toFixed(1)} rating ({provider.reviews} reviews)
                  </span>
                </div>
              </div>
            </div>

            <div className="grid gap-2 sm:min-w-[220px] sm:grid-cols-2">
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className={sectionLabelClassName}>Distance</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{formatDistanceLabel(provider.distanceKm)}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                <p className={sectionLabelClassName}>Starting point</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {provider.minPriceLabel ? `From ${provider.minPriceLabel}` : "Ask for pricing"}
                </p>
              </div>
            </div>
          </div>

          <section className="rounded-[1.7rem] border border-slate-200 bg-white/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={sectionLabelClassName}>Business Summary</p>
                <p className="mt-2 max-w-3xl text-base leading-7 text-slate-600">{provider.bio}</p>
              </div>
              <button
                type="button"
                onClick={() => onOpenTrust(provider.id)}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
              >
                <ShieldCheck className="h-3.5 w-3.5" />
                Trust details
              </button>
            </div>

            <div className="mt-4 flex flex-wrap gap-2">
              {provider.tags.slice(0, 6).map((tag) => (
                <span
                  key={`${provider.id}-${tag}`}
                  className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700"
                >
                  {tag}
                </span>
              ))}
            </div>
          </section>

          <section className="rounded-[1.7rem] border border-slate-200 bg-white/90 p-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <p className={sectionLabelClassName}>Services And Catalog</p>
                <p className="mt-1 text-sm text-slate-500">
                  {provider.listingCount > 0
                    ? `${provider.listingCount} published offers across services and products`
                    : "This profile is visible in the network and ready for direct outreach."}
                </p>
              </div>
              <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-semibold text-slate-700">
                {provider.primarySkill}
              </span>
            </div>

            {visibleOfferings.length > 0 ? (
              <div className="mt-4 grid gap-3 lg:grid-cols-2">
                {visibleOfferings.map((offering) => (
                  <div key={offering.id} className="rounded-[1.4rem] border border-slate-200 bg-slate-50/90 p-4">
                    <div className="flex items-start justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-[0.14em] text-slate-500">
                            {offering.kind}
                          </span>
                          <span className="rounded-full border border-[var(--brand-500)]/20 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-700)]">
                            {offering.category}
                          </span>
                        </div>
                        <h4 className="mt-3 text-base font-semibold text-slate-900">{offering.title}</h4>
                        <p className="mt-1 line-clamp-3 text-sm leading-6 text-slate-600">{offering.description}</p>
                      </div>
                      {offering.priceLabel ? (
                        <span className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-700">
                          {offering.priceLabel}
                        </span>
                      ) : null}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="mt-4 rounded-[1.4rem] border border-dashed border-slate-200 bg-slate-50 px-5 py-6 text-sm text-slate-500">
                No published service cards yet. ServiQ is still showing the live profile summary, identity details, and trust signals.
              </div>
            )}
          </section>

          <section className="rounded-[1.7rem] border border-slate-200 bg-white/90 p-5">
            <p className={sectionLabelClassName}>Trust Signals</p>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Completed work</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{provider.completedJobs}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Profile strength</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{provider.profileCompletion}%</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Open leads</p>
                <p className="mt-2 text-lg font-semibold text-slate-900">{provider.openLeads}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Marketplace activity</p>
                <p className="mt-2 text-sm font-semibold text-slate-900">{provider.recentActivityLabel}</p>
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3 text-sm text-slate-500">
              <span>{provider.trustBlurb}</span>
              <span className="text-slate-300">•</span>
              <span>{formatJoinedLabel(provider.joinedAt)}</span>
            </div>

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
          </section>
        </div>

        <div className="space-y-4">
          <section className="overflow-hidden rounded-[1.8rem] border border-slate-200 bg-white/95">
            <div className="flex items-center justify-between border-b border-slate-200 px-4 py-3">
              <div>
                <p className={sectionLabelClassName}>Media Showcase</p>
                <p className="mt-1 text-sm text-slate-500">
                  {mediaItems.length > 0
                    ? `${mediaItems.length} published visuals from this profile`
                    : "No published gallery yet"}
                </p>
              </div>
              {mediaItems.length > 1 ? (
                <div className="inline-flex items-center gap-2 text-xs font-semibold text-slate-500">
                  <button
                    type="button"
                    onClick={() => setMediaIndex((current) => (current - 1 + mediaItems.length) % mediaItems.length)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                    aria-label="Previous media"
                  >
                    <span aria-hidden="true">‹</span>
                  </button>
                    <span>
                      {boundedMediaIndex + 1}/{mediaItems.length}
                    </span>
                  <button
                    type="button"
                    onClick={() => setMediaIndex((current) => (current + 1) % mediaItems.length)}
                    className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
                    aria-label="Next media"
                  >
                    <span aria-hidden="true">›</span>
                  </button>
                </div>
              ) : null}
            </div>

            {activeMedia ? (
              <div className="relative aspect-[4/3] overflow-hidden bg-slate-100">
                <Image
                  src={activeMedia.url}
                  alt={activeMedia.title}
                  fill
                  unoptimized
                  sizes="(max-width: 1280px) 100vw, 360px"
                  className="object-cover"
                />
                <div className="absolute inset-x-0 bottom-0 bg-linear-to-t from-slate-950/70 via-slate-950/10 to-transparent px-4 py-4 text-white">
                  <p className="text-sm font-semibold">{activeMedia.title}</p>
                  <p className="mt-1 text-xs text-white/80">Published from the provider&apos;s ServiQ catalog</p>
                </div>
              </div>
            ) : (
              <div className="grid aspect-[4/3] place-items-center bg-[linear-gradient(180deg,rgba(248,250,252,0.98),rgba(241,245,249,0.98))] px-6 text-center">
                <div className="max-w-xs">
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-white text-slate-500 shadow-sm">
                    <ImageIcon className="h-6 w-6" />
                  </div>
                  <p className="mt-4 text-base font-semibold text-slate-900">No portfolio media published yet</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Product images appear here automatically when this profile publishes them in ServiQ.
                  </p>
                </div>
              </div>
            )}
          </section>

          <section className="rounded-[1.8rem] border border-slate-200 bg-white/95 p-5">
            <p className={sectionLabelClassName}>Quick Read</p>
            <div className="mt-4 space-y-3">
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Primary service</p>
                <p className="mt-2 text-base font-semibold text-slate-900">{provider.primarySkill}</p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Catalog coverage</p>
                <p className="mt-2 text-base font-semibold text-slate-900">
                  {provider.serviceCount} services • {provider.productCount} products
                </p>
              </div>
              <div className="rounded-2xl border border-slate-200 bg-slate-50/90 px-4 py-3">
                <p className="text-xs font-medium uppercase tracking-[0.14em] text-slate-400">Why this profile stands out</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{provider.trustBlurb}</p>
              </div>
            </div>
          </section>
        </div>
      </div>

      <div className="relative mt-6 border-t border-slate-200/90 pt-5">
        <div className="flex flex-wrap gap-2.5">
          {renderConnectionAction()}

          <button
            type="button"
            onClick={() => onMessage(provider.id)}
            disabled={chatBusy}
            className={`${secondaryActionClassName} bg-slate-900 text-white hover:bg-slate-800 hover:text-white`}
          >
            <MessageCircle className="h-4 w-4" />
            {chatBusy ? "Opening..." : "Chat"}
          </button>

          <button
            type="button"
            onClick={() => onToggleSave(provider.id)}
            disabled={saveBusy}
            className={`${iconOnlyActionClassName} ${saved ? "border-[var(--brand-500)]/30 bg-cyan-50 text-[var(--brand-700)]" : ""}`}
          >
            {saved ? <BookmarkCheck className="h-4 w-4" /> : <Bookmark className="h-4 w-4" />}
            {saveBusy ? "Saving..." : saved ? "Saved" : "Save"}
          </button>

          <button
            type="button"
            onClick={() => onShare(provider.id)}
            disabled={shareBusy}
            className={iconOnlyActionClassName}
          >
            <Share2 className="h-4 w-4" />
            {shareBusy ? "Sharing..." : "Share"}
          </button>

          <button
            type="button"
            onClick={() => onViewProfile(provider.id)}
            className={iconOnlyActionClassName}
          >
            <ExternalLink className="h-4 w-4" />
            View Full Profile
            <ArrowUpRight className="h-4 w-4" />
          </button>
        </div>
      </div>
    </article>
  );
};

const MemoizedProviderCard = memo(ProviderCard);
MemoizedProviderCard.displayName = "ProviderCard";

export default MemoizedProviderCard;
