"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import dynamic from "next/dynamic";
import type { RealtimePostgresChangesPayload } from "@supabase/supabase-js";
import { AnimatePresence, motion } from "framer-motion";
import {
  AlertCircle,
  Bell,
  ChevronDown,
  Compass,
  Loader2,
  Sparkles,
  Users,
} from "lucide-react";
import { useRouter } from "next/navigation";
import PageContextStrip from "@/app/components/PageContextStrip";
import WhatHappensNext from "@/app/components/trust/WhatHappensNext";
import RouteObservability from "@/app/components/RouteObservability";
import type { DashboardPromptConfig } from "@/app/components/prompt/DashboardPromptContext";
import { useDashboardPrompt } from "@/app/components/prompt/DashboardPromptContext";
import type {
  CommunityPeopleResponse,
} from "@/lib/api/community";
import { fetchAuthedJson } from "@/lib/clientApi";
import { ensureClientProfile } from "@/lib/clientProfile";
import {
  clearPendingFeedCardSave,
  getPendingFeedCardIds,
  persistFeedCardSave,
  prunePendingFeedCardSaves,
  removeFeedCardSave,
  stagePendingFeedCardSave,
  syncPendingFeedCardSaves,
} from "@/lib/feedCardSavesClient";
import {
  calculateLocalRankScore,
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
} from "@/lib/business";
import type {
  ConnectionDecision,
  ConnectionState,
} from "@/lib/connectionState";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import {
  defaultMarketCoordinates,
  distanceBetweenCoordinatesKm,
  getBrowserCoordinates,
  resolveCoordinates,
  resolveCoordinatesWithAccuracy,
  type Coordinates,
} from "@/lib/geo";
import { useConnectionRequests } from "@/lib/hooks/useConnectionRequests";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import {
  buildPublicProfilePath,
  getProfileDisplayName,
} from "@/lib/profile/utils";
import {
  extractPresenceUserIds,
  GLOBAL_PRESENCE_CHANNEL,
} from "@/lib/realtime";
import { supabase } from "@/lib/supabase";
import PeopleLiveHeader from "./components/PeopleLiveHeader";
import PeopleMapPanel from "./components/PeopleMapPanel";
import ProviderCard from "./components/ProviderCard";
import ProviderCardSkeleton from "./components/ProviderCardSkeleton";
import type {
  PeopleBanner,
  PresenceTone,
  ProviderCard as ProviderCardModel,
  ProviderMedia,
  ProviderOffering,
  ProviderPreview,
  RealtimeToast,
} from "./types";

const ProviderTrustPanel = dynamic(
  () =>
    import("@/app/components/ProviderTrustPanel").then((mod) => mod.default),
  { ssr: false },
);

import type {
  ProfileRow,
  ServiceRow,
  ProductRow,
  ServiceDetailRow,
  ProductDetailRow,
  SavedCardRow,
  RealtimeConnectionRow,
  CommunityPeopleSuccessPayload,
} from "./peopleTypes";
import {
  PAGE_SIZE,
  EMPTY_CONNECTION_STATE,
  GEO_LOOKUP_TIMEOUT_MS,
  MAX_DISCOVERABLE_PROFILES,
  AUTO_SYNC_INTERVAL_MS,
  NEW_PROVIDER_WINDOW_DAYS,
  normalizeText,
  toFiniteNumber,
  isMissingRelationError,
  formatCurrency,
  buildProfileCardId,
  isUuid,
  formatRelativeTimestamp,
  looksLikePlaceholderText,
  sanitizeProfileServices,
  isProviderFacingRole,
  loadPeopleSnapshotDirect,
  loadProviderDetails,
  createProviderCards,
} from "./peopleTypes";

export default function PeoplePage() {
  const router = useRouter();
  const infiniteSentinelRef = useRef<HTMLDivElement | null>(null);
  const loadMoreTimerRef = useRef<number | null>(null);
  const providerPreviewRef = useRef<Map<string, ProviderPreview>>(new Map());
  const cardElementsRef = useRef<Map<string, HTMLDivElement>>(new Map());
  const deepLinkHandledRef = useRef(false);

  const [providers, setProviders] = useState<ProviderCardModel[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [currentUserId, setCurrentUserId] = useState<string | null>(null);
  const [onlineUserIds, setOnlineUserIds] = useState<Set<string>>(new Set());
  const [lastSyncedAt, setLastSyncedAt] = useState<string | null>(null);

  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);
  const [loadingMore, setLoadingMore] = useState(false);
  const [activeProviderId, setActiveProviderId] = useState<string | null>(null);
  const [trustPanelProviderId, setTrustPanelProviderId] = useState<
    string | null
  >(null);
  const [chatBusyUserId, setChatBusyUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(() => {
    if (typeof window === "undefined") return "";
    return new URLSearchParams(window.location.search).get("q") || "";
  });
  const deferredSearchQuery = useDeferredValue(searchQuery);

  const [noticeBanner, setNoticeBanner] = useState<PeopleBanner | null>(null);
  const [showConnectionExplainer, setShowConnectionExplainer] = useState(false);
  const [realtimeToast, setRealtimeToast] = useState<RealtimeToast | null>(
    null,
  );
  const [savedCardIds, setSavedCardIds] = useState<Set<string>>(new Set());
  const [savingCardIds, setSavingCardIds] = useState<Set<string>>(new Set());
  const [sharingCardIds, setSharingCardIds] = useState<Set<string>>(new Set());
  const [viewerCompletionPercent, setViewerCompletionPercent] = useState<
    number | null
  >(null);
  const [profileBannerDismissed, setProfileBannerDismissed] = useState(false);

  const [deepLinkContext] = useState<{
    providerId: string | null;
    panel: string | null;
  }>(() => {
    if (typeof window === "undefined") {
      return { providerId: null, panel: null };
    }
    const params = new URLSearchParams(window.location.search);
    return {
      providerId: params.get("provider"),
      panel: params.get("panel"),
    };
  });

  const {
    viewerId: connectionViewerId,
    busyTargetId: busyConnectionTargetId,
    busyRequestId: busyConnectionRequestId,
    busyActionKey,
    schemaReady: connectionSchemaReady,
    schemaMessage: connectionSchemaMessage,
    connectionBuckets,
    getConnectionState,
    sendRequest,
    respond,
  } = useConnectionRequests();

  useEffect(() => {
    if (!connectionViewerId) return;
    setCurrentUserId((previous) => previous || connectionViewerId);
  }, [connectionViewerId]);

  useEffect(() => {
    if (!noticeBanner) return;
    const timerId = window.setTimeout(() => setNoticeBanner(null), 3200);
    return () => window.clearTimeout(timerId);
  }, [noticeBanner]);

  useEffect(() => {
    if (!realtimeToast) return;
    const timerId = window.setTimeout(() => setRealtimeToast(null), 4200);
    return () => window.clearTimeout(timerId);
  }, [realtimeToast]);

  const loadProviders = useCallback(async (soft = false) => {
    if (soft) {
      setSyncing(true);
    } else {
      setLoading(true);
    }
    setErrorMessage("");

    try {
      const browserCoordinatesPromise = getBrowserCoordinates(
        GEO_LOOKUP_TIMEOUT_MS,
      );

      const {
        data: { user },
        error: authError,
      } = await supabase.auth.getUser();

      if (authError || !user) {
        throw new Error(authError?.message || "Login required.");
      }

      setCurrentUserId(user.id);
      await ensureClientProfile(user).catch(() => false);

      let peoplePayload: CommunityPeopleSuccessPayload;
      try {
        const payload = await fetchAuthedJson<CommunityPeopleResponse>(
          supabase,
          "/api/community/people",
        );
        if (!payload.ok) {
          throw new Error(
            payload.message || "Unable to load people directory.",
          );
        }
        peoplePayload = payload;
      } catch (routeError) {
        peoplePayload = await loadPeopleSnapshotDirect(user.id).catch(
          (fallbackError) => {
            const primaryMessage =
              routeError instanceof Error
                ? routeError.message
                : "Unable to load people directory.";
            const fallbackMessage =
              fallbackError instanceof Error
                ? fallbackError.message
                : "Fallback people load failed.";
            throw new Error(primaryMessage || fallbackMessage);
          },
        );
      }

      const viewerId = peoplePayload.currentUserId || user.id;
      setCurrentUserId(viewerId);

      const viewerProfile = (
        (peoplePayload.profiles || []) as ProfileRow[]
      ).find((profile) => profile.id === viewerId);
      if (viewerProfile) {
        const pct =
          viewerProfile.profile_completion_percent ??
          calculateProfileCompletion(viewerProfile);
        setViewerCompletionPercent(pct);
      }
      const browserCoordinates = await browserCoordinatesPromise;
      const viewerProfileCoordinates = viewerProfile
        ? resolveCoordinates({
            row: viewerProfile as unknown as Record<string, unknown>,
            location: viewerProfile.location || "",
            seed: viewerProfile.id,
          })
        : null;
      const effectiveViewerCoordinates =
        browserCoordinates ||
        viewerProfileCoordinates ||
        defaultMarketCoordinates();
      const providerIdsForDetails = Array.from(
        new Set(
          [
            ...((peoplePayload.profiles || []) as ProfileRow[]).map((profile) =>
              normalizeText(profile.id),
            ),
            ...(peoplePayload.services || []).map((row) =>
              normalizeText((row as ServiceRow).provider_id),
            ),
            ...(peoplePayload.products || []).map((row) =>
              normalizeText((row as ProductRow).provider_id),
            ),
          ].filter((providerId) => providerId && providerId !== viewerId),
        ),
      );

      const { serviceDetails, productDetails } = await loadProviderDetails(
        providerIdsForDetails,
      ).catch(() => ({
        serviceDetails: [] as ServiceDetailRow[],
        productDetails: [] as ProductDetailRow[],
      }));

      const cards = createProviderCards({
        payload: peoplePayload,
        viewerId,
        viewerCoordinates: effectiveViewerCoordinates,
        serviceDetails,
        productDetails,
      });

      setProviders(cards);
      setLastSyncedAt(new Date().toISOString());
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unable to load people.";
      setProviders([]);
      setErrorMessage(message);
    } finally {
      setLoading(false);
      setSyncing(false);
    }
  }, []);

  useEffect(() => {
    void loadProviders(false);
  }, [loadProviders]);

  const ensureViewerId = useCallback(async () => {
    if (currentUserId) return currentUserId;
    if (connectionViewerId) {
      setCurrentUserId(connectionViewerId);
      return connectionViewerId;
    }

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error(error?.message || "Login required.");
    }

    setCurrentUserId(user.id);
    return user.id;
  }, [connectionViewerId, currentUserId]);

  const loadSavedProfiles = useCallback(
    async (viewerId: string, nextProviders: ProviderCardModel[]) => {
      if (!viewerId || nextProviders.length === 0) {
        setSavedCardIds(new Set());
        return;
      }

      const cardIds = nextProviders.map((provider) =>
        buildProfileCardId(provider.id),
      );
      const { data, error } = await supabase
        .from("feed_card_saves")
        .select("card_id")
        .eq("user_id", viewerId)
        .in("card_id", cardIds);

      if (error) {
        if (isMissingRelationError(error.message || "")) {
          const nextSavedIds = new Set(
            getPendingFeedCardIds(viewerId).filter((cardId) =>
              cardIds.includes(cardId),
            ),
          );
          setSavedCardIds(nextSavedIds);
          return;
        }
        throw new Error(error.message);
      }

      const persistedCardIds = ((data as SavedCardRow[] | null) || []).map(
        (row) => row.card_id,
      );
      prunePendingFeedCardSaves(viewerId, persistedCardIds);
      const nextSavedIds = new Set([
        ...persistedCardIds,
        ...getPendingFeedCardIds(viewerId).filter((cardId) =>
          cardIds.includes(cardId),
        ),
      ]);
      setSavedCardIds(nextSavedIds);
      void syncPendingFeedCardSaves(supabase, viewerId, persistedCardIds);
    },
    [],
  );

  useEffect(() => {
    if (!currentUserId || providers.length === 0) return;

    void loadSavedProfiles(currentUserId, providers).catch(() => {
      setSavedCardIds(new Set());
    });
  }, [currentUserId, loadSavedProfiles, providers]);

  const providerById = useMemo(
    () => new Map(providers.map((provider) => [provider.id, provider])),
    [providers],
  );

  const persistProfileShare = useCallback(
    async (
      provider: ProviderCardModel,
      channel: "native" | "clipboard",
      activeViewerId: string | null,
    ) => {
      if (!activeViewerId) return;
      const profilePath =
        provider.publicProfilePath || provider.fullProfilePath;

      const { error } = await supabase.from("feed_card_shares").insert({
        user_id: activeViewerId,
        card_id: buildProfileCardId(provider.id),
        focus_id: provider.id,
        card_type: "service",
        title: provider.name,
        channel,
        metadata: {
          kind: "people_profile",
          image: provider.media[0]?.url || provider.avatar,
          mediaGallery: provider.media.map((entry) => entry.url).slice(0, 3),
          priceLabel: provider.minPriceLabel
            ? `From ${provider.minPriceLabel}`
            : null,
          audienceName: provider.location,
          tags: provider.tags.slice(0, 3),
          actionPath: profilePath,
          role: provider.role,
        },
      });

      if (error && !isMissingRelationError(error.message || "")) {
        console.warn("Failed to persist profile share:", error.message);
      }
    },
    [],
  );

  const handleConnect = useCallback(
    async (providerId: string) => {
      setNoticeBanner(null);
      try {
        if (!connectionSchemaReady) {
          throw new Error(
            connectionSchemaMessage || "Connections are not configured yet.",
          );
        }

        if (!isUuid(providerId)) {
          throw new Error("This profile cannot accept live connections yet.");
        }

        const viewerId = await ensureViewerId();
        if (viewerId === providerId) {
          throw new Error("This is your own profile.");
        }

        const previousState = getConnectionState(providerId);
        await sendRequest(providerId);

        setNoticeBanner({
          kind: "success",
          message:
            previousState.kind === "incoming_pending"
              ? "Connected! Their posts now appear in your Welcome feed."
              : "Connection request sent. You\'ll get notified when they accept — their posts will then appear in your Welcome feed.",
        });
        setShowConnectionExplainer(true);
        setTimeout(() => setShowConnectionExplainer(false), 8000);
      } catch (error) {
        setNoticeBanner({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to send connection request.",
        });
      }
    },
    [
      connectionSchemaMessage,
      connectionSchemaReady,
      ensureViewerId,
      getConnectionState,
      sendRequest,
    ],
  );

  const handleConnectionDecision = useCallback(
    async (requestId: string, decision: ConnectionDecision) => {
      setNoticeBanner(null);
      try {
        if (!connectionSchemaReady) {
          throw new Error(
            connectionSchemaMessage || "Connections are not configured yet.",
          );
        }

        await respond(requestId, decision);
        setNoticeBanner({
          kind: "success",
          message:
            decision === "accepted"
              ? "Connection accepted."
              : decision === "rejected"
                ? "Connection request declined."
                : "Connection request cancelled.",
        });
        if (decision === "accepted") {
          setShowConnectionExplainer(true);
          setTimeout(() => setShowConnectionExplainer(false), 8000);
        }
      } catch (error) {
        setNoticeBanner({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to update connection request.",
        });
      }
    },
    [connectionSchemaMessage, connectionSchemaReady, respond],
  );
  const openChatThread = useCallback(
    async (providerId: string) => {
      setNoticeBanner(null);
      setChatBusyUserId(providerId);
      try {
        if (!isUuid(providerId)) {
          throw new Error("This profile does not support direct chat yet.");
        }

        const viewerId = await ensureViewerId();
        if (viewerId === providerId) {
          throw new Error("This is your own profile.");
        }

        const conversationId = await getOrCreateDirectConversationId(
          supabase,
          viewerId,
          providerId,
        );
        router.push(
          `/dashboard/chat?open=${encodeURIComponent(conversationId)}`,
        );
      } catch (error) {
        setNoticeBanner({
          kind: "error",
          message:
            error instanceof Error ? error.message : "Unable to open chat.",
        });
      } finally {
        setChatBusyUserId(null);
      }
    },
    [ensureViewerId, router],
  );

  const handleToggleSave = useCallback(
    async (providerId: string) => {
      const provider = providerById.get(providerId);
      if (!provider) return;

      const cardId = buildProfileCardId(providerId);
      const wasSaved = savedCardIds.has(cardId);
      const shouldSave = !wasSaved;

      setSavingCardIds((current) => new Set(current).add(cardId));
      setSavedCardIds((current) => {
        const next = new Set(current);
        if (shouldSave) {
          next.add(cardId);
        } else {
          next.delete(cardId);
        }
        return next;
      });

      try {
        const viewerId = await ensureViewerId();
        const profilePath =
          provider.publicProfilePath || provider.fullProfilePath;
        const savePayload = {
          card_id: cardId,
          focus_id: provider.id,
          card_type: "service" as const,
          title: provider.name,
          subtitle: provider.role,
          action_path: profilePath,
          metadata: {
            kind: "people_profile",
            image: provider.media[0]?.url || provider.avatar,
            mediaGallery: provider.media.map((entry) => entry.url).slice(0, 3),
            priceLabel: provider.minPriceLabel
              ? `From ${provider.minPriceLabel}`
              : null,
            audienceName: provider.location,
            tags: provider.tags.slice(0, 3),
            role: provider.role,
            actionPath: profilePath,
          },
        };

        if (shouldSave) {
          stagePendingFeedCardSave(viewerId, savePayload);
          await persistFeedCardSave(supabase, savePayload);

          setNoticeBanner({ kind: "success", message: "Profile saved." });
          return;
        }

        clearPendingFeedCardSave(viewerId, cardId);
        await removeFeedCardSave(supabase, cardId);

        setNoticeBanner({ kind: "info", message: "Removed from saved." });
      } catch (error) {
        try {
          const viewerId = await ensureViewerId();
          const profilePath =
            provider.publicProfilePath || provider.fullProfilePath;
          const rollbackPayload = {
            card_id: cardId,
            focus_id: provider.id,
            card_type: "service" as const,
            title: provider.name,
            subtitle: provider.role,
            action_path: profilePath,
            metadata: {
              kind: "people_profile",
              image: provider.media[0]?.url || provider.avatar,
              mediaGallery: provider.media
                .map((entry) => entry.url)
                .slice(0, 3),
              priceLabel: provider.minPriceLabel
                ? `From ${provider.minPriceLabel}`
                : null,
              audienceName: provider.location,
              tags: provider.tags.slice(0, 3),
              role: provider.role,
              actionPath: profilePath,
            },
          };

          if (shouldSave) {
            clearPendingFeedCardSave(viewerId, cardId);
          } else {
            stagePendingFeedCardSave(viewerId, rollbackPayload);
          }
        } catch {
          // Ignore viewer lookup failures during rollback.
        }

        setSavedCardIds((current) => {
          const next = new Set(current);
          if (wasSaved) {
            next.add(cardId);
          } else {
            next.delete(cardId);
          }
          return next;
        });

        setNoticeBanner({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to update saved state.",
        });
      } finally {
        setSavingCardIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          return next;
        });
      }
    },
    [ensureViewerId, providerById, savedCardIds],
  );

  const handleShareProvider = useCallback(
    async (providerId: string) => {
      const provider = providerById.get(providerId);
      if (!provider) return;

      const cardId = buildProfileCardId(providerId);
      const sharePath = provider.publicProfilePath || provider.fullProfilePath;
      const shareUrl = `${window.location.origin}${sharePath}`;
      const shareText = `${provider.name} • ${provider.role} • ${provider.location}`;

      setSharingCardIds((current) => new Set(current).add(cardId));

      try {
        let activeViewerId: string | null = null;
        try {
          activeViewerId = await ensureViewerId();
        } catch {
          activeViewerId = null;
        }

        if (navigator.share) {
          await navigator.share({
            title: provider.name,
            text: shareText,
            url: shareUrl,
          });
          await persistProfileShare(provider, "native", activeViewerId);
          setNoticeBanner({ kind: "success", message: "Share sent." });
          return;
        }

        if (!navigator.clipboard?.writeText) {
          throw new Error("This browser does not support clipboard sharing.");
        }

        await navigator.clipboard.writeText(
          `${provider.name}\n${shareText}\n${shareUrl}`,
        );
        await persistProfileShare(provider, "clipboard", activeViewerId);
        setNoticeBanner({ kind: "success", message: "Profile link copied." });
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        setNoticeBanner({
          kind: "error",
          message:
            error instanceof Error
              ? error.message
              : "Unable to share right now.",
        });
      } finally {
        setSharingCardIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          return next;
        });
      }
    },
    [ensureViewerId, persistProfileShare, providerById],
  );

  const getPresenceTone = useCallback(
    (provider: ProviderCardModel): PresenceTone => {
      if (onlineUserIds.has(provider.id) || provider.online) return "online";
      const availability = normalizeText(provider.availability).toLowerCase();
      if (
        availability.includes("away") ||
        availability.includes("busy") ||
        availability.includes("idle")
      ) {
        return "away";
      }
      return "offline";
    },
    [onlineUserIds],
  );

  const filteredProviders = useMemo(() => {
    const query = deferredSearchQuery.trim().toLowerCase();
    if (!query) return providers;

    return providers.filter((provider) =>
      provider.searchDocument.includes(query),
    );
  }, [deferredSearchQuery, providers]);

  const discoveryProviders = useMemo(() => {
    const presenceWeight = (tone: PresenceTone) =>
      tone === "online" ? 2 : tone === "away" ? 1 : 0;

    return [...filteredProviders].sort((left, right) => {
      const leftPresence = presenceWeight(getPresenceTone(left));
      const rightPresence = presenceWeight(getPresenceTone(right));
      return (
        right.rankScore - left.rankScore ||
        rightPresence - leftPresence ||
        left.distanceKm - right.distanceKm
      );
    });
  }, [filteredProviders, getPresenceTone]);

  const visibleProviders = useMemo(
    () => discoveryProviders.slice(0, Math.max(PAGE_SIZE, visibleCount)),
    [discoveryProviders, visibleCount],
  );
  const hasMoreProviders = visibleCount < discoveryProviders.length;

  useEffect(() => {
    if (loadMoreTimerRef.current) {
      window.clearTimeout(loadMoreTimerRef.current);
      loadMoreTimerRef.current = null;
    }
    setVisibleCount(Math.min(PAGE_SIZE, discoveryProviders.length));
    setLoadingMore(false);
  }, [discoveryProviders.length]);

  useEffect(() => {
    return () => {
      if (loadMoreTimerRef.current) {
        window.clearTimeout(loadMoreTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    if (loading || !hasMoreProviders || !infiniteSentinelRef.current) return;
    const sentinel = infiniteSentinelRef.current;

    const observer = new IntersectionObserver(
      (entries) => {
        const entry = entries[0];
        if (!entry?.isIntersecting || loadingMore || !hasMoreProviders) return;

        setLoadingMore(true);
        if (loadMoreTimerRef.current) {
          window.clearTimeout(loadMoreTimerRef.current);
        }

        loadMoreTimerRef.current = window.setTimeout(() => {
          setVisibleCount((previous) =>
            Math.min(previous + PAGE_SIZE, discoveryProviders.length),
          );
          setLoadingMore(false);
          loadMoreTimerRef.current = null;
        }, 220);
      },
      { rootMargin: "240px 0px" },
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [discoveryProviders.length, hasMoreProviders, loading, loadingMore]);

  useEffect(() => {
    if (!visibleProviders.length) {
      setActiveProviderId(null);
      return;
    }

    if (
      activeProviderId &&
      visibleProviders.some((provider) => provider.id === activeProviderId)
    ) {
      return;
    }

    setActiveProviderId(visibleProviders[0].id);
  }, [activeProviderId, visibleProviders]);

  const setCardElement = useCallback(
    (providerId: string, element: HTMLDivElement | null) => {
      if (element) {
        cardElementsRef.current.set(providerId, element);
        return;
      }
      cardElementsRef.current.delete(providerId);
    },
    [],
  );

  const jumpToProviderCard = useCallback((providerId: string) => {
    setActiveProviderId(providerId);
    const element = cardElementsRef.current.get(providerId);
    if (!element) return;
    element.scrollIntoView({ behavior: "smooth", block: "start" });
  }, []);

  const handlePeoplePromptSubmit = useCallback(() => {
    const firstMatch = discoveryProviders[0];

    if (firstMatch) {
      jumpToProviderCard(firstMatch.id);
      return;
    }

    if (searchQuery.trim()) {
      setNoticeBanner({
        kind: "info",
        message: `No people matched "${searchQuery.trim()}". Try a broader name, role, or location.`,
      });
    }
  }, [discoveryProviders, jumpToProviderCard, searchQuery]);

  const peoplePromptConfig = useMemo<DashboardPromptConfig>(
    () => ({
      placeholder: "Search people by name, role, location, or expertise",
      value: searchQuery,
      onValueChange: setSearchQuery,
      onSubmit: handlePeoplePromptSubmit,
    }),
    [handlePeoplePromptSubmit, searchQuery],
  );

  useDashboardPrompt(peoplePromptConfig);

  useEffect(() => {
    if (!visibleProviders.length) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const mostVisibleEntry = [...entries]
          .filter((entry) => entry.isIntersecting)
          .sort(
            (left, right) => right.intersectionRatio - left.intersectionRatio,
          )[0];

        const providerId =
          mostVisibleEntry?.target.getAttribute("data-provider-id");
        if (!providerId) return;
        setActiveProviderId(providerId);
      },
      {
        threshold: [0.35, 0.55, 0.75],
        rootMargin: "-10% 0px -18% 0px",
      },
    );

    visibleProviders.forEach((provider) => {
      const element = cardElementsRef.current.get(provider.id);
      if (element) {
        observer.observe(element);
      }
    });

    return () => observer.disconnect();
  }, [visibleProviders]);

  useEffect(() => {
    if (!deepLinkContext.providerId || deepLinkHandledRef.current) return;
    if (
      !visibleProviders.some(
        (provider) => provider.id === deepLinkContext.providerId,
      )
    )
      return;

    deepLinkHandledRef.current = true;
    jumpToProviderCard(deepLinkContext.providerId);
  }, [deepLinkContext.providerId, jumpToProviderCard, visibleProviders]);

  const providerPreviewMap = useMemo(() => {
    const map = new Map<string, ProviderPreview>();
    providers.forEach((provider) => {
      map.set(provider.id, {
        id: provider.id,
        name: provider.name,
        avatar: provider.avatar,
        role: provider.role,
        presenceTone: getPresenceTone(provider),
        distanceLabel: `${provider.distanceKm.toFixed(1)} km away`,
        ratingLabel:
          provider.rating !== null && provider.reviews > 0
            ? `${provider.rating.toFixed(1)} | ${provider.reviews} reviews`
            : "No reviews yet",
        tagline: provider.trustBlurb,
      });
    });
    return map;
  }, [getPresenceTone, providers]);

  useEffect(() => {
    providerPreviewRef.current = providerPreviewMap;
  }, [providerPreviewMap]);

  useEffect(() => {
    if (!currentUserId) return;

    let active = true;
    let reloadTimer: number | null = null;

    const scheduleReload = () => {
      if (reloadTimer) {
        window.clearTimeout(reloadTimer);
      }
      reloadTimer = window.setTimeout(() => {
        void loadProviders(true);
      }, 260);
    };

    const handleConnectionRealtimeEvent = (
      payload: RealtimePostgresChangesPayload<RealtimeConnectionRow>,
    ) => {
      const nextRow = (payload.new as RealtimeConnectionRow | null) || null;
      const previousRow = (payload.old as RealtimeConnectionRow | null) || null;
      const requesterId = normalizeText(
        nextRow?.requester_id || previousRow?.requester_id,
      );
      const recipientId = normalizeText(
        nextRow?.recipient_id || previousRow?.recipient_id,
      );
      const status = normalizeText(
        nextRow?.status || previousRow?.status,
      ).toLowerCase();
      const isRelevant =
        requesterId === currentUserId || recipientId === currentUserId;
      if (!isRelevant) return;

      scheduleReload();

      if (
        payload.eventType === "INSERT" &&
        recipientId === currentUserId &&
        status === "pending"
      ) {
        const requesterName =
          providerPreviewRef.current.get(requesterId)?.name ||
          "A nearby member";
        setRealtimeToast({
          id: Date.now(),
          message: `${requesterName} just sent you a connection request.`,
        });
      }
    };

    const handleSavedRealtimeEvent = (
      payload: RealtimePostgresChangesPayload<{ card_id?: string | null }>,
    ) => {
      const nextRow =
        (payload.new as { card_id?: string | null } | null) || null;
      const previousRow =
        (payload.old as { card_id?: string | null } | null) || null;
      const cardId = normalizeText(nextRow?.card_id || previousRow?.card_id);
      if (!cardId.startsWith("people:")) return;

      setSavedCardIds((current) => {
        const next = new Set(current);
        if (payload.eventType === "DELETE") {
          clearPendingFeedCardSave(currentUserId, cardId);
          next.delete(cardId);
        } else {
          prunePendingFeedCardSaves(currentUserId, [cardId]);
          next.add(cardId);
        }
        return next;
      });
    };

    const presenceChannel = supabase.channel(GLOBAL_PRESENCE_CHANNEL, {
      config: {
        presence: {
          key: currentUserId,
        },
      },
    });

    const syncOnlineUsers = () => {
      if (!active) return;
      setOnlineUserIds(extractPresenceUserIds(presenceChannel.presenceState()));
    };

    presenceChannel
      .on("presence", { event: "sync" }, syncOnlineUsers)
      .on("presence", { event: "join" }, syncOnlineUsers)
      .on("presence", { event: "leave" }, syncOnlineUsers)
      .subscribe(async (status) => {
        if (status !== "SUBSCRIBED" || !active) return;
        await presenceChannel.track({
          user_id: currentUserId,
          page: "people",
          last_seen_at: new Date().toISOString(),
        });
      });

    let realtimeChannel = supabase
      .channel(`people-live-${currentUserId}`)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "profiles" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_listings" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_catalog" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "provider_presence" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "reviews" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "orders" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "posts" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "help_requests" },
        scheduleReload,
      )
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_card_saves",
          filter: `user_id=eq.${currentUserId}`,
        },
        handleSavedRealtimeEvent,
      );

    if (connectionSchemaReady) {
      realtimeChannel = realtimeChannel.on(
        "postgres_changes",
        { event: "*", schema: "public", table: "connection_requests" },
        handleConnectionRealtimeEvent,
      );
    }

    realtimeChannel = realtimeChannel.subscribe();

    const presenceHeartbeatTimer = window.setInterval(() => {
      void presenceChannel.track({
        user_id: currentUserId,
        page: "people",
        last_seen_at: new Date().toISOString(),
      });
    }, AUTO_SYNC_INTERVAL_MS);

    const autoSyncTimer = window.setInterval(() => {
      void loadProviders(true);
    }, AUTO_SYNC_INTERVAL_MS);

    return () => {
      active = false;
      if (reloadTimer) {
        window.clearTimeout(reloadTimer);
      }
      window.clearInterval(presenceHeartbeatTimer);
      window.clearInterval(autoSyncTimer);
      void presenceChannel.untrack();
      void supabase.removeChannel(presenceChannel);
      void supabase.removeChannel(realtimeChannel);
      setOnlineUserIds(new Set());
    };
  }, [connectionSchemaReady, currentUserId, loadProviders]);

  const activeProvider = useMemo(
    () =>
      visibleProviders.find((provider) => provider.id === activeProviderId) ||
      visibleProviders[0] ||
      null,
    [activeProviderId, visibleProviders],
  );

  const peopleMapItems = useMemo(
    () =>
      visibleProviders
        .filter(
          (provider) =>
            typeof provider.latitude === "number" &&
            Number.isFinite(provider.latitude) &&
            typeof provider.longitude === "number" &&
            Number.isFinite(provider.longitude),
        )
        .map((provider) => ({
          id: provider.id,
          title: provider.name,
          lat: provider.latitude as number,
          lng: provider.longitude as number,
          creatorName: provider.name,
          locationLabel: provider.location,
          category: provider.primarySkill,
          timeLabel: provider.recentActivityLabel,
          priceLabel: provider.minPriceLabel || undefined,
        })),
    [visibleProviders],
  );

  const peopleMapCenter = useMemo(() => {
    if (
      activeProvider &&
      typeof activeProvider.latitude === "number" &&
      Number.isFinite(activeProvider.latitude) &&
      typeof activeProvider.longitude === "number" &&
      Number.isFinite(activeProvider.longitude)
    ) {
      return {
        lat: activeProvider.latitude,
        lng: activeProvider.longitude,
      };
    }

    const firstMapItem = peopleMapItems[0];
    return firstMapItem
      ? {
          lat: firstMapItem.lat,
          lng: firstMapItem.lng,
        }
      : null;
  }, [activeProvider, peopleMapItems]);

  const activeNow = useMemo(
    () =>
      providers.filter((provider) => getPresenceTone(provider) === "online")
        .length,
    [getPresenceTone, providers],
  );

  return (
    <div
      className="mx-auto w-full max-w-[1540px] space-y-4 overflow-x-clip pb-2 sm:space-y-5"
      style={{
        backgroundImage:
          "radial-gradient(circle at 0% 0%, rgba(14,165,164,0.08), transparent 34%), radial-gradient(circle at 100% 8%, rgba(17,70,106,0.08), transparent 30%), linear-gradient(180deg, rgba(255,255,255,0.44), rgba(255,255,255,0))",
      }}
    >
      <RouteObservability route="people" />

      <PeopleLiveHeader
        activeNow={activeNow}
        connectionCount={connectionBuckets.accepted.length}
        outgoingCount={connectionBuckets.outgoing.length}
        syncing={syncing}
        lastSyncedAt={lastSyncedAt}
        incoming={connectionBuckets.incoming}
        outgoing={connectionBuckets.outgoing}
        accepted={connectionBuckets.accepted}
        providerPreviewMap={providerPreviewMap}
        busyRequestId={busyConnectionRequestId}
        busyActionKey={busyActionKey}
        initialPanel={
          deepLinkContext.panel === "incoming"
            ? "incoming"
            : deepLinkContext.panel === "outgoing"
              ? "outgoing"
              : deepLinkContext.panel === "connected"
                ? "connected"
                : null
        }
        onAccept={(requestId) =>
          void handleConnectionDecision(requestId, "accepted")
        }
        onDecline={(requestId) =>
          void handleConnectionDecision(requestId, "rejected")
        }
        onCancel={(requestId) =>
          void handleConnectionDecision(requestId, "cancelled")
        }
        onDisconnect={(requestId) =>
          void handleConnectionDecision(requestId, "cancelled")
        }
      />

      <PageContextStrip
        label="People"
        description="Discover and connect with nearby providers — send requests, view profiles, and start conversations."
        action={{ label: "Edit Profile", href: "/dashboard/profile" }}
        switchAction={{ label: "Connected Feed", href: "/dashboard/welcome" }}
      />

      <PeopleMapPanel
        items={peopleMapItems}
        center={peopleMapCenter}
        activeProvider={activeProvider}
        onSelectProvider={jumpToProviderCard}
      />

      {viewerCompletionPercent !== null &&
        viewerCompletionPercent < 70 &&
        !profileBannerDismissed && (
          <div className="rounded-[1.6rem] border border-indigo-200 bg-gradient-to-r from-indigo-50 to-sky-50 px-4 py-3 shadow-sm sm:px-5">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex min-w-0 items-start gap-3">
                <Sparkles className="mt-0.5 h-4 w-4 shrink-0 text-indigo-600" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-indigo-900">
                    Your profile is {viewerCompletionPercent}% complete
                  </p>
                  <p className="mt-0.5 text-xs text-slate-600">
                    A complete profile gets 3× more connection requests and
                    quote inquiries.
                  </p>
                  <div className="mt-2 h-1.5 w-full max-w-[12rem] overflow-hidden rounded-full bg-indigo-200">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-indigo-500 to-sky-400 transition-all"
                      style={{ width: `${viewerCompletionPercent}%` }}
                    />
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => router.push("/dashboard/profile")}
                  className="rounded-full bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition hover:bg-indigo-500"
                >
                  Complete profile
                </button>
                <button
                  type="button"
                  onClick={() => setProfileBannerDismissed(true)}
                  className="rounded-full border border-indigo-200 bg-white px-3 py-1.5 text-xs font-semibold text-indigo-700 transition hover:bg-indigo-50"
                >
                  Dismiss
                </button>
              </div>
            </div>
          </div>
        )}

      {!connectionSchemaReady && !!connectionSchemaMessage && (
        <div className="rounded-[1.6rem] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800 shadow-sm sm:px-5">
          <div className="flex items-start gap-3">
            <Bell className="mt-0.5 h-4 w-4 shrink-0" />
            <p className="min-w-0 leading-6 [overflow-wrap:anywhere]">
              {connectionSchemaMessage}
            </p>
          </div>
        </div>
      )}

      {errorMessage && (
        <div className="rounded-[1.6rem] border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700 shadow-sm sm:px-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <span className="inline-flex min-w-0 items-start gap-2 font-medium">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              <span className="[overflow-wrap:anywhere]">{errorMessage}</span>
            </span>
            <button
              type="button"
              onClick={() => void loadProviders(false)}
              className="rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              Retry
            </button>
          </div>
        </div>
      )}

      {noticeBanner && (
        <div
          className={`rounded-[1.6rem] border px-4 py-3 text-sm shadow-sm sm:px-5 ${
            noticeBanner.kind === "success"
              ? "border-emerald-200 bg-emerald-50 text-emerald-700"
              : noticeBanner.kind === "error"
                ? "border-rose-200 bg-rose-50 text-rose-700"
                : "border-cyan-200 bg-cyan-50 text-[var(--brand-700)]"
          }`}
        >
          <div className="flex items-start gap-3">
            {noticeBanner.kind === "success" ? (
              <Sparkles className="mt-0.5 h-4 w-4 shrink-0" />
            ) : noticeBanner.kind === "error" ? (
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            ) : (
              <Bell className="mt-0.5 h-4 w-4 shrink-0" />
            )}
            <p className="min-w-0 leading-6 [overflow-wrap:anywhere]">
              {noticeBanner.message}
            </p>
          </div>
        </div>
      )}

      {showConnectionExplainer && (
        <WhatHappensNext kind="connect" />
      )}

      <div className="min-w-0">
        <main className="space-y-6">
          {loading ? (
            <ProviderCardSkeleton count={8} />
          ) : !providers.length ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-slate-100 text-slate-500">
                <Users className="h-7 w-7" />
              </div>
              <p className="mt-4 text-xl font-semibold text-slate-900">
                No business profiles are visible yet
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                ServiQ will populate this discovery feed automatically as nearby
                people publish their business profiles, services, and trust
                details.
              </p>
              <button
                type="button"
                onClick={() => void loadProviders(false)}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
              >
                Check again
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </button>
            </div>
          ) : !discoveryProviders.length ? (
            <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-sm">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-[linear-gradient(135deg,rgba(14,165,164,0.12),rgba(103,232,249,0.18))] text-[var(--brand-700)]">
                <Compass className="h-7 w-7" />
              </div>
              <p className="mt-4 text-xl font-semibold text-slate-900">
                {searchQuery.trim()
                  ? "No people match this search yet"
                  : "No providers found yet"}
              </p>
              <p className="mt-2 text-sm leading-6 text-slate-500">
                {searchQuery.trim()
                  ? "Try a different name, role, location, or expertise keyword."
                  : "Published people and business profiles will appear here as they become available."}
              </p>
              <button
                type="button"
                onClick={() => {
                  if (searchQuery.trim()) {
                    setSearchQuery("");
                    return;
                  }
                  void loadProviders(false);
                }}
                className="mt-5 inline-flex items-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
              >
                {searchQuery.trim() ? "Clear search" : "Check again"}
                <ChevronDown className="h-4 w-4 -rotate-90" />
              </button>
            </div>
          ) : (
            <>
              <motion.section
                initial="hidden"
                animate="show"
                variants={{
                  hidden: {},
                  show: {
                    transition: {
                      staggerChildren: 0.06,
                    },
                  },
                }}
                className="grid grid-cols-1 items-start gap-3 sm:grid-cols-2 sm:gap-4 xl:grid-cols-3 2xl:grid-cols-4"
              >
                {visibleProviders.map((provider) => {
                  const connectionState =
                    getConnectionState(provider.id) || EMPTY_CONNECTION_STATE;
                  const connectionBusy =
                    busyConnectionTargetId === provider.id ||
                    (connectionState.requestId
                      ? busyConnectionRequestId === connectionState.requestId
                      : false);
                  const cardId = buildProfileCardId(provider.id);

                  return (
                    <motion.div
                      key={provider.id}
                      ref={(element) => setCardElement(provider.id, element)}
                      data-provider-id={provider.id}
                      className="scroll-mt-28"
                      variants={{
                        hidden: { opacity: 0, y: 18 },
                        show: {
                          opacity: 1,
                          y: 0,
                          transition: { duration: 0.3, ease: "easeOut" },
                        },
                      }}
                    >
                      <ProviderCard
                        provider={provider}
                        presenceTone={getPresenceTone(provider)}
                        connectionState={connectionState}
                        busy={connectionBusy}
                        busyActionKey={busyActionKey}
                        chatBusy={chatBusyUserId === provider.id}
                        isActive={activeProviderId === provider.id}
                        saved={savedCardIds.has(cardId)}
                        saveBusy={savingCardIds.has(cardId)}
                        shareBusy={sharingCardIds.has(cardId)}
                        onActivate={setActiveProviderId}
                        onConnect={handleConnect}
                        onAccept={(requestId) =>
                          void handleConnectionDecision(requestId, "accepted")
                        }
                        onDecline={(requestId) =>
                          void handleConnectionDecision(requestId, "rejected")
                        }
                        onCancel={(requestId) =>
                          void handleConnectionDecision(requestId, "cancelled")
                        }
                        onMessage={(providerId) =>
                          void openChatThread(providerId)
                        }
                        onToggleSave={(providerId) =>
                          void handleToggleSave(providerId)
                        }
                        onShare={(providerId) =>
                          void handleShareProvider(providerId)
                        }
                        onViewProfile={(providerId) => {
                          const selectedProvider = providerById.get(providerId);
                          if (!selectedProvider) return;
                          router.push(
                            selectedProvider.publicProfilePath ||
                              selectedProvider.fullProfilePath,
                          );
                        }}
                      />
                    </motion.div>
                  );
                })}
              </motion.section>

              {hasMoreProviders && (
                <div
                  ref={infiniteSentinelRef}
                  className="flex justify-center py-2"
                >
                  <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600 shadow-sm">
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Sparkles className="h-4 w-4 text-[var(--brand-700)]" />
                    )}
                    {loadingMore
                      ? "Loading more profiles..."
                      : "Scroll for the next business showcase"}
                  </div>
                </div>
              )}
            </>
          )}
        </main>
      </div>

      <AnimatePresence>
        {realtimeToast && (
          <motion.div
            initial={{ opacity: 0, y: -8, x: 20 }}
            animate={{ opacity: 1, y: 0, x: 0 }}
            exit={{ opacity: 0, y: -8, x: 20 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-x-3 top-[5rem] z-40 rounded-[1.4rem] border border-amber-200 bg-white px-4 py-3 shadow-lg sm:left-auto sm:right-4 sm:top-4 sm:max-w-sm"
          >
            <div className="flex items-start gap-3">
              <Bell className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
              <div className="min-w-0">
                <p className="text-sm font-semibold text-slate-900">
                  Incoming request
                </p>
                <p className="mt-1 text-sm text-slate-600 [overflow-wrap:anywhere]">
                  {realtimeToast.message}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <ProviderTrustPanel
        userId={trustPanelProviderId || ""}
        open={Boolean(trustPanelProviderId)}
        onClose={() => setTrustPanelProviderId(null)}
      />
    </div>
  );
}
