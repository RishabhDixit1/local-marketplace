"use client";

import { startTransition, useCallback, useEffect, useEffectEvent, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
  ArrowRight,
  BriefcaseBusiness,
  Clock3,
  Copy,
  ExternalLink,
  Loader2,
  Mail,
  NotebookText,
  Sparkles,
  UserRound,
} from "lucide-react";
import ProfileAvatarField from "@/app/components/profile/ProfileAvatarField";
import ProfileCompletionChecklist from "@/app/components/profile/ProfileCompletionChecklist";
import ProfileContactFields from "@/app/components/profile/ProfileContactFields";
import ProfileHeader from "@/app/components/profile/ProfileHeader";
import InterestsChipsInput from "@/app/components/profile/InterestsChipsInput";
import MarketplaceReadinessPanel from "@/app/components/profile/MarketplaceReadinessPanel";
import { type ProfileToast } from "@/app/components/profile/ProfileToastViewport";
import ProfileToastViewport from "@/app/components/profile/ProfileToastViewport";
import ProfileRoleToggle from "@/app/components/profile/ProfileRoleToggle";
import ProfileSectionCard from "@/app/components/profile/ProfileSectionCard";
import ProfileStickySaveBar from "@/app/components/profile/ProfileStickySaveBar";
import { useProfileContext } from "@/app/components/profile/ProfileContext";
import { calculateVerificationStatus, verificationLabel } from "@/lib/business";
import { isFinalOrderStatus } from "@/lib/orderWorkflow";
import { createMarketplaceReadinessSummary } from "@/lib/profile/readiness";
import {
  saveCurrentUserProfile,
  uploadProfileAvatar,
} from "@/lib/profile/client";
import {
  POST_LOGIN_REDIRECT_ROUTE,
  PROFILE_AUTOSAVE_DEBOUNCE_MS,
  PROFILE_BIO_MIN_LENGTH,
  PROFILE_TOPIC_LIMIT,
  type ProfileFormValues,
  type ProfileValidationErrors,
  type StoredProfileRole,
} from "@/lib/profile/types";
import {
  calculateProfileCompletionPercent,
  buildPublicProfilePath,
  createProfileCompletionChecklist,
  isProfileOnboardingComplete,
  normalizePhone,
  normalizeTopics,
  normalizeWebsite,
  toProfileFormValues,
} from "@/lib/profile/utils";
import { canAutosaveProfile, validateProfileValues } from "@/lib/profile/validation";
import { supabase } from "@/lib/supabase";

type ServiceInsightRow = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  availability: string | null;
};

type ProductInsightRow = {
  id: string;
  title: string | null;
  category: string | null;
  price: number | null;
  stock: number | null;
};

type ReviewRow = {
  rating: number | null;
};

type OrderStatusRow = {
  status: string | null;
};

type FeaturedListing = {
  id: string;
  type: "service" | "product";
  title: string;
  category: string;
  price: number;
  status: string;
};

type ProviderInsight = {
  servicesCount: number;
  productsCount: number;
  averageRating: number;
  reviewCount: number;
  activeOrders: number;
};

type SeekerInsight = {
  postsCount: number;
  activeOrders: number;
};

const emptyProfileForm: ProfileFormValues = {
  fullName: "",
  location: "",
  role: "seeker",
  bio: "",
  interests: [],
  email: "",
  phone: "",
  website: "",
  avatarUrl: "",
  availability: "available",
};

const availabilityOptions = [
  {
    value: "available",
    title: "Available",
    description: "Shown as actively reachable in nearby discovery.",
  },
  {
    value: "busy",
    title: "Busy",
    description: "Still visible, but expectations stay realistic.",
  },
  {
    value: "offline",
    title: "Offline",
    description: "You stay listed but response expectations are lowered.",
  },
] as const;

const createToast = (kind: ProfileToast["kind"], message: string): ProfileToast => ({
  id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
  kind,
  message,
});

const serializeFormValues = (values: ProfileFormValues) =>
  JSON.stringify({
    fullName: values.fullName.trim(),
    location: values.location.trim(),
    role: values.role,
    bio: values.bio.trim(),
    interests: normalizeTopics(values.interests),
    email: values.email.trim().toLowerCase(),
    phone: normalizePhone(values.phone),
    website: normalizeWebsite(values.website),
    avatarUrl: values.avatarUrl.trim(),
    availability: values.availability,
  });

const buildVisibleErrors = (params: {
  touched: Partial<Record<keyof ProfileValidationErrors, boolean>>;
  submitAttempted: boolean;
  submitErrors: ProfileValidationErrors;
  draftErrors: ProfileValidationErrors;
}) => {
  const visible: ProfileValidationErrors = { ...params.draftErrors };

  (Object.keys(params.submitErrors) as Array<keyof ProfileValidationErrors>).forEach((key) => {
    if (params.submitAttempted || params.touched[key]) {
      const message = params.submitErrors[key];
      if (message) visible[key] = message;
    }
  });

  return visible;
};

export default function ProfilePage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { user, profile, loading, setProfile } = useProfileContext();

  const [formValues, setFormValues] = useState<ProfileFormValues>(emptyProfileForm);
  const [tagInput, setTagInput] = useState("");
  const [touched, setTouched] = useState<Partial<Record<keyof ProfileValidationErrors, boolean>>>({});
  const [submitAttempted, setSubmitAttempted] = useState(false);
  const [saveState, setSaveState] = useState<"idle" | "saving" | "saved" | "error" | "blocked">("idle");
  const [toasts, setToasts] = useState<ProfileToast[]>([]);
  const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);
  const [loadingInsights, setLoadingInsights] = useState(false);
  const [providerInsight, setProviderInsight] = useState<ProviderInsight>({
    servicesCount: 0,
    productsCount: 0,
    averageRating: 0,
    reviewCount: 0,
    activeOrders: 0,
  });
  const [seekerInsight, setSeekerInsight] = useState<SeekerInsight>({
    postsCount: 0,
    activeOrders: 0,
  });
  const [featuredListings, setFeaturedListings] = useState<FeaturedListing[]>([]);
  const [lastSavedSnapshot, setLastSavedSnapshot] = useState("");
  const [serverVersion, setServerVersion] = useState("");

  const currentStoredRole: StoredProfileRole =
    formValues.role === "provider"
      ? profile?.role === "business"
        ? "business"
        : "provider"
      : "seeker";
  const roleFamily = formValues.role;
  const businessClaimed = currentStoredRole === "business";
  const onboardingQuery = searchParams.get("onboarding") === "1";

  const submitErrors = validateProfileValues(formValues, { mode: "submit" });
  const draftErrors = validateProfileValues(formValues, { mode: "draft" });
  const visibleErrors = buildVisibleErrors({
    touched,
    submitAttempted,
    submitErrors,
    draftErrors,
  });

  const comparableSnapshot = serializeFormValues(formValues);
  const dirty = Boolean(lastSavedSnapshot) && comparableSnapshot !== lastSavedSnapshot;

  const previewProfile = {
    full_name: formValues.fullName,
    location: formValues.location,
    role: currentStoredRole,
    bio: formValues.bio,
    interests: formValues.interests,
    services: formValues.interests,
    email: formValues.email,
    phone: normalizePhone(formValues.phone),
    website: normalizeWebsite(formValues.website),
    avatar_url: formValues.avatarUrl,
  };

  const profileCompletion = calculateProfileCompletionPercent(previewProfile);
  const checklist = createProfileCompletionChecklist(previewProfile);
  const onboardingReady = Object.keys(submitErrors).length === 0;
  const onboardingComplete = isProfileOnboardingComplete(previewProfile);
  const publicProfilePath = buildPublicProfilePath({
    id: user?.id || "",
    full_name: formValues.fullName,
    name: formValues.fullName,
  });
  const verificationStatus = calculateVerificationStatus({
    role: currentStoredRole,
    profileCompletion,
    listingsCount: providerInsight.servicesCount + providerInsight.productsCount,
    averageRating: providerInsight.averageRating,
    reviewCount: providerInsight.reviewCount,
  });
  const checklistCompleteCount = checklist.filter((item) => item.complete).length;
  const marketplaceReadiness = createMarketplaceReadinessSummary({
    profile: previewProfile,
    providerServicesCount: providerInsight.servicesCount,
    providerProductsCount: providerInsight.productsCount,
    seekerPostsCount: seekerInsight.postsCount,
  });
  const readinessStats =
    roleFamily === "provider"
      ? [
          { label: "Completion", value: `${marketplaceReadiness.completionPercent}%` },
          { label: "Live listings", value: String(providerInsight.servicesCount + providerInsight.productsCount) },
          { label: "Active orders", value: String(providerInsight.activeOrders) },
        ]
      : [
          { label: "Completion", value: `${marketplaceReadiness.completionPercent}%` },
          { label: "Need posts", value: String(seekerInsight.postsCount) },
          { label: "Active orders", value: String(seekerInsight.activeOrders) },
        ];

  const loadRoleInsights = useEffectEvent(async () => {
    if (!user?.id) return;

    setLoadingInsights(true);

    try {
      if (roleFamily === "provider") {
        const [{ data: services, count: servicesCount }, { data: products, count: productsCount }, { data: reviews }, { data: orders }] =
          await Promise.all([
            supabase.from("service_listings").select("id,title,category,price,availability", { count: "exact" }).eq("provider_id", user.id).limit(4),
            supabase.from("product_catalog").select("id,title,category,price,stock", { count: "exact" }).eq("provider_id", user.id).limit(4),
            supabase.from("reviews").select("rating").eq("provider_id", user.id),
            supabase.from("orders").select("status").eq("provider_id", user.id),
          ]);

        const reviewRows = (reviews as ReviewRow[] | null) || [];
        const ratingValues = reviewRows
          .map((row) => Number(row.rating))
          .filter((rating) => Number.isFinite(rating) && rating > 0);
        const averageRating = ratingValues.length
          ? Number((ratingValues.reduce((sum, rating) => sum + rating, 0) / ratingValues.length).toFixed(1))
          : 0;
        const orderRows = (orders as OrderStatusRow[] | null) || [];
        const activeOrders = orderRows.filter((order) => !isFinalOrderStatus(order.status)).length;

        const serviceCards: FeaturedListing[] = ((services as ServiceInsightRow[] | null) || []).map((service) => ({
          id: service.id,
          type: "service",
          title: service.title || "Untitled service",
          category: service.category || "Service",
          price: Number(service.price || 0),
          status: (service.availability || "available").toLowerCase(),
        }));

        const productCards: FeaturedListing[] = ((products as ProductInsightRow[] | null) || []).map((product) => ({
          id: product.id,
          type: "product",
          title: product.title || "Untitled product",
          category: product.category || "Product",
          price: Number(product.price || 0),
          status: (product.stock || 0) > 0 ? "in stock" : "out of stock",
        }));

        setProviderInsight({
          servicesCount: servicesCount || 0,
          productsCount: productsCount || 0,
          averageRating,
          reviewCount: reviewRows.length,
          activeOrders,
        });
        setSeekerInsight({
          postsCount: 0,
          activeOrders: 0,
        });
        setFeaturedListings([...serviceCards, ...productCards].slice(0, 6));
        setLoadingInsights(false);
        return;
      }

      const [{ count: postsCount }, { data: orders }] = await Promise.all([
        supabase.from("posts").select("id", { count: "exact", head: true }).eq("user_id", user.id),
        supabase.from("orders").select("status").eq("consumer_id", user.id),
      ]);

      const orderRows = (orders as OrderStatusRow[] | null) || [];
      const activeOrders = orderRows.filter((order) => !isFinalOrderStatus(order.status)).length;

      setSeekerInsight({
        postsCount: postsCount || 0,
        activeOrders,
      });
      setProviderInsight({
        servicesCount: 0,
        productsCount: 0,
        averageRating: 0,
        reviewCount: 0,
        activeOrders: 0,
      });
      setFeaturedListings([]);
      setLoadingInsights(false);
    } catch {
      setLoadingInsights(false);
    }
  });

  const enqueueToast = useCallback((kind: ProfileToast["kind"], message: string) => {
    const toast = createToast(kind, message);
    setToasts((current) => [...current, toast]);
    window.setTimeout(() => {
      setToasts((current) => current.filter((item) => item.id !== toast.id));
    }, 4500);
  }, []);

  const adoptServerProfile = useEffectEvent((shouldNotifyOnConflict: boolean) => {
    if (!profile) return;

    const nextForm = toProfileFormValues(profile);
    const nextSnapshot = serializeFormValues(nextForm);
    const nextVersion = profile.updated_at || nextSnapshot;

    if (!serverVersion) {
      setFormValues(nextForm);
      setLastSavedSnapshot(nextSnapshot);
      setServerVersion(nextVersion);
      return;
    }

    if (nextVersion === serverVersion) return;

    if (dirty && shouldNotifyOnConflict) {
      enqueueToast("info", "Profile changed in another tab. Your local edits are still on screen.");
      setServerVersion(nextVersion);
      return;
    }

    setFormValues(nextForm);
    setLastSavedSnapshot(nextSnapshot);
    setServerVersion(nextVersion);
  });

  useEffect(() => {
    if (!profile) return;
    adoptServerProfile(true);
  }, [profile]);

  useEffect(() => {
    if (!user?.id) return;
    void loadRoleInsights();
  }, [roleFamily, user?.id]);

  useEffect(() => {
    if (!dirty && saveState === "saved") {
      const timeoutId = window.setTimeout(() => setSaveState("idle"), 2200);
      return () => window.clearTimeout(timeoutId);
    }
  }, [dirty, saveState]);

  useEffect(() => {
    if (!dirty) return;

    const handleBeforeUnload = (event: BeforeUnloadEvent) => {
      event.preventDefault();
      event.returnValue = "";
    };

    window.addEventListener("beforeunload", handleBeforeUnload);
    return () => {
      window.removeEventListener("beforeunload", handleBeforeUnload);
    };
  }, [dirty]);

  const performSave = useCallback(async (mode: "manual" | "autosave") => {
    if (!user || !profile) return null;

    const validationErrors = validateProfileValues(formValues, {
      mode: mode === "manual" ? "submit" : "draft",
    });

    if (mode === "manual" && Object.keys(validationErrors).length > 0) {
      setSaveState("blocked");
      enqueueToast("error", "Complete the highlighted fields before saving.");
      return null;
    }

    if (mode === "autosave" && !canAutosaveProfile(formValues)) {
      return null;
    }

    setSaveState("saving");

    try {
      const nextProfile = await saveCurrentUserProfile({
        user,
        values: formValues,
      });

      if (!nextProfile) {
        throw new Error("Profile save returned no profile row.");
      }

      setProfile(nextProfile);
      const nextForm = toProfileFormValues(nextProfile);
      setFormValues(nextForm);
      setLastSavedSnapshot(serializeFormValues(nextForm));
      setServerVersion(nextProfile.updated_at || serializeFormValues(nextForm));
      setSaveState("saved");

      if (mode === "manual") {
        const becameOnboarded = nextProfile.onboarding_completed;
        const nextPublicProfilePath = buildPublicProfilePath(nextProfile);
        enqueueToast(
          "success",
          becameOnboarded && onboardingQuery
            ? "Profile completed. Redirecting you into the marketplace."
            : nextPublicProfilePath
            ? "Profile saved. Opening your public profile."
            : "Profile saved."
        );

        if (becameOnboarded && onboardingQuery) {
          startTransition(() => {
            router.replace(POST_LOGIN_REDIRECT_ROUTE);
          });
        } else if (nextPublicProfilePath) {
          startTransition(() => {
            router.push(nextPublicProfilePath);
          });
        }
      }

      return nextProfile;
    } catch (error) {
      setSaveState("error");
      enqueueToast(
        "error",
        error instanceof Error ? error.message : "Unable to save your profile right now. Please retry."
      );
      return null;
    }
  }, [enqueueToast, formValues, onboardingQuery, profile, router, setProfile, user]);

  useEffect(() => {
    if (!user || !profile || !dirty || isUploadingAvatar) return;
    if (!canAutosaveProfile(formValues)) return;

    const timeoutId = window.setTimeout(() => {
      void performSave("autosave");
    }, PROFILE_AUTOSAVE_DEBOUNCE_MS);

    return () => window.clearTimeout(timeoutId);
  }, [dirty, formValues, isUploadingAvatar, performSave, profile, user]);

  const updateField = (field: keyof ProfileFormValues, value: string) => {
    setFormValues((current) => ({
      ...current,
      [field]: value,
    }));
  };

  const markTouched = (field: keyof ProfileValidationErrors) => {
    setTouched((current) => ({ ...current, [field]: true }));
  };

  const handleAddTag = () => {
    const nextTag = tagInput.trim();
    if (!nextTag) return;

    if (formValues.interests.length >= PROFILE_TOPIC_LIMIT) {
      enqueueToast("error", `You can add up to ${PROFILE_TOPIC_LIMIT} tags.`);
      return;
    }

    const normalized = normalizeTopics([...formValues.interests, nextTag]);
    if (normalized.length === formValues.interests.length) {
      enqueueToast("info", "That tag is already added.");
      return;
    }

    setFormValues((current) => ({
      ...current,
      interests: normalized,
    }));
    setTagInput("");
    markTouched("interests");
  };

  const handleRemoveTag = (value: string) => {
    setFormValues((current) => ({
      ...current,
      interests: current.interests.filter((item) => item !== value),
    }));
    markTouched("interests");
  };

  const handleAvatarUpload = async (file: File) => {
    if (!user?.id) return;
    if (file.size > 5 * 1024 * 1024) {
      enqueueToast("error", "Avatar must be 5MB or smaller.");
      return;
    }

    setIsUploadingAvatar(true);
    try {
      const publicUrl = await uploadProfileAvatar({ userId: user.id, file });
      setFormValues((current) => ({
        ...current,
        avatarUrl: publicUrl,
      }));
      markTouched("avatarUrl");
      enqueueToast("success", "Avatar uploaded. It will save automatically.");
    } catch (error) {
      enqueueToast("error", error instanceof Error ? error.message : "Avatar upload failed.");
    } finally {
      setIsUploadingAvatar(false);
    }
  };

  const handleCopyPublicProfile = async () => {
    if (!publicProfilePath || typeof window === "undefined") return;

    try {
      await navigator.clipboard.writeText(`${window.location.origin}${publicProfilePath}`);
      enqueueToast("success", "Public profile link copied.");
    } catch {
      enqueueToast("error", "Unable to copy the public profile link.");
    }
  };

  if (loading || !profile || !user) {
    return (
      <div className="space-y-5">
        <div className="h-56 animate-pulse rounded-[32px] bg-white/80" />
        <div className="grid gap-5 xl:grid-cols-[minmax(0,1fr)_320px]">
          <div className="space-y-5">
            <div className="h-72 animate-pulse rounded-[28px] bg-white/80" />
            <div className="h-64 animate-pulse rounded-[28px] bg-white/80" />
            <div className="h-64 animate-pulse rounded-[28px] bg-white/80" />
          </div>
          <div className="space-y-5">
            <div className="h-64 animate-pulse rounded-[28px] bg-white/80" />
            <div className="h-80 animate-pulse rounded-[28px] bg-white/80" />
          </div>
        </div>
      </div>
    );
  }

  const saveButtonLabel =
    onboardingQuery && !profile.onboarding_completed ? "Save and continue" : dirty ? "Save profile" : "Profile saved";

  return (
    <div className="space-y-6 pb-20 lg:space-y-8">
      <ProfileToastViewport
        toasts={toasts}
        onDismiss={(id) => setToasts((current) => current.filter((toast) => toast.id !== id))}
      />

      <ProfileHeader
        role={roleFamily}
        storedRole={currentStoredRole}
        fullName={formValues.fullName}
        location={formValues.location}
        avatarUrl={formValues.avatarUrl}
        progress={profileCompletion}
        checklistCompleteCount={checklistCompleteCount}
        checklistTotalCount={checklist.length}
        onboardingComplete={onboardingComplete}
      />

      <MarketplaceReadinessPanel summary={marketplaceReadiness} stats={readinessStats} loading={loadingInsights} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_330px] xl:items-start">
        <div className="space-y-6">
          <ProfileSectionCard
            icon={<UserRound className="h-5 w-5" />}
            title="Basic Information"
            description={
              onboardingQuery
                ? "Finish these core details once to unlock the rest of the marketplace."
                : "Keep the essentials current so discovery, trust, and notifications stay accurate."
            }
          >
            <div className="space-y-5">
              <ProfileAvatarField
                name={formValues.fullName}
                avatarUrl={formValues.avatarUrl}
                uploading={isUploadingAvatar}
                onUpload={handleAvatarUpload}
                onRemove={() => {
                  setFormValues((current) => ({ ...current, avatarUrl: "" }));
                  markTouched("avatarUrl");
                }}
              />

              <div className="grid gap-4 md:grid-cols-2">
                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Full name</label>
                  <input
                    value={formValues.fullName}
                    onBlur={() => markTouched("fullName")}
                    onChange={(event) => updateField("fullName", event.target.value)}
                    placeholder="Your full name"
                    className={`min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
                      visibleErrors.fullName
                        ? "border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                        : "border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    }`}
                  />
                  <p className={`text-sm ${visibleErrors.fullName ? "text-rose-600" : "text-slate-500"}`}>
                    {visibleErrors.fullName || "This is how other people will recognize you."}
                  </p>
                </div>

                <div className="space-y-2">
                  <label className="text-sm font-semibold text-slate-900">Location</label>
                  <input
                    value={formValues.location}
                    onBlur={() => markTouched("location")}
                    onChange={(event) => updateField("location", event.target.value)}
                    placeholder="Neighborhood, city, or service area"
                    className={`min-h-12 w-full rounded-2xl border bg-white px-4 py-3 text-sm text-slate-900 outline-none transition placeholder:text-slate-400 ${
                      visibleErrors.location
                        ? "border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                        : "border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                    }`}
                  />
                  <p className={`text-sm ${visibleErrors.location ? "text-rose-600" : "text-slate-500"}`}>
                    {visibleErrors.location || "Manual location is used unless autocomplete is added later."}
                  </p>
                </div>
              </div>
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard
            icon={<BriefcaseBusiness className="h-5 w-5" />}
            title="Role & Marketplace Strategy"
            description="Switching roles updates the helper content, summary cards, and discoverability guidance immediately."
            aside={
              businessClaimed ? (
                <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
                  Claimed business profile. Verification status: {verificationLabel(verificationStatus)}.
                </div>
              ) : null
            }
          >
            <div className="space-y-5">
              <ProfileRoleToggle
                value={roleFamily}
                onChange={(value) => {
                  setFormValues((current) => ({ ...current, role: value }));
                  markTouched("role");
                }}
              />

              {roleFamily === "provider" ? (
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                    <div className="min-h-36 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Services</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{providerInsight.servicesCount}</p>
                    </div>
                    <div className="min-h-36 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Products</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{providerInsight.productsCount}</p>
                    </div>
                    <div className="min-h-36 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Rating</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">
                        {providerInsight.averageRating ? providerInsight.averageRating.toFixed(1) : "New"}
                      </p>
                      <p className="text-xs text-slate-500">{providerInsight.reviewCount} reviews</p>
                    </div>
                    <div className="min-h-36 rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active orders</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{providerInsight.activeOrders}</p>
                    </div>
                  </div>

                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Provider actions</p>
                    <div className="mt-4 grid gap-2 md:grid-cols-2">
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/provider/listings")}
                        className="inline-flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:text-indigo-700"
                      >
                        Manage listings
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/provider/orders")}
                        className="inline-flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:text-indigo-700"
                      >
                        Review order pipeline
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_280px]">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Need posts</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{seekerInsight.postsCount}</p>
                    </div>
                    <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                      <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">Active orders</p>
                      <p className="mt-2 text-2xl font-semibold text-slate-950">{seekerInsight.activeOrders}</p>
                    </div>
                  </div>
                  <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                    <p className="text-sm font-semibold text-slate-900">Seeker shortcuts</p>
                    <div className="mt-4 space-y-2">
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard/people")}
                        className="inline-flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:text-indigo-700"
                      >
                        Discover providers
                        <ArrowRight className="h-4 w-4" />
                      </button>
                      <button
                        type="button"
                        onClick={() => router.push("/dashboard?compose=1")}
                        className="inline-flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:text-indigo-700"
                      >
                        Post a need
                        <ArrowRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>
                </div>
              )}

              {publicProfilePath ? (
                <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Public profile</p>
                      <p className="mt-1 text-sm leading-6 text-slate-600">
                        Anyone with this link can view the saved profile, contact details, and marketplace presence for now.
                      </p>
                    </div>
                    <span className="inline-flex w-fit rounded-full bg-white px-3 py-1 text-xs font-semibold uppercase tracking-wide text-slate-500 shadow-sm">
                      Visible to everyone
                    </span>
                  </div>
                  <div className="mt-4 grid gap-2 md:grid-cols-2">
                    <button
                      type="button"
                      onClick={handleCopyPublicProfile}
                      className="inline-flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:text-indigo-700"
                    >
                      Copy public profile link
                      <Copy className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => window.open(publicProfilePath, "_blank", "noopener,noreferrer")}
                      className="inline-flex w-full items-center justify-between rounded-2xl bg-white px-4 py-3 text-sm font-semibold text-slate-800 shadow-sm transition hover:text-indigo-700"
                    >
                      View public profile
                      <ExternalLink className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              ) : null}

              <div className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                <div className="flex items-center gap-2 text-sm font-semibold text-slate-900">
                  <Clock3 className="h-4 w-4 text-slate-500" />
                  Availability
                </div>
                <div className="mt-4 grid gap-3 md:grid-cols-3">
                  {availabilityOptions.map((option) => {
                    const active = formValues.availability === option.value;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        onClick={() => setFormValues((current) => ({ ...current, availability: option.value }))}
                        className={`rounded-[22px] border px-4 py-4 text-left transition ${
                          active
                            ? "border-slate-950 bg-slate-950 text-white shadow-lg shadow-slate-900/15"
                            : "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
                        }`}
                      >
                        <p className="text-sm font-semibold">{option.title}</p>
                        <p className={`mt-1 text-sm leading-6 ${active ? "text-white/70" : "text-slate-600"}`}>
                          {option.description}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {roleFamily === "provider" ? (
                <div className="space-y-3">
                  <div className="flex items-center justify-between gap-3">
                    <p className="text-sm font-semibold text-slate-900">Featured listings</p>
                    {loadingInsights ? <Loader2 className="h-4 w-4 animate-spin text-slate-400" /> : null}
                  </div>
                  {featuredListings.length > 0 ? (
                    <div className="grid gap-3 md:grid-cols-2">
                      {featuredListings.map((listing) => (
                        <article key={`${listing.type}-${listing.id}`} className="rounded-[24px] border border-slate-200 bg-slate-50 p-4">
                          <div className="flex items-start justify-between gap-3">
                            <div>
                              <h3 className="text-sm font-semibold text-slate-900">{listing.title}</h3>
                              <p className="mt-1 text-sm text-slate-600">{listing.category}</p>
                            </div>
                            <span className="rounded-full bg-white px-2.5 py-1 text-[11px] font-semibold uppercase tracking-wide text-slate-600 shadow-sm">
                              {listing.type}
                            </span>
                          </div>
                          <div className="mt-4 flex items-center justify-between text-sm">
                            <span className="font-semibold text-slate-950">INR {listing.price.toLocaleString("en-IN")}</span>
                            <span className="capitalize text-slate-500">{listing.status}</span>
                          </div>
                        </article>
                      ))}
                    </div>
                  ) : (
                    <div className="rounded-[24px] border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-500">
                      No published services or products yet. Add listings to strengthen trust and conversion.
                    </div>
                  )}
                </div>
              ) : null}
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard
            icon={<NotebookText className="h-5 w-5" />}
            title="About You"
            description={`This summary is required for onboarding. Aim for at least ${PROFILE_BIO_MIN_LENGTH} characters and make it specific.`}
          >
            <div className="space-y-2">
              <textarea
                value={formValues.bio}
                onBlur={() => markTouched("bio")}
                onChange={(event) => updateField("bio", event.target.value)}
                rows={6}
                placeholder={
                  roleFamily === "provider"
                    ? "Describe what you offer, what areas you serve, and why people can trust you."
                    : "Describe what you're looking for, when you usually need help, and what kind of providers fit best."
                }
                className={`min-h-[180px] w-full rounded-[24px] border bg-white px-4 py-4 text-sm leading-6 text-slate-900 outline-none transition placeholder:text-slate-400 ${
                  visibleErrors.bio
                    ? "border-rose-300 focus:border-rose-400 focus:ring-4 focus:ring-rose-100"
                    : "border-slate-200 focus:border-indigo-400 focus:ring-4 focus:ring-indigo-100"
                }`}
              />
              <div className="flex flex-wrap items-center justify-between gap-2">
                <p className={`text-sm ${visibleErrors.bio ? "text-rose-600" : "text-slate-500"}`}>
                  {visibleErrors.bio ||
                    (roleFamily === "provider"
                      ? "Good provider profiles mention specialty, service area, and response style."
                      : "Good seeker profiles mention the kind of help, timing, and local context.")}
                </p>
                <p className="text-sm font-medium text-slate-500">{formValues.bio.trim().length} characters</p>
              </div>
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard
            icon={<Sparkles className="h-5 w-5" />}
            title={roleFamily === "provider" ? "Services & Discoverability Tags" : "Needs & Interests"}
            description={
              roleFamily === "provider"
                ? "These tags are mirrored into your public profile and help local discovery surfaces rank you better."
                : "Use specific needs, categories, or service types so providers understand what to respond to."
            }
          >
            <div className="space-y-3">
              <InterestsChipsInput
                label={roleFamily === "provider" ? "Offerings" : "Interests"}
                description={
                  roleFamily === "provider"
                    ? "Examples: Home cleaning, pastry catering, AC repair, event decor."
                    : "Examples: Weekly tiffin, birthday cakes, appliance repair, pet grooming."
                }
                placeholder={
                  roleFamily === "provider"
                    ? "Type an offering or niche"
                    : "Type a need or interest"
                }
                values={formValues.interests}
                inputValue={tagInput}
                error={visibleErrors.interests}
                onInputChange={setTagInput}
                onAdd={handleAddTag}
                onRemove={handleRemoveTag}
              />
              <p className="text-sm text-slate-500">
                {formValues.interests.length}/{PROFILE_TOPIC_LIMIT} tags used.
              </p>
            </div>
          </ProfileSectionCard>

          <ProfileSectionCard
            icon={<Mail className="h-5 w-5" />}
            title="Contact Information"
            description="Email is prefilled from auth when available. Phone and website stay optional but improve trust and conversions."
          >
            <ProfileContactFields
              email={formValues.email}
              phone={formValues.phone}
              website={formValues.website}
              emailReadOnly={Boolean(user.email)}
              errors={visibleErrors}
              onChange={(field, value) => {
                updateField(field, value);
                markTouched(field);
              }}
            />
          </ProfileSectionCard>
        </div>

        <aside className="space-y-6 xl:sticky xl:top-24">
          <ProfileCompletionChecklist items={checklist} />
        </aside>
      </div>

      <ProfileStickySaveBar
        dirty={dirty}
        saveState={saveState}
        buttonLabel={
          onboardingQuery && !profile.onboarding_completed && !onboardingReady ? "Complete required fields" : saveButtonLabel
        }
        saveDisabled={!user || isUploadingAvatar}
        onSave={() => {
          setSubmitAttempted(true);
          void performSave("manual");
        }}
      />
    </div>
  );
}
