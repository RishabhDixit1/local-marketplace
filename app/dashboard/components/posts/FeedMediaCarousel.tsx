"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MarketplaceFeedMedia } from "@/lib/marketplaceFeed";

type FeedMediaCarouselProps = {
  media: MarketplaceFeedMedia[];
  title: string;
  showCountBadge?: boolean;
  aspectClassName?: string;
  className?: string;
};

export default function FeedMediaCarousel({
  media,
  title,
  showCountBadge = true,
  aspectClassName = "aspect-[16/9]",
  className = "",
}: FeedMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [imgError, setImgError] = useState(false);

  if (!media.length) {
    return null;
  }

  const safeIndex = Math.min(activeIndex, media.length - 1);
  const current = media[safeIndex];
  const canNavigate = media.length > 1;

  const goNext = () => {
    setImgError(false);
    setActiveIndex((currentIndex) => {
      const normalized = Math.min(currentIndex, media.length - 1);
      return (normalized + 1) % media.length;
    });
  };

  const goPrev = () => {
    setImgError(false);
    setActiveIndex((currentIndex) => {
      const normalized = Math.min(currentIndex, media.length - 1);
      return (normalized - 1 + media.length) % media.length;
    });
  };

  return (
    <div
      className={`relative overflow-hidden rounded-[1.2rem] border border-slate-200 bg-slate-100 sm:rounded-[1.4rem] ${className}`.trim()}
    >
      <div className={`w-full ${aspectClassName} max-h-[16.5rem] sm:max-h-[19rem] lg:max-h-[21rem]`}>
        {current.mimeType.startsWith("image/") && !current.mimeType.startsWith("image/svg") ? (
          imgError ? (
            <div className="grid h-full place-items-center bg-gradient-to-br from-slate-50 via-white to-slate-100 text-center">
              <p className="text-xs font-semibold text-slate-500">Image unavailable</p>
            </div>
          ) : (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={current.url}
              alt={title}
              loading={safeIndex === 0 ? "eager" : "lazy"}
              decoding="async"
              fetchPriority={safeIndex === 0 ? "high" : "auto"}
              className="h-full w-full object-cover"
              onError={() => setImgError(true)}
            />
          )
        ) : current.mimeType.startsWith("video/") ? (
          <video src={current.url} controls playsInline preload="metadata" className="h-full w-full object-cover" />
        ) : current.mimeType.startsWith("audio/") ? (
          <div className="grid h-full place-items-center bg-slate-900 p-4 text-center">
            <div className="w-full max-w-xs space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Audio Attachment</p>
              <audio src={current.url} controls className="w-full" preload="metadata" />
            </div>
          </div>
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-cyan-50 via-white to-slate-100 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Media Preview</p>
          </div>
        )}
      </div>

      {canNavigate ? (
        <>
          <button
            type="button"
            onClick={goPrev}
            className="absolute left-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white sm:h-8 sm:w-8"
            aria-label="Previous media"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 inline-flex h-7 w-7 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white sm:h-8 sm:w-8"
            aria-label="Next media"
          >
            <ChevronRight size={14} />
          </button>
        </>
      ) : null}

      {showCountBadge ? (
        <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-slate-900/70 px-2 py-1 text-[10px] font-semibold text-white sm:px-2.5 sm:text-[11px]">
          {safeIndex + 1} / {media.length}
        </div>
      ) : null}
    </div>
  );
}
