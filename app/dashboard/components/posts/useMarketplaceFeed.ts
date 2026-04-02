"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { CommunityFeedResponse } from "@/lib/api/community";
import { fetchAuthedJson } from "@/lib/clientApi";
import { distanceBetweenCoordinatesKm, watchBrowserCoordinates, type BrowserCoordinateStatus, type Coordinates } from "@/lib/geo";
import {
  buildMarketplaceDisplayItem,
  DEFAULT_MARKETPLACE_FEED_FILTER_STATE,
  mapMarketplaceRealtimeHealth,
  matchesMarketplaceFeedFilters,
  MARKETPLACE_REALTIME_HEALTH_STYLES,
  type MarketplaceDisplayFeedItem,
  type MarketplaceFeedFilterState,
  type MarketplaceFeedItem,
  type MarketplaceFeedStats,
  type MarketplaceMapCenter,
  type MarketplaceRealtimeHealth,
} from "@/lib/marketplaceFeed";
import { supabase } from "@/lib/supabase";
import { isAbortLikeError, isFailedFetchError, toErrorMessage } from "@/lib/runtimeErrors";

const FEED_POLL_INTERVAL_MS = 120000;
const MIN_SOFT_REFRESH_GAP_MS = 5000;
const FILTER_STORAGE_KEY_PREFIX = "serviq-posts-filters-v3";

type MarketplaceMapItem = {
  id: string;
  title: string;
  lat: number;
  lng: number;
  creatorName: string;
  locationLabel: string;
  category: string;
  timeLabel: string;
  priceLabel: string;
  coordinateAccuracy: "precise" | "approximate";
  urgent?: boolean;
};

type UseMarketplaceFeedParams = {
  pushToast: (kind: "success" | "error" | "info", message: string) => void;
};

const getFilterStorageKey = (viewerId: string | null) => `${FILTER_STORAGE_KEY_PREFIX}:${viewerId || "anon"}`;

const VALID_TYPE_FILTERS = new Set(["all", "demand", "service", "product"]);

const applyStoredFilters = (
  current: MarketplaceFeedFilterState,
  parsed: Partial<MarketplaceFeedFilterState>
): MarketplaceFeedFilterState => ({
  ...current,
  ...parsed,
  query: typeof parsed.query === "string" ? parsed.query : current.query,
  type: typeof parsed.type === "string" && VALID_TYPE_FILTERS.has(parsed.type) ? (parsed.type as MarketplaceFeedFilterState["type"]) : current.type,
  category: typeof parsed.category === "string" ? parsed.category : current.category,
  maxDistanceKm:
    typeof parsed.maxDistanceKm === "number" && Number.isFinite(parsed.maxDistanceKm)
      ? Math.max(0, parsed.maxDistanceKm)
      : current.maxDistanceKm,
  urgentOnly: typeof parsed.urgentOnly === "boolean" ? parsed.urgentOnly : current.urgentOnly,
  mediaOnly: typeof parsed.mediaOnly === "boolean" ? parsed.mediaOnly : current.mediaOnly,
  verifiedOnly: typeof parsed.verifiedOnly === "boolean" ? parsed.verifiedOnly : current.verifiedOnly,
  freshOnly: typeof parsed.freshOnly === "boolean" ? parsed.freshOnly : current.freshOnly,
});

export const useMarketplaceFeed = ({ pushToast }: UseMarketplaceFeedParams) => {
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [feed, setFeed] = useState<MarketplaceFeedItem[]>([]);
  const [filters, setFilters] = useState<MarketplaceFeedFilterState>(DEFAULT_MARKETPLACE_FEED_FILTER_STATE);
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [feedError, setFeedError] = useState<string | null>(null);
  const [feedChannelHealth, setFeedChannelHealth] = useState<MarketplaceRealtimeHealth>("connecting");
  const [activeMapItemId, setActiveMapItemId] = useState<string | null>(null);
  const [focusItemId, setFocusItemId] = useState("");
  const [composeRequested, setComposeRequested] = useState(false);
  const [mapCenter, setMapCenter] = useState<MarketplaceMapCenter>({ lat: 12.9716, lng: 77.5946 });
  const [browserLocation, setBrowserLocation] = useState<Coordinates | null>(null);
  const [locationStatus, setLocationStatus] = useState<BrowserCoordinateStatus>("idle");
  const [feedStats, setFeedStats] = useState<MarketplaceFeedStats>({
    total: 0,
    urgent: 0,
    demand: 0,
    service: 0,
    product: 0,
  });

  const fetchAbortRef = useRef<AbortController | null>(null);
  const activeFeedRequestIdRef = useRef(0);
  const refreshTimeoutRef = useRef<number | null>(null);
  const lastSoftRefreshAtRef = useRef(0);
  const lastLocationRefreshRef = useRef<string>("");
  const browserLocationRef = useRef<Coordinates | null>(null);
  const hydratedFilterKeyRef = useRef<string | null>(null);

  useEffect(() => {
    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      fetchAbortRef.current?.abort();
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    try {
      const storageKey = getFilterStorageKey(null);
      const rawFilters = window.localStorage.getItem(storageKey);
      if (rawFilters) {
        const parsed = JSON.parse(rawFilters) as Partial<MarketplaceFeedFilterState>;
        setFilters((current) => applyStoredFilters(current, parsed));
      }
      hydratedFilterKeyRef.current = storageKey;

      const params = new URLSearchParams(window.location.search);
      const queryParam = params.get("q") || "";
      const focusParam = params.get("focus") || params.get("help_request") || "";
      if (queryParam.trim()) {
        setFilters((current) => ({ ...current, query: queryParam.trim() }));
      }
      if (focusParam.trim()) {
        setFocusItemId(focusParam.trim());
        setActiveMapItemId(focusParam.trim());
      }
      setComposeRequested(params.get("compose") === "1");
    } catch {
      // Local state hydration is best effort.
    }
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!viewerId) return;

    const storageKey = getFilterStorageKey(viewerId);
    if (hydratedFilterKeyRef.current === storageKey) return;

    try {
      const rawFilters = window.localStorage.getItem(storageKey);
      if (!rawFilters) {
        hydratedFilterKeyRef.current = storageKey;
        return;
      }

      const parsed = JSON.parse(rawFilters) as Partial<MarketplaceFeedFilterState>;
      setFilters((current) => applyStoredFilters(current, parsed));
      hydratedFilterKeyRef.current = storageKey;
    } catch {
      hydratedFilterKeyRef.current = storageKey;
    }
  }, [viewerId]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(getFilterStorageKey(viewerId), JSON.stringify(filters));
  }, [filters, viewerId]);

  useEffect(() => {
    browserLocationRef.current = browserLocation;
  }, [browserLocation]);

  useEffect(() => {
    const stopWatching = watchBrowserCoordinates(
      (coordinates) => {
        setBrowserLocation((current) => {
          if (!current) {
            return coordinates;
          }

          const movedDistanceKm = distanceBetweenCoordinatesKm(current, coordinates);
          return movedDistanceKm >= 0.12 ? coordinates : current;
        });
      },
      setLocationStatus
    );

    return () => {
      stopWatching();
    };
  }, []);

  const fetchFeed = useCallback(
    async (hardRefresh = false) => {
      const now = Date.now();
      if (!hardRefresh && now - lastSoftRefreshAtRef.current < MIN_SOFT_REFRESH_GAP_MS) {
        return;
      }

      lastSoftRefreshAtRef.current = now;
      setFeedError(null);

      if (hardRefresh) {
        setLoading(true);
      } else {
        setRefreshing(true);
      }

      const requestId = activeFeedRequestIdRef.current + 1;
      activeFeedRequestIdRef.current = requestId;

      const controller = new AbortController();
      fetchAbortRef.current?.abort();
      fetchAbortRef.current = controller;
      const requestPath = (() => {
        if (!browserLocationRef.current) {
          return "/api/community/feed?scope=all";
        }

        const params = new URLSearchParams({
          scope: "all",
          lat: browserLocationRef.current.latitude.toFixed(6),
          lng: browserLocationRef.current.longitude.toFixed(6),
        });
        return `/api/community/feed?${params.toString()}`;
      })();

      try {
        const payload = await fetchAuthedJson<CommunityFeedResponse>(supabase, requestPath, {
          method: "GET",
          signal: controller.signal,
        });

        if (!payload.ok) {
          throw new Error(payload.message || "Unable to load posts feed.");
        }

        setViewerId(payload.currentUserId || null);
        setFeed(payload.feedItems || []);
        setFeedStats(payload.feedStats);
        setMapCenter(payload.mapCenter);
      } catch (error) {
        if (isAbortLikeError(error)) return;

        const message = toErrorMessage(error, "Unable to load posts feed.");
        setFeedError(message);

        if (isFailedFetchError(error)) {
          pushToast("error", "Network issue detected. Showing the latest available posts.");
        }

        setFeed((current) => current);
      } finally {
        if (fetchAbortRef.current === controller) {
          fetchAbortRef.current = null;
        }

        if (activeFeedRequestIdRef.current === requestId) {
          setLoading(false);
          setRefreshing(false);
        }
      }
    },
    [pushToast]
  );

  useEffect(() => {
    void fetchFeed(true);
  }, [fetchFeed]);

  useEffect(() => {
    const intervalId = window.setInterval(() => {
      void fetchFeed(false);
    }, FEED_POLL_INTERVAL_MS);

    return () => {
      window.clearInterval(intervalId);
    };
  }, [fetchFeed]);

  useEffect(() => {
    if (!browserLocation) {
      return;
    }

    const nextSignature = `${browserLocation.latitude.toFixed(3)}:${browserLocation.longitude.toFixed(3)}`;
    if (nextSignature === lastLocationRefreshRef.current) {
      return;
    }

    lastLocationRefreshRef.current = nextSignature;
    void fetchFeed(false);
  }, [browserLocation, fetchFeed]);

  useEffect(() => {
    const scheduleRefresh = () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
      }
      refreshTimeoutRef.current = window.setTimeout(() => {
        void fetchFeed(false);
      }, 360);
    };

    const channel = supabase
      .channel("posts-feed-live")
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "help_requests" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "service_listings" }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "product_catalog" }, scheduleRefresh)
      .subscribe((status) => {
        setFeedChannelHealth(mapMarketplaceRealtimeHealth(status));
      });

    return () => {
      if (refreshTimeoutRef.current) {
        window.clearTimeout(refreshTimeoutRef.current);
        refreshTimeoutRef.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [fetchFeed]);

  const filteredFeed = useMemo(() => feed.filter((item) => matchesMarketplaceFeedFilters(item, filters)), [feed, filters]);

  const displayFeed = useMemo<MarketplaceDisplayFeedItem[]>(
    () => filteredFeed.map((item) => buildMarketplaceDisplayItem(item)),
    [filteredFeed]
  );

  useEffect(() => {
    if (!displayFeed.length) {
      setActiveMapItemId(null);
      return;
    }

    setActiveMapItemId((current) => {
      if (current && displayFeed.some((item) => item.id === current)) {
        return current;
      }

      if (focusItemId && displayFeed.some((item) => item.id === focusItemId)) {
        return focusItemId;
      }

      return null;
    });
  }, [displayFeed, focusItemId]);

  const categoryOptions = useMemo(() => {
    const set = new Set<string>(["all"]);
    feed.forEach((item) => {
      const normalized = item.category.trim().toLowerCase();
      if (normalized) set.add(normalized);
      set.add(item.type);
    });
    return Array.from(set).slice(0, 12);
  }, [feed]);

  const mapItems = useMemo<MarketplaceMapItem[]>(
    () =>
      displayFeed.map((item) => ({
        id: item.id,
        title: item.displayTitle,
        lat: item.lat,
        lng: item.lng,
        creatorName: item.displayCreator,
        locationLabel: item.locationLabel || item.distanceLabel,
        category: item.category,
        timeLabel: item.timeLabel,
        priceLabel: item.priceLabel,
        coordinateAccuracy: item.coordinateAccuracy,
        urgent: item.urgent,
      })),
    [displayFeed]
  );

  const resetFilters = useCallback(() => {
    setFilters(DEFAULT_MARKETPLACE_FEED_FILTER_STATE);
    setShowAdvancedFilters(false);
  }, []);

  const consumeComposeRequest = useCallback(() => {
    if (typeof window === "undefined") return;

    setComposeRequested(false);
    const params = new URLSearchParams(window.location.search);
    params.delete("compose");
    const nextQuery = params.toString();
    const nextUrl = nextQuery ? `${window.location.pathname}?${nextQuery}` : window.location.pathname;
    window.history.replaceState(window.history.state, "", nextUrl);
  }, []);

  return {
    viewerId,
    setViewerId,
    feed,
    setFeed,
    filters,
    setFilters,
    showAdvancedFilters,
    setShowAdvancedFilters,
    loading,
    refreshing,
    feedError,
    feedChannelHealth,
    realtimeStyle: MARKETPLACE_REALTIME_HEALTH_STYLES[feedChannelHealth],
    feedStats,
    mapCenter: browserLocation ? { lat: browserLocation.latitude, lng: browserLocation.longitude } : mapCenter,
    browserLocation,
    locationStatus,
    mapItems,
    categoryOptions,
    displayFeed,
    showFeedLoading: loading || (refreshing && feed.length === 0),
    activeMapItemId,
    setActiveMapItemId,
    focusItemId,
    composeRequested,
    consumeComposeRequest,
    fetchFeed,
    resetFilters,
  };
};
