"use client";

import Image from "next/image";
import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BadgeCheck, Check, Clock3, ExternalLink, Loader2, MapPin, MessageCircle, Star, UserCheck, UserPlus, X, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import {
  deriveConnectionState,
  listCurrentUserConnectionRows,
  respondToConnectionRequest,
  sendConnectionRequest,
  type ConnectionRequestRow,
} from "@/lib/connections";
import ReviewModal from "./ReviewModal";
import {
  calculateProfileCompletion,
  calculateVerificationStatus,
  createBusinessSlug,
  estimateResponseMinutes,
  verificationLabel,
} from "@/lib/business";

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

const demoProfileMap: Record<
  string,
  Pick<ProfileRow, "name" | "location" | "bio" | "role" | "availability">
> = {
  "demo-1": {
    name: "Test Electrician",
    location: "Nearby",
    bio: "Seeded demo profile for local electrician discovery.",
    role: "provider",
    availability: "available",
  },
  "demo-2": {
    name: "Test Cleaning Team",
    location: "West Side",
    bio: "Seeded demo profile for cleaning and home support.",
    role: "provider",
    availability: "available",
  },
  "demo-3": {
    name: "Test Plumbing Pro",
    location: "East End",
    bio: "Seeded demo profile for plumbing and emergency fixes.",
    role: "provider",
    availability: "available",
  },
  "demo-provider-amit": {
    name: "Amit P",
    location: "Nearby",
    bio: "Seeded demo profile.",
    role: "provider",
    availability: "available",
  },
  "demo-provider-mary": {
    name: "Mary Electricals",
    location: "Nearby",
    bio: "Seeded demo profile.",
    role: "business",
    availability: "available",
  },
  "demo-provider-sejal": {
    name: "Sejal CleanCare",
    location: "Nearby",
    bio: "Seeded demo profile.",
    role: "provider",
    availability: "available",
  },
};

const buildDemoProfile = (id: string): ProfileRow => {
  const mapped = demoProfileMap[id] || {
    name: "Demo Provider",
    location: "Nearby",
    bio: "Seeded demo profile.",
    role: "provider",
    availability: "available",
  };

  return {
    id,
    name: mapped.name,
    location: mapped.location,
    bio: mapped.bio,
    role: mapped.role,
    services: [],
    availability: mapped.availability,
    email: null,
    phone: null,
    website: null,
    avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(id)}`,
  };
};

const buildLiveFallbackProfile = (
  id: string,
  options?: { servicesCount?: number; productsCount?: number; reviewsCount?: number }
): ProfileRow => {
  const servicesCount = options?.servicesCount || 0;
  const productsCount = options?.productsCount || 0;
  const reviewsCount = options?.reviewsCount || 0;
  const role =
    servicesCount + productsCount > 0 ? "provider" : reviewsCount > 0 ? "marketplace_member" : "member";

  return {
    id,
    name: `Local Member ${id.slice(0, 4).toUpperCase()}`,
    location: "Nearby",
    bio:
      servicesCount + productsCount > 0
        ? "This member is active on the marketplace and can be contacted in realtime."
        : "This member is visible on the marketplace and can be contacted in realtime.",
    role,
    services: [],
    availability: "available",
    email: null,
    phone: null,
    website: null,
    avatar_url: `https://i.pravatar.cc/150?u=${encodeURIComponent(id)}`,
  };
};

export default function ProviderTrustPanel({ userId, open, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [openReview, setOpenReview] = useState(false);
  const [servicesCount, setServicesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [connectionRows, setConnectionRows] = useState<ConnectionRequestRow[]>([]);
  const [connectionBusy, setConnectionBusy] = useState(false);
  const [connectionNotice, setConnectionNotice] = useState<string | null>(null);
  const isUuidUserId = UUID_PATTERN.test(userId);

  useEffect(() => {
    if (!open || !userId) return;

    let isMounted = true;
    setLoading(true);
    setLoadError(null);
    setProfile(null);
    setReviews([]);
    setServicesCount(0);
    setProductsCount(0);
    setCompletedJobs(0);

    if (!isUuidUserId) {
      setProfile(buildDemoProfile(userId));
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
          profileRow ||
            buildLiveFallbackProfile(userId, {
              servicesCount: normalizedServicesCount,
              productsCount: normalizedProductsCount,
              reviewsCount: normalizedReviews.length,
            })
        );
        setReviews(normalizedReviews);
        setServicesCount(normalizedServicesCount);
        setProductsCount(normalizedProductsCount);

        const statsRows = statsError ? [] : (providerOrderStats as ProviderOrderStatsRow[] | null) || [];
        const doneCount = statsRows.length > 0 ? Number(statsRows[0].completed_jobs || 0) : 0;
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
    if (!open) setOpenReview(false);
  }, [open]);

  useEffect(() => {
    if (!open || !isUuidUserId) return;

    let mounted = true;
    setConnectionNotice(null);

    void (async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!mounted) return;

      setViewerId(user?.id || null);

      if (!user?.id || user.id === userId) {
        setConnectionRows([]);
        return;
      }

      try {
        const rows = await listCurrentUserConnectionRows(user.id);
        if (mounted) {
          setConnectionRows(rows);
        }
      } catch (error) {
        if (mounted) {
          setConnectionNotice(error instanceof Error ? error.message : "Unable to load connection state.");
        }
      }
    })();

    return () => {
      mounted = false;
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
      profileCompletion,
      listingsCount: servicesCount + productsCount,
      averageRating: avgRating,
      reviewCount: reviews.length,
    });
  }, [avgRating, profile, profileCompletion, productsCount, reviews.length, servicesCount]);

  const businessSlug = profile ? createBusinessSlug(profile.name, profile.id) : "";
  const connectionState = useMemo(
    () => deriveConnectionState(viewerId, userId, connectionRows),
    [connectionRows, userId, viewerId]
  );

  const refreshConnections = async (currentViewerId: string) => {
    const rows = await listCurrentUserConnectionRows(currentViewerId);
    setConnectionRows(rows);
    return rows;
  };

  const handleConnect = async () => {
    if (!viewerId || !isUuidUserId || viewerId === userId) return;

    setConnectionBusy(true);
    setConnectionNotice(null);

    try {
      const previousState = deriveConnectionState(viewerId, userId, connectionRows);
      await sendConnectionRequest(userId);
      await refreshConnections(viewerId);
      setConnectionNotice(
        previousState.kind === "incoming_pending"
          ? "Connection accepted."
          : "Connection request sent."
      );
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Unable to send connection request.");
    } finally {
      setConnectionBusy(false);
    }
  };

  const handleDecision = async (decision: "accepted" | "rejected" | "cancelled") => {
    if (!connectionState.requestId || !viewerId) return;

    setConnectionBusy(true);
    setConnectionNotice(null);

    try {
      await respondToConnectionRequest({
        requestId: connectionState.requestId,
        decision,
      });
      await refreshConnections(viewerId);
      setConnectionNotice(
        decision === "accepted"
          ? "Connection accepted."
          : decision === "rejected"
          ? "Connection request declined."
          : "Connection request cancelled."
      );
    } catch (error) {
      setConnectionNotice(error instanceof Error ? error.message : "Unable to update connection request.");
    } finally {
      setConnectionBusy(false);
    }
  };

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
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
            <p className="text-sm font-semibold text-slate-900">Provider profile unavailable</p>
            <p className="mt-1 text-xs text-slate-600">This provider does not have a published trust profile yet.</p>
          </div>
        ) : (
          <>
            <div className="mb-6 text-center">
              <Image
                src={profile?.avatar_url || "https://i.pravatar.cc/150"}
                alt={profile?.name || "Provider"}
                width={96}
                height={96}
                className="mx-auto mb-3 h-24 w-24 rounded-full border-4 border-indigo-500 object-cover"
              />
              <h2 className="text-xl font-semibold">{profile?.name || "Provider"}</h2>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-slate-500">
                <MapPin size={14} />
                {profile?.location || "Unknown"}
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-100 px-3 py-1 text-xs text-emerald-700">
                <BadgeCheck size={13} />
                {verificationLabel(verificationStatus)}
              </div>
            </div>

            <div className="mb-6 grid grid-cols-2 gap-3">
              <StatCard label="Rating" value={avgRating || "New"} icon={<Star size={14} />} />
              <StatCard label="Reviews" value={reviews.length} icon={<MessageCircle size={14} />} />
              <StatCard label="Jobs Done" value={completedJobs} icon={<BadgeCheck size={14} />} />
              <StatCard label="Response" value={`${responseMinutes} mins`} icon={<Clock3 size={14} />} />
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold">About</h3>
              <p className="text-sm text-slate-600">{profile?.bio || "No bio added yet."}</p>
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
                  <span className="text-xs text-slate-500">No services listed</span>
                )}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold">Recent Reviews</h3>
              <div className="max-h-40 space-y-2 overflow-y-auto">
                {reviews.length === 0 && <p className="text-sm text-slate-500">No reviews yet.</p>}
                {reviews.map((review, index) => (
                  <div key={`review-${index}`} className="rounded-lg bg-slate-100 p-2">
                    <div className="text-sm text-yellow-400">{"★".repeat(Math.max(1, Number(review.rating || 0)))}</div>
                    <p className="text-xs text-slate-600">{review.comment || "Customer left a rating."}</p>
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
                    {connectionState.kind === "incoming_pending" && connectionState.requestId ? (
                      <>
                        <button
                          type="button"
                          disabled={connectionBusy}
                          onClick={() => void handleDecision("accepted")}
                          className="inline-flex items-center gap-1 rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white transition hover:bg-emerald-500 disabled:opacity-70"
                        >
                          {connectionBusy ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />}
                          Accept
                        </button>
                        <button
                          type="button"
                          disabled={connectionBusy}
                          onClick={() => void handleDecision("rejected")}
                          className="inline-flex items-center gap-1 rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-sm font-semibold text-rose-700 transition hover:bg-rose-100 disabled:opacity-70"
                        >
                          <XCircle size={14} />
                          Decline
                        </button>
                      </>
                    ) : connectionState.kind === "outgoing_pending" && connectionState.requestId ? (
                      <>
                        <span className="inline-flex items-center gap-1 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm font-semibold text-amber-700">
                          <Loader2 size={14} className={connectionBusy ? "animate-spin" : ""} />
                          Request sent
                        </span>
                        <button
                          type="button"
                          disabled={connectionBusy}
                          onClick={() => void handleDecision("cancelled")}
                          className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-70"
                        >
                          Cancel
                        </button>
                      </>
                    ) : connectionState.kind === "accepted" ? (
                      <span className="inline-flex items-center gap-1 rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm font-semibold text-emerald-700">
                        <UserCheck size={14} />
                        Connected
                      </span>
                    ) : (
                      <button
                        type="button"
                        disabled={connectionBusy}
                        onClick={() => void handleConnect()}
                        className="inline-flex items-center gap-1 rounded-xl border border-indigo-200 bg-indigo-50 px-3 py-2 text-sm font-semibold text-indigo-700 transition hover:bg-indigo-100 disabled:opacity-70"
                      >
                        {connectionBusy ? <Loader2 size={14} className="animate-spin" /> : <UserPlus size={14} />}
                        {connectionState.kind === "rejected" || connectionState.kind === "cancelled"
                          ? "Connect again"
                          : "Connect"}
                      </button>
                    )}
                  </div>
                  {connectionNotice && <p className="mt-2 text-xs text-slate-600">{connectionNotice}</p>}
                </div>
              )}

              <button
                type="button"
                onClick={() => setOpenReview(true)}
                disabled={!isUuidUserId}
                className={`w-full rounded-xl py-2 text-sm font-semibold transition ${
                  isUuidUserId
                    ? "bg-indigo-600 text-white hover:bg-indigo-500"
                    : "cursor-not-allowed bg-slate-200 text-slate-500"
                }`}
              >
                Write Review
              </button>
              {!isUuidUserId && <p className="text-xs text-slate-500">Reviews are disabled for demo providers.</p>}
              {!!businessSlug && isUuidUserId && (
                <button
                  type="button"
                  onClick={() => window.open(`/business/${businessSlug}`, "_blank")}
                  className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-slate-200 py-2 text-sm font-semibold text-slate-800 transition hover:bg-slate-300"
                >
                  <ExternalLink size={14} />
                  Open Public Business Page
                </button>
              )}
            </div>
          </>
        )}
      </div>

      <ReviewModal providerId={userId} open={openReview} onClose={() => setOpenReview(false)} />
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
