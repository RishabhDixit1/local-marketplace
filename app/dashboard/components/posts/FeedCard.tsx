"use client";

import { motion } from "framer-motion";
import {
  Bookmark,
  BookmarkCheck,
  CheckCircle2,
  ExternalLink,
  FileText,
  Loader2,
  MapPin,
  Send,
  Share2,
} from "lucide-react";
import type {
  MarketplaceCardActionButton,
  MarketplacePrimaryActionKind,
  MarketplaceSecondaryActionKind,
} from "@/lib/marketplaceCardActions";
import { normalizeMarketplaceStatusLabel, type MarketplaceDisplayFeedItem } from "@/lib/marketplaceFeed";
import FeedMediaCarousel from "@/app/dashboard/components/posts/FeedMediaCarousel";

type ActionBusyState = Record<MarketplacePrimaryActionKind | MarketplaceSecondaryActionKind, boolean>;

type FeedCardProps = {
  item: MarketplaceDisplayFeedItem;
  index: number;
  active: boolean;
  saved: boolean;
  buttons: MarketplaceCardActionButton<MarketplacePrimaryActionKind>[];
  iconActions: MarketplaceCardActionButton<MarketplaceSecondaryActionKind>[];
  actionBusyState: ActionBusyState;
  onPrimaryAction: (action: MarketplacePrimaryActionKind) => void | Promise<void>;
  onSecondaryAction: (action: MarketplaceSecondaryActionKind) => void | Promise<void>;
  onFocus: () => void;
  onHoverChange: (hovered: boolean) => void;
};

const buttonToneClassNames: Record<MarketplaceCardActionButton<MarketplacePrimaryActionKind>["tone"], string> = {
  primary: "border-slate-900 bg-slate-900 text-white hover:bg-slate-800",
  secondary: "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900",
  success: "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100",
  status: "border-slate-200 bg-slate-100 text-slate-500",
};

const buttonBusyLabels: Record<MarketplacePrimaryActionKind, string> = {
  accept: "Accepting",
  send_quote: "Opening",
  view_profile: "Opening",
};

const buttonIcon = (kind: MarketplacePrimaryActionKind, busy: boolean) => {
  if (busy) return <Loader2 size={14} className="animate-spin" />;
  if (kind === "accept") return <CheckCircle2 size={14} />;
  if (kind === "send_quote") return <FileText size={14} />;
  return <ExternalLink size={14} />;
};

const iconButtonLabel = {
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
    activeIcon: Send,
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

export default function FeedCard({
  item,
  index,
  active,
  saved,
  buttons,
  iconActions,
  actionBusyState,
  onPrimaryAction,
  onSecondaryAction,
  onFocus,
  onHoverChange,
}: FeedCardProps) {
  return (
    <motion.article
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.28, delay: Math.min(index * 0.03, 0.18) }}
      className={`overflow-hidden rounded-3xl border bg-white p-4 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.45)] transition-all ${
        active
          ? "border-[var(--brand-500)]/45 shadow-[0_28px_42px_-28px_rgba(14,165,164,0.48)]"
          : "border-slate-200"
      }`}
      onClickCapture={onFocus}
      onMouseEnter={() => onHoverChange(true)}
      onMouseLeave={() => onHoverChange(false)}
    >
      <header className="flex items-start gap-3">
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
            className="h-10 w-10 rounded-full border border-slate-200 object-cover"
          />
        </button>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              onClick={() => void onPrimaryAction("view_profile")}
              className="max-w-full truncate text-left text-sm font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-800)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
              aria-label={`Open ${item.displayCreator} profile`}
            >
              {item.displayCreator}
            </button>
            {item.verificationStatus === "verified" ? (
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                Verified
              </span>
            ) : null}
            {item.urgent ? (
              <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                Urgent
              </span>
            ) : null}
          </div>

          <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
            <span>{item.timeLabel}</span>
            <span className="inline-flex items-center gap-1">
              <MapPin size={11} />
              {item.distanceLabel}
            </span>
            <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
              {normalizeMarketplaceStatusLabel(item.status)}
            </span>
          </div>
        </div>
      </header>

      <div className="relative mt-3">
        <FeedMediaCarousel media={item.media} title={item.displayTitle} />

        <div className="absolute right-3 top-3 flex flex-col gap-2">
          {iconActions.map((action) => {
            const busy = actionBusyState[action.kind];
            const isActive = action.kind === "save" ? saved : false;
            const Icon = isActive ? iconButtonLabel[action.kind].activeIcon : iconButtonLabel[action.kind].icon;

            return (
              <button
                key={action.kind}
                type="button"
                onClick={() => void onSecondaryAction(action.kind)}
                disabled={busy}
                aria-label={isActive ? iconButtonLabel[action.kind].active : iconButtonLabel[action.kind].idle}
                className={`inline-flex h-10 w-10 items-center justify-center rounded-full border backdrop-blur-md transition disabled:cursor-not-allowed disabled:opacity-70 ${
                  isActive
                    ? "border-slate-900/10 bg-slate-900 text-white shadow-[0_14px_24px_-18px_rgba(15,23,42,0.8)]"
                    : "border-white/70 bg-white/90 text-slate-700 shadow-[0_16px_28px_-18px_rgba(15,23,42,0.55)] hover:bg-white"
                }`}
              >
                {busy ? <Loader2 size={15} className="animate-spin" /> : <Icon size={15} />}
              </button>
            );
          })}
        </div>
      </div>

      <div className="mt-3">
        <h3 className="line-clamp-2 text-base font-semibold leading-tight text-slate-900">{item.displayTitle}</h3>
        <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-600">{item.displayDescription}</p>

        <div className="mt-2 flex flex-wrap items-center gap-1.5 text-[11px]">
          <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1 font-semibold text-slate-600">
            {item.category}
          </span>
          <span className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 font-semibold text-indigo-700">
            {item.priceLabel}
          </span>
          <span className="rounded-full border border-slate-200 bg-white px-2 py-1 font-semibold text-slate-500">
            ~{item.responseMinutes} mins response
          </span>
        </div>
      </div>

      <div className="mt-4 grid grid-cols-3 gap-2">
        {buttons.map((button) => {
          const busy = actionBusyState[button.kind];

          return (
            <button
              key={button.kind}
              type="button"
              onClick={() => void onPrimaryAction(button.kind)}
              disabled={button.disabled || busy}
              className={`inline-flex min-h-11 items-center justify-center gap-1 rounded-2xl border px-2 text-[12px] font-semibold transition disabled:cursor-not-allowed disabled:opacity-70 ${
                buttonToneClassNames[button.tone]
              }`}
            >
              {buttonIcon(button.kind, busy)}
              <span>{busy ? buttonBusyLabels[button.kind] : button.label}</span>
            </button>
          );
        })}
      </div>
    </motion.article>
  );
}
