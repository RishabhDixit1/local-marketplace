"use client";

import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import { SafeImage, InitialsAvatar } from "@/app/components/ui/SafeImage";
import {
  ArrowUpRight,
  Archive,
  Bookmark,
  BookmarkCheck,
  Check,
  EyeOff,
  Flag,
  Loader2,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  MoreVertical,
  Pencil,
  Share2,
  Trash2,
  X,
} from "lucide-react";
import { Card } from "@/app/components/ui/Card";
import TrustSnapshot from "@/app/components/trust/TrustSnapshot";
import type {
  MarketplaceCardActionButton,
  MarketplacePrimaryActionKind,
  MarketplaceSecondaryActionKind,
} from "@/lib/marketplaceCardActions";
import {
  type LoopType,
  statusChipColorClass,
} from "@/lib/marketplaceFeed";
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
  overflowButtons?: MarketplaceCardActionButton<MarketplaceSecondaryActionKind>[];
};

const buttonToneClassNames: Record<MarketplaceCardActionButton<MarketplacePrimaryActionKind>["tone"], string> = {
  primary: "border-[var(--ink-950)] bg-[var(--ink-950)] text-[var(--ink-50)] hover:bg-[var(--ink)]",
  secondary: "border-[var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--ink-700)] hover:border-[var(--border-strong)] hover:text-[var(--ink-950)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white",
  success: "border-emerald-200 dark:border-emerald-800 bg-emerald-50 dark:bg-emerald-950/50 text-emerald-700 dark:text-emerald-300 hover:bg-emerald-100 dark:hover:bg-emerald-900/50",
  status: "border-[var(--surface-border)] bg-[var(--surface-soft)] text-[var(--ink-500)] dark:border-slate-700 dark:bg-slate-800 dark:text-slate-400",
  destructive: "border-rose-200 dark:border-rose-800 bg-rose-50 dark:bg-rose-950/50 text-rose-700 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/50",
};

const buttonBusyLabels: Record<MarketplacePrimaryActionKind, string> = {
  accept: "Accepting",
  withdraw: "Withdrawing",
  decline: "Declining",
  send_quote: "Opening",
  view_profile: "Opening",
  discard: "Discarding",
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
  testId = "feed-card",
  overflowButtons = [],
}: FeedCardProps) {
  void index;
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const [detailsExpanded, setDetailsExpanded] = useState(false);
  const [overflowMenuOpen, setOverflowMenuOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement>(null);
  const overflowMenuRef = useRef<HTMLDivElement>(null);
  const hasMedia = item.media.length > 0;
  const loopType: LoopType = item.loopType;
  const isDirectBooking = loopType === "direct_booking";

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

  useEffect(() => {
    if (!overflowMenuOpen) return;

    const handler = (event: MouseEvent) => {
      if (overflowMenuRef.current && !overflowMenuRef.current.contains(event.target as Node)) {
        setOverflowMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [overflowMenuOpen]);

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
    <Card
      variant="elevated"
      radius="xl"
      radiusSm="2xl"
      padding="sm"
      isActive={active}
      data-testid={testId}
      data-card-id={item.id}
      className={`flex h-full w-full min-w-0 flex-col overflow-hidden border-l-2 ${
        isDirectBooking
          ? "border-l-[var(--brand-500)]"
          : "border-l-[var(--color-warm)]"
      }`}
      onClickCapture={onFocus}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <header className="flex shrink-0 items-start gap-2.5 sm:gap-3">
        <button
          type="button"
          onClick={() => void onPrimaryAction("view_profile")}
          className="relative h-9 w-9 shrink-0 overflow-hidden rounded-full border border-slate-200 dark:border-slate-700 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 sm:h-10 sm:w-10"
          aria-label={`Open ${item.displayCreator} profile`}
        >
          <SafeImage
            src={item.avatarUrl}
            alt={`${item.displayCreator} avatar`}
            width={40}
            height={40}
            sizes="40px"
            className="h-full w-full object-cover"
            fallback={<InitialsAvatar name={item.displayCreator} size="sm" />}
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void onPrimaryAction("view_profile")}
              className="min-w-0 max-w-full truncate text-left text-[14px] font-semibold text-slate-900 dark:text-white transition hover:text-[var(--brand-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2 sm:text-[15px]"
              aria-label={`Open ${item.displayCreator} profile`}
            >
              {item.displayCreator}
            </button>
            {item.verificationStatus === "verified" ? (
              <span className="relative overflow-hidden rounded-full border border-emerald-200 bg-emerald-50 px-1.5 py-0.5 text-[9px] font-semibold text-emerald-700 sm:px-2 sm:text-[10px]">
                Verified
                <span className="absolute inset-0 animate-pulse rounded-full bg-gradient-to-r from-transparent via-white/40 to-transparent" />
              </span>
            ) : null}
          </div>

          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 text-[10px] text-slate-500 dark:text-slate-400 sm:text-[11px]">
            <span>{item.timeLabel}</span>
            <span className="inline-flex min-w-0 items-center gap-1 truncate">
              <MapPin size={11} />
              {item.distanceLabel}
            </span>
            {item.urgent ? <span className="shrink-0 font-semibold text-rose-600">Urgent</span> : null}
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
              className="inline-flex h-7 w-7 items-center justify-center rounded-full text-slate-400 dark:text-slate-500 transition hover:bg-slate-100 hover:text-slate-600 dark:hover:bg-slate-700 dark:hover:text-slate-300 disabled:opacity-50 sm:h-8 sm:w-8"
            >
              {ownerBusy ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={15} />}
            </button>

            {ownerMenuOpen && (ownerCanEdit || ownerCanArchive || ownerCanDelete) ? (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-2xl">
                {ownerCanEdit ? (
                  <button
                    type="button"
                    onClick={() => {
                      setOwnerMenuOpen(false);
                      onOwnerEdit?.();
                    }}
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Pencil size={14} className="text-slate-400 dark:text-slate-500" />
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
                    className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <Archive size={14} className="text-amber-400" />
                    Archive post
                  </button>
                ) : null}

                {ownerCanDelete && (ownerCanEdit || ownerCanArchive) ? <div className="my-1 border-t border-slate-100 dark:border-slate-700" /> : null}

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

      <div className="mt-2 flex items-center gap-1.5 flex-wrap">
        <span
          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wider sm:text-[10px] ${
            isDirectBooking
              ? "border border-[var(--brand-500)]/30 bg-[var(--brand-500)]/10 text-[var(--brand-700)]"
              : "border border-[var(--color-warm)]/30 bg-[var(--color-warm)]/10 text-amber-700"
          }`}
        >
          {isDirectBooking ? "Order" : "Requirement"}
        </span>
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[9px] font-semibold sm:text-[10px] ${statusChipColorClass(item.status)}`}
        >
          {item.statusChipText}
        </span>
      </div>

      <div className="mt-1.5 flex min-w-0 min-h-0 flex-1 flex-col">
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
            className="overflow-hidden rounded-[1.15rem] border border-slate-200 dark:border-slate-700 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_42%),linear-gradient(135deg,#ffffff_0%,#f8fafc_62%,#ecfeff_100%)] dark:bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.14),transparent_42%),linear-gradient(135deg,#1e293b_0%,#0f172a_62%,#0c2427_100%)] p-3 pb-3.5 sm:rounded-[1.35rem] sm:p-3.5"
          >
            <div className="flex flex-wrap items-center gap-1.5 text-[10px] font-semibold sm:gap-2 sm:text-[11px]">
              {heroPills.map((pill, pillIdx) => (
                <span
                  key={`${item.id}:hero:${pillIdx}`}
                  className={`inline-flex items-center rounded-full border px-2.5 py-1 ${pill.className}`}
                >
                  {pill.label}
                </span>
              ))}
            </div>

            <div className={heroPills.length > 0 ? "mt-3" : ""}>
              <h3 className="break-words text-[15px] font-semibold leading-tight text-slate-950 dark:text-white [overflow-wrap:anywhere] sm:text-[1.02rem]">
                {item.displayTitle}
              </h3>
              <p
                className={`mt-1.5 break-words text-[13px] leading-5 text-slate-600 dark:text-slate-400 [overflow-wrap:anywhere] sm:text-sm sm:leading-6 ${
                  detailsExpanded ? "" : descriptionClampClassName
                }`}
              >
                {item.displayDescription}
              </p>
            </div>
          </div>
        )}

        <div className={hasMedia ? "mt-2" : "mt-0"}>
          {hasMedia ? (
            <>
              <h3 className="line-clamp-2 break-words text-[15px] font-semibold leading-tight text-slate-900 dark:text-white [overflow-wrap:anywhere] sm:text-[1.02rem]">
                {item.displayTitle}
              </h3>
              <p
                className={`mt-1.5 break-words text-[13px] leading-5 text-slate-600 dark:text-slate-400 [overflow-wrap:anywhere] sm:text-sm sm:leading-relaxed ${
                  detailsExpanded ? "" : descriptionClampClassName
                }`}
              >
                {item.displayDescription}
              </p>
            </>
          ) : null}

          {visibleMetaPills.length > 0 ? (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {visibleMetaPills.map((pill, pillIdx) => (
                <span
                  key={`${item.id}:${pillIdx}`}
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
              className="mt-2 inline-flex items-center rounded-full border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-1 text-[11px] font-semibold text-[var(--brand-700)] transition hover:border-[var(--brand-300)] hover:text-[var(--brand-800)]"
            >
              {detailsExpanded ? "Show less" : "Show more"}
            </button>
          ) : null}

          {item.locationLabel ? (
            <p
              className={`mt-1.5 items-start gap-1.5 text-[11px] text-slate-500 dark:text-slate-400 sm:text-xs ${
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
              className="mt-1.5"
            />
          ) : null}
        </div>
      </div>

      <div className="mt-auto flex flex-col gap-2 pt-2.5 sm:flex-row sm:items-center sm:justify-between sm:pt-3">
        <div className="flex flex-wrap items-center gap-2">
          {primaryButton ? (() => {
            const isBusy = actionBusyState[primaryButton.kind];
            const getLoopLabel = () => {
              if (isBusy) return buttonBusyLabels[primaryButton.kind];
              if (isDirectBooking) {
                if (primaryButton.kind === "accept" && !primaryButton.disabled) return "Book Now";
                if (primaryButton.kind === "accept" && primaryButton.label === "Taken") return "Booked";
                if (primaryButton.kind === "send_quote") return "View Order";
                if (primaryButton.kind === "decline" || primaryButton.kind === "withdraw") return "Cancel";
              } else {
                if (primaryButton.kind === "accept" && !primaryButton.disabled) return "Respond";
                if (primaryButton.kind === "accept" && primaryButton.label === "Taken") return "Matched";
                if (primaryButton.kind === "send_quote") return "View Responses";
                if (primaryButton.kind === "decline" || primaryButton.kind === "withdraw") return "Withdraw";
              }
              return primaryButton.label;
            };
            const displayLabel = getLoopLabel();
            return (
              <button
                type="button"
                data-testid="feed-action-primary"
                onClick={() => void onPrimaryAction(primaryButton.kind)}
                disabled={primaryButton.disabled || isBusy}
                aria-label={displayLabel}
                title={displayLabel}
                className={`inline-flex h-10 min-w-[8rem] items-center justify-center gap-1.5 rounded-2xl border px-4 py-2 text-sm font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  buttonToneClassNames[primaryButton.tone]
                }`}
              >
                {isBusy ? (
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
                <span className="truncate">{displayLabel}</span>
              </button>
            );
          })() : null}

          {sendQuoteButton && primaryButton !== sendQuoteButton ? (
            <button
              type="button"
              data-testid="feed-action-message"
              onClick={() => void onPrimaryAction(sendQuoteButton.kind)}
              disabled={sendQuoteButton.disabled || actionBusyState[sendQuoteButton.kind]}
              aria-label={actionBusyState[sendQuoteButton.kind] ? buttonBusyLabels[sendQuoteButton.kind] : sendQuoteButton.label}
              title={actionBusyState[sendQuoteButton.kind] ? buttonBusyLabels[sendQuoteButton.kind] : sendQuoteButton.label}
              className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              {actionBusyState[sendQuoteButton.kind] ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <MessageCircle size={16} />
              )}
              <span className="hidden sm:inline">{sendQuoteButton.label}</span>
            </button>
          ) : null}

          {openButton && primaryButton !== openButton ? (
            <button
              type="button"
              data-testid="feed-action-network"
              onClick={() => void onPrimaryAction(openButton.kind)}
              disabled={openButton.disabled}
              aria-label={openButton.label}
              title={openButton.label}
              className="inline-flex h-10 min-w-10 items-center justify-center gap-1.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 px-3 py-2 text-sm font-semibold text-slate-700 dark:text-slate-300 transition hover:border-slate-300 dark:hover:border-slate-600 hover:text-slate-900 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-70"
            >
              <ArrowUpRight size={16} />
              <span className="hidden sm:inline">{openButton.label}</span>
            </button>
          ) : null}
        </div>

        <div className="flex items-center gap-1.5 self-end sm:self-auto">
          <button
            type="button"
            data-testid="feed-action-share"
            onClick={() => void onSecondaryAction("share")}
            disabled={actionBusyState.share}
            aria-label="Share post"
            title="Share post"
            className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white disabled:cursor-not-allowed disabled:opacity-70 sm:h-9 sm:w-9"
          >
            {actionBusyState.share ? <Loader2 size={16} className="animate-spin" /> : <Share2 size={16} />}
            <span className="sr-only">Share post</span>
          </button>

          {overflowButtons.length > 0 ? (
            <div ref={overflowMenuRef} className="relative">
              <button
                type="button"
                onClick={() => setOverflowMenuOpen((current) => !current)}
                aria-label="More actions"
                title="More actions"
                className="inline-flex h-8 w-8 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900 dark:border-slate-700 dark:bg-slate-800 dark:text-slate-300 dark:hover:border-slate-600 dark:hover:text-white sm:h-9 sm:w-9"
              >
                <MoreHorizontal size={16} />
              </button>

              {overflowMenuOpen ? (
                <div className="absolute bottom-full right-0 z-50 mb-1 w-36 overflow-hidden rounded-2xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 py-1 shadow-2xl">
                  <button
                    type="button"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      void onSecondaryAction("save");
                    }}
                    disabled={actionBusyState.save}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    {saved ? <BookmarkCheck size={14} className="text-slate-400" /> : <Bookmark size={14} className="text-slate-400" />}
                    {saved ? "Unsave" : "Save"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      void onSecondaryAction("hide");
                    }}
                    disabled={actionBusyState.hide}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-slate-700 dark:text-slate-300 transition hover:bg-slate-50 dark:hover:bg-slate-700"
                  >
                    <EyeOff size={14} className="text-slate-400" />
                    Hide
                  </button>
                  <div className="my-1 border-t border-slate-100 dark:border-slate-700" />
                  <button
                    type="button"
                    onClick={() => {
                      setOverflowMenuOpen(false);
                      void onSecondaryAction("report");
                    }}
                    disabled={actionBusyState.report}
                    className="flex w-full items-center gap-2.5 px-3.5 py-2 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                  >
                    <Flag size={14} />
                    Report
                  </button>
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </div>
    </Card>
  );
}
