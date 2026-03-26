"use client";

import { type ChangeEvent, useRef } from "react";
import {
  BadgeCheck,
  BriefcaseBusiness,
  LayoutDashboard,
  Loader2,
  MapPin,
  ShieldCheck,
  Sparkles,
  Star,
  Upload,
  UserRound,
  X,
} from "lucide-react";
import type { ProfileRoleFamily, StoredProfileRole } from "@/lib/profile/types";

const roleCopy: Record<ProfileRoleFamily, { label: string; accent: string }> = {
  provider: {
    label: "Marketplace Provider",
    accent: "from-[#ff8748] via-[#f33fa7] to-[#4b3dff]",
  },
  seeker: {
    label: "Marketplace Seeker",
    accent: "from-[#4f7cff] via-[#7857ff] to-[#ff5ca8]",
  },
};

const formatMemberSince = (value: string) => {
  if (!value) return "";

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) return "";

  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    year: "numeric",
  }).format(parsed);
};

export default function ProfileHeader({
  role,
  storedRole,
  fullName,
  bio,
  location,
  avatarUrl,
  backgroundImageUrl,
  progress,
  checklistCompleteCount,
  checklistTotalCount,
  onboardingComplete,
  verificationStatus,
  memberSince,
  tags,
  averageRating,
  reviewCount,
  taskCount,
  backgroundUploading,
  onBackgroundUpload,
  onBackgroundClear,
  onGoToDashboard,
}: {
  role: ProfileRoleFamily;
  storedRole: StoredProfileRole;
  fullName: string;
  bio: string;
  location: string;
  avatarUrl: string;
  backgroundImageUrl: string;
  progress: number;
  checklistCompleteCount: number;
  checklistTotalCount: number;
  onboardingComplete: boolean;
  verificationStatus: "verified" | "pending" | "unclaimed";
  memberSince: string;
  tags: string[];
  averageRating: number;
  reviewCount: number;
  taskCount: number;
  backgroundUploading: boolean;
  onBackgroundUpload: (file: File) => void;
  onBackgroundClear: () => void;
  onGoToDashboard: () => void;
}) {
  const coverInputRef = useRef<HTMLInputElement | null>(null);
  const copy = roleCopy[role];
  const heroTitle = fullName.trim() || "Your Profile";
  const memberSinceLabel = formatMemberSince(memberSince);
  const visibleTags = tags.filter(Boolean).slice(0, 3);
  const showVerifiedBadge = verificationStatus === "verified";
  const hasBackgroundImage = Boolean(backgroundImageUrl.trim());
  const roleIcon =
    storedRole === "business" || role === "provider" ? <BriefcaseBusiness className="h-3.5 w-3.5" /> : <UserRound className="h-3.5 w-3.5" />;

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    onBackgroundUpload(file);
    event.target.value = "";
  };

  const activityLabel = role === "provider" ? `${taskCount} active offerings` : `${taskCount} need posts`;

  return (
    <section
      className={`relative h-[25svh] min-h-[220px] max-h-[320px] overflow-hidden rounded-[32px] bg-gradient-to-br ${copy.accent} text-white shadow-[0_30px_90px_-40px_rgba(76,29,149,0.9)]`}
    >
      {hasBackgroundImage ? (
        <>
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={backgroundImageUrl} alt="" className="absolute inset-0 h-full w-full object-cover" />
          <div className="absolute inset-0 bg-[linear-gradient(120deg,rgba(15,23,42,0.45),rgba(79,70,229,0.18),rgba(15,23,42,0.62))]" />
        </>
      ) : null}

      <div className="absolute inset-0 bg-[radial-gradient(circle_at_18%_20%,rgba(255,167,85,0.9),transparent_28%),radial-gradient(circle_at_82%_16%,rgba(90,88,255,0.9),transparent_30%),radial-gradient(circle_at_75%_82%,rgba(255,85,220,0.35),transparent_26%),linear-gradient(140deg,rgba(255,255,255,0.12),transparent_22%,rgba(255,255,255,0.08)_22%,transparent_36%,rgba(255,255,255,0.04)_36%,transparent_100%)]" />
      <div className="absolute inset-y-0 left-[30%] w-[28%] rotate-[16deg] bg-white/8 blur-[2px]" />
      <div className="absolute inset-y-0 right-[14%] w-[32%] -rotate-[20deg] bg-indigo-200/10 blur-[2px]" />
      <div className="absolute inset-0 bg-[linear-gradient(to_top,rgba(15,23,42,0.72),rgba(15,23,42,0.18),transparent)]" />

      <input ref={coverInputRef} type="file" accept="image/*" className="hidden" onChange={handleFileChange} />

      <div className="absolute inset-x-0 top-0 z-20 flex items-start justify-between gap-3 p-4 sm:p-5">
        <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/12 px-3 py-1.5 text-[11px] font-semibold text-white/92 backdrop-blur-md">
          {roleIcon}
          {storedRole === "business" ? "Claimed Business" : copy.label}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onGoToDashboard}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-white/12 px-4 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-white/20"
          >
            <LayoutDashboard className="h-4 w-4" />
            Dashboard
          </button>
          <button
            type="button"
            onClick={() => coverInputRef.current?.click()}
            disabled={backgroundUploading}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-white/20 bg-slate-950/25 px-4 text-sm font-semibold text-white backdrop-blur-md transition hover:bg-slate-950/40 disabled:cursor-not-allowed disabled:opacity-70"
          >
            {backgroundUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            {backgroundUploading ? "Uploading" : "Edit cover"}
          </button>
          {hasBackgroundImage ? (
            <button
              type="button"
              onClick={onBackgroundClear}
              className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-white/20 bg-slate-950/25 text-white backdrop-blur-md transition hover:bg-slate-950/40"
              aria-label="Clear cover image"
            >
              <X className="h-4 w-4" />
            </button>
          ) : null}
        </div>
      </div>

      <div className="relative z-10 flex h-full items-end p-4 sm:p-5">
        <div className="flex w-full items-end gap-3 sm:gap-4">
          <div className="relative shrink-0">
            <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border-4 border-white/90 bg-white/20 text-2xl font-semibold uppercase text-white shadow-xl sm:h-24 sm:w-24 sm:text-3xl">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName || "Profile avatar"} className="h-full w-full object-cover" />
              ) : (
                <span>{heroTitle.slice(0, 2)}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => coverInputRef.current?.click()}
              className="absolute bottom-1 right-0 inline-flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-slate-900/80 text-white shadow-lg backdrop-blur"
              aria-label="Change header background"
            >
              {backgroundUploading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Upload className="h-4 w-4" />}
            </button>
          </div>

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <h1 className="truncate text-2xl font-semibold tracking-tight text-white sm:text-[2rem]">{heroTitle}</h1>
              {showVerifiedBadge ? <BadgeCheck className="h-5 w-5 shrink-0 text-sky-200" /> : null}
            </div>

            <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-white/88">
              <span>{copy.label}</span>
              {memberSinceLabel ? <span>&bull; {memberSinceLabel}</span> : null}
              <span className="inline-flex items-center gap-1">
                <ShieldCheck className="h-3.5 w-3.5" />
                {onboardingComplete ? "Marketplace ready" : `${checklistCompleteCount}/${checklistTotalCount} complete`}
              </span>
            </div>

            {location ? (
              <div className="mt-1 inline-flex max-w-full items-center gap-1.5 text-sm text-white/90">
                <MapPin className="h-3.5 w-3.5 shrink-0" />
                <span className="truncate">{location}</span>
              </div>
            ) : null}

            {bio.trim() ? <p className="mt-2 max-w-3xl truncate text-sm text-white/86 sm:text-[15px]">{bio.trim()}</p> : null}

            <div className="mt-3 flex flex-wrap items-center gap-2">
              {visibleTags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-semibold text-white/92 backdrop-blur-md"
                >
                  <Sparkles className="h-3 w-3" />
                  {tag}
                </span>
              ))}
              <span className="inline-flex items-center gap-1 rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-semibold text-white/92 backdrop-blur-md">
                <Star className="h-3 w-3 text-amber-300" />
                {reviewCount > 0 ? `${averageRating.toFixed(1)} rating` : `${progress}% profile`}
              </span>
              <span className="inline-flex items-center gap-1 rounded-full border border-white/18 bg-white/10 px-3 py-1 text-xs font-semibold text-white/92 backdrop-blur-md">
                <BriefcaseBusiness className="h-3 w-3" />
                {activityLabel}
              </span>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
