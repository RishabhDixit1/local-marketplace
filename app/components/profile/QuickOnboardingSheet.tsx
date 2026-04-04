"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  Loader2,
  MapPin,
  Phone,
  Store,
  UserRound,
  Zap,
} from "lucide-react";
import MarketplaceJourneyGuide, { type MarketplaceJourneyMode } from "@/app/components/onboarding/MarketplaceJourneyGuide";
import { useProfileContext } from "@/app/components/profile/ProfileContext";
import { formatCoordinatePair, getCoordinates, isUsableLocationLabel } from "@/lib/geo";
import type { ProfileRecord } from "@/lib/profile/types";
import { supabase } from "@/lib/supabase";

type RoleChoice = "user" | "provider" | "both";
type FlowStep = "intro" | "details" | "complete";

type CompletionAction = {
  href: string;
  label: string;
  description: string;
  icon: typeof Zap;
  primary?: boolean;
};

const trim = (value: string | null | undefined) => value?.trim() ?? "";

const getInitialFlowStep = (profile: ProfileRecord | null | undefined): FlowStep => {
  const hasStartedEssentials = Boolean(
    trim(profile?.full_name) || trim(profile?.name) || trim(profile?.location) || trim(profile?.phone)
  );

  return hasStartedEssentials ? "details" : "intro";
};

const toJourneyMode = (roleChoice: RoleChoice): MarketplaceJourneyMode =>
  roleChoice === "user" ? "user" : roleChoice === "provider" ? "provider" : "both";

const getCompletionActions = (roleChoice: RoleChoice): CompletionAction[] => {
  if (roleChoice === "provider") {
    return [
      {
        href: "/dashboard/provider/add-service",
        label: "Add your first service",
        description: "Create a bookable offer so nearby customers can act right away.",
        icon: Store,
        primary: true,
      },
      {
        href: "/dashboard?category=demand",
        label: "See live demand",
        description: "Browse the marketplace feed for needs you can respond to today.",
        icon: Zap,
      },
    ];
  }

  if (roleChoice === "both") {
    return [
      {
        href: "/dashboard?compose=1",
        label: "Post a need",
        description: "Start as a customer and see how fast nearby providers respond.",
        icon: Zap,
        primary: true,
      },
      {
        href: "/dashboard/provider/add-service",
        label: "Add a service",
        description: "You can also publish what you offer and earn from the same account.",
        icon: Store,
      },
    ];
  }

  return [
    {
      href: "/dashboard?compose=1",
      label: "Post your first need",
      description: "Create a live request so nearby providers have something real to reply to.",
      icon: Zap,
      primary: true,
    },
    {
      href: "/dashboard/people",
      label: "Browse providers",
      description: "Explore people nearby if you want to understand the supply side first.",
      icon: Store,
    },
  ];
};

export default function QuickOnboardingSheet() {
  const router = useRouter();
  const { user, profile, setProfile } = useProfileContext();
  const [name, setName] = useState(profile?.full_name || profile?.name || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [latitude, setLatitude] = useState<number | null>(profile?.latitude ?? null);
  const [longitude, setLongitude] = useState<number | null>(profile?.longitude ?? null);
  const [phone, setPhone] = useState(profile?.phone || "");
  const [roleChoice, setRoleChoice] = useState<RoleChoice>(
    profile?.role === "business" ? "both" : profile?.role === "seeker" ? "user" : "provider"
  );
  const [flowStep, setFlowStep] = useState<FlowStep>("intro");
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const initializedProfileIdRef = useRef<string | null>(null);

  const journeyMode = useMemo(() => toJourneyMode(roleChoice), [roleChoice]);
  const completionActions = useMemo(() => getCompletionActions(roleChoice), [roleChoice]);

  const shouldShow = useMemo(() => {
    if (!user || !profile) return false;
    return !profile.onboarding_completed || flowStep === "complete";
  }, [flowStep, profile, user]);

  useEffect(() => {
    setName(profile?.full_name || profile?.name || "");
    setLocation(profile?.location || "");
    setLatitude(profile?.latitude ?? null);
    setLongitude(profile?.longitude ?? null);
    setPhone(profile?.phone || "");
    setRoleChoice(profile?.role === "business" ? "both" : profile?.role === "seeker" ? "user" : "provider");
  }, [profile]);

  useEffect(() => {
    if (!profile?.id || initializedProfileIdRef.current === profile.id) return;
    initializedProfileIdRef.current = profile.id;
    setFlowStep(getInitialFlowStep(profile));
  }, [profile]);

  if (!shouldShow || !user || !profile) return null;

  const submit = async () => {
    if (!trim(name)) {
      setError("Add your full name so nearby people know who they are dealing with.");
      return;
    }

    if (!isUsableLocationLabel(location)) {
      setError("Enter a readable area or city name, not raw GPS coordinates.");
      return;
    }

    if (!trim(phone)) {
      setError("Add a phone number so replies and updates can reach you quickly.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const storedRole = roleChoice === "user" ? "seeker" : roleChoice === "both" ? "business" : "provider";
      const metadata = {
        ...(profile.metadata || {}),
        onboardingRoleChoice: roleChoice,
      };

      const { data, error: updateError } = await supabase
        .from("profiles")
        .update({
          full_name: name.trim() || null,
          name: name.trim() || null,
          location: location.trim() || null,
          latitude: typeof latitude === "number" && Number.isFinite(latitude) ? latitude : null,
          longitude: typeof longitude === "number" && Number.isFinite(longitude) ? longitude : null,
          phone: phone.trim() || null,
          role: storedRole,
          metadata,
        })
        .eq("id", user.id)
        .select("*")
        .maybeSingle();

      if (updateError) throw updateError;

      if (data) {
        setProfile(data as typeof profile);
        setFlowStep("complete");
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save onboarding details.");
    } finally {
      setSaving(false);
    }
  };

  const openCompletionAction = (href: string) => {
    setFlowStep("details");
    router.push(href);
  };

  const progressSteps = [
    { id: "intro", label: "How it works" },
    { id: "details", label: "Your basics" },
    { id: "complete", label: "Start now" },
  ] as const;

  const currentStepIndex = progressSteps.findIndex((step) => step.id === flowStep);
  const introTitle =
    roleChoice === "provider"
      ? "Start with clarity, then publish what you offer."
      : roleChoice === "both"
        ? "Start with the marketplace model, then unlock both sides."
        : "Start with the marketplace flow, then post with confidence.";
  const detailsSummary =
    journeyMode === "provider"
      ? "These basics help nearby customers trust you and contact you quickly."
      : journeyMode === "both"
        ? "These basics make it easier to buy, sell, and switch roles without friction."
        : "These basics help nearby providers trust your requests and respond faster.";

  return (
    <div className="fixed inset-0 z-[var(--layer-modal)] grid place-items-end bg-slate-950/45 p-3 sm:place-items-center">
      <div className="w-full max-w-4xl overflow-hidden rounded-[32px] border border-slate-200 bg-white shadow-[0_42px_90px_-48px_rgba(15,23,42,0.7)]">
        <div className="border-b border-slate-200 bg-[linear-gradient(180deg,#ffffff_0%,#f8fafc_100%)] px-5 py-4 sm:px-6">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-[var(--brand-700)]">
                Step {currentStepIndex + 1} of {progressSteps.length}
              </p>
              <h2 className="mt-1 text-xl font-semibold text-slate-900">
                {flowStep === "intro"
                  ? "Welcome to ServiQ"
                  : flowStep === "details"
                    ? "Set up your essentials"
                    : "You are ready to use ServiQ"}
              </h2>
              <p className="mt-1 text-sm text-slate-600">
                {flowStep === "intro"
                  ? introTitle
                  : flowStep === "details"
                    ? "A few basics unlock the local marketplace and keep first replies smooth."
                    : "Your profile basics are live. Take one concrete action so the app makes sense immediately."}
              </p>
            </div>
            {flowStep === "details" ? (
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setFlowStep("intro");
                }}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </button>
            ) : null}
          </div>

          <div className="mt-4 grid gap-2 sm:grid-cols-3">
            {progressSteps.map((step, index) => {
              const isComplete = index < currentStepIndex;
              const isCurrent = step.id === flowStep;

              return (
                <div
                  key={step.id}
                  className={`rounded-2xl border px-3 py-2.5 text-sm transition ${
                    isCurrent
                      ? "border-[var(--brand-500)]/40 bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : isComplete
                        ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-500"
                  }`}
                >
                  <p className="text-[11px] font-semibold uppercase tracking-[0.12em]">
                    {isComplete ? "Done" : `0${index + 1}`}
                  </p>
                  <p className="mt-1 font-semibold">{step.label}</p>
                </div>
              );
            })}
          </div>
        </div>

        {flowStep === "intro" ? (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="grid gap-2 sm:grid-cols-3">
              {(
                [
                  {
                    id: "user" as const,
                    label: "I need help",
                    description: "Post tasks and get replies from nearby providers.",
                  },
                  {
                    id: "provider" as const,
                    label: "I want to earn",
                    description: "Offer services or products and reply to local demand.",
                  },
                  {
                    id: "both" as const,
                    label: "I want both",
                    description: "Use ServiQ as both customer and provider from one account.",
                  },
                ] satisfies Array<{ id: RoleChoice; label: string; description: string }>
              ).map((option) => (
                <button
                  key={option.id}
                  type="button"
                  onClick={() => setRoleChoice(option.id)}
                  className={`rounded-3xl border p-4 text-left transition ${
                    roleChoice === option.id
                      ? "border-[var(--brand-500)]/50 bg-[var(--brand-50)] shadow-[0_18px_34px_-28px_rgba(14,116,144,0.45)]"
                      : "border-slate-200 bg-white hover:border-slate-300"
                  }`}
                >
                  <p className="text-sm font-semibold text-slate-900">{option.label}</p>
                  <p className="mt-1 text-xs leading-5 text-slate-600">{option.description}</p>
                </button>
              ))}
            </div>

            <MarketplaceJourneyGuide
              mode={journeyMode}
              className="border-slate-100 bg-slate-50/50 shadow-none"
            />

            <div className="flex flex-col gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-sm font-semibold text-slate-900">You can switch roles later from your profile.</p>
                <p className="mt-1 text-xs leading-5 text-slate-600">
                  The goal here is just to make the first path obvious so the app feels useful on day one.
                </p>
              </div>
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setFlowStep("details");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
              >
                Continue setup
                <ArrowRight className="h-4 w-4" />
              </button>
            </div>
          </div>
        ) : null}

        {flowStep === "details" ? (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="rounded-3xl border border-[var(--brand-500)]/20 bg-[var(--brand-50)] px-4 py-4">
              <p className="text-sm font-semibold text-slate-900">{detailsSummary}</p>
              <p className="mt-1 text-xs leading-5 text-slate-600">
                You only need name, location, phone, and your starting role to begin using the marketplace clearly.
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block">
                <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <UserRound className="h-3.5 w-3.5" />
                  Full name
                </span>
                <input
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder="Your full name"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-[var(--brand-500)]/60"
                />
              </label>

              <label className="block">
                <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Store className="h-3.5 w-3.5" />
                  Starting role
                </span>
                <select
                  value={roleChoice}
                  onChange={(event) => setRoleChoice(event.target.value as RoleChoice)}
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-[var(--brand-500)]/60"
                >
                  <option value="user">I need help</option>
                  <option value="provider">I want to earn nearby</option>
                  <option value="both">Both</option>
                </select>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <MapPin className="h-3.5 w-3.5" />
                  Location
                </span>
                <div className="space-y-2">
                  <input
                    value={location}
                    onChange={(event) => setLocation(event.target.value)}
                    placeholder="City or area"
                    className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-[var(--brand-500)]/60"
                  />
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                    <button
                      type="button"
                      disabled={locating}
                      onClick={() => {
                        if (!navigator.geolocation) {
                          setError("GPS is not supported on this device.");
                          return;
                        }
                        setLocating(true);
                        setError("");
                        navigator.geolocation.getCurrentPosition(
                          (position) => {
                            const coordinates = getCoordinates(position.coords.latitude, position.coords.longitude);
                            setLatitude(coordinates?.latitude ?? null);
                            setLongitude(coordinates?.longitude ?? null);
                            setLocating(false);
                          },
                          () => {
                            setError("Could not fetch GPS location. You can still enter the city manually.");
                            setLocating(false);
                          },
                          { enableHighAccuracy: false, timeout: 10000 }
                        );
                      }}
                      className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                    >
                      {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                      {locating ? "Fetching GPS..." : "Use current GPS location"}
                    </button>
                    <p className="text-[11px] leading-5 text-slate-500">
                      Keep the label human-readable. GPS is saved separately for map accuracy.
                    </p>
                  </div>
                  {typeof latitude === "number" && typeof longitude === "number" ? (
                    <p className="text-[11px] font-medium text-emerald-700">
                      Precise coordinates saved: {formatCoordinatePair({ latitude, longitude }, 4)}
                    </p>
                  ) : null}
                </div>
              </label>

              <label className="block sm:col-span-2">
                <span className="mb-1.5 inline-flex items-center gap-1.5 text-xs font-semibold text-slate-600">
                  <Phone className="h-3.5 w-3.5" />
                  Phone
                </span>
                <input
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  placeholder="10-digit mobile number"
                  className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition hover:border-slate-300 focus:border-[var(--brand-500)]/60"
                />
              </label>
            </div>

            {error ? <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p> : null}

            <div className="flex flex-col gap-3 sm:flex-row sm:justify-between">
              <button
                type="button"
                onClick={() => {
                  setError("");
                  setFlowStep("intro");
                }}
                className="inline-flex items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
              >
                <ArrowLeft className="h-4 w-4" />
                Review how it works
              </button>
              <button
                type="button"
                disabled={saving}
                onClick={() => void submit()}
                className="inline-flex items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:opacity-60"
              >
                {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                {saving ? "Saving setup..." : "Save and continue"}
              </button>
            </div>
          </div>
        ) : null}

        {flowStep === "complete" ? (
          <div className="space-y-5 p-5 sm:p-6">
            <div className="rounded-[30px] border border-emerald-200 bg-[linear-gradient(180deg,#f0fdf4_0%,#ffffff_100%)] px-5 py-6 text-center">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="h-8 w-8" />
              </div>
              <h3 className="mt-4 text-2xl font-semibold text-slate-900">Your basics are live.</h3>
              <p className="mx-auto mt-2 max-w-2xl text-sm leading-6 text-slate-600">
                ServiQ will make much more sense once you take one real action. Pick the fastest next step below and you can refine the rest later.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              {completionActions.map((action) => {
                const ActionIcon = action.icon;

                return (
                  <button
                    key={action.href}
                    type="button"
                    onClick={() => openCompletionAction(action.href)}
                    className={`rounded-3xl border p-4 text-left transition ${
                      action.primary
                        ? "border-[var(--brand-500)]/40 bg-[var(--brand-50)] shadow-[0_20px_38px_-30px_rgba(14,116,144,0.45)]"
                        : "border-slate-200 bg-white hover:border-slate-300"
                    }`}
                  >
                    <div className="flex items-start gap-3">
                      <div
                        className={`inline-flex h-11 w-11 items-center justify-center rounded-2xl ${
                          action.primary ? "bg-[var(--brand-900)] text-white" : "bg-slate-100 text-slate-700"
                        }`}
                      >
                        <ActionIcon className="h-5 w-5" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900">{action.label}</p>
                        <p className="mt-1 text-xs leading-5 text-slate-600">{action.description}</p>
                      </div>
                    </div>
                  </button>
                );
              })}
            </div>

            <button
              type="button"
              onClick={() => setFlowStep("details")}
              className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300 hover:text-slate-900"
            >
              Start exploring the app
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
