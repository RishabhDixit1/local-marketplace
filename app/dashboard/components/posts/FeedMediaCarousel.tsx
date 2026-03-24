"use client";

import { useState } from "react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import type { MarketplaceFeedMedia } from "@/lib/marketplaceFeed";

type FeedMediaCarouselProps = {
  media: MarketplaceFeedMedia[];
  title: string;
};

export default function FeedMediaCarousel({ media, title }: FeedMediaCarouselProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  if (!media.length) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 via-white to-cyan-50 text-center">
        <div>
          <p className="text-xs font-semibold text-slate-600">No media yet</p>
          <p className="mt-1 text-[11px] text-slate-500">This post does not include image or video attachments.</p>
        </div>
      </div>
    );
  }

  const safeIndex = Math.min(activeIndex, media.length - 1);
  const current = media[safeIndex];
  const canNavigate = media.length > 1;

  const goNext = () => {
    setActiveIndex((currentIndex) => {
      const normalized = Math.min(currentIndex, media.length - 1);
      return (normalized + 1) % media.length;
    });
  };

  const goPrev = () => {
    setActiveIndex((currentIndex) => {
      const normalized = Math.min(currentIndex, media.length - 1);
      return (normalized - 1 + media.length) % media.length;
    });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div className="aspect-[16/9]">
        {current.mimeType.startsWith("image/") && !current.mimeType.startsWith("image/svg") ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={current.url} alt={title} className="h-full w-full object-cover" />
        ) : current.mimeType.startsWith("video/") ? (
          <video src={current.url} controls preload="metadata" className="h-full w-full object-cover" />
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
            className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            aria-label="Previous media"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={goNext}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/70 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            aria-label="Next media"
          >
            <ChevronRight size={14} />
          </button>
        </>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-white">
        {safeIndex + 1} / {media.length}
      </div>
    </div>
  );
}
