"use client";

import { BadgeCheck, Compass, MapPin, ShieldCheck, Sparkles } from "lucide-react";
import type { ProfileRoleFamily, StoredProfileRole } from "@/lib/profile/types";

const roleCopy: Record<ProfileRoleFamily, { title: string; subtitle: string; accent: string }> = {
  provider: {
    title: "Service Provider Profile",
    subtitle: "Build trust fast, showcase what you offer, and stay discoverable in your local market.",
    accent: "from-sky-500 via-indigo-500 to-fuchsia-500",
  },
  seeker: {
    title: "Seeker Profile",
    subtitle: "Share what you need clearly so nearby providers can respond with confidence.",
    accent: "from-blue-500 via-indigo-500 to-violet-600",
  },
};

export default function ProfileHeader({
  role,
  storedRole,
  fullName,
  location,
  avatarUrl,
  progress,
  checklistCompleteCount,
  checklistTotalCount,
  onboardingComplete,
}: {
  role: ProfileRoleFamily;
  storedRole: StoredProfileRole;
  fullName: string;
  location: string;
  avatarUrl: string;
  progress: number;
  checklistCompleteCount: number;
  checklistTotalCount: number;
  onboardingComplete: boolean;
}) {
  const copy = roleCopy[role];
  const heroTitle = fullName.trim() || "Your Profile";
  const progressWidth = `${Math.max(6, progress)}%`;

  return (
    <section className={`relative overflow-hidden rounded-[32px] bg-gradient-to-br ${copy.accent} p-6 text-white shadow-[0_30px_80px_-35px_rgba(79,70,229,0.85)] sm:p-8 lg:p-10`}>
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(255,255,255,0.32),transparent_36%),radial-gradient(circle_at_bottom_right,rgba(255,255,255,0.18),transparent_40%)]" />
      <div className="absolute inset-y-0 right-0 w-1/2 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.08),transparent)]" />
      <div className="relative space-y-6">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-20 w-20 shrink-0 items-center justify-center overflow-hidden rounded-[26px] border border-white/30 bg-white/15 text-2xl font-semibold uppercase shadow-lg backdrop-blur sm:h-24 sm:w-24 sm:text-3xl">
              {avatarUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarUrl} alt={fullName || "Profile avatar"} className="h-full w-full object-cover" />
              ) : (
                <span>{(fullName || "LM").slice(0, 2)}</span>
              )}
            </div>
            <div className="space-y-3">
              <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white/90 backdrop-blur">
                <Sparkles className="h-3.5 w-3.5" />
                {storedRole === "business" ? "Claimed business profile" : role === "provider" ? "Provider mode" : "Seeker mode"}
              </div>
              <div>
                <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{heroTitle}</h1>
                <p className="mt-2 max-w-2xl text-sm leading-6 text-white/85 sm:text-base">{copy.subtitle}</p>
              </div>
              <div className="flex flex-wrap gap-2 text-xs font-semibold text-white/90">
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
                  <BadgeCheck className="h-3.5 w-3.5" />
                  {onboardingComplete ? "Marketplace unlocked" : "Complete required fields to unlock the app"}
                </div>
                <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
                  <Compass className="h-3.5 w-3.5" />
                  {copy.title}
                </div>
                {location ? (
                  <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1.5 backdrop-blur">
                    <MapPin className="h-3.5 w-3.5" />
                    {location}
                  </div>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:min-w-[280px] lg:max-w-sm lg:grid-cols-1">
            <div className="rounded-[24px] border border-white/20 bg-white/10 p-4 backdrop-blur">
              <p className="text-xs font-medium uppercase tracking-[0.18em] text-white/65">Profile completion</p>
              <div className="mt-3 flex items-end justify-between gap-4">
                <p className="text-4xl font-semibold leading-none">{progress}%</p>
                <p className="max-w-[120px] text-right text-xs leading-5 text-white/70">
                  {checklistCompleteCount} of {checklistTotalCount} profile milestones done
                </p>
              </div>
              <div className="mt-4 h-2.5 overflow-hidden rounded-full bg-white/20">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-emerald-300 via-lime-200 to-white transition-[width] duration-500"
                  style={{ width: progressWidth }}
                />
              </div>
            </div>
            <div className="rounded-[24px] border border-white/20 bg-slate-950/18 p-4 backdrop-blur">
              <div className="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.18em] text-white/70">
                <ShieldCheck className="h-3.5 w-3.5" />
                Onboarding status
              </div>
              <p className="mt-3 text-sm leading-6 text-white/88">
                {onboardingComplete
                  ? "You can move freely through the marketplace. Keep improving your profile to rank better."
                  : "Finish your basic details once. Drafts save automatically, but the app stays locked until the essentials are complete."}
              </p>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
