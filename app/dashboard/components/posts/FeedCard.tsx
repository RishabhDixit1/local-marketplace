"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  ArrowUpRight,
  Archive,
  Bookmark,
  BookmarkCheck,
  Check,
  Loader2,
  MapPin,
  MessageCircle,
  MoreVertical,
  Pencil,
  Share2,
  Star,
  Trash2,
  X,
  Zap,
} from "lucide-react";
import TrustSnapshot from "@/app/components/trust/TrustSnapshot";
import type {
  MarketplaceCardActionButton,
  MarketplacePrimaryActionKind,
  MarketplaceSecondaryActionKind,
} from "@/lib/marketplaceCardActions";
import type { MarketplaceDisplayFeedItem } from "@/lib/marketplaceFeed";
import FeedMediaCarousel from "@/app/dashboard/components/posts/FeedMediaCarousel";

type ActionBusyState = Record<MarketplacePrimaryActionKind | MarketplaceSecondaryActionKind, boolean>;

type FeedCardProps = {
  item: MarketplaceDisplayFeedItem;
  index: number;
  testId?: string;
  active: boolean;
  saved: boolean;
  buttons: MarketplaceCardActionButton<MarketplacePrimaryActionKind>[];
  actionBusyState: ActionBusyState;
  onPrimaryAction: (action: MarketplacePrimaryActionKind) => void | Promise<void>;
  onSecondaryAction: (action: MarketplaceSecondaryActionKind) => void | Promise<void>;
  onFocus: () => void;
  onHoverChange: (hovered: boolean) => void;
  headerAction?: ReactNode;
  isOwner?: boolean;
  onOwnerEdit?: () => void;
  onOwnerArchive?: () => void;
  onOwnerDelete?: () => void;
  ownerDeleteLabel?: string;
  ownerBusy?: boolean;
};

const buttonToneClassNames: Record<MarketplaceCardActionButton<MarketplacePrimaryActionKind>["tone"], string> = {
  primary: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  status: "border-slate-200 bg-slate-100 text-slate-500",
  destructive: "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100",
};

const buttonBusyLabels: Record<MarketplacePrimaryActionKind, string> = {
  accept: "Accepting",
  withdraw: "Withdrawing",
  decline: "Declining",
  send_quote: "Opening",
  view_profile: "Opening",
  discard: "Discarding",
};

const secondaryActionMeta = {
  save: {
    idle: "Save post",
    active: "Saved post",
    icon: Bookmark,
    activeIcon: BookmarkCheck,
  },
  share: {
    idle: "Share post",
    active: "Share post",
    icon: Share2,
    activeIcon: Share2,
  },
} satisfies Record<
  MarketplaceSecondaryActionKind,
  {
    idle: string;
    active: string;
    icon: typeof Bookmark;
    activeIcon: typeof BookmarkCheck;
  }
>;

const isBrowserLocalImageUrl = (value: string) => /^(data:image\/|blob:)/i.test(value);

export default function FeedCard({
  item,
  index,
  active,
  saved,
  buttons,
  actionBusyState,
  onPrimaryAction,
  onSecondaryAction,
  onFocus,
  onHoverChange,
  headerAction,
  isOwner,
  onOwnerEdit,
  onOwnerArchive,
  onOwnerDelete,
  ownerDeleteLabel = "Delete post",
  ownerBusy,
  testId = "feed-card",
}: FeedCardProps) {
  void index;
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement>(null);
  const hasMedia = item.media.length > 0;
  const useBrowserAvatar = isBrowserLocalImageUrl(item.avatarUrl);

  useEffect(() => {
    if (!ownerMenuOpen) return;

    const handler = (event: MouseEvent) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(event.target as Node)) {
        setOwnerMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ownerMenuOpen]);

  const acceptButton = buttons.find(
    (button) => button.kind === "accept" || button.kind === "withdraw" || button.kind === "decline"
  );
  const sendQuoteButton = buttons.find((button) => button.kind === "send_quote");
  const openButton = buttons.find((button) => button.kind === "view_profile");
  const discardButton = buttons.find((button) => button.kind === "discard");
  const primaryButton = acceptButton || sendQuoteButton || openButton || discardButton;
  const ownerCanEdit = typeof onOwnerEdit === "function";
  const ownerCanArchive = typeof onOwnerArchive === "function";
  const ownerCanDelete = typeof onOwnerDelete === "function";

  const detailPills = [
    {
      label: item.type === "demand" ? "Need" : item.type === "service" ? "Service" : "Product",
      className:
        item.type === "demand"
          ? "border-rose-200 bg-rose-50 text-rose-700"
          : item.type === "service"
          ? "border-cyan-200 bg-cyan-50 text-[var(--brand-700)]"
          : "border-emerald-200 bg-emerald-50 text-emerald-700",
    },
    {
      label: item.category,
      className: "border-slate-200 bg-slate-50 text-slate-700",
    },
    item.priceLabel && (item.type !== "demand" || item.price > 0)
      ? {
          label: item.priceLabel,
          className: "border-cyan-200 bg-cyan-50 text-cyan-700",
        }
      : null,
    item.urgent
      ? {
          label: "Urgent",
          className: "border-rose-200 bg-rose-50 text-rose-700",
        }
      : null,
  ].filter((value): value is { label: string; className: string } => !!value);
  const heroPills = hasMedia ? [] : detailPills.slice(0, 2);
  const metaPills = hasMedia ? detailPills : detailPills.slice(heroPills.length);
  const visibleMetaPills = detailsExpanded ? metaPills : metaPills.slice(0, 2);
  const descriptionClampClassName = hasMedia ? "line-clamp-2 sm:line-clamp-3" : "line-clamp-3 sm:line-clamp-4";
  const shouldShowDetailsToggle =
    item.displayDescription.length > (hasMedia ? 120 : 160) ||
    metaPills.length > 2 ||
    !!item.locationLabel;

  return (
    <article
      data-testid={testId}
      data-card-id={item.id}
      className={`h-full w-full min-w-0 overflow-hidden rounded-[1.35rem] border bg-white p-3 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.45)] transition-all sm:rounded-[1.6rem] sm:p-3.5 ${
        active
          ? "border-[var(--brand-500)]/45 shadow-[0_28px_42px_-28px_rgba(14,165,164,0.48)]"
          : "border-slate-200"
      }`}
      onClickCapture={onFocus}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <header className="flex items-start gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => void onPrimaryAction("view_profile")}
          className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
          aria-label={`Open ${item.displayCreator} profile`}
        >
          {useBrowserAvatar ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={item.avatarUrl}
              alt={`${item.displayCreator} avatar`}
              loading="lazy"
              className="h-9 w-9 rounded-full border border-slate-200 object-cover sm:h-10 sm:w-10"
            />
          ) : (
            <Image
              src={item.avatarUrl}
              alt={`${item.displayCreator} avatar`}
              width={40}
              height={40}
              quality={60}
              sizes="40px"
              className="h-9 w-9 rounded-full border border-slate-200 object-cover sm:h-10 sm:w-10"
            />
          )}
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void onPrimaryAction("view_profile")}
              className="min-w-0 max-w-full truncate text-left text-[14px] font-semibold text-slate-900 transition hover:text-[var(--brand-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 sm:text-[15px]"
              aria-label={`Open ${item.displayCreator} profile`}
            >
              {item.displayCreator}
            </button>
            {item.verificationStatus === "verified" ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 sm:px-2 sm:text-[10px]">
                Verified
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-x-2 gap-y-1 text-[10px] text-slate-500 sm:text-[11px]">
            <span>{item.timeLabel}</span>
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <MapPin size={11} />
              {item.distanceLabel}
            </span>
            {item.responseMinutes > 0 ? (
              <span className="inline-flex items-center gap-1 shrink-0">
                <Zap size={10} />
                ~{item.responseMinutes} min
              </span>
            ) : null}
            {item.completedJobs && item.completedJobs > 0 ? (
              <span className="shrink-0">{item.completedJobs} jobs</span>
            ) : null}
            {item.averageRating && item.averageRating > 0 ? (
              <span className="inline-flex items-center gap-0.5 shrink-0">
                <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
                {item.averageRating.toFixed(1)}
              </span>
            ) : null}
            {item.urgent ? <span className="shrink-0 text-rose-600">Urgent</span> : null}
          </div>
        </div>

        {headerAction ? <div className="shrink-0 self-center">{headerAction}</div> : null}

        {isOwner ? (
          <div ref={ownerMenuRef} className="relative shrink-0 self-center">
            <button
              type="button"
              onClick={() => setOwnerMenuOpen((current) => !current)}
              disabled={ownerBusy}
              aria-label="Post options"
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50 sm:h-8 sm:w-8"
            >
              {ownerBusy ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={15} />}
            </button>

            {ownerMenuOpen && (ownerCanEdit || ownerCanArchive || ownerCanDelete) ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl">
                {ownerCanEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerMenuOpen(false);
                      onOwnerEdit?.();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Pencil size={14} className="text-slate-400" />
                    Edit post
                  </button>
                ) : null}

                {ownerCanArchive ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerMenuOpen(false);
                      onOwnerArchive?.();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                  >
                    <Archive size={14} className="text-amber-400" />
                    Archive post
                  </button>
                ) : null}

                {ownerCanDelete && (ownerCanEdit || ownerCanArchive) ? <div className="my-1 border-t border-slate-100" /> : null}

                {ownerCanDelete ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerMenuOpen(false);
                      onOwnerDelete?.();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <Trash2 size={14} />
                    {ownerDeleteLabel}
                  </button>
                ) : null}
              </div>
            ) : null}
          </div>
        ) : null}
      </header>

      <div className="mt-2.5">
        {hasMedia ? (
          <div data-testid="feed-card-main-image">
            <FeedMediaCarousel
              media={item.media}
              title={item.displayTitle}
              aspectClassName="aspect-[16/11] sm:aspect-[16/10]"
            />
          </div>
        ) : (
          <div
            data-testid="feed-card-main-image"
            className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_42%),linear-gradient(135deg,#ffffff_0%,#f8fafc_62%,#ecfeff_100%)] p-3 sm:rounded-[1.35rem] sm:p-3.5"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold sm:gap-2 sm:text-[11px]">
              {heroPills.map((pill) => (
                <span
                  key={`${item.id}:hero:${pill.label}`}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 ${pill.className}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>

            <div className={heroPills.length > 0 ? "mt-3" : ""}>
              <h3 className="break-words text-[15px] font-semibold leading-tight text-slate-950 [overflow-wrap:anywhere] sm:text-[1.02rem]">
                {item.displayTitle}
              </h3>
              <p
                className={`mt-1.5 break-words text-[13px] leading-5 text-slate-600 [overflow-wrap:anywhere] sm:text-sm sm:leading-6 ${
                  detailsExpanded ? "" : descriptionClampClassName
                }`}
              >
                {item.displayDescription}
              </p>
            </div>
          </div>
        )}
      </div>

      <div className="mt-2.5">
        {hasMedia ? (
          <>
            <h3 className="line-clamp-2 break-words text-[15px] font-semibold leading-tight text-slate-900 [overflow-wrap:anywhere] sm:text-[1.02rem]">
              {item.displayTitle}
            </h3>
            <p
              className={`mt-1.5 break-words text-[13px] leading-5 text-slate-600 [overflow-wrap:anywhere] sm:text-sm sm:leading-relaxed ${
                detailsExpanded ? "" : descriptionClampClassName
              }`}
            >
              {item.displayDescription}
            </p>
          </>
        ) : null}

        {visibleMetaPills.length > 0 ? (
          <div className="mt-2.5 flex flex-wrap gap-1.5">
            {visibleMetaPills.map((pill) => (
              <span
                key={`${item.id}:${pill.label}`}
                className={`inline-flex max-w-full items-center overflow-hidden rounded-full border px-2.5 py-1 text-[10px] font-semibold sm:text-[11px] ${pill.className}`}
                title={pill.label}
              >
                <span className="truncate">{pill.label}</span>
              </span>
            ))}
          </div>
        ) : null}

        {shouldShowDetailsToggle ? (
          <button
            type="button"
            onClick={() => setDetailsExpanded((expanded) => !expanded)}
            className="mt-2 inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-[var(--brand-700)] transition hover:border-[var(--brand-300)] hover:text-[var(--brand-800)]"
          >
            {detailsExpanded ? "Show less" : "Show more"}
          </button>
        ) : null}

        {item.locationLabel ? (
          <p
            className={`mt-2 items-start gap-1.5 text-[11px] text-slate-500 sm:text-xs ${
              detailsExpanded ? "flex" : "hidden sm:flex"
            }`}
          >
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {item.locationLabel}
            </span>
          </p>
        ) : null}

        {!isOwner ? (
          <TrustSnapshot
            items={[
              {
                label:
                  item.verificationStatus === "verified"
                    ? "Verified"
                    : item.reviewCount && item.reviewCount > 0
                      ? "Active profile"
                      : "New profile",
                tone:
                  item.verificationStatus === "verified"
                    ? "good"
                    : item.reviewCount && item.reviewCount > 0
                      ? "neutral"
                      : "caution",
              },
              item.averageRating && item.averageRating > 0
                ? {
                    label: `${item.averageRating.toFixed(1)} stars`,
                    tone: "good" as const,
                  }
                : {
                    label: "No ratings",
                    tone: "neutral" as const,
                  },
              item.completedJobs && item.completedJobs > 0
                ? {
                    label: `${item.completedJobs} jobs done`,
                    tone: "good" as const,
                  }
                : null,
              item.responseMinutes > 0
                ? {
                    label: `~${item.responseMinutes} min reply`,
                    tone:
                      item.responseMinutes <= 15
                        ? ("good" as const)
                        : ("neutral" as const),
                  }
                : null,
            ].filter((value): value is { label: string; tone: "neutral" | "good" | "caution" } => value !== null)}
            compact
            mobileItemLimit={2}
            className="mt-2"
          />
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:mt-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {primaryButton ? (
            <button
              type="button"
              data-testid="feed-action-primary"
              onClick={() => void onPrimaryAction(primaryButton.kind)}
              disabled={primaryButton.disabled || actionBusyState[primaryButton.kind]}
              aria-label={actionBusyState[primaryButton.kind] ? buttonBusyLabels[primaryButton.kind] : primaryButton.label}
              title={actionBusyState[primaryButton.kind] ? buttonBusyLabels[primaryButton.kind] : primaryButton.label}
              className={`inline-flex h-10 min-w-[8rem] items-center justify-center gap-1.5 rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                buttonToneClassNames[primaryButton.tone]
              }`}
            >
              {actionBusyState[primaryButton.kind] ? (
                <Loader2 size={16} className="animate-spin" />
              ) : primaryButton.kind === "send_quote" ? (
                <MessageCircle size={16} />
              ) : primaryButton.kind === "view_profile" ? (
                <ArrowUpRight size={16} />
              ) : primaryButton.kind === "discard" ? (
                <Trash2 size={16} />
              ) : primaryButton.kind === "decline" || primaryButton.kind === "withdraw" ? (
                <X size={16} />
              ) : (
                <Check size={16} />
              )}
              <span className="truncate">{primaryButton.label}</span>
            </button>
          ) : null}

          {sendQuoteButton ? (
            <button
              type="button"
              data-testid="feed-action-message"
              onClick={() => void onPrimaryAction(sendQuoteButton.kind)}
              disabled={sendQuoteButton.disabled || actionBusyState[sendQuoteButton.kind]}
              aria-label={actionBusyState[sendQuoteButton.kind] ? buttonBusyLabels[sendQuoteButton.kind] : sendQuoteButton.label}
              title={actionBusyState[sendQuoteButton.kind] ? buttonBusyLabels[sendQuoteButton.kind] : sendQuoteButton.label}
              className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              {actionBusyState[sendQuoteButton.kind] ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <MessageCircle size={16} />
              )}
              <span className="hidden sm:inline">{sendQuoteButton.label}</span>
            </button>
          ) : null}

          {openButton ? (
            <button
              type="button"
              data-testid="feed-action-network"
              onClick={() => void onPrimaryAction(openButton.kind)}
              disabled={openButton.disabled}
              aria-label={openButton.label}
              title={openButton.label}
              className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowUpRight size={16} />
              <span className="hidden sm:inline">{openButton.label}</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          {(["share", "save"] as const).map((actionKind) => {
            const busy = actionBusyState[actionKind];
            const isActive = actionKind === "save" ? saved : false;
            const Icon = isActive ? secondaryActionMeta[actionKind].activeIcon : secondaryActionMeta[actionKind].icon;
            const label = isActive ? secondaryActionMeta[actionKind].active : secondaryActionMeta[actionKind].idle;

            return (
              <button
                key={actionKind}
                type="button"
                data-testid={actionKind === "share" ? "feed-action-share" : "feed-action-save"}
                onClick={() => void onSecondaryAction(actionKind)}
                disabled={busy}
                aria-label={label}
                title={label}
                className={`inline-flex h-8 w-8 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 sm:h-9 sm:w-9 ${
                  isActive
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                }`}
              >
                {busy ? <Loader2 size={16} className="animate-spin" /> : <Icon size={16} />}
                <span className="sr-only">{label}</span>
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
