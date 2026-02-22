"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import ReviewModal from "./ReviewModal";
import {
  Star,
  MapPin,
  ShieldCheck,
  MessageCircle,
  Briefcase,
  Clock,
  X,
  Image,
} from "lucide-react";

type Props = {
  userId: string;
  open: boolean;
  onClose: () => void;
};

type Profile = {
  id: string;
  name: string;
  location: string;
  bio: string;
  role: string;
  services: string[];
  availability: string;
  avatar_url?: string;
};

export default function ProviderTrustPanel({
  userId,
  open,
  onClose,
}: Props) {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [stats, setStats] = useState({
    rating: 4.6,
    reviews: 18,
    completed: 42,
    response: "7 mins",
  });

  const [portfolio, setPortfolio] = useState<string[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [avgRating, setAvgRating] = useState(0);
  const [openReview, setOpenReview] = useState(false);
  const [metrics, setMetrics] = useState<any>(null);

  /* ---------- LOAD DATA ---------- */

  useEffect(() => {
  if (!userId) return;

  const fetchReviews = async () => {
    const { data } = await supabase
      .from("reviews")
      .select("*")
      .eq("provider_id", userId);

    if (data) {
      setReviews(data);

      const avg =
        data.reduce(
          (sum, r) => sum + r.rating,
          0
        ) / data.length;

      setAvgRating(avg.toFixed(1));
    }
  };

  fetchReviews();
}, [userId]);
useEffect(() => {
  if (!userId) return;

  const fetchMetrics = async () => {
    const { data } = await supabase
      .rpc("get_provider_metrics", { pid: userId });

    if (data?.length) setMetrics(data[0]);
  };

  fetchMetrics();
}, [userId]);
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex">

      {/* OVERLAY */}
      <div
        className="flex-1 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* PANEL */}
      <div className="w-[420px] bg-slate-950 border-l border-slate-800 p-6 overflow-y-auto animate-in slide-in-from-right">

        {/* CLOSE */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-white"
        >
          <X />
        </button>

        {/* PROFILE HEADER */}
        <div className="text-center mb-6">

          <img
            src={
              profile?.avatar_url ||
              "https://i.pravatar.cc/150"
            }
            className="w-24 h-24 rounded-full mx-auto border-4 border-indigo-500 mb-3"
          />

          <h2 className="text-xl font-semibold">
            {profile?.name || "Provider"}
          </h2>

          <p className="text-sm text-slate-400 flex justify-center gap-1">
            <MapPin size={14} />
            {profile?.location || "Unknown"}
          </p>

          <div className="flex justify-center gap-1 mt-2 text-green-400 text-sm">
            <ShieldCheck size={14} />
            Verified Provider
          </div>
        </div>

        {/* TRUST STATS */}
        <div className="grid grid-cols-2 gap-3 mb-6">
          <StatCard icon={<Star />} label="Rating" value={stats.rating} />
          <StatCard icon={<Briefcase />} label="Jobs Done" value={stats.completed} />
          <StatCard icon={<MessageCircle />} label="Reviews" value={stats.reviews} />
          <StatCard icon={<Clock />} label="Response" value={stats.response} />
        </div>

        {/* BIO */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">About</h3>
          <p className="text-sm text-slate-400">
            {profile?.bio || "No bio added yet."}
          </p>
        </div>
        {/* REVIEWS */}
<div className="mt-6">
  <h3 className="font-semibold mb-2">
    Reviews & Ratings
  </h3>

  <div className="text-yellow-400 font-bold mb-3">
    ⭐ {avgRating || "No ratings yet"}
  </div>

  <div className="space-y-2 max-h-40 overflow-y-auto">
    {reviews.map((r, i) => (
      <div
        key={i}
        className="bg-slate-800 p-2 rounded-lg"
      >
        <div className="text-yellow-400 text-sm">
          {"⭐".repeat(r.rating)}
        </div>

        <p className="text-xs text-slate-300">
          {r.comment}
        </p>
      </div>
    ))}
  </div>
</div>
<button
  onClick={() => setOpenReview(true)}
  className="w-full mt-4 bg-indigo-600 py-2 rounded-xl text-sm"
>
  Write Review
</button>
<ReviewModal
  providerId={userId}
  open={openReview}
  onClose={() => setOpenReview(false)}
/>
{/* PERFORMANCE METRICS */}

<div className="mt-6 border-t border-slate-800 pt-4">

  <h3 className="font-semibold mb-3">
    Performance Metrics
  </h3>

  {!metrics ? (
    <p className="text-sm text-slate-400">
      No performance data yet.
    </p>
  ) : (
    <div className="grid grid-cols-2 gap-3 text-sm">

      <div className="bg-slate-800 p-3 rounded-xl">
        <p className="text-slate-400">Jobs Completed</p>
        <p className="font-bold text-lg">
          {metrics.completed_orders}
        </p>
      </div>

      <div className="bg-slate-800 p-3 rounded-xl">
        <p className="text-slate-400">Total Orders</p>
        <p className="font-bold text-lg">
          {metrics.total_orders}
        </p>
      </div>

      <div className="bg-slate-800 p-3 rounded-xl">
        <p className="text-slate-400">Success Rate</p>
        <p className="font-bold text-lg text-green-400">
          {metrics.success_rate || 0}%
        </p>
      </div>

      <div className="bg-slate-800 p-3 rounded-xl">
        <p className="text-slate-400">Cancelled</p>
        <p className="font-bold text-lg text-red-400">
          {metrics.cancelled_orders}
        </p>
      </div>

    </div>
  )}
</div>
{/* TRUST SCORE */}

<div className="mt-4">

  <div className="text-sm mb-1">
    Trust Score
  </div>

  <div className="h-2 bg-slate-800 rounded-full overflow-hidden">
    <div
      className="h-full bg-gradient-to-r from-green-400 to-emerald-500"
      style={{
        width: `${metrics?.success_rate || 0}%`,
      }}
    />
  </div>

</div>

        {/* SERVICES */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2">
            Services Offered
          </h3>

          <div className="flex flex-wrap gap-2">
            {profile?.services?.length ? (
              profile.services.map((s, i) => (
                <span
                  key={i}
                  className="bg-slate-800 px-3 py-1 rounded-full text-xs"
                >
                  {s}
                </span>
              ))
            ) : (
              <span className="text-xs text-slate-500">
                No services listed
              </span>
            )}
          </div>
        </div>

        {/* PORTFOLIO */}
        <div className="mb-6">
          <h3 className="font-semibold mb-2 flex items-center gap-2">
            <Image size={16} />
            Portfolio
          </h3>

          <div className="grid grid-cols-3 gap-2">
            {portfolio.map((img, i) => (
              <img
                key={i}
                src={img}
                className="rounded-lg h-20 object-cover"
              />
            ))}
          </div>
        </div>

        {/* AVAILABILITY */}
        <div className="mb-6 text-sm">
          <span className="text-slate-400">
            Availability:
          </span>{" "}
          <span className="text-green-400">
            {profile?.availability || "Available"}
          </span>
        </div>

        {/* ACTIONS */}
        <div className="space-y-3">
          <button className="w-full bg-indigo-600 hover:bg-indigo-700 py-2 rounded-xl">
            Book Now
          </button>

          <button className="w-full bg-slate-800 hover:bg-slate-700 py-2 rounded-xl flex items-center justify-center gap-2">
            <MessageCircle size={16} />
            Chat Provider
          </button>
        </div>
      </div>
    </div>
  );
}

/* ---------- STAT CARD ---------- */

function StatCard({
  icon,
  label,
  value,
}: any) {
  return (
    <div className="bg-slate-900 border border-slate-800 p-3 rounded-xl text-center">
      <div className="flex justify-center text-indigo-400 mb-1">
        {icon}
      </div>
      <div className="font-semibold">{value}</div>
      <div className="text-xs text-slate-400">
        {label}
      </div>``
    </div>
  );
}