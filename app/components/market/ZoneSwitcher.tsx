"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { ChevronDown, MapPin } from "lucide-react";

type ZoneItem = {
  slug: string;
  name: string;
  city: string;
  phase: number;
};

export default function ZoneSwitcher({ currentSlug }: { currentSlug: string }) {
  const [open, setOpen] = useState(false);
  const [zones, setZones] = useState<ZoneItem[]>([]);
  const dropdownRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetch("/api/market/zones")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setZones(data.zones);
      })
      .catch(() => {});
  }, []);

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const current = zones.find((z) => z.slug === currentSlug);

  return (
    <div ref={dropdownRef} className="relative">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-white px-3 py-2 text-xs font-semibold text-[var(--ink-700)] transition hover:border-[var(--brand-300)] hover:shadow-sm"
      >
        <MapPin className="h-3.5 w-3.5 text-[var(--brand-600)]" />
        {current?.name ?? "Switch Zone"}
        <ChevronDown className={`h-3 w-3 transition ${open ? "rotate-180" : ""}`} />
      </button>

      {open && (
        <div className="absolute right-0 top-full z-50 mt-1 w-56 rounded-2xl border border-[var(--surface-border)] bg-white p-1 shadow-lg">
          {zones.map((zone) => {
            const isActive = zone.slug === currentSlug;
            return (
              <Link
                key={zone.slug}
                href={`/market/zone/${zone.slug}`}
                onClick={() => setOpen(false)}
                className={`flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold transition ${
                  isActive
                    ? "bg-[var(--brand-50)] text-[var(--brand-700)]"
                    : "text-[var(--ink-700)] hover:bg-[var(--surface-soft)]"
                }`}
              >
                <div className={`flex h-6 w-6 items-center justify-center rounded-lg ${
                  isActive ? "bg-[var(--brand-100)]" : "bg-[var(--surface-soft)]"
                }`}>
                  <MapPin className={`h-3 w-3 ${isActive ? "text-[var(--brand-600)]" : "text-[var(--ink-500)]"}`} />
                </div>
                <span className="flex-1">{zone.name}</span>
                {zone.phase === 2 && (
                  <span className="rounded-full bg-purple-100 px-1.5 py-0.5 text-[9px] font-semibold text-purple-700">
                    Soon
                  </span>
                )}
                {isActive && (
                  <span className="h-1.5 w-1.5 rounded-full bg-[var(--brand-600)]" />
                )}
              </Link>
            );
          })}
          <div className="border-t border-[var(--surface-border)] mt-1 pt-1">
            <Link
              href="/market"
              onClick={() => setOpen(false)}
              className="flex items-center gap-2 rounded-xl px-3 py-2.5 text-xs font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-50)]"
            >
              View all zones
            </Link>
          </div>
        </div>
      )}
    </div>
  );
}
