"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Sparkles, X } from "lucide-react";
import PublicProfileAbout from "@/app/components/profile/PublicProfileAbout";
import PublicProfilePostsGrid from "@/app/components/profile/PublicProfilePostsGrid";
import type { VerificationStatus } from "@/lib/business";
import type { PublicProfileManualOffering, PublicProfilePost, PublicProfileReview } from "@/lib/profile/public";
import { supabase } from "@/lib/supabase";
import { setPublicProfileModalOpen } from "@/app/components/profile/publicProfileModalState";

type PublicProfileContentTabsProps = {
  bio: string | null;
  reviews: PublicProfileReview[];
  averageRating: number;
  reviewCount: number;
  posts: PublicProfilePost[];
  manualOfferings: PublicProfileManualOffering[];
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
  manualOfferings,
  profileUserId,
  displayName,
  avatarUrl,
  verificationStatus,
  locationLabel,
  responseMinutes,
  publicPath,
}: PublicProfileContentTabsProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<"marketplace" | "offerings" | "reviews" | "about">("marketplace");
  const [authResolved, setAuthResolved] = useState(false);
  const [viewerId, setViewerId] = useState<string | null>(null);
  const [offeringDialogOpen, setOfferingDialogOpen] = useState(false);
  const isSelf = Boolean(viewerId && viewerId === profileUserId);
  const offeringDialogRef = useRef<HTMLDivElement | null>(null);
  const offeringTitleInputRef = useRef<HTMLInputElement | null>(null);

  const [offerings, setOfferings] = useState<PublicProfileManualOffering[]>(manualOfferings);
  const [newTitle, setNewTitle] = useState("");
  const [newDescription, setNewDescription] = useState("");
  const [newThumbnailUrl, setNewThumbnailUrl] = useState("");
  const [saveBusy, setSaveBusy] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  const marketplacePosts = useMemo(() => posts, [posts]);

  useEffect(() => {
    setOfferings(manualOfferings);
  }, [manualOfferings]);

  useEffect(() => {
    if (!offeringDialogOpen) return;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    setPublicProfileModalOpen(true);
    offeringDialogRef.current?.focus();
    offeringTitleInputRef.current?.focus();

    return () => {
      document.body.style.overflow = previousOverflow;
      setPublicProfileModalOpen(false);
    };
  }, [offeringDialogOpen]);

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

  const canSubmit = useMemo(() => newTitle.trim().length > 1 && !saveBusy, [newTitle, saveBusy]);

  const resetOfferingForm = useCallback(() => {
    setNewTitle("");
    setNewDescription("");
    setNewThumbnailUrl("");
    setSaveError(null);
  }, []);

  const closeOfferingDialog = useCallback(() => {
    if (saveBusy) return;
    setOfferingDialogOpen(false);
    resetOfferingForm();
  }, [resetOfferingForm, saveBusy]);

  const handleAddOffering = useCallback(async () => {
    if (!isSelf || !viewerId) return;
    const title = newTitle.trim();
    if (!title) return;

    setSaveBusy(true);
    setSaveError(null);

    const offering: PublicProfileManualOffering = {
      id:
        typeof window !== "undefined" && window.crypto?.randomUUID
          ? window.crypto.randomUUID()
          : `${Date.now()}-${Math.random().toString(16).slice(2)}`,
      title,
      description: newDescription.trim(),
      thumbnailUrl: newThumbnailUrl.trim() || null,
    };

    try {
      const { data: currentProfile, error: loadError } = await supabase
        .from("profiles")
        .select("metadata")
        .eq("id", viewerId)
        .maybeSingle();
      if (loadError) throw loadError;

      const currentMetadata =
        (currentProfile && typeof (currentProfile as Record<string, unknown>).metadata === "object"
          ? ((currentProfile as Record<string, unknown>).metadata as Record<string, unknown> | null)
          : null) || {};

      const rawExisting = currentMetadata.offerings;
      const existing = Array.isArray(rawExisting) ? rawExisting : [];
      const nextMetadata = {
        ...currentMetadata,
        offerings: [...existing, offering],
      };

      const { error: saveError } = await supabase.from("profiles").update({ metadata: nextMetadata }).eq("id", viewerId);
      if (saveError) throw saveError;

      setOfferings((current) => [...current, offering]);
      setOfferingDialogOpen(false);
      resetOfferingForm();
      router.refresh();
    } catch (error) {
      setSaveError(error instanceof Error ? error.message : "Unable to save offering right now.");
    } finally {
      setSaveBusy(false);
    }
  }, [isSelf, newDescription, newThumbnailUrl, newTitle, resetOfferingForm, router, viewerId]);

  const tabs = [
    { id: "marketplace" as const, label: "Marketplace" },
    { id: "offerings" as const, label: "Offerings" },
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

        {activeTab === "offerings" ? (
          <div className="space-y-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <h2 className="text-[2rem] font-semibold tracking-tight text-slate-950">Offerings</h2>
                <p className="mt-2 text-sm text-slate-600">
                  A simple list of what this member can help with. {isSelf ? "Add services and keep this list fresh." : ""}
                </p>
              </div>
              {authResolved && isSelf && offerings.length > 0 ? (
                <button
                  type="button"
                  onClick={() => {
                    setSaveError(null);
                    setOfferingDialogOpen(true);
                  }}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0959aa]"
                >
                  <Plus className="h-4 w-4" />
                  Add offering
                </button>
              ) : null}
            </div>

            {offerings.length > 0 ? (
              <div className="grid gap-4 md:grid-cols-2">
                {offerings.map((item) => (
                  <article key={item.id} className="relative overflow-hidden rounded-[22px] border border-slate-200 bg-white p-4">
                    <div className="flex items-start gap-3">
                      {item.thumbnailUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.thumbnailUrl}
                          alt=""
                          className="h-12 w-12 rounded-2xl border border-slate-200 object-cover"
                        />
                      ) : (
                        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[#edf3f8] text-[#0a66c2]">
                          <Sparkles className="h-5 w-5" />
                        </div>
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-base font-semibold text-slate-950">{item.title}</p>
                        <p className="mt-1 overflow-hidden text-sm leading-6 text-slate-600 [display:-webkit-box] [-webkit-line-clamp:2] [-webkit-box-orient:vertical]">
                          {item.description || "No description provided yet."}
                        </p>
                      </div>
                    </div>
                  </article>
                ))}
              </div>
            ) : (
              <div className="rounded-[24px] border border-dashed border-slate-200 bg-[linear-gradient(180deg,#f8fbff_0%,#f8fafc_100%)] p-6 sm:p-7">
                <div className="flex max-w-xl flex-col gap-4">
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-[#edf3f8] text-[#0a66c2]">
                    <Sparkles className="h-6 w-6" />
                  </div>
                  <div>
                    <h3 className="text-lg font-semibold text-slate-950">No offerings added yet</h3>
                    <p className="mt-2 text-sm leading-6 text-slate-600">
                      {isSelf
                        ? "Create your first offering so visitors can quickly understand what services you provide."
                        : "This member has not added any offerings yet."}
                    </p>
                  </div>
                  {authResolved && isSelf ? (
                    <div>
                      <button
                        type="button"
                        onClick={() => {
                          setSaveError(null);
                          setOfferingDialogOpen(true);
                        }}
                        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0959aa]"
                      >
                        <Plus className="h-4 w-4" />
                        Add new offering
                      </button>
                    </div>
                  ) : null}
                </div>
              </div>
            )}
          </div>
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

      {!offeringDialogOpen ? null : (
        <div className="fixed inset-0 z-[90] flex items-center justify-center bg-slate-950/55 px-4 py-6 backdrop-blur-sm">
          <div className="absolute inset-0" onClick={closeOfferingDialog} />
          <div
            ref={offeringDialogRef}
            role="dialog"
            aria-modal="true"
            aria-label="Add offering"
            tabIndex={-1}
            className="relative z-[1] flex max-h-[min(88vh,760px)] w-full max-w-2xl flex-col overflow-hidden rounded-[28px] bg-white shadow-[0_30px_80px_-35px_rgba(15,23,42,0.45)] outline-none"
          >
            <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-6 py-5">
              <div>
                <p className="text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">New offering</p>
                <h3 className="mt-1 text-2xl font-semibold tracking-tight text-slate-950">Add service details</h3>
                <p className="mt-2 text-sm text-slate-600">
                  Add a clear title, a short description, and an optional image link.
                </p>
              </div>
              <button
                type="button"
                onClick={closeOfferingDialog}
                disabled={saveBusy}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:bg-slate-100 hover:text-slate-900 disabled:opacity-50"
                aria-label="Close offering dialog"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="min-h-0 flex-1 overflow-y-auto px-6 py-6">
              <div className="grid gap-4">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Service title</label>
                  <input
                    ref={offeringTitleInputRef}
                    value={newTitle}
                    onChange={(event) => setNewTitle(event.target.value)}
                    placeholder="e.g. Home cleaning, AC repair, Tiffin service"
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Description</label>
                  <textarea
                    value={newDescription}
                    onChange={(event) => setNewDescription(event.target.value)}
                    rows={4}
                    placeholder="What’s included, coverage area, timing, pricing notes..."
                    className="min-h-[140px] w-full rounded-[24px] border border-slate-200 bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10"
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Thumbnail URL (optional)</label>
                  <input
                    value={newThumbnailUrl}
                    onChange={(event) => setNewThumbnailUrl(event.target.value)}
                    placeholder="https://..."
                    className="min-h-12 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[#0a66c2] focus:ring-4 focus:ring-[#0a66c2]/10"
                  />
                </div>

                {saveError ? <p className="text-sm text-rose-600">{saveError}</p> : null}
              </div>
            </div>

            <div className="flex shrink-0 items-center justify-between gap-3 border-t border-slate-200 px-6 py-5">
              <p className="text-xs text-slate-500">Tip: Keep the title short and use the description for the details.</p>
              <div className="flex items-center gap-3">
                <button
                  type="button"
                  onClick={closeOfferingDialog}
                  disabled={saveBusy}
                  className="inline-flex min-h-11 items-center rounded-full border border-slate-200 px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-100 disabled:opacity-50"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  disabled={!canSubmit}
                  onClick={() => void handleAddOffering()}
                  className="inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-[#0a66c2] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[#0959aa] disabled:cursor-not-allowed disabled:bg-slate-300"
                >
                  {saveBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                  {saveBusy ? "Saving..." : "Save offering"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
