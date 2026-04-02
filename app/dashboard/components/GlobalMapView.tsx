"use client";

import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  Compass,
  Layers,
  MapPin,
  Navigation,
  Users,
  Newspaper,
  X,
  ChevronDown,
  Loader2,
  ExternalLink,
} from "lucide-react";
import { usePathname, useRouter } from "next/navigation";
import type { MarketplaceMapItem } from "@/app/components/maps/types";
import type { CommunityFeedResponse, CommunityPeopleResponse, CommunityPresenceRecord } from "@/lib/api/community";
import { estimateResponseMinutes } from "@/lib/business";
import { resolveCoordinatesWithAccuracy } from "@/lib/geo";
import { buildMarketplaceDisplayItem, type MarketplaceFeedItem } from "@/lib/marketplaceFeed";
import { captureUiActionObservability, resolveObservedRouteFromPathname } from "@/lib/observability";
import { buildPublicProfilePath } from "@/lib/profile/utils";

const MarketplaceMap = dynamic(
  () => import("@/app/components/MarketplaceMap").then((m) => ({ default: m.default ?? m })),
  { ssr: false }
);

type Layer = "all" | "explore" | "people";

type MapItemDetail = {
  id: string;
  title: string;
  subtitle?: string;
  category?: string;
  locationLabel?: string;
  timeLabel?: string;
  priceLabel?: string;
  layer: Layer | "explore" | "people";
  coordinateAccuracy: "precise" | "approximate";
  detailPath: string | null;
  detailLabel: string;
};

type Props = {
  open: boolean;
  onClose: () => void;
};

type ViewerCenter = {
  lat: number;
  lng: number;
};

const INR = (value: number) =>
  new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 0 }).format(value);

const buildExploreDetailPath = (item: MarketplaceFeedItem) =>
  `/dashboard?source=posts_feed&focus=${encodeURIComponent(item.id)}`;

// ── Lightweight fetch helpers ──────────────────────────────────────────────────

const buildExploreFeedUrl = (viewerCenter?: ViewerCenter | null) => {
  const params = new URLSearchParams({
    lite: "1",
    limit: "200",
  });

  if (viewerCenter) {
    params.set("lat", viewerCenter.lat.toString());
    params.set("lng", viewerCenter.lng.toString());
  }

  return `/api/community/feed?${params.toString()}`;
};

async function fetchExploreItems(viewerCenter?: ViewerCenter | null): Promise<MarketplaceMapItem[]> {
  try {
    const res = await fetch(buildExploreFeedUrl(viewerCenter), {
      credentials: "include",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as CommunityFeedResponse;
    if (!json.ok) return [];

    return (json.feedItems ?? []).map((item) => {
      const display = buildMarketplaceDisplayItem(item);
      return {
        id: item.id,
        title: display.displayTitle,
        lat: item.lat,
        lng: item.lng,
        creatorName: display.displayCreator,
        locationLabel: item.locationLabel || display.distanceLabel,
        category: item.category,
        timeLabel: display.timeLabel,
        priceLabel: display.priceLabel,
        urgent: item.urgent,
        coordinateAccuracy: item.coordinateAccuracy,
        detailPath: buildExploreDetailPath(item),
        detailLabel:
          item.type === "demand"
            ? "Open request"
            : item.type === "product"
            ? "Open product"
            : "Open service",
      } satisfies MarketplaceMapItem;
    });
  } catch {
    return [];
  }
}

async function fetchPeopleItems(): Promise<MarketplaceMapItem[]> {
  try {
    const res = await fetch("/api/community/people?lite=1&limit=200", {
      credentials: "include",
    });
    if (!res.ok) return [];
    const json = (await res.json()) as CommunityPeopleResponse;
    if (!json.ok) return [];

    const categoriesByProfileId = new Map<string, string[]>();
    const pricesByProfileId = new Map<string, number[]>();
    const presenceByProfileId = new Map<string, CommunityPresenceRecord>();

    const pushCategory = (profileId: string, value: string | null | undefined) => {
      const normalized = typeof value === "string" ? value.trim() : "";
      if (!profileId || !normalized) return;
      const current = categoriesByProfileId.get(profileId) || [];
      if (current.includes(normalized)) return;
      categoriesByProfileId.set(profileId, [...current, normalized]);
    };

    const pushPrice = (profileId: string, value: number | string | null | undefined) => {
      const nextValue = typeof value === "number" ? value : typeof value === "string" ? Number(value) : Number.NaN;
      if (!profileId || !Number.isFinite(nextValue) || nextValue <= 0) return;
      const current = pricesByProfileId.get(profileId) || [];
      pricesByProfileId.set(profileId, [...current, Math.round(nextValue)]);
    };

    (json.services || []).forEach((service) => {
      pushCategory(service.provider_id, service.category);
      pushPrice(service.provider_id, service.price);
    });
    (json.products || []).forEach((product) => {
      pushCategory(product.provider_id, product.category);
      pushPrice(product.provider_id, product.price);
    });
    (json.presence || []).forEach((presence) => {
      if (!presence.provider_id) return;
      presenceByProfileId.set(presence.provider_id, presence);
    });

    return (json.profiles || []).reduce<MarketplaceMapItem[]>((items, profile) => {
      if (!profile.id) return items;

      const coordinateMeta = resolveCoordinatesWithAccuracy({
        row: profile as Record<string, unknown>,
        location: profile.location || "",
        seed: profile.id,
      });
      const presence = presenceByProfileId.get(profile.id);
      const responseMinutes = estimateResponseMinutes({
        availability: presence?.availability || profile.availability || null,
        providerId: profile.id,
        baseResponseMinutes: presence?.rolling_response_minutes ?? presence?.response_sla_minutes ?? null,
      });
      const priceCandidates = pricesByProfileId.get(profile.id) || [];
      const minPrice = priceCandidates.length ? Math.min(...priceCandidates) : null;
      const primaryCategory = (categoriesByProfileId.get(profile.id) || [])[0];
      const publicPath =
        buildPublicProfilePath(profile) || `/dashboard/people?provider=${encodeURIComponent(profile.id)}`;

      items.push({
        id: profile.id,
        title: profile.name?.trim() || "Community member",
        lat: coordinateMeta.coordinates.latitude,
        lng: coordinateMeta.coordinates.longitude,
        creatorName: profile.role || undefined,
        locationLabel:
          coordinateMeta.accuracy === "approximate" && profile.location
            ? `${profile.location} (approximate area)`
            : profile.location || "Nearby",
        category: primaryCategory || profile.role || undefined,
        timeLabel: responseMinutes > 0 ? `~${responseMinutes} min reply` : undefined,
        priceLabel: minPrice ? `From ${INR(minPrice)}` : undefined,
        coordinateAccuracy: coordinateMeta.accuracy,
        detailPath: publicPath,
        detailLabel: "Open profile",
      });

      return items;
    }, []);
  } catch {
    return [];
  }
}

async function getUserCenter(): Promise<{ lat: number; lng: number } | null> {
  return new Promise((resolve) => {
    if (!navigator?.geolocation) {
      resolve(null);
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (pos) => resolve({ lat: pos.coords.latitude, lng: pos.coords.longitude }),
      () => resolve(null),
      { timeout: 6000, maximumAge: 60_000 }
    );
  });
}

// ── Layer pill config ──────────────────────────────────────────────────────────

const LAYERS: { id: Layer; label: string; Icon: typeof Layers }[] = [
  { id: "all", label: "All", Icon: Layers },
  { id: "explore", label: "Explore", Icon: Newspaper },
  { id: "people", label: "People", Icon: Users },
];

const resolveDefaultLayer = (pathname: string | null | undefined): Layer => {
  if ((pathname || "").startsWith("/dashboard/people")) return "people";
  if ((pathname || "") === "/dashboard") return "explore";
  return "all";
};

// ── Component ─────────────────────────────────────────────────────────────────

export default function GlobalMapView({ open, onClose }: Props) {
  const pathname = usePathname();
  const router = useRouter();
  const [activeLayer, setActiveLayer] = useState<Layer>("all");
  const [exploreItems, setExploreItems] = useState<MarketplaceMapItem[]>([]);
  const [peopleItems, setPeopleItems] = useState<MarketplaceMapItem[]>([]);
  const [center, setCenter] = useState<{ lat: number; lng: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [locating, setLocating] = useState(false);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const refreshRequestRef = useRef(0);
  const openTrackedRef = useRef(false);
  const sheetRef = useRef<HTMLDivElement>(null);
  const observedRoute = resolveObservedRouteFromPathname(pathname || "/dashboard");
  const defaultLayer = resolveDefaultLayer(pathname);
  const mapTitle = activeLayer === "explore" ? "Explore Map" : activeLayer === "people" ? "People Map" : "Marketplace Map";

  const refreshMapData = useCallback(
    async (options?: { viewerCenter?: ViewerCenter | null; preserveSelection?: boolean }) => {
      const requestId = refreshRequestRef.current + 1;
      refreshRequestRef.current = requestId;
      setLoading(true);

      if (!options?.preserveSelection) {
        setSheetOpen(false);
        setSelectedId(null);
      }

      const viewerCenter = options?.viewerCenter ?? (await getUserCenter());
      const [explore, people] = await Promise.all([fetchExploreItems(viewerCenter), fetchPeopleItems()]);

      if (refreshRequestRef.current !== requestId) {
        return;
      }

      setExploreItems(explore);
      setPeopleItems(people);
      setCenter((current) => viewerCenter || current);
      setLoading(false);
    },
    []
  );

  useEffect(() => {
    if (!open) {
      openTrackedRef.current = false;
      setSheetOpen(false);
      setSelectedId(null);
      return;
    }

    setActiveLayer(defaultLayer);
    void refreshMapData();
  }, [defaultLayer, open, refreshMapData]);

  useEffect(() => {
    if (!open || openTrackedRef.current) return;
    openTrackedRef.current = true;
    void captureUiActionObservability({
      route: observedRoute,
      pathname: pathname || undefined,
      action: "map_open",
      context: {
        layer: activeLayer,
      },
    });
  }, [activeLayer, observedRoute, open, pathname]);

  const visibleItems: MarketplaceMapItem[] = (() => {
    if (activeLayer === "explore") return exploreItems;
    if (activeLayer === "people") return peopleItems;
    return [...exploreItems, ...peopleItems];
  })();

  const selectedDetail: MapItemDetail | null = (() => {
    if (!selectedId) return null;
    const e = exploreItems.find((i) => i.id === selectedId);
    if (e) return {
      id: e.id, title: e.title, subtitle: e.creatorName, category: e.category,
      locationLabel: e.locationLabel, timeLabel: e.timeLabel, priceLabel: e.priceLabel,
      layer: "explore",
      coordinateAccuracy: e.coordinateAccuracy || "approximate",
      detailPath: e.detailPath || null,
      detailLabel: e.detailLabel || "View details",
    };
    const p = peopleItems.find((i) => i.id === selectedId);
    if (p) return {
      id: p.id, title: p.title, subtitle: p.creatorName, category: p.category,
      locationLabel: p.locationLabel, timeLabel: p.timeLabel, priceLabel: p.priceLabel,
      layer: "people",
      coordinateAccuracy: p.coordinateAccuracy || "approximate",
      detailPath: p.detailPath || null,
      detailLabel: p.detailLabel || "View details",
    };
    return null;
  })();

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
    setSheetOpen(true);
    void captureUiActionObservability({
      route: observedRoute,
      pathname: pathname || undefined,
      action: "pin_select",
      context: {
        itemId: id,
        layer: activeLayer,
      },
    });
  }, [activeLayer, observedRoute, pathname]);

  const handleLocate = useCallback(async () => {
    setLocating(true);
    try {
      const pos = await getUserCenter();
      if (pos) {
        await refreshMapData({ viewerCenter: pos, preserveSelection: true });
      }
    } finally {
      setLocating(false);
    }
  }, [refreshMapData]);

  const handleDismissSheet = useCallback(() => {
    setSheetOpen(false);
    setSelectedId(null);
  }, []);

  const handleViewDetail = useCallback(() => {
    if (!selectedDetail?.detailPath) return;
    void captureUiActionObservability({
      route: observedRoute,
      pathname: pathname || undefined,
      action: "deep_link_open",
      context: {
        itemId: selectedDetail.id,
        layer: selectedDetail.layer,
        detailPath: selectedDetail.detailPath,
      },
    });
    router.push(selectedDetail.detailPath);
    onClose();
  }, [observedRoute, onClose, pathname, router, selectedDetail]);

  // Close sheet on click outside
  useEffect(() => {
    if (!sheetOpen) return;
    const handler = (e: MouseEvent) => {
      if (sheetRef.current && !sheetRef.current.contains(e.target as Node)) {
        handleDismissSheet();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [sheetOpen, handleDismissSheet]);

  // Keyboard close
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (sheetOpen) handleDismissSheet();
        else onClose();
      }
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open, sheetOpen, onClose, handleDismissSheet]);

  useEffect(() => {
    if (!selectedId) return;
    if (visibleItems.some((item) => item.id === selectedId)) return;
    handleDismissSheet();
  }, [handleDismissSheet, selectedId, visibleItems]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-[9000] flex flex-col bg-[#020617]"
      role="dialog"
      aria-modal="true"
      aria-label="Map view"
    >
      {/* ── Map fills the entire screen ─────────────────────────────── */}
      <div className="absolute inset-0">
        {!loading && (
          <MarketplaceMap
            items={visibleItems}
            center={center}
            activeItemId={selectedId}
            selectedItemId={selectedId}
            onSelectItem={handleSelect}
          />
        )}
        {loading && (
          <div className="flex h-full w-full items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-slate-400">
              <Loader2 className="h-9 w-9 animate-spin text-[var(--brand-500)]" />
              <span className="text-sm font-medium">Loading map…</span>
            </div>
          </div>
        )}
      </div>

      {/* ── Top chrome overlay ──────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 top-0 z-10 h-28 bg-gradient-to-b from-[rgba(2,6,23,0.85)] to-transparent" />

      <div className="relative z-20 flex items-center justify-between gap-3 px-4 pt-[calc(env(safe-area-inset-top)+12px)] sm:px-6">
        {/* Title + count */}
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-900)] shadow-lg">
            <MapPin className="h-4.5 w-4.5 text-white" />
          </div>
          <div>
            <p className="text-sm font-bold leading-tight text-white">{mapTitle}</p>
            {!loading && (
              <p className="text-[11px] font-medium text-slate-400">
                {visibleItems.length} {visibleItems.length === 1 ? "pin" : "pins"}
              </p>
            )}
          </div>
        </div>

        {/* Layer toggles */}
        <div className="flex items-center gap-1 rounded-full border border-white/10 bg-slate-900/75 p-1 backdrop-blur-md">
          {LAYERS.map(({ id, label, Icon }) => (
            <button
              key={id}
              type="button"
              onClick={() => {
                setActiveLayer(id);
                void captureUiActionObservability({
                  route: observedRoute,
                  pathname: pathname || undefined,
                  action: "layer_switch",
                  context: {
                    layer: id,
                  },
                });
              }}
              className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[11px] font-semibold transition-all ${
                activeLayer === id
                  ? "bg-[var(--brand-900)] text-white shadow-md"
                  : "text-slate-400 hover:text-white"
              }`}
            >
              <Icon className="h-3 w-3 shrink-0" />
              <span className="hidden sm:inline">{label}</span>
            </button>
          ))}
        </div>

        {/* Close */}
        <button
          type="button"
          onClick={onClose}
          aria-label="Close map"
          className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border border-white/10 bg-slate-900/75 text-white backdrop-blur-md transition hover:bg-slate-800"
        >
          <X className="h-4 w-4" />
        </button>
      </div>

      {/* ── Bottom gradient ─────────────────────────────────────────── */}
      <div className="pointer-events-none absolute inset-x-0 bottom-0 z-10 h-48 bg-gradient-to-t from-[rgba(2,6,23,0.7)] to-transparent" />

      {/* ── Locate-me FAB ───────────────────────────────────────────── */}
      <button
        type="button"
        onClick={() => void handleLocate()}
        aria-label="Center on my location"
        disabled={locating}
        className="absolute bottom-8 right-4 z-30 flex h-12 w-12 items-center justify-center rounded-full border border-white/10 bg-slate-900/85 text-white shadow-xl backdrop-blur-md transition hover:bg-[var(--brand-900)] disabled:opacity-60 sm:bottom-10 sm:right-6"
      >
        {locating ? (
          <Loader2 className="h-5 w-5 animate-spin" />
        ) : (
          <Navigation className="h-5 w-5" />
        )}
      </button>

      {/* ── Compass accent ──────────────────────────────────────────── */}
      <button
        type="button"
        aria-label="Reset bearing"
        className="absolute bottom-24 right-4 z-30 flex h-10 w-10 items-center justify-center rounded-full border border-white/10 bg-slate-900/75 text-slate-400 backdrop-blur-md transition hover:text-white sm:bottom-28 sm:right-6"
      >
        <Compass className="h-4.5 w-4.5" />
      </button>

      {/* ── Selected item bottom sheet ──────────────────────────────── */}
      <div
        className={`absolute inset-x-0 bottom-0 z-40 transform transition-transform duration-300 ease-in-out ${
          sheetOpen ? "translate-y-0" : "translate-y-full"
        }`}
        ref={sheetRef}
        role="region"
        aria-label="Selected item details"
      >
        <div className="mx-auto w-full max-w-lg overflow-hidden rounded-t-3xl border-t border-white/8 bg-slate-900/95 shadow-2xl backdrop-blur-xl">
          {/* Drag handle */}
          <button
            type="button"
            onClick={handleDismissSheet}
            aria-label="Dismiss"
            className="flex w-full items-center justify-center pt-3"
          >
            <div className="h-1 w-10 rounded-full bg-slate-600" />
          </button>

          {selectedDetail && (
            <div className="px-5 pb-8 pt-3">
              {/* Layer badge */}
              <div className="mb-3 flex items-center gap-2">
                {selectedDetail.layer === "people" ? (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-indigo-500/18 px-2.5 py-1 text-[11px] font-semibold text-indigo-300 ring-1 ring-inset ring-indigo-400/20">
                    <Users className="h-3 w-3" />
                    People
                  </span>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-[var(--brand-900)]/30 px-2.5 py-1 text-[11px] font-semibold text-[var(--brand-400)] ring-1 ring-inset ring-[var(--brand-400)]/20">
                    <Newspaper className="h-3 w-3" />
                    Explore
                  </span>
                )}
                {selectedDetail.category && (
                  <span className="inline-flex items-center rounded-full bg-slate-800 px-2.5 py-1 text-[11px] font-medium text-slate-400">
                    {selectedDetail.category}
                  </span>
                )}
                <span
                  className={`inline-flex items-center rounded-full px-2.5 py-1 text-[11px] font-semibold ring-1 ring-inset ${
                    selectedDetail.coordinateAccuracy === "precise"
                      ? "bg-emerald-500/16 text-emerald-200 ring-emerald-400/25"
                      : "bg-amber-500/14 text-amber-100 ring-amber-400/20"
                  }`}
                >
                  {selectedDetail.coordinateAccuracy === "precise" ? "Precise pin" : "Approx area"}
                </span>
              </div>

              {/* Title + subtitle */}
              <h2 className="text-base font-bold leading-snug text-white">
                {selectedDetail.title}
              </h2>
              {selectedDetail.subtitle && (
                <p className="mt-0.5 text-sm text-slate-400">{selectedDetail.subtitle}</p>
              )}

              {/* Meta row */}
              <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-slate-400">
                {selectedDetail.locationLabel && (
                  <span className="flex items-center gap-1">
                    <MapPin className="h-3 w-3 shrink-0 text-slate-500" />
                    {selectedDetail.locationLabel}
                  </span>
                )}
                {selectedDetail.timeLabel && (
                  <span>{selectedDetail.timeLabel}</span>
                )}
                {selectedDetail.priceLabel && (
                  <span className="font-semibold text-emerald-400">
                    {selectedDetail.priceLabel}
                  </span>
                )}
              </div>

              {selectedDetail.coordinateAccuracy === "approximate" ? (
                <p className="mt-3 text-xs leading-5 text-amber-100/85">
                  This pin represents a shared area or city, not an exact street-level address.
                </p>
              ) : null}

              {/* CTA */}
              <div className="mt-5 flex gap-3">
                <button
                  type="button"
                  onClick={handleViewDetail}
                  disabled={!selectedDetail.detailPath}
                  className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {selectedDetail.detailLabel}
                  <ExternalLink className="h-3.5 w-3.5 opacity-75" />
                </button>
                <button
                  type="button"
                  onClick={handleDismissSheet}
                  className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-slate-700 text-slate-400 transition hover:border-slate-600 hover:text-white"
                  aria-label="Close panel"
                >
                  <ChevronDown className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          {/* safe area spacer */}
          <div style={{ height: "env(safe-area-inset-bottom)" }} />
        </div>
      </div>
    </div>
  );
}
