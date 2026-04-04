"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BadgeCheck, Clock3, ExternalLink, MapPin, MessageCircle, Star, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import ConnectionActionGroup from "@/app/components/connections/ConnectionActionGroup";
import {
  calculateProfileCompletion,
  calculateVerificationStatus,
  estimateResponseMinutes,
  verificationLabel,
} from "@/lib/business";
import { createAvatarFallback } from "@/lib/avatarFallback";
import { useConnectionRequests } from "@/lib/hooks/useConnectionRequests";
import { resolveProfileAvatarUrl } from "@/lib/mediaUrl";
import { buildPublicProfilePath } from "@/lib/profile/utils";

type Props = {
  userId: string;
  open: boolean;
  onClose: () => void;
};

type ProfileRow = {
  id: string;
  name: string | null;
  location: string | null;
  bio: string | null;
  role: string | null;
  verification_level?: string | null;
  services: string[] | null;
  availability: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  avatar_url: string | null;
};

type ReviewRow = {
  rating: number | null;
  comment: string | null;
};

type ProviderOrderStatsRow = {
  provider_id: string;
  completed_jobs: number | string;
  open_leads: number | string;
};

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default function ProviderTrustPanel({ userId, open, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [servicesCount, setServicesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [completedJobs, setCompletedJobs] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const isUuidUserId = UUID_PATTERN.test(userId);
  const {
    viewerId,
    busyTargetId,
    busyRequestId,
    busyActionKey,
    schemaReady,
    schemaMessage,
    getConnectionState,
    sendRequest,
    respond,
  } = useConnectionRequests({ enabled: open && isUuidUserId });

  useEffect(() => {
    if (!open || !userId) return;

    let isMounted = true;
    setLoading(true);
    setLoadError(null);
    setProfile(null);
    setReviews([]);
    setServicesCount(0);
    setProductsCount(0);
    setCompletedJobs(null);

    if (!isUuidUserId) {
      setLoadError("This profile is not connected to a live ServiQ member record.");
      setLoading(false);
      return;
    }

    void (async () => {
      try {
        const [
          { data: profileRow, error: profileError },
          { data: reviewRows, error: reviewError },
          { data: serviceRows, error: servicesError },
          { data: productRows, error: productsError },
          { data: providerOrderStats, error: statsError },
        ] = await Promise.all([
          supabase
            .from("profiles")
            .select("*")
            .eq("id", userId)
            .maybeSingle<ProfileRow>(),
          supabase.from("reviews").select("rating,comment").eq("provider_id", userId),
          supabase.from("service_listings").select("id").eq("provider_id", userId),
          supabase.from("product_catalog").select("id").eq("provider_id", userId),
          supabase.rpc("get_provider_order_stats", { provider_ids: [userId] }),
        ]);

        if (!isMounted) return;

        if (profileError || reviewError || servicesError || productsError) {
          const firstError =
            profileError?.message ||
            reviewError?.message ||
            servicesError?.message ||
            productsError?.message ||
            "Could not load provider details.";
          setLoadError(firstError);
          return;
        }

        if (statsError) {
          console.warn("Provider order stats RPC unavailable, using fallback stats:", statsError.message);
        }

        const normalizedReviews = (reviewRows as ReviewRow[] | null) || [];
        const normalizedServicesCount = (serviceRows || []).length;
        const normalizedProductsCount = (productRows || []).length;

        setProfile(
          profileRow
            ? {
                ...profileRow,
                avatar_url: resolveProfileAvatarUrl(profileRow.avatar_url),
              }
            : null
        );
        setReviews(normalizedReviews);
        setServicesCount(normalizedServicesCount);
        setProductsCount(normalizedProductsCount);

        const statsRows = statsError ? [] : (providerOrderStats as ProviderOrderStatsRow[] | null) || [];
        const doneCount = statsRows.length > 0 ? Number(statsRows[0].completed_jobs || 0) : null;
        setCompletedJobs(doneCount);
      } catch {
        if (!isMounted) return;
        setLoadError("Could not load provider details.");
      } finally {
        if (!isMounted) return;
        setLoading(false);
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [isUuidUserId, open, userId]);

  useEffect(() => {
    if (!connectionNotice) return;
    const timerId = window.setTimeout(() => setConnectionNotice(null), 2800);

    return () => {
      window.clearTimeout(timerId);
    };
  }, [connectionNotice]);

  const avgRating = useMemo(() => {
    if (!reviews.length) return 0;
    const ratings = reviews
      .map((review) => Number(review.rating))
      .filter((rating) => Number.isFinite(rating) && rating > 0);
    if (!ratings.length) return 0;
    return Number((ratings.reduce((sum, rating) => sum + rating, 0) / ratings.length).toFixed(1));
  }, [reviews]);

  const responseMinutes = useMemo(() => {
    if (!profile) return 0;
    return estimateResponseMinutes({
      availability: profile.availability,
      providerId: profile.id,
    });
  }, [profile]);

  const profileCompletion = useMemo(() => {
    if (!profile) return 0;
    return calculateProfileCompletion({
      name: profile.name,
      location: profile.location,
      bio: profile.bio,
      services: profile.services,
      email: profile.email,
      phone: profile.phone,
      website: profile.website,
    });
  }, [profile]);

  const verificationStatus = useMemo(() => {
    if (!profile) return "unclaimed";
    return calculateVerificationStatus({
      role: profile.role,
      verificationLevel: profile.verification_level,
      profileCompletion,
      listingsCount: servicesCount + productsCount,
      averageRating: avgRating,
      reviewCount: reviews.length,
      completedJobs,
    });
  }, [avgRating, completedJobs, profile, profileCompletion, productsCount, reviews.length, servicesCount]);

  const publicProfilePath = profile ? buildPublicProfilePath(profile) : "";
  const connectionState = useMemo(() => getConnectionState(userId), [getConnectionState, userId]);
  const connectionBusy =
    busyTargetId === userId || (connectionState.requestId ? busyRequestId === connectionState.requestId : false);

  const handleConnect = async () => {
    if (!viewerId || !isUuidUserId || viewerId === userId) return;
    if (!schemaReady) {
      setConnectionNotice(schemaMessage);
      return;
    }

    setConnectionNotice(null);

    try {
      const previousState = connectionState;
      await sendRequest(userId);
      setConnectionNotice(
        previousState.kind === "incoming_pending"
          ? "Connection accepted."
          : "Connection request sent."
      );
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Unable to send connection request.");
    }
  };

  const handleDecision = async (decision: "accepted" | "rejected" | "cancelled") => {
    if (!connectionState.requestId || !viewerId) return;
    if (!schemaReady) {
      setConnectionNotice(schemaMessage);
      return;
    }

    setConnectionNotice(null);

    try {
      await respond(connectionState.requestId, decision);
      setConnectionNotice(
        decision === "accepted"
          ? "Connection accepted."
          : decision === "rejected"
          ? "Connection request declined."
          : "Connection request cancelled."
      );
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Unable to update connection request.");
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[var(--layer-modal)] flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[420px] max-w-full overflow-y-auto border-l border-slate-200 bg-slate-50 p-6 text-slate-900 shadow-xl animate-in slide-in-from-right">
        <button type="button" onClick={onClose} className="absolute right-4 top-4 text-slate-500 hover:text-slate-800">
          <X />
        </button>

        {loading ? (
          <div className="mt-8 space-y-3">
            <p className="text-sm text-slate-600">Loading provider profile...</p>
            <div className="h-2 w-full overflow-hidden rounded-full bg-slate-200">
              <div className="h-full w-1/2 animate-pulse bg-indigo-500/80" />
            </div>
          </div>
        ) : loadError ? (
          <div className="mt-8 rounded-xl border border-rose-200 bg-rose-50 p-4">
            <p className="text-sm font-semibold text-rose-700">Unable to load provider profile</p>
            <p className="mt-1 text-xs text-rose-600">{loadError}</p>
          </div>
        ) : !profile ? (
          <div className="mt-8 rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-sm font-semibold text-slate-900">Profile unavailable</p>
            <p className="mt-1 text-xs text-slate-600">This member does not have a published ServiQ trust profile yet.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <Image
                src={
                  resolveProfileAvatarUrl(profile?.avatar_url) ||
                  createAvatarFallback({ label: profile?.name || profile?.role || "ServiQ member", seed: profile?.id || userId })
                }
                alt={profile?.name || "ServiQ member"}
                width={96}
                height={96}
                unoptimized
                className="mx-auto mb-3 h-24 w-24 rounded-full border-4 border-indigo-500 object-cover"
              />
              <h2 className="text-xl font-semibold">{profile?.name || "ServiQ member"}</h2>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-slate-500">
                <MapPin size={14} />
                {profile?.location || "Location not shared"}
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                <BadgeCheck size={13} />
                {verificationLabel(verificationStatus)}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <StatCard label="Rating" value={avgRating || "No reviews"} icon={<Star size={14} />} />
              <StatCard label="Reviews" value={reviews.length} icon={<MessageCircle size={14} />} />
              <StatCard label="Jobs Done" value={completedJobs ?? "Not available"} icon={<BadgeCheck size={14} />} />
              <StatCard label="Response" value={`${responseMinutes} mins`} icon={<Clock3 size={14} />} />
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold">About</h3>
              <p className="text-sm text-slate-600">{profile?.bio || "No business summary added yet."}</p>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold">Services</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.services?.length ? (
                  profile.services.map((service) => (
                    <span key={service} className="rounded-full bg-slate-100 px-3 py-1 text-xs text-slate-700">
                      {service}
                    </span>
                  ))
                ) : (
                  <span className="text-xs text-slate-500">No services listed yet.</span>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold">Recent Reviews</h3>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
                {reviews.map((review, index) => (
                  <div key={`review-${index}`} className="rounded-lg bg-slate-100 p-2">
                    <div className="text-sm text-yellow-500">{Array.from({ length: Math.max(1, Number(review.rating || 0)) }, () => "*").join("")}</div>
                    <p className="text-xs text-slate-600">{review.comment || "Customer left a rating without a written note."}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 text-sm">Trust Score</h3>
              <div className="h-2 overflow-hidden rounded-full bg-slate-200">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400" style={{ width: `${profileCompletion}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-600">{profileCompletion}% profile completion</p>
            </div>

            <div className="space-y-3">
              {isUuidUserId && viewerId && viewerId !== userId && (
                <div className="rounded-xl border border-slate-200 bg-white p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Connection status</p>
                  <div className="mt-3 flex flex-wrap gap-2">
                    {schemaReady ? (
                      <ConnectionActionGroup
                        state={connectionState}
                        busy={connectionBusy}
                        busyActionKey={busyActionKey}
                        onConnect={() => void handleConnect()}
                        onAccept={() => void handleDecision("accepted")}
                        onReject={() => void handleDecision("rejected")}
                        onCancel={() => void handleDecision("cancelled")}
                      />
                    ) : (
                      <span className="inline-flex items-center gap-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-1.5 text-sm font-semibold text-amber-800">
                        Setup required
                      </span>
                    )}
                  </div>
                  {!schemaReady && !!schemaMessage && <p className="mt-2 text-xs text-amber-700">{schemaMessage}</p>}
                  {connectionNotice && <p className="mt-2 text-xs text-slate-600">{connectionNotice}</p>}
                </div>
              )}

              <button
                type="button"
                onClick={() => {
                  if (!publicProfilePath) return;
                  window.open(`${publicProfilePath}?tab=reviews&writeReview=1`, "_blank");
                }}
                disabled={!publicProfilePath}
                className={`w-full rounded-xl py-2 text-sm font-semibold transition ${
                  publicProfilePath
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "cursor-not-allowed bg-slate-200 text-slate-500"
                }`}
              >
                Write Review
              </button>
              {!publicProfilePath && <p className="text-xs text-slate-500">Reviews are available for published member profiles only.</p>}
              {!!publicProfilePath && isUuidUserId && (
                <button
                  type="button"
                  onClick={() => window.open(publicProfilePath, "_blank")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-300"
                >
                  <ExternalLink size={14} />
                  Open Public Profile
                </button>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}

function StatCard({ label, value, icon }: { label: string; value: string | number; icon: ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 text-center">
      <div className="mb-1 flex justify-center text-indigo-600">{icon}</div>
      <div className="font-semibold text-slate-900">{value}</div>
      <div className="text-xs text-slate-500">{label}</div>
    </div>
  );
}
