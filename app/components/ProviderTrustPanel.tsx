"use client";

import { useEffect, useMemo, useState } from "react";
import type { ReactNode } from "react";
import { BadgeCheck, Clock3, ExternalLink, MapPin, MessageCircle, Star, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
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

type OrderRow = {
  status: string | null;
};

export default function ProviderTrustPanel({ userId, open, onClose }: Props) {
  const [profile, setProfile] = useState<ProfileRow | null>(null);
  const [reviews, setReviews] = useState<ReviewRow[]>([]);
  const [openReview, setOpenReview] = useState(false);
  const [servicesCount, setServicesCount] = useState(0);
  const [productsCount, setProductsCount] = useState(0);
  const [completedJobs, setCompletedJobs] = useState(0);

  useEffect(() => {
    if (!open || !userId) return;

    let isMounted = true;

    void (async () => {
      const [{ data: profileRow }, { data: reviewRows }, { data: serviceRows }, { data: productRows }, { data: orderRows }] =
        await Promise.all([
          supabase
            .from("profiles")
            .select("id,name,location,bio,role,services,availability,email,phone,website,avatar_url")
            .eq("id", userId)
            .maybeSingle<ProfileRow>(),
          supabase.from("reviews").select("rating,comment").eq("provider_id", userId),
          supabase.from("service_listings").select("id").eq("provider_id", userId),
          supabase.from("product_catalog").select("id").eq("provider_id", userId),
          supabase.from("orders").select("status").eq("provider_id", userId),
        ]);

      if (!isMounted) return;
      setProfile(profileRow || null);
      setReviews((reviewRows as ReviewRow[] | null) || []);
      setServicesCount((serviceRows || []).length);
      setProductsCount((productRows || []).length);

      const doneCount = ((orderRows as OrderRow[] | null) || []).filter((row) =>
        ["completed", "closed"].includes((row.status || "").toLowerCase())
      ).length;
      setCompletedJobs(doneCount);
    })();

    return () => {
      isMounted = false;
    };
  }, [open, userId]);

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

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">
      <div className="flex-1 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative w-[420px] max-w-full overflow-y-auto border-l border-slate-800 bg-slate-950 p-6 animate-in slide-in-from-right">
        <button onClick={onClose} className="absolute right-4 top-4 text-slate-400 hover:text-white">
          <X />
        </button>

        {!profile ? (
          <p className="text-sm text-slate-400">Loading provider profile...</p>
        ) : (
          <>
            <div className="mb-6 text-center">
              <img
                src={profile?.avatar_url || "https://i.pravatar.cc/150"}
                alt={profile?.name || "Provider"}
                className="mx-auto mb-3 h-24 w-24 rounded-full border-4 border-indigo-500 object-cover"
              />
              <h2 className="text-xl font-semibold">{profile?.name || "Provider"}</h2>
              <p className="mt-1 flex items-center justify-center gap-1 text-sm text-slate-400">
                <MapPin size={14} />
                {profile?.location || "Unknown"}
              </p>
              <div className="mt-2 inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-3 py-1 text-xs text-emerald-300">
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
              <p className="text-sm text-slate-400">{profile?.bio || "No bio added yet."}</p>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 font-semibold">Services</h3>
              <div className="flex flex-wrap gap-2">
                {profile?.services?.length ? (
                  profile.services.map((service) => (
                    <span key={service} className="rounded-full bg-slate-800 px-3 py-1 text-xs">
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
                  <div key={`review-${index}`} className="rounded-lg bg-slate-800 p-2">
                    <div className="text-sm text-yellow-400">{"★".repeat(Math.max(1, Number(review.rating || 0)))}</div>
                    <p className="text-xs text-slate-300">{review.comment || "Customer left a rating."}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-6">
              <h3 className="mb-2 text-sm">Trust Score</h3>
              <div className="h-2 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full bg-gradient-to-r from-indigo-500 to-emerald-400" style={{ width: `${profileCompletion}%` }} />
              </div>
              <p className="mt-1 text-xs text-slate-400">{profileCompletion}% profile completion</p>
            </div>

            <div className="space-y-3">
              <button
                onClick={() => setOpenReview(true)}
                className="w-full rounded-xl bg-indigo-600 py-2 text-sm font-semibold hover:bg-indigo-500"
              >
                Write Review
              </button>
              {!!businessSlug && (
                <button
                  onClick={() => window.open(`/business/${businessSlug}`, "_blank")}
                  className="w-full rounded-xl bg-slate-800 py-2 text-sm font-semibold hover:bg-slate-700 inline-flex items-center justify-center gap-2"
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
    <div className="rounded-xl border border-slate-800 bg-slate-900 p-3 text-center">
      <div className="mb-1 flex justify-center text-indigo-400">{icon}</div>
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-slate-400">{label}</div>
    </div>
  );
}
