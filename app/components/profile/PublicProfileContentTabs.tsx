"use client";

import { useState } from "react";
import PublicProfileAbout from "@/app/components/profile/PublicProfileAbout";
import PublicProfilePostsGrid from "@/app/components/profile/PublicProfilePostsGrid";
import type { PublicProfilePost, PublicProfileReview, VerificationStatus } from "@/lib/profile/public";

type PublicProfileContentTabsProps = {
  bio: string | null;
  reviews: PublicProfileReview[];
  averageRating: number;
  reviewCount: number;
  posts: PublicProfilePost[];
  profileUserId: string;
  displayName: string;
  avatarUrl: string | null;
  verificationStatus: VerificationStatus;
  locationLabel: string;
  responseMinutes: number;
  publicPath: string;
};

const formatReviewDate = (value: string | null) => {
  if (!value) return "Recently";

  try {
    return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value));
  } catch {
    return "Recently";
  }
};

const renderStars = (rating: number) =>
  Array.from({ length: 5 }, (_, index) => (
    <span key={`${rating}-${index}`} className={index < Math.round(rating) ? "text-amber-400" : "text-slate-300"}>
      ★
    </span>
  ));

export default function PublicProfileContentTabs({
  bio,
  reviews,
  averageRating,
  reviewCount,
  posts,
  profileUserId,
  displayName,
  avatarUrl,
  verificationStatus,
  locationLabel,
  responseMinutes,
  publicPath,
}: PublicProfileContentTabsProps) {
  const [activeTab, setActiveTab] = useState<"help" | "services" | "reviews" | "about">("help");
  const helpPosts = posts.filter((post) => post.type === "demand");
  const servicePosts = posts.filter((post) => post.type === "service" || post.type === "product");
  const tabs = [
    { id: "help" as const, label: "Help Post" },
    { id: "services" as const, label: "Services" },
    { id: "reviews" as const, label: "Reviews" },
    { id: "about" as const, label: "About" },
  ];

  return (
    <section className="rounded-[22px] border border-slate-200 bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.05)] sm:px-6 sm:py-6">
      <div className="flex flex-wrap items-end gap-6 border-b border-slate-200">
        {tabs.map((tab) => {
          const active = activeTab === tab.id;

          return (
            <button
              key={tab.id}
              type="button"
              onClick={() => setActiveTab(tab.id)}
              className={`inline-flex border-b-2 pb-3 text-base font-semibold transition ${
                active
                  ? "border-[#0a66c2] text-[#0a66c2]"
                  : "border-transparent text-slate-500 hover:text-slate-900"
              }`}
            >
              {tab.label}
            </button>
          );
        })}
      </div>

      <div className="pt-6">
        {activeTab === "help" ? (
          helpPosts.length > 0 ? (
            <PublicProfilePostsGrid
              posts={helpPosts}
              profileUserId={profileUserId}
              displayName={displayName}
              avatarUrl={avatarUrl}
              verificationStatus={verificationStatus}
              locationLabel={locationLabel}
              responseMinutes={responseMinutes}
              publicPath={publicPath}
            />
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-[#f8fafc] p-4 text-sm text-slate-500">
              No public help posts yet. When this member shares task requests, they will appear here.
            </div>
          )
        ) : null}

        {activeTab === "services" ? (
          servicePosts.length > 0 ? (
            <PublicProfilePostsGrid
              posts={servicePosts}
              profileUserId={profileUserId}
              displayName={displayName}
              avatarUrl={avatarUrl}
              verificationStatus={verificationStatus}
              locationLabel={locationLabel}
              responseMinutes={responseMinutes}
              publicPath={publicPath}
            />
          ) : (
            <div className="rounded-[20px] border border-dashed border-slate-200 bg-[#f8fafc] p-4 text-sm text-slate-500">
              No public services yet. When this member shares service or product listings, they will appear here.
            </div>
          )
        ) : null}

        {activeTab === "reviews" ? (
          <div className="space-y-5">
            <div>
              <h2 className="text-[2rem] font-semibold tracking-tight text-slate-950">Reviews</h2>
              <p className="mt-2 text-sm text-slate-600">
                {reviewCount > 0 ? `${averageRating.toFixed(1)} average from ${reviewCount} review${reviewCount === 1 ? "" : "s"}.` : "No public reviews yet."}
              </p>
            </div>

            {reviews.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {reviews.map((review, index) => (
                  <article key={`${review.createdAt || "review"}-${index}`} className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-1 text-lg">{renderStars(review.rating)}</div>
                      <span className="text-xs font-medium text-slate-500">{formatReviewDate(review.createdAt)}</span>
                    </div>
                    <p className="mt-3 text-sm leading-7 text-slate-700">{review.comment || "Verified marketplace interaction."}</p>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-slate-200 bg-[#f8fafc] p-4 text-sm text-slate-500">
                Reviews will appear here once this member receives public feedback.
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "about" ? <PublicProfileAbout bio={bio} /> : null}
      </div>
    </section>
  );
}
