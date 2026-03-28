"use client";

import { useEffect, useMemo, useState } from "react";
import { Clock3, MapPin } from "lucide-react";
import { watchBrowserCoordinates, type BrowserCoordinateStatus, type Coordinates } from "@/lib/geo";

const statusLabel: Record<BrowserCoordinateStatus, string> = {
  idle: "Locating",
  locating: "Locating",
  ready: "Live",
  denied: "Location off",
  unsupported: "No GPS",
  error: "Location error",
};

const formatTime = (timestamp: number) =>
  new Intl.DateTimeFormat([], {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
  }).format(timestamp);

const formatCoordinates = (coordinates: Coordinates) =>
  `${coordinates.latitude.toFixed(4)}, ${coordinates.longitude.toFixed(4)}`;

export default function LiveStatusBadge({ className = "" }: { className?: string }) {
  const [nowMs, setNowMs] = useState(() => Date.now());
  const [coordinates, setCoordinates] = useState<Coordinates | null>(null);
  const [status, setStatus] = useState<BrowserCoordinateStatus>("idle");

  useEffect(() => {
    const timerId = window.setInterval(() => {
      setNowMs(Date.now());
    }, 1000);

    return () => {
      window.clearInterval(timerId);
    };
  }, []);

  useEffect(() => {
    return watchBrowserCoordinates(setCoordinates, setStatus);
  }, []);

  const timeLabel = useMemo(() => formatTime(nowMs), [nowMs]);
  const locationLabel = coordinates ? formatCoordinates(coordinates) : statusLabel[status];

  return (
    <span
      title={`Local time ${timeLabel}. ${coordinates ? `Current location ${locationLabel}.` : locationLabel}`}
      className={`inline-flex max-w-[15rem] items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-semibold text-slate-700 shadow-sm ${className}`}
    >
      <Clock3 className="h-3.5 w-3.5 shrink-0 text-[var(--brand-700)]" />
      <span className="truncate">{timeLabel}</span>
      <MapPin className="h-3.5 w-3.5 shrink-0 text-slate-400" />
      <span className="truncate">{locationLabel}</span>
    </span>
  );
}
