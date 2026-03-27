"use client";

import { Star } from "lucide-react";
import type { MarketplaceReviewRecord } from "@/lib/profile/marketplace";

const renderStars = (rating: number) =>
  Array.from({ length: 5 }, (_, index) => (
    <Star key={`${rating}-${index}`} className={`h-4 w-4 ${index < Math.round(rating) ? "fill-amber-400 text-amber-400" : "text-slate-300"}`} />
  ));

export default function ReviewsSection({
  reviews,
  averageRating,
}: {
  reviews: MarketplaceReviewRecord[];
  averageRating: number;
}) {
  return (
    <section className="rounded-[28px] border border-slate-200/80 bg-white p-5 shadow-lg shadow-slate-200/50 sm:p-6">
      <div className="mb-5">
        <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Feedback</p>
        <h2 className="mt-1 text-xl font-semibold tracking-tight text-slate-950">Reviews</h2>
        <p className="mt-2 text-sm text-slate-600">
          {reviews.length > 0 ? `${averageRating.toFixed(1)} average from ${reviews.length} reviews.` : "No public reviews yet."}
        </p>
      </div>

      {reviews.length > 0 ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {reviews.map((review, index) => (
            <article key={`${review.created_at || "review"}-${index}`} className="rounded-[22px] border border-slate-200 bg-slate-50 p-4">
              <div className="flex items-center justify-between gap-3">
                <div className="flex items-center gap-1">{renderStars(review.rating)}</div>
                <span className="text-xs font-medium text-slate-500">{review.created_at ? new Date(review.created_at).toLocaleDateString() : "Recently"}</span>
              </div>
              <p className="mt-3 text-sm leading-7 text-slate-700">{review.comment || "Verified marketplace interaction."}</p>
            </article>
          ))}
        </div>
      ) : (
        <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-6 text-sm text-slate-600">
          Reviews will appear here once this profile receives feedback.
        </div>
      )}
    </section>
  );
}
