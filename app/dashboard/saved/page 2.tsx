"use client";

import Image from "next/image";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Bookmark, Clock3, Loader2, Share2, Trash2 } from "lucide-react";

type FeedCardType = "demand" | "service" | "product";

type FeedCardSaveRow = {
  id: string;
  card_id: string;
  focus_id: string;
  card_type: FeedCardType;
  title: string;
  subtitle: string | null;
  action_path: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
};

type FeedToast = {
  id: number;
  kind: "success" | "error" | "info";
  message: string;
};

const fallbackCoverByType: Record<FeedCardType, string[]> = {
  demand: [
    "https://images.unsplash.com/photo-1484154218962-a197022b5858?w=1200&q=80",
    "https://images.unsplash.com/photo-1486946255434-2466348c2166?w=1200&q=80",
  ],
  service: [
    "https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=1200&q=80",
    "https://images.unsplash.com/photo-1616046229478-9901c5536a45?w=1200&q=80",
  ],
  product: [
    "https://images.unsplash.com/photo-1517649763962-0c623066013b?w=1200&q=80",
    "https://images.unsplash.com/photo-1526178613552-2b45c6c302f0?w=1200&q=80",
  ],
};

const typeBadgeLabel: Record<FeedCardType, string> = {
  demand: "Need",
  service: "Service",
  product: "Product",
};

const readMetaString = (metadata: Record<string, unknown> | null, key: string) => {
  if (!metadata) return null;
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
};

const readMetaStringArray = (metadata: Record<string, unknown> | null, key: string) => {
  if (!metadata) return [];
  const value = metadata[key];
  if (!Array.isArray(value)) return [];
  return value.filter((entry): entry is string => typeof entry === "string" && entry.trim().length > 0);
};

const formatSavedAgo = (createdAt: string) => {
  const savedTime = new Date(createdAt).getTime();
  if (!Number.isFinite(savedTime)) return "saved recently";

  const diffMinutes = Math.max(1, Math.floor((Date.now() - savedTime) / 60000));
  if (diffMinutes < 60) return `saved ${diffMinutes}m ago`;

  const diffHours = Math.floor(diffMinutes / 60);
  if (diffHours < 24) return `saved ${diffHours}h ago`;

  const diffDays = Math.floor(diffHours / 24);
  return `saved ${diffDays}d ago`;
};

export default function SavedFeedPage() {
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [savedCards, setSavedCards] = useState<FeedCardSaveRow[]>([]);
  const [loadError, setLoadError] = useState("");
  const [removingCardId, setRemovingCardId] = useState<string | null>(null);
  const [sharingCardId, setSharingCardId] = useState<string | null>(null);
  const [feedToasts, setFeedToasts] = useState<FeedToast[]>([]);
  const [typeFilter, setTypeFilter] = useState<"all" | FeedCardType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const pushFeedToast = (kind: FeedToast["kind"], message: string) => {
    const id = Date.now() + Math.floor(Math.random() * 1000);
    setFeedToasts((current) => [...current, { id, kind, message }]);
    window.setTimeout(() => {
      setFeedToasts((current) => current.filter((toast) => toast.id !== id));
    }, 2600);
  };

  const buildSavedFeedPath = (card: FeedCardSaveRow) => {
    const basePath = card.action_path || "/dashboard";
    const [pathname, rawQuery = ""] = basePath.split("?");
    const params = new URLSearchParams(rawQuery);

    params.set("source", "saved_feed");
    params.set("context_card", card.card_id);
    params.set("context_focus", card.focus_id);
    params.set("context_type", card.card_type);
    params.set("context_title", card.title);
    params.set("focus", card.focus_id);
    params.set("type", card.card_type);

    const query = params.toString();
    return query ? `${pathname}?${query}` : pathname;
  };

  const loadSavedFeed = useCallback(async (showLoader = true) => {
    if (showLoader) {
      setLoading(true);
    }
    setLoadError("");

    try {
      const { data: sessionData } = await supabase.auth.getSession();
      let currentUser = sessionData.session?.user || null;

      if (!currentUser) {
        const { data: authData, error: authError } = await supabase.auth.getUser();
        if (authError) {
          throw authError;
        }
        currentUser = authData.user;
      }

      if (!currentUser) {
        setViewerId(null);
        setSavedCards([]);
        setLoadError("Sign in to sync and view your saved feed cards.");
        return;
      }

      setViewerId(currentUser.id);

      const { data, error } = await supabase
        .from("feed_card_saves")
        .select("id, card_id, focus_id, card_type, title, subtitle, action_path, metadata, created_at")
        .eq("user_id", currentUser.id)
        .order("created_at", { ascending: false })
        .limit(150);

      if (error) {
        throw error;
      }

      setSavedCards(((data as FeedCardSaveRow[] | null) || []).filter((row) => !!row.card_id));
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load saved feed.";
      console.warn("Failed to load saved feed:", message);
      setLoadError(message);
    } finally {
      if (showLoader) {
        setLoading(false);
      }
    }
  }, []);

  useEffect(() => {
    void loadSavedFeed(true);
  }, [loadSavedFeed]);

  useEffect(() => {
    if (!viewerId) return;

    const channel = supabase
      .channel(`saved-feed-${viewerId}`)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "feed_card_saves",
          filter: `user_id=eq.${viewerId}`,
        },
        () => {
          void loadSavedFeed(false);
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [loadSavedFeed, viewerId]);

  const saveStats = useMemo(() => {
    return savedCards.reduce(
      (summary, card) => {
        summary.total += 1;
        summary[card.card_type] += 1;
        return summary;
      },
      { total: 0, demand: 0, service: 0, product: 0 }
    );
  }, [savedCards]);

  const visibleSavedCards = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return savedCards.filter((card) => {
      if (typeFilter !== "all" && card.card_type !== typeFilter) return false;
      if (!query) return true;
      const haystack = `${card.title} ${card.subtitle || ""}`.toLowerCase();
      return haystack.includes(query);
    });
  }, [savedCards, searchQuery, typeFilter]);

  const handleShareCard = async (card: FeedCardSaveRow) => {
    const sharePath = buildSavedFeedPath(card);
    const shareUrl = `${window.location.origin}${sharePath}`;
    const shareText = card.subtitle || `Saved ${typeBadgeLabel[card.card_type].toLowerCase()} from your local feed`;

    setSharingCardId(card.card_id);
    try {
      if (navigator.share) {
        await navigator.share({
          title: `${typeBadgeLabel[card.card_type]}: ${card.title}`,
          text: shareText,
          url: shareUrl,
        });
        pushFeedToast("success", "Saved post shared.");
        return;
      }

      if (!navigator.clipboard?.writeText) {
        pushFeedToast("error", "Share is not supported in this browser context.");
        return;
      }

      await navigator.clipboard.writeText(`${card.title}\n${shareText}\n${shareUrl}`);
      pushFeedToast("success", "Share link copied.");
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") {
        return;
      }
      pushFeedToast("error", "Unable to share right now.");
    } finally {
      setSharingCardId((current) => (current === card.card_id ? null : current));
    }
  };

  const handleRemoveCard = async (card: FeedCardSaveRow) => {
    if (!viewerId) {
      pushFeedToast("info", "Sign in to update saved posts.");
      return;
    }

    setRemovingCardId(card.card_id);
    const previousCards = savedCards;
    setSavedCards((current) => current.filter((entry) => entry.card_id !== card.card_id));

    try {
      const { error } = await supabase
        .from("feed_card_saves")
        .delete()
        .eq("user_id", viewerId)
        .eq("card_id", card.card_id);

      if (error) {
        throw error;
      }

      pushFeedToast("success", "Removed from saved feed.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Could not remove saved post.";
      console.warn("Failed to remove saved card:", message);
      setSavedCards(previousCards);
      pushFeedToast("error", "Could not remove saved post. Try again.");
    } finally {
      setRemovingCardId((current) => (current === card.card_id ? null : current));
    }
  };

  return (
    <div className="w-full max-w-550 mx-auto space-y-5 sm:space-y-6">
      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
        <p className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.14em] text-slate-700">
          <Bookmark size={13} />
          Saved
        </p>

        <h1 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900 sm:text-3xl">Saved opportunities</h1>
        <p className="mt-1.5 max-w-2xl text-sm text-slate-600 sm:text-base">
          Revisit posts you bookmarked from connections and groups, then jump back into action instantly.
        </p>

        <div className="mt-4 grid grid-cols-2 gap-2 text-xs sm:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-slate-500">Total saved</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{saveStats.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-slate-500">Needs</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{saveStats.demand}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-slate-500">Services</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{saveStats.service}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2">
            <p className="text-slate-500">Products</p>
            <p className="mt-1 text-lg font-semibold text-slate-900">{saveStats.product}</p>
          </div>
        </div>
      </section>

      {!!loadError && (
        <div className="rounded-xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm text-rose-700">{loadError}</div>
      )}

      <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <input
            type="text"
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            placeholder="Search saved titles..."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-700 outline-none placeholder:text-slate-400 focus-visible:border-indigo-300 focus-visible:ring-2 focus-visible:ring-indigo-100 sm:max-w-xs"
          />
          <div className="flex flex-wrap gap-2">
            {[
              { key: "all", label: `All (${saveStats.total})` },
              { key: "demand", label: `Needs (${saveStats.demand})` },
              { key: "service", label: `Services (${saveStats.service})` },
              { key: "product", label: `Products (${saveStats.product})` },
            ].map((item) => (
              <button
                key={item.key}
                type="button"
                onClick={() => setTypeFilter(item.key as "all" | FeedCardType)}
                className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${
                  typeFilter === item.key
                    ? "bg-slate-900 text-white"
                    : "bg-slate-100 text-slate-700 hover:bg-slate-200"
                }`}
              >
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </section>

      {loading ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm sm:p-5">
          <div className="inline-flex items-center gap-2 rounded-lg bg-slate-100 px-3 py-1.5 text-sm text-slate-600">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading saved feed...
          </div>
        </section>
      ) : saveStats.total === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">No saved cards yet</h2>
          <p className="mt-1 text-sm text-slate-600">
            Save feed cards from Welcome to build your personal shortlist of needs, services, and products.
          </p>
          <button
            type="button"
            onClick={() => router.push("/dashboard/welcome")}
            className="mt-3 inline-flex items-center gap-1 rounded-lg bg-indigo-600 px-3 py-2 text-sm font-semibold text-white hover:bg-indigo-500"
          >
            Browse Welcome Feed
            <ArrowRight size={14} />
          </button>
        </section>
      ) : visibleSavedCards.length === 0 ? (
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="text-base font-semibold text-slate-900">No matches in saved</h2>
          <p className="mt-1 text-sm text-slate-600">
            Try a different filter or search term to find saved posts faster.
          </p>
        </section>
      ) : (
        <section data-testid="saved-feed-list" className="space-y-3">
          {visibleSavedCards.map((card, index) => {
            const metadata = card.metadata || {};
            const mediaGallery = readMetaStringArray(metadata, "mediaGallery");
            const imageFromMeta = readMetaString(metadata, "image") || mediaGallery[0] || null;
            const fallbackPool = fallbackCoverByType[card.card_type] || fallbackCoverByType.demand;
            const image = imageFromMeta || fallbackPool[index % fallbackPool.length];
            const priceLabel = readMetaString(metadata, "priceLabel");
            const etaLabel = readMetaString(metadata, "etaLabel");
            const audienceName = readMetaString(metadata, "audienceName");
            const tags = readMetaStringArray(metadata, "tags").slice(0, 2);
            const openPath = buildSavedFeedPath(card);
            const isRemoving = removingCardId === card.card_id;
            const isSharing = sharingCardId === card.card_id;

            return (
              <article
                key={card.id}
                data-testid="saved-feed-card"
                data-card-id={card.card_id}
                className="rounded-2xl border border-slate-200 bg-white p-3.5 shadow-sm sm:p-4"
              >
                <div className="grid gap-4 lg:grid-cols-[220px_minmax(0,1fr)]">
                  <div className="relative h-40 overflow-hidden rounded-xl border border-slate-200 bg-slate-100">
                    <Image src={image} alt={`${card.title} saved visual`} fill sizes="220px" className="object-cover" />
                    <span className="absolute left-2 top-2 rounded-full bg-slate-900/80 px-2 py-0.5 text-[10px] font-semibold text-white">
                      {typeBadgeLabel[card.card_type]}
                    </span>
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                      <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5">
                        <Clock3 size={11} />
                        {formatSavedAgo(card.created_at)}
                      </span>
                      {audienceName && <span>{audienceName}</span>}
                    </div>

                    <h3 className="mt-2 text-base font-semibold text-slate-900 sm:text-lg">{card.title}</h3>
                    {card.subtitle && <p className="mt-1 text-sm text-slate-600">{card.subtitle}</p>}

                    <div className="mt-2 flex flex-wrap items-center gap-2 text-[11px] text-slate-600">
                      {priceLabel && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{priceLabel}</span>}
                      {etaLabel && <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-1">{etaLabel}</span>}
                      {tags.map((tag) => (
                        <span key={`${card.id}-${tag}`} className="rounded-full border border-indigo-200 bg-indigo-50 px-2 py-1 text-indigo-700">
                          {tag}
                        </span>
                      ))}
                    </div>

                    <div className="mt-3 flex flex-wrap items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => router.push(openPath)}
                        data-testid="saved-feed-open"
                        className="inline-flex items-center gap-1 rounded-md bg-indigo-600 px-3 py-1.5 text-xs font-semibold text-white transition-colors hover:bg-indigo-500"
                      >
                        Open
                        <ArrowRight size={11} />
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleShareCard(card)}
                        disabled={isSharing}
                        data-testid="saved-feed-share"
                        className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-indigo-300 hover:text-indigo-600 disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        <Share2 size={12} />
                        {isSharing ? "Sharing..." : "Share"}
                      </button>
                      <button
                        type="button"
                        onClick={() => void handleRemoveCard(card)}
                        disabled={isRemoving}
                        data-testid="saved-feed-remove"
                        className="inline-flex items-center gap-1 rounded-md border border-rose-200 bg-white px-3 py-1.5 text-xs font-medium text-rose-700 transition-colors hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-65"
                      >
                        <Trash2 size={12} />
                        {isRemoving ? "Unsaving..." : "Unsave"}
                      </button>
                    </div>
                  </div>
                </div>
              </article>
            );
          })}
        </section>
      )}

      <div
        aria-live="polite"
        aria-atomic="true"
        className="pointer-events-none fixed bottom-6 right-4 z-[1200] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2 sm:right-6"
      >
        {feedToasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className={`rounded-xl border px-3 py-2 text-sm shadow-lg backdrop-blur ${
              toast.kind === "success"
                ? "border-emerald-200 bg-emerald-50/95 text-emerald-800"
                : toast.kind === "error"
                ? "border-rose-200 bg-rose-50/95 text-rose-800"
                : "border-indigo-200 bg-indigo-50/95 text-indigo-800"
            }`}
          >
            {toast.message}
          </div>
        ))}
      </div>
    </div>
  );
}
