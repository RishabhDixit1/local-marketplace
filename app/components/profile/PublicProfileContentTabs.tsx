"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BadgeCheck, Camera, Loader2, Plus, ThumbsDown, ThumbsUp, X } from "lucide-react";
import PublicProfileAbout from "@/app/components/profile/PublicProfileAbout";
import PublicProfilePostsGrid from "@/app/components/profile/PublicProfilePostsGrid";
import PublicProfileStoreTab from "@/app/components/profile/PublicProfileStoreTab";
import type { VerificationStatus } from "@/lib/business";
import { formatPaymentRailLabel } from "@/lib/paymentFlow";
import type { PublicProfilePost, PublicProfileReview } from "@/lib/profile/public";
import { supabase } from "@/lib/supabase";
import { setPublicProfileModalOpen } from "@/app/components/profile/publicProfileModalState";

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
  initialTab?: "marketplace" | "store" | "reviews" | "about";
  requestReviewComposer?: boolean;
  paymentMethods?: Array<{ id: string; method_type: string; provider_name: string | null; account_handle: string | null; is_verified: boolean }>;
  workHistory?: Array<{ id: string; role_title: string; company_name: string; start_date: string | null; end_date: string | null; is_current: boolean }>;
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
  initialTab = "marketplace",
  requestReviewComposer = false,
  paymentMethods = [],
  workHistory = [],
}: PublicProfileContentTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"marketplace" | "store" | "reviews" | "about">(initialTab);
  const [authResolved, setAuthResolved] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const isSelf = Boolean(viewerId && viewerId === profileUserId);

  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState("");
  const [reviewSubmitting, setReviewSubmitting] = useState(false);
  const [reviewError, setReviewError] = useState<string | null>(null);
  const [reviewBreakdown, setReviewBreakdown] = useState({ quality: 5, communication: 5, timeliness: 5, value: 5 });
  const [reviewWouldRecommend, setReviewWouldRecommend] = useState(true);
  const [reviewPhotos, setReviewPhotos] = useState<File[]>([]);
  const [reviewPhotoPreviews, setReviewPhotoPreviews] = useState<string[]>([]);

  const marketplacePosts = useMemo(() => posts, [posts]);

  useEffect(() => {
    if (!reviewModalOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setPublicProfileModalOpen(true);
    return () => {
      document.body.style.overflow = previousOverflow;
      setPublicProfileModalOpen(false);
    };
  }, [reviewModalOpen]);

  useEffect(() => {
    let active = true;

    const bootstrap = async () => {
      try {
        const {
          data: { user },
        } = await supabase.auth.getUser();
        if (!active) return;
        setViewerId(user?.id || null);
      } finally {
        if (active) setAuthResolved(true);
      }
    };

    void bootstrap();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  useEffect(() => {
    if (!requestReviewComposer || !authResolved) return;
    if (!viewerId || isSelf) return;
    setActiveTab("reviews");
    setReviewModalOpen(true);
  }, [authResolved, isSelf, requestReviewComposer, viewerId]);

  const handleReviewPhotos = useCallback((files: FileList | null) => {
    if (!files) return;
    const selected = Array.from(files).slice(0, 5);
    setReviewPhotos((prev) => [...prev, ...selected].slice(0, 5));
    selected.forEach((file) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const dataUrl = e.target?.result as string;
        setReviewPhotoPreviews((prev) => [...prev, dataUrl].slice(0, 5));
      };
      reader.readAsDataURL(file);
    });
  }, []);

  const removeReviewPhoto = useCallback((index: number) => {
    setReviewPhotos((prev) => prev.filter((_, i) => i !== index));
    setReviewPhotoPreviews((prev) => prev.filter((_, i) => i !== index));
  }, []);

  const resetReviewForm = useCallback(() => {
    setReviewComment("");
    setReviewRating(5);
    setReviewBreakdown({ quality: 5, communication: 5, timeliness: 5, value: 5 });
    setReviewWouldRecommend(true);
    setReviewPhotos([]);
    setReviewPhotoPreviews([]);
    setReviewError(null);
  }, []);

  const handleSubmitReview = useCallback(async () => {
    if (isSelf || !viewerId) return;
    setReviewSubmitting(true);
    setReviewError(null);
    try {
      const { data: inserted, error } = await supabase
        .from("reviews")
        .insert({
          provider_id: profileUserId,
          reviewer_id: viewerId,
          rating: reviewRating,
          comment: reviewComment.trim() || null,
          metadata: {
            quality: reviewBreakdown.quality,
            communication: reviewBreakdown.communication,
            timeliness: reviewBreakdown.timeliness,
            value: reviewBreakdown.value,
            wouldRecommend: reviewWouldRecommend,
          },
        })
        .select("id")
        .single();

      if (error) throw error;

      if (reviewPhotos.length > 0 && inserted?.id) {
        for (const photo of reviewPhotos) {
          const formData = new FormData();
          formData.append("file", photo);
          await fetch(`/api/reviews/${inserted.id}/photos`, {
            method: "POST",
            body: formData,
          });
        }
      }

      setReviewModalOpen(false);
      resetReviewForm();
      router.refresh();
    } catch (error) {
      setReviewError(error instanceof Error ? error.message : "Unable to submit review right now.");
    } finally {
      setReviewSubmitting(false);
    }
  }, [
    isSelf,
    profileUserId,
    reviewComment,
    reviewRating,
    reviewBreakdown,
    reviewWouldRecommend,
    reviewPhotos,
    router,
    viewerId,
    resetReviewForm,
  ]);

  const tabs = [
    { id: "marketplace" as const, label: "Marketplace" },
    { id: "store" as const, label: "Store" },
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
        {activeTab === "marketplace" ? (
          <div className="space-y-4">
            <div className="flex items-end justify-between gap-3">
              <div>
                <h2 className="text-xl font-semibold tracking-tight text-slate-950">Marketplace</h2>
                <p className="mt-1 text-sm text-slate-600">
                  All posts, services, and products in one horizontally scrollable row.
                </p>
              </div>
            </div>

            {marketplacePosts.length > 0 ? (
              <PublicProfilePostsGrid
                posts={marketplacePosts}
                profileUserId={profileUserId}
                displayName={displayName}
                avatarUrl={avatarUrl}
                verificationStatus={verificationStatus}
                locationLabel={locationLabel}
                responseMinutes={responseMinutes}
                publicPath={publicPath}
                horizontal
              />
            ) : (
              <div className="rounded-[20px] border border-dashed border-slate-200 bg-[#f8fafc] p-4 text-sm text-slate-500">
                No public marketplace items yet. Posts, services, and products will appear here when shared.
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "store" ? (
          <PublicProfileStoreTab profileUserId={profileUserId} displayName={displayName} />
        ) : null}

        {activeTab === "reviews" ? (
          <div className="space-y-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[2rem] font-semibold tracking-tight text-slate-950">Reviews</h2>
                <p className="mt-2 text-sm text-slate-600">
                  {reviewCount > 0 ? `${averageRating.toFixed(1)} average from ${reviewCount} review${reviewCount === 1 ? "" : "s"}.` : "No public reviews yet."}
                </p>
              </div>
              {authResolved && !isSelf && viewerId ? (
                <button
                  type="button"
                  onClick={() => setReviewModalOpen(true)}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0959aa]"
                >
                  <Plus className="h-4 w-4" />
                  Write a review
                </button>
              ) : null}
            </div>

            {reviews.length > 0 ? (
              <div className="grid gap-4 lg:grid-cols-2">
                {reviews.map((review, index) => (
                  <ReviewCard key={`${review.createdAt || "review"}-${index}`} review={review} viewerId={viewerId} />
                ))}
              </div>
            ) : (
              <div className="rounded-[20px] border border-dashed border-slate-200 bg-[#f8fafc] p-4 text-sm text-slate-500">
                Reviews will appear here once this member receives public feedback.
              </div>
            )}
          </div>
        ) : null}

        {activeTab === "about" ? (
          <div className="space-y-6">
            <PublicProfileAbout bio={bio} />

            {workHistory.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-700">Work History</h3>
                <ol className="space-y-3">
                  {workHistory.slice(0, 2).map((wh) => (
                    <li key={wh.id} className="flex items-start gap-3">
                      <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo-500" />
                      <div>
                        <p className="text-sm font-medium text-slate-800">{wh.role_title}</p>
                        <p className="text-xs text-slate-500">
                          {wh.company_name}
                          {wh.start_date
                            ? ` · ${new Date(wh.start_date).getFullYear()}–${wh.is_current ? "Present" : wh.end_date ? new Date(wh.end_date).getFullYear() : ""}`
                            : null}
                        </p>
                      </div>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {paymentMethods.length > 0 && (
              <div className="rounded-2xl border border-slate-200 bg-white p-5">
                <h3 className="mb-4 text-sm font-semibold text-slate-700">Accepts Payment Via</h3>
                <div className="flex flex-wrap gap-2">
                  {paymentMethods.map((pm) => (
                    <span
                      key={pm.id}
                      className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-slate-50 px-3 py-1.5 text-xs font-medium text-slate-700"
                    >
                      {formatPaymentRailLabel(pm.provider_name ?? pm.method_type)}
                      {pm.is_verified && (
                        <span className="text-emerald-500">✓</span>
                      )}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        ) : null}
      </div>

      {!reviewModalOpen ? null : (
        <div className="fixed inset-0 z-[var(--layer-modal)] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={() => setReviewModalOpen(false)} />
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Write a review"
            tabIndex={-1}
            className="relative z-[1] flex max-h-[min(88vh,600px)] w-full max-w-lg flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)] outline-none"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">Review</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Share your experience</h3>
              </div>
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                disabled={reviewSubmitting}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="Close review dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-5">

                {/* Overall Rating */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Overall Rating</label>
                  <div className="flex items-center gap-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <button
                        key={star}
                        type="button"
                        onClick={() => setReviewRating(star)}
                        className={`text-2xl transition ${star <= reviewRating ? "text-yellow-400" : "text-slate-300 hover:text-yellow-300"}`}
                        aria-label={`${star} star${star > 1 ? "s" : ""}`}
                      >
                        ★
                      </button>
                    ))}
                  </div>
                </div>

                {/* Rating Breakdown */}
                <div className="space-y-3 rounded-2xl border border-slate-100 bg-slate-50/50 p-4">
                  <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Breakdown</p>
                  {(["quality", "communication", "timeliness", "value"] as const).map((key) => (
                    <div key={key} className="flex items-center gap-3">
                      <span className="w-28 shrink-0 text-xs font-medium capitalize text-slate-700">{key}</span>
                      <div className="flex items-center gap-0.5">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setReviewBreakdown((prev) => ({ ...prev, [key]: star }))}
                            className={`text-base transition ${star <= reviewBreakdown[key] ? "text-yellow-400" : "text-slate-200 hover:text-yellow-300"}`}
                            aria-label={`${key} ${star} star${star > 1 ? "s" : ""}`}
                          >
                            ★
                          </button>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>

                {/* Would recommend toggle */}
                <div className="flex items-center justify-between rounded-2xl border border-slate-200 bg-white px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    {reviewWouldRecommend ? (
                      <ThumbsUp className="h-5 w-5 text-emerald-500" />
                    ) : (
                      <ThumbsDown className="h-5 w-5 text-rose-400" />
                    )}
                    <span className="text-sm font-medium text-slate-900">
                      {reviewWouldRecommend ? "I would recommend this provider" : "I would not recommend this provider"}
                    </span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setReviewWouldRecommend((prev) => !prev)}
                    className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors ${
                      reviewWouldRecommend ? "bg-emerald-500" : "bg-slate-300"
                    }`}
                    role="switch"
                    aria-checked={reviewWouldRecommend}
                    aria-label="Toggle recommendation"
                  >
                    <span
                      className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow transition-transform ${
                        reviewWouldRecommend ? "translate-x-5" : "translate-x-0"
                      }`}
                    />
                  </button>
                </div>

                {/* Photo upload */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Photos</label>
                  <div className="flex flex-wrap gap-3">
                    {reviewPhotoPreviews.map((preview, i) => (
                      <div key={preview} className="relative h-20 w-20 overflow-hidden rounded-xl border border-slate-200">
                        <img src={preview} alt={`Review photo ${i + 1}`} className="h-full w-full object-cover" />
                        <button
                          type="button"
                          onClick={() => removeReviewPhoto(i)}
                          className="absolute right-0.5 top-0.5 flex h-5 w-5 items-center justify-center rounded-full bg-slate-900/60 text-white hover:bg-slate-900/80"
                          aria-label="Remove photo"
                        >
                          <X className="h-3 w-3" />
                        </button>
                      </div>
                    ))}
                    {reviewPhotos.length < 5 && (
                      <label className="flex h-20 w-20 cursor-pointer items-center justify-center rounded-xl border-2 border-dashed border-slate-300 bg-slate-50 transition hover:border-slate-400 hover:bg-slate-100">
                        <Camera className="h-6 w-6 text-slate-400" />
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          className="hidden"
                          onChange={(e) => handleReviewPhotos(e.target.files)}
                        />
                      </label>
                    )}
                  </div>
                  <p className="text-xs text-slate-400">Up to 5 photos</p>
                </div>

                {/* Comment */}
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Comment</label>
                  <textarea
                    value={reviewComment}
                    onChange={(e) => setReviewComment(e.target.value)}
                    rows={4}
                    placeholder="Describe your experience with this provider..."
                    className="min-h-[120px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-teal-500 focus:ring-4 focus:ring-teal-500/10"
                  />
                </div>

                {reviewError ? <p className="text-sm text-rose-600">{reviewError}</p> : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-end gap-3 border-t border-slate-200 px-6 py-5">
              <button
                type="button"
                onClick={() => setReviewModalOpen(false)}
                disabled={reviewSubmitting}
                className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={reviewSubmitting || reviewComment.trim().length < 5}
                onClick={() => void handleSubmitReview()}
                className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0959aa] disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {reviewSubmitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {reviewSubmitting ? "Submitting..." : "Submit review"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}

function ReviewCard({ review, viewerId }: { review: PublicProfileReview; viewerId: string | null }) {
  const [voteState, setVoteState] = useState<{ helpful: number; notHelpful: number; userVote: string | null } | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    if (!viewerId) return;
    const fetchVotes = async () => {
      try {
        const res = await fetch(`/api/reviews/${review.reviewerId ?? "none"}/vote/status`);
        const json = await res.json();
        if (json.ok) {
          setVoteState({
            helpful: json.helpful_count ?? 0,
            notHelpful: json.not_helpful_count ?? 0,
            userVote: json.user_vote ?? null,
          });
        }
      } catch {
        // silently fail
      }
    };
    void fetchVotes();
  }, [review.reviewerId, viewerId]);

  const photos = review.metadata?.photos as string[] | undefined;
  const helpfulCount = voteState?.helpful ?? (review.metadata?.helpful_count as number | undefined) ?? 0;

  const handleVote = async (vote: string) => {
    if (!viewerId || voting) return;
    setVoting(true);
    try {
      const res = await fetch(`/api/reviews/${review.reviewerId ?? "none"}/vote`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ vote }),
      });
      const json = await res.json();
      if (json.ok) {
        setVoteState((prev) => ({
          helpful: json.action === "removed" && voteState?.userVote === "helpful" ? (prev?.helpful ?? 1) - 1 : json.vote === "helpful" ? (prev?.helpful ?? 0) + 1 : prev?.helpful ?? 0,
          notHelpful: json.action === "removed" && voteState?.userVote === "not_helpful" ? (prev?.notHelpful ?? 1) - 1 : json.vote === "not_helpful" ? (prev?.notHelpful ?? 0) + 1 : prev?.notHelpful ?? 0,
          userVote: json.action === "removed" ? null : json.vote,
        }));
      }
    } catch {
      // silently fail
    } finally {
      setVoting(false);
    }
  };

  return (
    <article className="rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-4">
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-1 text-lg">{renderStars(review.rating)}</div>
        <div className="flex items-center gap-2">
          {review.isVerifiedPurchase && (
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-700">
              <BadgeCheck className="h-3 w-3" />
              Verified
            </span>
          )}
          <span className="text-xs font-medium text-slate-500">{formatReviewDate(review.createdAt)}</span>
        </div>
      </div>

      <p className="mt-3 text-sm leading-7 text-slate-700">{review.comment || "Verified marketplace interaction."}</p>

      {photos && photos.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {photos.map((photo) => (
            <img
              key={photo}
              src={photo}
              alt="Review photo"
              className="h-20 w-20 rounded-lg object-cover"
            />
          ))}
        </div>
      )}

      {viewerId && (
        <div className="mt-3 flex items-center gap-3">
          <button
            type="button"
            disabled={voting}
            onClick={() => void handleVote("helpful")}
            className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-1 text-[11px] font-medium transition ${
              voteState?.userVote === "helpful"
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 text-slate-500 hover:border-slate-300 hover:text-slate-700"
            }`}
          >
            <ThumbsUp className="h-3 w-3" />
            Helpful{helpfulCount > 0 ? ` (${helpfulCount})` : ""}
          </button>
        </div>
      )}
    </article>
  );
}
