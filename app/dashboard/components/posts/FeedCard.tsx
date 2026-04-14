"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
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
  Trash2,
  X,
} from "lucide-react";
import type {
  MarketplaceCardActionButton,
  MarketplacePrimaryActionKind,
  MarketplaceSecondaryActionKind,
} from "@/lib/marketplaceCardActions";
import type { MarketplaceDisplayFeedItem } from "@/lib/marketplaceFeed";
import FeedMediaCarousel from "@/app/dashboard/components/posts/FeedMediaCarousel";
import TrustSnapshot from "@/app/components/trust/TrustSnapshot";

type ActionBusyState = Record<MarketplacePrimaryActionKind | MarketplaceSecondaryActionKind, boolean>;

type FeedCardProps = {
  item: MarketplaceDisplayFeedItem;
  index: number;
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

const verificationLabels: Record<MarketplaceDisplayFeedItem["verificationStatus"], string> = {
  verified: "Verified profile",
  pending: "Checks in progress",
  unclaimed: "Unclaimed profile",
};

const formatTrustRating = (rating: number) => `${rating.toFixed(1)} stars`;
type TrustItem = {
  label: string;
  tone: "neutral" | "good" | "caution";
};

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
}: FeedCardProps) {
  void index;
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement>(null);
  const hasMedia = item.media.length > 0;

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
  const discardButton = buttons.find((button) => button.kind === "discard");
  const reviewCount = item.reviewCount ?? 0;
  const completedJobs = item.completedJobs ?? 0;
  const responseMin = item.responseMinutes ?? 0;
  const ownerCanEdit = typeof onOwnerEdit === "function";
  const ownerCanArchive = typeof onOwnerArchive === "function";
  const ownerCanDelete = typeof onOwnerDelete === "function";
  const responseSignal =
    responseMin > 0 && responseMin < 60
      ? { label: "Replies within 1 hr", tone: "good" as const }
      : responseMin >= 60 && responseMin < 1440
      ? { label: "Same-day replies", tone: "neutral" as const }
      : null;
  const trustItems = [
    item.verificationStatus === "verified"
      ? {
          label: verificationLabels[item.verificationStatus],
          tone: "good" as const,
        }
      : item.verificationStatus === "pending"
      ? {
          label: verificationLabels[item.verificationStatus],
          tone: "neutral" as const,
        }
      : null,
    reviewCount > 0 && typeof item.averageRating === "number" && Number.isFinite(item.averageRating)
      ? {
          label: `${formatTrustRating(item.averageRating)} (${reviewCount})`,
          tone: "good" as const,
        }
      : completedJobs > 0
      ? {
          label: `${completedJobs} completed job${completedJobs === 1 ? "" : "s"}`,
          tone: completedJobs >= 5 ? ("good" as const) : ("neutral" as const),
        }
      : {
          label: "New to marketplace",
          tone: "neutral" as const,
        },
    responseSignal,
  ].filter(Boolean) as TrustItem[];

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
    !!item.locationLabel ||
    trustItems.length > 2;

  return (
    <article
      data-testid="feed-card"
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
          <Image
            src={item.avatarUrl}
            alt={`${item.displayCreator} avatar`}
            width={40}
            height={40}
            loading="lazy"
            quality={70}
            className="h-9 w-9 rounded-full border border-slate-200 object-cover sm:h-10 sm:w-10"
          />
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
          <FeedMediaCarousel
            media={item.media}
            title={item.displayTitle}
            aspectClassName="aspect-[16/11] sm:aspect-[16/10]"
          />
        ) : (
          <div className="overflow-hidden rounded-[1.15rem] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_42%),linear-gradient(135deg,#ffffff_0%,#f8fafc_62%,#ecfeff_100%)] p-3 sm:rounded-[1.35rem] sm:p-3.5">
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

        <TrustSnapshot
          items={trustItems}
          compact
          className="mt-2.5 sm:mt-3"
          mobileItemLimit={detailsExpanded ? trustItems.length : 2}
        />

        {item.locationLabel ? (
          <p
            className={`mt-2 items-start gap-1.5 text-[11px] text-slate-400 sm:text-xs ${
              detailsExpanded ? "flex" : "hidden sm:flex"
            }`}
          >
            <MapPin size={12} className="mt-0.5 shrink-0" />
            <span className="min-w-0 break-words [overflow-wrap:anywhere]">
              {item.locationLabel}
            </span>
          </p>
        ) : null}
      </div>

      <div className="mt-3 flex flex-col gap-2 sm:mt-3.5 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-2">
          {acceptButton ? (
            <button
              type="button"
              onClick={() => void onPrimaryAction(acceptButton.kind)}
              disabled={acceptButton.disabled || actionBusyState[acceptButton.kind]}
              aria-label={actionBusyState[acceptButton.kind] ? buttonBusyLabels[acceptButton.kind] : acceptButton.label}
              title={actionBusyState[acceptButton.kind] ? buttonBusyLabels[acceptButton.kind] : acceptButton.label}
              className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 max-sm:w-9 max-sm:px-0 max-sm:py-0 sm:h-10 sm:min-h-10 sm:rounded-2xl sm:px-4 sm:text-sm ${
                buttonToneClassNames[acceptButton.tone]
              }`}
            >
              {actionBusyState[acceptButton.kind] ? (
                <Loader2 size={16} className="animate-spin" />
              ) : acceptButton.kind === "decline" || acceptButton.kind === "withdraw" ? (
                <X size={16} />
              ) : (
                <Check size={16} />
              )}
              <span className="hidden truncate sm:inline">{acceptButton.label}</span>
            </button>
          ) : null}

          {sendQuoteButton ? (
            <button
              type="button"
              onClick={() => void onPrimaryAction("send_quote")}
              disabled={sendQuoteButton.disabled || actionBusyState.send_quote}
              aria-label={actionBusyState.send_quote ? buttonBusyLabels.send_quote : sendQuoteButton.label}
              title={actionBusyState.send_quote ? buttonBusyLabels.send_quote : sendQuoteButton.label}
              className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 max-sm:w-9 max-sm:px-0 max-sm:py-0 sm:h-10 sm:min-h-10 sm:rounded-2xl sm:px-4 sm:text-sm ${
                buttonToneClassNames[sendQuoteButton.tone]
              }`}
            >
              {actionBusyState.send_quote ? <Loader2 size={16} className="animate-spin" /> : <MessageCircle size={16} />}
              <span className="hidden truncate sm:inline">{sendQuoteButton.label}</span>
            </button>
          ) : null}

          {discardButton ? (
            <button
              type="button"
              onClick={() => void onPrimaryAction("discard")}
              disabled={discardButton.disabled || actionBusyState.discard}
              aria-label={actionBusyState.discard ? buttonBusyLabels.discard : discardButton.label}
              title={actionBusyState.discard ? buttonBusyLabels.discard : discardButton.label}
              className={`inline-flex h-9 min-w-9 items-center justify-center gap-1.5 rounded-xl border px-3 py-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 max-sm:w-9 max-sm:px-0 max-sm:py-0 sm:h-10 sm:min-h-10 sm:rounded-2xl sm:px-4 sm:text-sm ${
                buttonToneClassNames[discardButton.tone]
              }`}
            >
              {actionBusyState.discard ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
              <span className="hidden truncate sm:inline">{discardButton.label}</span>
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
              </button>
            );
          })}
        </div>
      </div>
    </article>
  );
}
