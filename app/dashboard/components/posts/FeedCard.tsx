"use client";

import { motion } from "framer-motion";
import type { ReactNode } from "react";
import { useEffect, useRef, useState } from "react";
import {
  Archive,
  Bookmark,
  BookmarkCheck,
  Check,
  Loader2,
  MapPin,
  MoreVertical,
  Pencil,
  Share2,
  Sparkles,
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
  ownerBusy,
}: FeedCardProps) {
  const [ownerMenuOpen, setOwnerMenuOpen] = useState(false);
  const ownerMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!ownerMenuOpen) return;
    const handler = (e: MouseEvent) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(e.target as Node)) {
        setOwnerMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [ownerMenuOpen]);

  const acceptButton = buttons.find((button) => button.kind === "accept" || button.kind === "decline");
  const sendQuoteButton = buttons.find((button) => button.kind === "send_quote");
  const discardButton = buttons.find((button) => button.kind === "discard");
  const trustItems = [
    {
      label: verificationLabels[item.verificationStatus],
      tone:
        item.verificationStatus === "verified"
          ? ("good" as const)
          : item.verificationStatus === "pending"
          ? ("neutral" as const)
          : ("caution" as const),
    },
    item.reviewCount && item.reviewCount > 0
      ? {
          label: `${item.reviewCount} review${item.reviewCount === 1 ? "" : "s"}`,
          tone: "good" as const,
        }
      : {
          label: "New marketplace profile",
          tone: "neutral" as const,
        },
    item.responseMinutes > 0
      ? {
          label: `~${item.responseMinutes} min reply`,
          tone: item.responseMinutes <= 15 ? ("good" as const) : ("neutral" as const),
        }
      : {
          label: "Reply speed building",
          tone: "caution" as const,
        },
    {
      label: item.coordinateAccuracy === "precise" ? "Exact area shared" : "Area shown approximately",
      tone: item.coordinateAccuracy === "precise" ? ("good" as const) : ("neutral" as const),
    },
  ];

  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.18) }}
      className={`overflow-hidden rounded-3xl border bg-white p-3.5 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.45)] transition-all ${
        active
          ? "border-[var(--brand-500)]/45 shadow-[0_28px_42px_-28px_rgba(14,165,164,0.48)]"
          : "border-slate-200"
      }`}
      onClickCapture={onFocus}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <header className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => void onPrimaryAction("view_profile")}
          className="relative shrink-0 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
          aria-label={`Open ${item.displayCreator} profile`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={item.avatarUrl}
            alt={`${item.displayCreator} avatar`}
            className="h-11 w-11 rounded-full border border-slate-200 object-cover"
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => void onPrimaryAction("view_profile")}
              className="min-w-0 max-w-full truncate text-left text-base font-semibold text-slate-900 transition hover:text-[var(--brand-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
              aria-label={`Open ${item.displayCreator} profile`}
            >
              {item.displayCreator}
            </button>
            {item.verificationStatus === "verified" ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Verified
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex items-center gap-2 overflow-hidden text-[11px] text-slate-500">
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
              onClick={() => setOwnerMenuOpen((p) => !p)}
              disabled={ownerBusy}
              aria-label="Post options"
              className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
            >
              {ownerBusy ? <Loader2 size={15} className="animate-spin" /> : <MoreVertical size={15} />}
            </button>
            {ownerMenuOpen && (
              <div className="absolute right-0 top-full z-50 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl">
                <button
                  type="button"
                  onClick={() => { setOwnerMenuOpen(false); onOwnerEdit?.(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Pencil size={14} className="text-slate-400" />
                  Edit post
                </button>
                <button
                  type="button"
                  onClick={() => { setOwnerMenuOpen(false); onOwnerArchive?.(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-slate-700 transition hover:bg-slate-50"
                >
                  <Archive size={14} className="text-amber-400" />
                  Archive post
                </button>
                <div className="my-1 border-t border-slate-100" />
                <button
                  type="button"
                  onClick={() => { setOwnerMenuOpen(false); onOwnerDelete?.(); }}
                  className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                >
                  <Trash2 size={14} />
                  Delete post
                </button>
              </div>
            )}
          </div>
        ) : null}
      </header>

      <div className="mt-2.5">
        <FeedMediaCarousel media={item.media} title={item.displayTitle} />
      </div>

      <div className="mt-2.5">
        <h3 className="line-clamp-3 text-base font-semibold leading-tight text-slate-900 sm:line-clamp-2">{item.displayTitle}</h3>
        <p className="mt-1.5 line-clamp-4 text-sm leading-relaxed text-slate-600">{item.displayDescription}</p>
        <TrustSnapshot items={trustItems} compact className="mt-3" />
        <div className="mt-2.5 flex flex-wrap gap-1.5">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              item.type === "demand"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : item.type === "service"
                ? "border-cyan-200 bg-cyan-50 text-[var(--brand-700)]"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {item.type === "demand" ? "Need" : item.type === "service" ? "Service" : "Product"}
          </span>
          <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2.5 py-1 text-[11px] font-semibold text-slate-700">
            {item.category}
          </span>
          <span className="inline-flex items-center rounded-full border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-[11px] font-semibold text-cyan-700">
            {item.priceLabel}
          </span>
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[11px] font-semibold ${
              item.urgent
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-emerald-200 bg-emerald-50 text-emerald-700"
            }`}
          >
            {item.urgent ? "Urgent" : "Standard"}
          </span>
        </div>
      </div>

      <div className="mt-3 flex items-center gap-1.5">
        {acceptButton ? (
          <button
            type="button"
            onClick={() => void onPrimaryAction(acceptButton.kind)}
            disabled={acceptButton.disabled || actionBusyState[acceptButton.kind]}
            aria-label={actionBusyState[acceptButton.kind] ? buttonBusyLabels[acceptButton.kind] : acceptButton.label}
            title={actionBusyState[acceptButton.kind] ? buttonBusyLabels[acceptButton.kind] : acceptButton.label}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
              buttonToneClassNames[acceptButton.tone]
            }`}
          >
            {actionBusyState[acceptButton.kind] ? (
              <Loader2 size={16} className="animate-spin" />
            ) : acceptButton.kind === "decline" ? (
              <X size={16} />
            ) : (
              <Check size={16} />
            )}
          </button>
        ) : null}

        {sendQuoteButton ? (
          <button
            type="button"
            onClick={() => void onPrimaryAction("send_quote")}
            disabled={sendQuoteButton.disabled || actionBusyState.send_quote}
            aria-label={actionBusyState.send_quote ? buttonBusyLabels.send_quote : sendQuoteButton.label}
            title={actionBusyState.send_quote ? buttonBusyLabels.send_quote : sendQuoteButton.label}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
              buttonToneClassNames[sendQuoteButton.tone]
            }`}
          >
            {actionBusyState.send_quote ? <Loader2 size={16} className="animate-spin" /> : <Sparkles size={16} />}
          </button>
        ) : null}

        {discardButton ? (
          <button
            type="button"
            onClick={() => void onPrimaryAction("discard")}
            disabled={discardButton.disabled || actionBusyState.discard}
            aria-label={actionBusyState.discard ? buttonBusyLabels.discard : discardButton.label}
            title={actionBusyState.discard ? buttonBusyLabels.discard : discardButton.label}
            className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
              buttonToneClassNames[discardButton.tone]
            }`}
          >
            {actionBusyState.discard ? <Loader2 size={16} className="animate-spin" /> : <Trash2 size={16} />}
          </button>
        ) : null}

        <div className="ml-auto flex items-center gap-1.5">
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
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
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

      {/* Creator + location footer */}
      {item.locationLabel ? (
        <p className="mt-2 truncate text-[11px] text-slate-400">
          {item.displayCreator}
          {item.locationLabel ? ` · ${item.locationLabel}` : ""}
        </p>
      ) : null}
    </motion.article>
  );
}
