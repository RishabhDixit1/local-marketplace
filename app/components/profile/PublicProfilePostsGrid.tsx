"use client";

/* eslint-disable @next/next/no-img-element */

import { useCallback, useEffect, useRef, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  Bookmark,
  BookmarkCheck,
  Check,
  ChevronLeft,
  ChevronRight,
  Clock3,
  Loader2,
  MapPin,
  MoreVertical,
  Music2,
  Play,
  Share2,
  ShoppingBag,
  ShoppingCart,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import ProfileToastViewport, { type ProfileToast } from "@/app/components/profile/ProfileToastViewport";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { useCart } from "@/app/components/store/CartContext";
import { getOrCreateDirectConversationId } from "@/lib/directMessages";
import {
  clearPendingFeedCardSave,
  getPendingFeedCardIds,
  persistFeedCardSave,
  prunePendingFeedCardSaves,
  removeFeedCardSave,
  stagePendingFeedCardSave,
  syncPendingFeedCardSaves,
} from "@/lib/feedCardSavesClient";
import { useConnectionRequests } from "@/lib/hooks/useConnectionRequests";
import type { PublicProfilePost, PublicProfilePostMedia } from "@/lib/profile/public";
import { fetchAuthedJson } from "@/lib/clientApi";
import { supabase } from "@/lib/supabase";

type Props = {
  posts: PublicProfilePost[];
  profileUserId: string;
  displayName: string;
  avatarUrl: string | null;
  verificationStatus: "verified" | "pending" | "unclaimed";
  locationLabel: string;
  responseMinutes: number;
  publicPath: string;
  horizontal?: boolean;
};

const formatRelativeAge = (value?: string | null) => {
  if (!value) return "Recently posted";

  const parsed = new Date(value).getTime();
  if (!Number.isFinite(parsed)) return "Recently posted";

  const diffMs = Math.max(0, Date.now() - parsed);
  const minutes = Math.floor(diffMs / (60 * 1000));
  if (minutes < 1) return "Just now";
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
};

const normalizeStatusLabel = (status?: string | null) => {
  const normalized = (status || "open").trim().toLowerCase();
  if (!normalized) return "Open";
  return normalized
    .split("_")
    .map((segment) => segment.charAt(0).toUpperCase() + segment.slice(1))
    .join(" ");
};

const formatPriceLabel = (post: Pick<PublicProfilePost, "price" | "type">) => {
  if (post.price > 0) return `INR ${Math.round(post.price).toLocaleString("en-IN")}`;
  if (post.type === "demand") return "Budget shared in chat";
  return "Price on request";
};

const toErrorMessage = (error: unknown, fallback: string) => (error instanceof Error ? error.message : fallback);

const isMissingRelationError = (message: string) =>
  /relation .* does not exist|table .* does not exist|function .* does not exist|schema cache/i.test(message);

const isClosedStatus = (status?: string | null) =>
  new Set(["cancelled", "canceled", "closed", "completed", "fulfilled", "archived", "deleted", "hidden"]).has(
    (status || "").trim().toLowerCase()
  );

const isUUIDLike = (value?: string | null) =>
  !!value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);

function MediaCarousel({ media, title }: { media: PublicProfilePostMedia[]; title: string }) {
  const [activeIndex, setActiveIndex] = useState(0);
  const [loadedMediaUrls, setLoadedMediaUrls] = useState<Set<string>>(new Set());

  if (!media.length) {
    return (
      <div className="grid aspect-[16/9] place-items-center rounded-2xl border border-dashed border-slate-200 bg-gradient-to-br from-slate-50 via-white to-indigo-50 text-center">
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
  const isLoadedMedia = loadedMediaUrls.has(current.url);
  const isRemoteImage = /^https?:\/\//i.test(current.url);

  const loadCurrentMedia = () => {
    setLoadedMediaUrls((currentSet) => {
      const nextSet = new Set(currentSet);
      nextSet.add(current.url);
      return nextSet;
    });
  };

  return (
    <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-100">
      <div className="relative aspect-[16/9]">
        {current.mimeType.startsWith("image/") && !current.mimeType.startsWith("image/svg") ? (
          isRemoteImage ? (
            <Image
              src={current.url}
              alt={title}
              fill
              sizes="(max-width: 640px) 92vw, (max-width: 1024px) 48vw, 36vw"
              quality={72}
              loading="lazy"
              className="object-cover"
            />
          ) : (
            <img src={current.url} alt={title} loading="lazy" decoding="async" className="h-full w-full object-cover" />
          )
        ) : current.mimeType.startsWith("video/") && isLoadedMedia ? (
          <video src={current.url} controls preload="metadata" className="h-full w-full object-cover" />
        ) : current.mimeType.startsWith("video/") ? (
          <button
            type="button"
            onClick={loadCurrentMedia}
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-white"
            aria-label={`Load video for ${title}`}
          >
            <span className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-xl">
              <Play className="ml-1 h-7 w-7 fill-current" />
            </span>
            <span className="text-sm font-semibold">Tap to load video</span>
            <span className="text-xs text-white/70">Media loads only when you open it.</span>
          </button>
        ) : current.mimeType.startsWith("audio/") && isLoadedMedia ? (
          <div className="grid h-full place-items-center bg-slate-900 p-4 text-center">
            <div className="w-full max-w-xs space-y-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-white/80">Audio Attachment</p>
              <audio src={current.url} controls className="w-full" preload="metadata" />
            </div>
          </div>
        ) : current.mimeType.startsWith("audio/") ? (
          <button
            type="button"
            onClick={loadCurrentMedia}
            className="flex h-full w-full flex-col items-center justify-center gap-3 bg-slate-950 px-4 text-center text-white"
            aria-label={`Load audio for ${title}`}
          >
            <span className="inline-flex h-14 w-14 items-center justify-center rounded-full bg-white/95 text-slate-950 shadow-xl">
              <Music2 className="h-6 w-6" />
            </span>
            <span className="text-sm font-semibold">Tap to load audio</span>
            <span className="text-xs text-white/70">Media loads only when you open it.</span>
          </button>
        ) : (
          <div className="grid h-full place-items-center bg-gradient-to-br from-indigo-50 via-white to-slate-100 p-4 text-center">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Media Preview</p>
          </div>
        )}
      </div>

      {canNavigate ? (
        <>
          <button
            type="button"
            onClick={() => {
              setActiveIndex((currentIndex) => {
                const normalized = Math.min(currentIndex, media.length - 1);
                return (normalized - 1 + media.length) % media.length;
              });
            }}
            className="absolute left-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            aria-label="Previous media"
          >
            <ChevronLeft size={14} />
          </button>
          <button
            type="button"
            onClick={() => {
              setActiveIndex((currentIndex) => {
                const normalized = Math.min(currentIndex, media.length - 1);
                return (normalized + 1) % media.length;
              });
            }}
            className="absolute right-2 top-1/2 inline-flex h-8 w-8 -translate-y-1/2 items-center justify-center rounded-full border border-white/60 bg-white/90 text-slate-700 shadow-sm transition hover:bg-white"
            aria-label="Next media"
          >
            <ChevronRight size={14} />
          </button>
        </>
      ) : null}

      <div className="pointer-events-none absolute bottom-2 left-2 rounded-full bg-slate-900/70 px-2.5 py-1 text-[11px] font-semibold text-white">
        {Math.min(safeIndex + 1, media.length)} / {media.length}
      </div>
    </div>
  );
}

export default function PublicProfilePostsGrid({
  posts,
  profileUserId,
  displayName,
  avatarUrl,
  verificationStatus,
  locationLabel,
  responseMinutes: _responseMinutes,
  publicPath,
  horizontal = false,
}: Props) {
  void _responseMinutes;
  const router = useRouter();
  const toastTimersRef = useRef<Map<string, number>>(new Map());
  const [items, setItems] = useState(posts);
  const [toasts, setToasts] = useState<ProfileToast[]>([]);
  const [savedCardIds, setSavedCardIds] = useState<Set<string>>(new Set());
  const [savingCardIds, setSavingCardIds] = useState<Set<string>>(new Set());
  const [sharingCardIds, setSharingCardIds] = useState<Set<string>>(new Set());
  const [acceptingCardIds, setAcceptingCardIds] = useState<Set<string>>(new Set());
  const [chatOpening, setChatOpening] = useState(false);
  const [addedToCart, setAddedToCart] = useState<string | null>(null);
  const [ownerMenuOpenId, setOwnerMenuOpenId] = useState<string | null>(null);
  const [ownerBusyId, setOwnerBusyId] = useState<string | null>(null);
  const ownerMenuRef = useRef<HTMLDivElement | null>(null);
  const resolvedAvatar = avatarUrl || createAvatarFallback({ label: displayName || "ServiQ member", seed: displayName || "public-profile" });

  const cart = useCart();
  const { viewerId } = useConnectionRequests();

  useEffect(() => {
    setItems(posts);
  }, [posts]);

  const pushToast = useCallback((kind: ProfileToast["kind"], message: string) => {
    const toastId =
      typeof window !== "undefined" && window.crypto?.randomUUID
        ? window.crypto.randomUUID()
        : `${Date.now()}-${Math.random().toString(16).slice(2)}`;

    setToasts((current) => [...current, { id: toastId, kind, message }]);

    const timeoutId = window.setTimeout(() => {
      setToasts((current) => current.filter((toast) => toast.id !== toastId));
      toastTimersRef.current.delete(toastId);
    }, 4600);

    toastTimersRef.current.set(toastId, timeoutId);
  }, []);

  useEffect(() => {
    const timers = toastTimersRef.current;
    return () => {
      timers.forEach((timeoutId) => window.clearTimeout(timeoutId));
      timers.clear();
    };
  }, []);

  useEffect(() => {
    if (!ownerMenuOpenId) return;

    const handlePointerDown = (event: MouseEvent) => {
      if (ownerMenuRef.current && !ownerMenuRef.current.contains(event.target as Node)) {
        setOwnerMenuOpenId(null);
      }
    };

    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [ownerMenuOpenId]);

  const buildCardId = useCallback((post: PublicProfilePost) => {
    const sourceId = post.source === "help_request" ? post.helpRequestId || post.id : post.id;
    return `dashboard:${post.source}:${post.type}:${sourceId}`;
  }, []);

  const buildActionPath = useCallback((post: PublicProfilePost) => `${publicPath}#profile-post-${post.id}`, [publicPath]);

  const ensureViewerId = useCallback(async () => {
    if (viewerId) return viewerId;

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser();

    if (error || !user) {
      throw new Error(error?.message || "Login required to continue.");
    }

    return user.id;
  }, [viewerId]);

  useEffect(() => {
    if (!viewerId || items.length === 0) {
      setSavedCardIds(new Set(viewerId ? getPendingFeedCardIds(viewerId) : []));
      return;
    }

    let active = true;
    const cardIds = items.map((item) => buildCardId(item));

    void (async () => {
      try {
        const { data, error } = await supabase
          .from("feed_card_saves")
          .select("card_id")
          .eq("user_id", viewerId)
          .in("card_id", cardIds);

        if (error) {
          if (isMissingRelationError(error.message || "")) {
            if (active) {
              setSavedCardIds(new Set(getPendingFeedCardIds(viewerId).filter((cardId) => cardIds.includes(cardId))));
            }
            return;
          }

          throw error;
        }

        const persistedCardIds = ((data as { card_id: string }[] | null) || []).map((row) => row.card_id);
        prunePendingFeedCardSaves(viewerId, persistedCardIds);

        if (!active) return;

        setSavedCardIds(new Set([...persistedCardIds, ...getPendingFeedCardIds(viewerId).filter((cardId) => cardIds.includes(cardId))]));
        void syncPendingFeedCardSaves(supabase, viewerId, persistedCardIds);
      } catch {
        if (active) {
          setSavedCardIds(new Set(getPendingFeedCardIds(viewerId).filter((cardId) => cardIds.includes(cardId))));
        }
      }
    })();

    return () => {
      active = false;
    };
  }, [buildCardId, items, viewerId]);

  const isOwnListing = Boolean(viewerId && viewerId === profileUserId);
  const canOpenChat = isOwnListing || isUUIDLike(profileUserId);
  const chatLabel = isOwnListing ? "Your chat" : chatOpening ? "Opening" : "Chat";

  const handleAccept = useCallback(
    async (post: PublicProfilePost) => {
      if (!post.helpRequestId) {
        pushToast("info", "Accept is available for active task requests.");
        return;
      }

      if (viewerId && profileUserId === viewerId) {
        pushToast("info", "You cannot accept your own task.");
        return;
      }

      if (post.acceptedProviderId && viewerId && post.acceptedProviderId !== viewerId) {
        pushToast("info", "This task is already accepted.");
        return;
      }

      if (isClosedStatus(post.status)) {
        pushToast("info", "This task is no longer open.");
        return;
      }

      const cardId = buildCardId(post);
      setAcceptingCardIds((current) => new Set(current).add(cardId));

      try {
        const activeViewerId = await ensureViewerId();
        if (profileUserId === activeViewerId) {
          throw new Error("You cannot accept your own task.");
        }

        await fetchAuthedJson<{ ok: true; helpRequestId: string; status: "accepted" }>(supabase, "/api/needs/accept", {
          method: "POST",
          body: JSON.stringify({ helpRequestId: post.helpRequestId }),
        });

        setItems((current) =>
          current.map((item) =>
            item.helpRequestId === post.helpRequestId
              ? {
                  ...item,
                  acceptedProviderId: activeViewerId,
                  status: "accepted",
                  source: "help_request",
                }
              : item
          )
        );

        pushToast("success", "Task accepted successfully.");
      } catch (error) {
        pushToast("error", toErrorMessage(error, "Unable to accept this task right now."));
      } finally {
        setAcceptingCardIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          return next;
        });
      }
    },
    [buildCardId, ensureViewerId, profileUserId, pushToast, viewerId]
  );

  const handleDecline = useCallback(
    async (post: PublicProfilePost) => {
      if (!post.helpRequestId) {
        pushToast("info", "Decline is available for accepted task requests.");
        return;
      }

      const cardId = buildCardId(post);
      setAcceptingCardIds((current) => new Set(current).add(cardId));

      try {
        const activeViewerId = await ensureViewerId();
        const isCreator = profileUserId === activeViewerId;
        const isAcceptedProvider = post.acceptedProviderId === activeViewerId;

        if (!isCreator && !isAcceptedProvider) {
          throw new Error("You can only decline requests you created or accepted.");
        }

        await fetchAuthedJson<{ ok: true; helpRequestId: string; status: "cancelled" }>(supabase, "/api/needs/reopen", {
          method: "POST",
          body: JSON.stringify({ helpRequestId: post.helpRequestId }),
        });

        setItems((current) =>
          current.map((item) =>
            item.helpRequestId === post.helpRequestId
              ? {
                  ...item,
                  status: "open",
                  acceptedProviderId: null,
                }
              : item
          )
        );

        pushToast("success", "Request declined.");
      } catch (error) {
        pushToast("error", toErrorMessage(error, "Unable to decline this task right now."));
      } finally {
        setAcceptingCardIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          return next;
        });
      }
    },
    [buildCardId, ensureViewerId, profileUserId, pushToast]
  );

  const handleOpenChat = useCallback(async () => {
    if (!isUUIDLike(profileUserId)) {
      pushToast("info", "Chat is available only for live accounts.");
      return;
    }

    try {
      const activeViewerId = await ensureViewerId();

      if (activeViewerId === profileUserId) {
        router.push("/dashboard/chat");
        return;
      }

      setChatOpening(true);
      const conversationId = await getOrCreateDirectConversationId(supabase, activeViewerId, profileUserId);
      router.push(`/dashboard/chat?open=${conversationId}`);
    } catch (error) {
      pushToast("error", toErrorMessage(error, "Unable to open chat."));
    } finally {
      setChatOpening(false);
    }
  }, [ensureViewerId, profileUserId, pushToast, router]);

  const handleToggleSave = useCallback(
    async (post: PublicProfilePost) => {
      const cardId = buildCardId(post);
      const wasSaved = savedCardIds.has(cardId);
      const shouldSave = !wasSaved;

      setSavingCardIds((current) => new Set(current).add(cardId));
      setSavedCardIds((current) => {
        const next = new Set(current);
        if (shouldSave) {
          next.add(cardId);
        } else {
          next.delete(cardId);
          next.delete(post.id);
        }
        return next;
      });

      try {
        const activeViewerId = await ensureViewerId();
        const savePayload = {
          card_id: cardId,
          focus_id: post.id,
          card_type: post.type,
          title: post.title,
          subtitle: post.description,
          action_path: buildActionPath(post),
          metadata: {
            kind: "public_profile_post",
            image: post.media[0]?.url || resolvedAvatar,
            mediaGallery: post.media.map((entry) => entry.url).slice(0, 3),
            priceLabel: formatPriceLabel(post),
            audienceName: post.locationLabel || locationLabel,
            tags: [post.category],
            actionPath: buildActionPath(post),
            creatorName: displayName,
          },
        };

        if (shouldSave) {
          stagePendingFeedCardSave(activeViewerId, savePayload);
          await persistFeedCardSave(supabase, savePayload);
          pushToast("success", "Post saved.");
          return;
        }

        clearPendingFeedCardSave(activeViewerId, cardId);
        await removeFeedCardSave(supabase, cardId);
        pushToast("success", "Removed from saved.");
      } catch (error) {
        try {
          const activeViewerId = await ensureViewerId();
          const rollbackPayload = {
            card_id: cardId,
            focus_id: post.id,
            card_type: post.type,
            title: post.title,
            subtitle: post.description,
            action_path: buildActionPath(post),
            metadata: {
              kind: "public_profile_post",
              image: post.media[0]?.url || resolvedAvatar,
              mediaGallery: post.media.map((entry) => entry.url).slice(0, 3),
              priceLabel: formatPriceLabel(post),
              audienceName: post.locationLabel || locationLabel,
              tags: [post.category],
              actionPath: buildActionPath(post),
              creatorName: displayName,
            },
          };

          if (shouldSave) {
            clearPendingFeedCardSave(activeViewerId, cardId);
          } else {
            stagePendingFeedCardSave(activeViewerId, rollbackPayload);
          }
        } catch {
          // Ignore rollback lookup errors.
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

        pushToast("error", toErrorMessage(error, "Unable to update save state."));
      } finally {
        setSavingCardIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          next.delete(post.id);
          return next;
        });
      }
    },
    [buildActionPath, buildCardId, displayName, ensureViewerId, locationLabel, pushToast, resolvedAvatar, savedCardIds]
  );

  const handleRemoveOwnedPost = useCallback(
    async (post: PublicProfilePost) => {
      setOwnerMenuOpenId(null);
      setOwnerBusyId(post.id);

      try {
        if (post.source === "help_request" && post.helpRequestId) {
          await fetchAuthedJson<{ ok: true; helpRequestId: string; status: string }>(supabase, "/api/needs/status", {
            method: "POST",
            body: JSON.stringify({
              helpRequestId: post.helpRequestId,
              status: "cancelled",
            }),
          });
          pushToast("success", "Request removed from your active posts.");
        } else {
          await fetchAuthedJson<{ ok: true }>(supabase, `/api/posts/manage?postId=${encodeURIComponent(post.id)}`, {
            method: "DELETE",
          });
          pushToast("success", "Post deleted.");
        }

        setItems((current) => current.filter((item) => item.id !== post.id));
        router.refresh();
      } catch (error) {
        pushToast(
          "error",
          toErrorMessage(error, post.source === "help_request" ? "Unable to close this request." : "Unable to delete this post.")
        );
      } finally {
        setOwnerBusyId((current) => (current === post.id ? null : current));
      }
    },
    [pushToast, router]
  );

  const handleAddToCart = useCallback(
    (post: PublicProfilePost) => {
      cart.addItem({
        itemType: post.type === "service" ? "service" : "product",
        itemId: post.id,
        providerId: profileUserId,
        providerName: displayName,
        title: post.title,
        price: post.price,
      });
      setAddedToCart(post.id);
      setTimeout(() => setAddedToCart(null), 1400);
    },
    [cart, displayName, profileUserId]
  );

  const handleBuyNow = useCallback(
    (post: PublicProfilePost) => {
      cart.replaceItems([
        {
          itemType: post.type === "service" ? "service" : "product",
          itemId: post.id,
          providerId: profileUserId,
          providerName: displayName,
          title: post.title,
          price: post.price,
        },
      ]);
      cart.closeCart();
      router.push("/checkout");
    },
    [cart, displayName, profileUserId, router]
  );

  const handleShare = useCallback(
    async (post: PublicProfilePost) => {
      const cardId = buildCardId(post);
      const shareUrl = `${window.location.origin}${buildActionPath(post)}`;
      const shareText = `${post.title} • ${displayName} • ${formatPriceLabel(post)}`;

      setSharingCardIds((current) => new Set(current).add(cardId));

      try {
        if (navigator.share) {
          await navigator.share({
            title: post.title,
            text: shareText,
            url: shareUrl,
          });
          pushToast("success", "Share sent.");
          return;
        }

        if (!navigator.clipboard?.writeText) {
          throw new Error("This browser does not support clipboard sharing.");
        }

        await navigator.clipboard.writeText(`${post.title}\n${shareText}\n${shareUrl}`);
        pushToast("success", "Share link copied.");
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") {
          return;
        }

        pushToast("error", toErrorMessage(error, "Unable to share this post."));
      } finally {
        setSharingCardIds((current) => {
          const next = new Set(current);
          next.delete(cardId);
          next.delete(post.id);
          return next;
        });
      }
    },
    [buildActionPath, buildCardId, displayName, pushToast]
  );

  return (
    <>
      <div className="mt-6 space-y-5">
        <div
          className={
            horizontal
              ? "flex snap-x snap-mandatory gap-3 overflow-x-auto pb-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden sm:gap-4"
              : "grid gap-4 md:grid-cols-2 xl:grid-cols-3"
          }
        >
          {items.map((post) => {
          const cardId = buildCardId(post);
          const saved = savedCardIds.has(cardId) || savedCardIds.has(post.id);
          const savingBusy = savingCardIds.has(cardId) || savingCardIds.has(post.id);
          const sharingBusy = sharingCardIds.has(cardId) || sharingCardIds.has(post.id);
          const acceptingBusy = acceptingCardIds.has(cardId) || acceptingCardIds.has(post.id);
          const normalizedPostStatus = (post.status || "").trim().toLowerCase();
          const isOpenLike = !normalizedPostStatus || normalizedPostStatus === "open" || normalizedPostStatus === "new_lead";
          const acceptedByMe = !isOpenLike && !!viewerId && post.acceptedProviderId === viewerId;
          const acceptedByOther = !isOpenLike && !!post.acceptedProviderId && post.acceptedProviderId !== viewerId;

          const canDecline = post.helpRequestId && !isClosedStatus(post.status) && (acceptedByMe || (isOwnListing && !!post.acceptedProviderId));
          const acceptDisabled =
            acceptingBusy ||
            (!canDecline &&
              (isOwnListing ||
                !post.helpRequestId ||
                acceptedByOther ||
                acceptedByMe ||
                isClosedStatus(post.status)));

          const acceptLabel = canDecline
            ? "Decline"
            : isOwnListing
            ? "Own"
            : acceptedByMe
            ? "Accepted"
            : acceptedByOther
            ? "Taken"
            : !post.helpRequestId
            ? "N/A"
            : isClosedStatus(post.status)
            ? "Closed"
            : "Accept";

          return (
            <article
              id={`profile-post-${post.id}`}
              key={post.id}
              className={`flex h-full flex-col overflow-hidden rounded-3xl border border-slate-200 bg-white p-3 shadow-[0_18px_32px_-26px_rgba(15,23,42,0.45)] sm:p-4 ${
                horizontal
                  ? "w-[min(82vw,320px)] min-w-[240px] max-w-[320px] shrink-0 snap-start sm:w-[calc(50vw-2.75rem)] sm:min-w-[260px] sm:max-w-[360px] lg:w-[calc(33vw-2.5rem)] lg:min-w-[280px] lg:max-w-[380px] xl:w-[calc(30vw-2.5rem)]"
                  : ""
              }`}
            >
              <header className="flex items-start gap-3">
                <div className="relative shrink-0 rounded-full">
                  <Image
                    src={resolvedAvatar}
                    alt={`${displayName} avatar`}
                    width={40}
                    height={40}
                    quality={70}
                    loading="lazy"
                    className="h-10 w-10 rounded-full border border-slate-200 object-cover"
                  />
                </div>

                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-1.5">
                    <span className="max-w-full truncate text-left text-sm font-semibold text-[var(--brand-700)]">
                      {displayName}
                    </span>
                    {verificationStatus === "verified" ? (
                      <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
                        <span className="inline-flex items-center gap-1">
                          <BadgeCheck className="h-3 w-3" />
                          Verified
                        </span>
                      </span>
                    ) : null}
                    {post.urgent ? (
                      <span className="rounded-full border border-rose-200 bg-rose-50 px-2 py-0.5 text-[10px] font-semibold text-rose-700">
                        Urgent
                      </span>
                    ) : null}
                  </div>

                  <div className="mt-1 flex flex-wrap items-center gap-2 text-[11px] text-slate-500">
                    <span className="inline-flex items-center gap-1">
                      <Clock3 size={11} />
                      {formatRelativeAge(post.createdAt)}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <MapPin size={11} />
                      {post.locationLabel || locationLabel || "Nearby"}
                    </span>
                    <span className="rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold text-slate-600">
                      {normalizeStatusLabel(post.status)}
                    </span>
                  </div>
                </div>

                {isOwnListing ? (
                  <div ref={ownerMenuOpenId === post.id ? ownerMenuRef : undefined} className="relative shrink-0">
                    <button
                      type="button"
                      onClick={() => setOwnerMenuOpenId((current) => (current === post.id ? null : post.id))}
                      disabled={ownerBusyId === post.id}
                      aria-label={post.source === "help_request" ? "Request options" : "Post options"}
                      className="inline-flex h-8 w-8 items-center justify-center rounded-full text-slate-400 transition hover:bg-slate-100 hover:text-slate-600 disabled:opacity-50"
                    >
                      {ownerBusyId === post.id ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <MoreVertical className="h-4 w-4" />
                      )}
                    </button>

                    {ownerMenuOpenId === post.id ? (
                      <div className="absolute right-0 top-full z-20 mt-1 w-44 overflow-hidden rounded-2xl border border-slate-200 bg-white py-1 shadow-2xl">
                        <button
                          type="button"
                          onClick={() => void handleRemoveOwnedPost(post)}
                          className="flex w-full items-center gap-2.5 px-4 py-2.5 text-sm font-medium text-rose-600 transition hover:bg-rose-50"
                        >
                          <Trash2 className="h-4 w-4" />
                          {post.source === "help_request" ? "Close request" : "Delete post"}
                        </button>
                      </div>
                    ) : null}
                  </div>
                ) : null}
              </header>

              <div className="mt-2.5">
                <MediaCarousel media={post.media} title={post.title} />
              </div>

              <div className="mt-2.5">
                <h3 className="line-clamp-2 text-base font-semibold leading-tight text-slate-900">
                  {post.title}
                </h3>
                <p className="mt-1 line-clamp-3 text-sm leading-relaxed text-slate-600">{post.description}</p>
              </div>

              {(post.type === "product" || post.type === "service") && !isOwnListing && (
                <div className="mt-3 flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleAddToCart(post)}
                    aria-label={`Add ${post.title} to cart`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
                  >
                    <ShoppingCart className="h-3.5 w-3.5" />
                    {addedToCart === post.id ? "Added!" : "Add to Cart"}
                  </button>
                  <button
                    type="button"
                    onClick={() => handleBuyNow(post)}
                    aria-label={`Buy ${post.title}`}
                    className="flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3 py-2 text-xs font-semibold text-white transition hover:bg-[var(--brand-700)]"
                  >
                    <ShoppingBag className="h-3.5 w-3.5" />
                    {post.type === "service" ? "Hire Now" : "Buy Now"}
                  </button>
                </div>
              )}

              <div className="mt-3 flex items-center gap-1.5">
                <button
                  type="button"
                    onClick={() => void (acceptLabel === "Decline" ? handleDecline(post) : handleAccept(post))}
                  disabled={acceptDisabled}
                  aria-label={acceptLabel}
                  title={acceptLabel}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    acceptDisabled
                      ? "border-slate-200 bg-slate-100 text-slate-500"
                      : acceptLabel === "Accept"
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"
                        : "border-rose-200 bg-rose-50 text-rose-700 hover:bg-rose-100"
                  }`}
                >
                  {acceptingBusy ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : acceptLabel === "Decline" ? (
                    <X className="h-4 w-4" />
                  ) : (
                    <Check className="h-4 w-4" />
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => void handleOpenChat()}
                  disabled={chatOpening || !canOpenChat}
                  aria-label={chatLabel}
                  title={chatLabel}
                  className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
                    canOpenChat
                      ? "border-slate-900 bg-slate-900 text-white hover:bg-slate-800"
                      : "border-slate-200 bg-slate-100 text-slate-500"
                  }`}
                >
                  {chatOpening ? <Loader2 className="h-4 w-4 animate-spin" /> : <Sparkles className="h-4 w-4" />}
                </button>

                <div className="ml-auto flex items-center gap-1.5">
                  <button
                    type="button"
                    onClick={() => void handleShare(post)}
                    disabled={sharingBusy}
                    aria-label="Share post"
                    title="Share post"
                    className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-700 transition hover:border-slate-300 hover:text-slate-900 disabled:cursor-not-allowed disabled:opacity-70"
                  >
                    {sharingBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Share2 className="h-4 w-4" />}
                  </button>

                  <button
                    type="button"
                    onClick={() => void handleToggleSave(post)}
                    disabled={savingBusy}
                    aria-label={saved ? "Saved post" : "Save post"}
                    title={saved ? "Saved post" : "Save post"}
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-full border transition disabled:cursor-not-allowed disabled:opacity-70 ${
                      saved
                        ? "border-slate-900 bg-slate-900 text-white"
                        : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:text-slate-900"
                    }`}
                  >
                    {savingBusy ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : saved ? (
                      <BookmarkCheck className="h-4 w-4" />
                    ) : (
                      <Bookmark className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>
            </article>
          );
          })}
        </div>
      </div>

      <ProfileToastViewport
        toasts={toasts}
        onDismiss={(toastId) => {
          setToasts((current) => current.filter((toast) => toast.id !== toastId));
          const timeoutId = toastTimersRef.current.get(toastId);
          if (timeoutId) {
            window.clearTimeout(timeoutId);
            toastTimersRef.current.delete(toastId);
          }
        }}
      />
    </>
  );
}
