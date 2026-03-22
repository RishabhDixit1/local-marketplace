"use client";

import Link from "next/link";
import { useCallback, useEffect, useState, type ChangeEvent, type FormEvent } from "react";
import {
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Globe,
  Loader2,
  MapPin,
  Package,
  Phone,
  Rocket,
  Sparkles,
  Store,
  Wand2,
} from "lucide-react";
import { useProfileContext } from "@/app/components/profile/ProfileContext";
import type {
  GetLaunchpadDraftResponse,
  LaunchpadAnswers,
  LaunchpadDraftRecord,
  LaunchpadWorkspaceSummary,
  PublishLaunchpadDraftResponse,
  SaveLaunchpadDraftResponse,
} from "@/lib/api/launchpad";
import { fetchAuthedJson } from "@/lib/clientApi";
import { DEFAULT_LAUNCHPAD_ANSWERS, inferLaunchpadInputSource, normalizeLaunchpadAnswers } from "@/lib/launchpad/validation";
import { getProfileDisplayName } from "@/lib/profile/utils";
import { supabase } from "@/lib/supabase";

const offeringTypeOptions: Array<{ value: LaunchpadAnswers["offeringType"]; label: string; description: string }> = [
  { value: "services", label: "Services", description: "Best for appointments, jobs, and local expertise." },
  { value: "products", label: "Products", description: "Best for catalog-driven selling and stock-based offers." },
  { value: "hybrid", label: "Hybrid", description: "Mix services with sellable products in one storefront." },
];

const brandToneOptions: Array<{ value: LaunchpadAnswers["brandTone"]; label: string }> = [
  { value: "professional", label: "Professional" },
  { value: "friendly", label: "Friendly" },
  { value: "premium", label: "Premium" },
  { value: "fast", label: "Fast-moving" },
  { value: "community", label: "Neighborhood-first" },
];

const launchpadSteps = [
  {
    title: "Describe the business",
    description: "Capture what you sell, who you serve, where you operate, and how you want the brand to sound.",
  },
  {
    title: "Paste messy source material",
    description: "Catalog text, a menu, or a WhatsApp profile can become structured listings without manual cleanup first.",
  },
  {
    title: "Review the generated pack",
    description: "Launchpad drafts the profile, storefront copy, service areas, FAQs, and the first set of listings for approval.",
  },
  {
    title: "Publish safely",
    description: "Only launchpad-owned listings get replaced, so existing manual marketplace work stays protected.",
  },
] as const;

const fieldClassName =
  "w-full rounded-[18px] border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[var(--brand-ring)]";

const serializeAnswers = (answers: LaunchpadAnswers) => JSON.stringify(normalizeLaunchpadAnswers(answers));
const dedupeStrings = (values: Array<string | null | undefined>, limit = 12) => {
  const seen = new Set<string>();
  const result: string[] = [];

  for (const value of values) {
    const normalized = value?.trim() || "";
    if (!normalized) continue;
    const key = normalized.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    result.push(normalized);
    if (result.length >= limit) break;
  }

  return result;
};
const resolveOfferingTypeFromSummary = (summary: LaunchpadWorkspaceSummary | null | undefined): LaunchpadAnswers["offeringType"] => {
  const totalServices = summary?.totalServices || 0;
  const totalProducts = summary?.totalProducts || 0;

  if (totalServices > 0 && totalProducts > 0) return "hybrid";
  if (totalProducts > 0 && totalServices === 0) return "products";
  return "services";
};
const formatLaunchpadTimestamp = (value: string | null) => {
  if (!value) return "Not published yet";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Not published yet";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
};

const createPrefilledAnswers = (
  profile: ReturnType<typeof useProfileContext>["profile"],
  summary: LaunchpadWorkspaceSummary | null
): LaunchpadAnswers =>
  normalizeLaunchpadAnswers({
    ...DEFAULT_LAUNCHPAD_ANSWERS,
    offeringType: resolveOfferingTypeFromSummary(summary),
    businessName: getProfileDisplayName(profile),
    businessType:
      profile?.role === "business"
        ? "Local business"
        : profile?.role === "provider"
        ? "Service business"
        : summary?.totalProducts && !summary.totalServices
        ? "Product business"
        : summary?.totalServices
        ? "Service business"
        : "",
    primaryCategory: profile?.interests?.[0] || summary?.liveCategories[0] || "",
    location: profile?.location || summary?.liveServiceAreas[0] || "",
    serviceArea: summary?.liveServiceAreas.join(", ") || profile?.location || "",
    shortDescription: profile?.bio || "",
    coreOfferings: dedupeStrings([...(summary?.liveOfferings || []), ...(profile?.interests || [])], 12).join(", "),
    catalogText: (summary?.liveCatalogLines || []).join("\n"),
    phone: profile?.phone || "",
    website: profile?.website || "",
  });

type PublishResultPaths = {
  businessPath: string;
  profilePath: string;
};

export default function LaunchpadPage() {
  const { profile, loading: profileLoading } = useProfileContext();

  const [formValues, setFormValues] = useState<LaunchpadAnswers>(DEFAULT_LAUNCHPAD_ANSWERS);
  const [draft, setDraft] = useState<LaunchpadDraftRecord | null>(null);
  const [workspaceSummary, setWorkspaceSummary] = useState<LaunchpadWorkspaceSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [publishedPaths, setPublishedPaths] = useState<PublishResultPaths | null>(null);

  const reloadWorkspace = useCallback(
    async (active?: { current: boolean }) => {
      const payload = await fetchAuthedJson<GetLaunchpadDraftResponse>(supabase, "/api/launchpad/draft");
      if (active && !active.current) return;
      if (!payload.ok) {
        throw new Error(payload.message);
      }

      setWorkspaceSummary(payload.summary);
      if (!payload.draft) {
        setDraft(null);
        setFormValues(createPrefilledAnswers(profile, payload.summary));
        return;
      }

      setDraft(payload.draft);
      setFormValues(payload.draft.answers);
    },
    [profile]
  );

  useEffect(() => {
    if (profileLoading) return;

    const active = { current: true };
    setLoading(true);

    void reloadWorkspace(active)
      .catch((error) => {
        if (!active.current) return;
        setErrorMessage(error instanceof Error ? error.message : "Unable to load launchpad draft right now.");
        setWorkspaceSummary(null);
        setFormValues(createPrefilledAnswers(profile, null));
      })
      .finally(() => {
        if (active.current) setLoading(false);
      });

    return () => {
      active.current = false;
    };
  }, [profile, profileLoading, reloadWorkspace]);

  const preview = draft;
  const isDraftSynced = draft ? serializeAnswers(formValues) === serializeAnswers(draft.answers) : false;
  const selectedOfferingTypeLabel =
    offeringTypeOptions.find((option) => option.value === formValues.offeringType)?.label || "Services";
  const selectedBrandToneLabel = brandToneOptions.find((option) => option.value === formValues.brandTone)?.label || "Professional";
  const servicePackCount = preview?.generatedServices.length || 0;
  const productPackCount = preview?.generatedProducts.length || 0;
  const faqCount = preview?.generatedFaq.length || 0;
  const serviceAreaCount = preview?.generatedServiceAreas.length || 0;
  const launchStatusLabel = loading ? "Loading" : draft ? draft.status.replace(/_/g, " ") : "Not generated";
  const totalOutputCount = servicePackCount + productPackCount;
  const liveSurfacePaths =
    publishedPaths ||
    (workspaceSummary?.profilePath && workspaceSummary?.businessPath
      ? {
          profilePath: workspaceSummary.profilePath,
          businessPath: workspaceSummary.businessPath,
        }
      : null);
  const hasLaunchpadLiveOutput = Boolean(publishedPaths || workspaceSummary?.lastPublishedAt);

  const handleInputChange = (event: ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value } = event.target;
    setFormValues((current) =>
      normalizeLaunchpadAnswers({
        ...current,
        [name]: name === "serviceRadiusKm" ? Number(value) : value,
      })
    );
  };

  const handleGenerate = async (event?: FormEvent<HTMLFormElement>) => {
    event?.preventDefault();
    setGenerating(true);
    setErrorMessage("");
    setSuccessMessage("");
    setPublishedPaths(null);

    const normalized = normalizeLaunchpadAnswers(formValues);
    setFormValues(normalized);

    try {
      const payload = await fetchAuthedJson<SaveLaunchpadDraftResponse>(supabase, "/api/launchpad/draft", {
        method: "POST",
        body: JSON.stringify({
          answers: normalized,
          inputSource: inferLaunchpadInputSource(normalized),
        }),
      });

      if (!payload.ok) {
        throw new Error(payload.message);
      }

      setDraft(payload.draft);
      setSuccessMessage("Launchpad draft generated and saved. Review the storefront pack, then publish when you are ready.");
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to generate launchpad draft right now.");
    } finally {
      setGenerating(false);
    }
  };

  const handlePublish = async () => {
    if (!draft) {
      setErrorMessage("Generate your launchpad draft before publishing.");
      return;
    }

    setPublishing(true);
    setErrorMessage("");
    setSuccessMessage("");

    try {
      const payload = await fetchAuthedJson<PublishLaunchpadDraftResponse>(supabase, "/api/launchpad/publish", {
        method: "POST",
        body: JSON.stringify({
          draftId: draft.id,
        }),
      });

      if (!payload.ok) {
        throw new Error(payload.message);
      }

      setDraft(payload.draft);
      setPublishedPaths({
        profilePath: payload.profilePath,
        businessPath: payload.businessPath,
      });
      await reloadWorkspace();
      setSuccessMessage(
        `Published ${payload.publishedServices} service pack${payload.publishedServices === 1 ? "" : "s"} and ${payload.publishedProducts} product pack${
          payload.publishedProducts === 1 ? "" : "s"
        }.`
      );
    } catch (error) {
      setErrorMessage(error instanceof Error ? error.message : "Unable to publish launchpad content right now.");
    } finally {
      setPublishing(false);
    }
  };

  return (
    <div className="mx-auto flex w-full max-w-[2200px] flex-col gap-6">
      <section className="overflow-hidden rounded-[34px] border border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.18),transparent_34%),radial-gradient(circle_at_top_right,rgba(15,23,42,0.12),transparent_38%),linear-gradient(135deg,#0b1f33_0%,#11466a_48%,#0ea5a4_100%)] p-6 text-white shadow-[0_28px_60px_-36px_rgba(15,23,42,0.9)] sm:p-8">
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px] xl:items-end">
          <div className="max-w-3xl">
            <div className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/90">
              <Sparkles className="h-3.5 w-3.5" />
              AI Business Launchpad
            </div>
            <h1 className="mt-4 text-3xl font-semibold tracking-tight sm:text-4xl">
              Turn one business brief into a live storefront, service packs, and marketplace-ready listings.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-cyan-50/90 sm:text-base">
              This first version keeps the flow deterministic and publish-safe: you answer a short brief, ServiQ generates a draft, and only launchpad-owned listings get replaced when you publish again.
            </p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-1 xl:justify-self-end xl:w-full xl:max-w-[360px]">
            <StatCard label="Launch status" value={launchStatusLabel} helper={draft ? "Latest draft state" : "Ready for first run"} />
            <StatCard label="Mode" value={selectedOfferingTypeLabel} helper={`${selectedBrandToneLabel} tone`} />
            <StatCard label="Outputs ready" value={totalOutputCount > 0 ? `${totalOutputCount} packs` : "Profile + listings"} helper="Generated on each run" />
          </div>
        </div>
      </section>

      {errorMessage ? (
        <div className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">{errorMessage}</div>
      ) : null}
      {successMessage ? (
        <div className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {successMessage}
        </div>
      ) : null}

      <section className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)] sm:p-6">
        <div className="flex flex-col gap-5 xl:flex-row xl:items-start xl:justify-between">
          <div className="max-w-3xl">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">What Launchpad Does</p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Launchpad is ServiQ&apos;s provider storefront builder.</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              It takes one business brief, turns it into profile copy, listing packs, FAQ answers, and service-area metadata,
              then publishes that output into the same profile, business page, and marketplace inventory the rest of the app already uses.
            </p>
            {profile?.role !== "provider" ? (
              <div className="mt-4 inline-flex items-center gap-2 rounded-full border border-cyan-200 bg-cyan-50 px-3 py-2 text-xs font-semibold text-[var(--brand-700)]">
                <Sparkles className="h-3.5 w-3.5" />
                Publishing from Launchpad will position this account as a provider storefront.
              </div>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:min-w-[420px]">
            <LaunchMetricCard
              icon={<Store className="h-4 w-4" />}
              label="Live Storefront"
              value={workspaceSummary?.profileExists ? "Connected" : "Not live yet"}
              helper={
                workspaceSummary?.lastPublishedAt
                  ? `Last launchpad publish ${formatLaunchpadTimestamp(workspaceSummary.lastPublishedAt)}`
                  : "Generate and publish to create a live provider storefront"
              }
            />
            <LaunchMetricCard
              icon={<Package className="h-4 w-4" />}
              label="Current Inventory"
              value={`${workspaceSummary?.totalServices || 0} services • ${workspaceSummary?.totalProducts || 0} products`}
              helper="Existing live listings are used to prefill the brief"
            />
          </div>
        </div>

        <div className="mt-5 flex flex-wrap gap-3">
          {liveSurfacePaths?.businessPath ? (
            <Link
              href={liveSurfacePaths.businessPath}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
            >
              Open business page
              <ExternalLink className="h-4 w-4" />
            </Link>
          ) : null}
          {liveSurfacePaths?.profilePath ? (
            <Link
              href={liveSurfacePaths.profilePath}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-800 transition hover:border-[var(--brand-500)]/35 hover:text-[var(--brand-700)]"
            >
              Open public profile
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : null}
          {workspaceSummary?.liveOfferings.length ? (
            <div className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-600">
              Prefilled from live inventory: {workspaceSummary.liveOfferings.slice(0, 3).join(", ")}
              {workspaceSummary.liveOfferings.length > 3 ? "..." : ""}
            </div>
          ) : null}
        </div>
      </section>

      <section className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
        <LaunchMetricCard
          icon={<Store className="h-4 w-4" />}
          label="Draft status"
          value={launchStatusLabel}
          helper={isDraftSynced ? "Preview matches the current answers" : "Preview needs a fresh generate pass"}
        />
        <LaunchMetricCard
          icon={<Package className="h-4 w-4" />}
          label="Listings generated"
          value={`${totalOutputCount}`}
          helper={`${servicePackCount} services • ${productPackCount} products`}
        />
        <LaunchMetricCard
          icon={<Sparkles className="h-4 w-4" />}
          label="FAQ answers"
          value={`${faqCount}`}
          helper={faqCount > 0 ? "Ready for the business page" : "Will appear after generation"}
        />
        <LaunchMetricCard
          icon={<MapPin className="h-4 w-4" />}
          label="Coverage areas"
          value={`${serviceAreaCount}`}
          helper={
            serviceAreaCount > 0 ? preview?.generatedServiceAreas.slice(0, 2).join(" • ") || "Coverage ready" : "No service areas generated yet"
          }
        />
      </section>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1.15fr)_minmax(320px,0.85fr)]">
        <form
          onSubmit={handleGenerate}
          className="space-y-6 rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)] sm:p-6"
        >
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Launchpad Brief</p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">Business input</h2>
              <p className="mt-2 text-sm leading-6 text-slate-600">
                The more concrete the inputs, the better the generated service packs, FAQs, and storefront copy.
              </p>
            </div>

            <div className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-3 py-2 text-xs font-semibold text-slate-600">
              {loading ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600" />}
              {loading ? "Loading draft" : draft ? `Draft ${draft.status}` : "Ready to generate"}
            </div>
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            <Field label="Business name" htmlFor="businessName" required>
              <input id="businessName" name="businessName" value={formValues.businessName} onChange={handleInputChange} placeholder="Aarav Home Repair" className={fieldClassName} />
            </Field>
            <Field label="Business type" htmlFor="businessType" required>
              <input id="businessType" name="businessType" value={formValues.businessType} onChange={handleInputChange} placeholder="Home repair studio" className={fieldClassName} />
            </Field>
            <Field label="Primary category" htmlFor="primaryCategory" required>
              <input id="primaryCategory" name="primaryCategory" value={formValues.primaryCategory} onChange={handleInputChange} placeholder="Repairs" className={fieldClassName} />
            </Field>
            <Field label="Offering type" htmlFor="offeringType" required>
              <select id="offeringType" name="offeringType" value={formValues.offeringType} onChange={handleInputChange} className={fieldClassName}>
                {offeringTypeOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Location" htmlFor="location" required>
              <input id="location" name="location" value={formValues.location} onChange={handleInputChange} placeholder="Bengaluru" className={fieldClassName} />
            </Field>
            <Field label="Service area" htmlFor="serviceArea" required>
              <input
                id="serviceArea"
                name="serviceArea"
                value={formValues.serviceArea}
                onChange={handleInputChange}
                placeholder="Indiranagar, Koramangala, HSR Layout"
                className={fieldClassName}
              />
            </Field>
            <Field label="Service radius (km)" htmlFor="serviceRadiusKm" required>
              <input id="serviceRadiusKm" name="serviceRadiusKm" type="number" min={1} max={100} value={formValues.serviceRadiusKm} onChange={handleInputChange} className={fieldClassName} />
            </Field>
            <Field label="Brand tone" htmlFor="brandTone" required>
              <select id="brandTone" name="brandTone" value={formValues.brandTone} onChange={handleInputChange} className={fieldClassName}>
                {brandToneOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Phone" htmlFor="phone">
              <input id="phone" name="phone" value={formValues.phone} onChange={handleInputChange} placeholder="+919999999999" className={fieldClassName} />
            </Field>
            <Field label="Website" htmlFor="website">
              <input id="website" name="website" value={formValues.website} onChange={handleInputChange} placeholder="https://yourbusiness.example" className={fieldClassName} />
            </Field>
            <Field label="Operating hours" htmlFor="hours">
              <input id="hours" name="hours" value={formValues.hours} onChange={handleInputChange} placeholder="Mon-Sat, 9am-7pm" className={fieldClassName} />
            </Field>
            <Field label="Pricing notes" htmlFor="pricingNotes">
              <input
                id="pricingNotes"
                name="pricingNotes"
                value={formValues.pricingNotes}
                onChange={handleInputChange}
                placeholder="Quotes start at INR 799, site visit charged separately"
                className={fieldClassName}
              />
            </Field>
          </div>

          <div className="grid gap-4">
            <Field label="Short business summary" htmlFor="shortDescription" required>
              <textarea
                id="shortDescription"
                name="shortDescription"
                value={formValues.shortDescription}
                onChange={handleInputChange}
                rows={4}
                placeholder="Tell customers what makes your business useful, trustworthy, and fast to book."
                className={fieldClassName}
              />
            </Field>
            <Field label="Core offerings" htmlFor="coreOfferings" required helper="Use one item per line or comma-separated values.">
              <textarea
                id="coreOfferings"
                name="coreOfferings"
                value={formValues.coreOfferings}
                onChange={handleInputChange}
                rows={4}
                placeholder={"AC repair\nPreventive maintenance\nEmergency diagnostics"}
                className={fieldClassName}
              />
            </Field>
            <Field label="Catalog, menu, or WhatsApp profile text" htmlFor="catalogText" helper="Optional. Paste messy source text and ServiQ will use it to create structured listings.">
              <textarea
                id="catalogText"
                name="catalogText"
                value={formValues.catalogText}
                onChange={handleInputChange}
                rows={5}
                placeholder={"Split AC installation - INR 2499\nDeep cleaning package - INR 1799\nAnnual maintenance plan - INR 3999"}
                className={`${fieldClassName} font-mono text-[13px]`}
              />
            </Field>
          </div>

          <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="text-sm text-slate-600">
              {draft && !isDraftSynced
                ? "You have edits that are not reflected in the current preview yet. Generate again to refresh the storefront pack."
                : "Generate saves the latest launchpad draft. Publish pushes the generated profile and launchpad-owned listings live."}
            </div>

            <div className="flex flex-col gap-3 sm:flex-row">
              <button type="submit" disabled={generating || publishing || loading} className="inline-flex items-center justify-center gap-2 rounded-full bg-slate-950 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-60">
                {generating ? <Loader2 className="h-4 w-4 animate-spin" /> : <Wand2 className="h-4 w-4" />}
                Generate Draft
              </button>
              <button type="button" onClick={handlePublish} disabled={!draft || generating || publishing || !isDraftSynced} className="inline-flex items-center justify-center gap-2 rounded-full bg-[var(--brand-500)] px-5 py-3 text-sm font-semibold text-slate-950 transition hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-60">
                {publishing ? <Loader2 className="h-4 w-4 animate-spin" /> : <Rocket className="h-4 w-4" />}
                Publish Live
              </button>
            </div>
          </div>
        </form>

        <aside className="space-y-6 xl:sticky xl:top-24 xl:self-start">
          <section className="overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]">
            <div className="border-b border-slate-200 bg-[radial-gradient(circle_at_top_left,rgba(14,165,164,0.12),transparent_40%),linear-gradient(135deg,#f8fafc_0%,#ffffff_100%)] px-5 py-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Storefront Preview</p>
                  <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">
                    {preview?.generatedProfile?.fullName || "Generate your first draft"}
                  </h2>
                </div>
                <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">
                  <Store className="h-5 w-5" />
                </div>
              </div>

              {preview?.generatedProfile ? (
                <>
                  <p className="mt-4 text-sm leading-7 text-slate-600">{preview.generatedProfile.bio}</p>
                  <div className="mt-4 flex flex-wrap gap-2">
                    {preview.generatedProfile.interests.slice(0, 5).map((interest) => (
                      <span key={interest} className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                        {interest}
                      </span>
                    ))}
                  </div>
                  <div className="mt-5 grid grid-cols-2 gap-2">
                    <PreviewMiniStat label="Service packs" value={`${servicePackCount}`} />
                    <PreviewMiniStat label="Product packs" value={`${productPackCount}`} />
                    <PreviewMiniStat label="FAQ" value={`${faqCount}`} />
                    <PreviewMiniStat label="Areas" value={`${serviceAreaCount}`} />
                  </div>
                </>
              ) : (
                <p className="mt-4 text-sm leading-7 text-slate-600">
                  The preview will show business copy, service areas, FAQs, and generated listings after you run the launchpad.
                </p>
              )}
            </div>

            <div className="space-y-4 px-5 py-5">
              <PreviewLine icon={<MapPin className="h-4 w-4" />} label="Location" value={preview?.generatedProfile?.location || "Add a business location"} />
              <PreviewLine icon={<Phone className="h-4 w-4" />} label="Phone" value={preview?.generatedProfile?.phone || "Optional but strongly recommended"} />
              <PreviewLine icon={<Globe className="h-4 w-4" />} label="Website" value={preview?.generatedProfile?.website || "Optional for now"} />
              <PreviewLine icon={<Sparkles className="h-4 w-4" />} label="Service areas" value={preview?.generatedServiceAreas.join(", ") || "Service areas will appear here"} />
            </div>
          </section>

          <section className="rounded-[30px] border border-slate-900 bg-slate-950 p-5 text-white shadow-[0_24px_70px_-52px_rgba(15,23,42,0.7)]">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-cyan-200">Go-live surfaces</p>
            <h2 className="mt-2 text-xl font-semibold text-white">Where this launch lands</h2>
            <div className="mt-4 grid gap-3">
              <SurfaceLine label="Public profile" value={liveSurfacePaths ? "Live" : "Ready to publish"} />
              <SurfaceLine label="Business mini-site" value={liveSurfacePaths ? "Live" : "Will publish with profile"} />
              <SurfaceLine label="Service listings" value={servicePackCount > 0 ? `${servicePackCount} prepared` : "None yet"} />
              <SurfaceLine label="Product listings" value={productPackCount > 0 ? `${productPackCount} prepared` : "None yet"} />
            </div>
            <div className="mt-4 rounded-[22px] border border-white/10 bg-white/5 px-4 py-4 text-sm text-slate-200">
              The strongest launchpad runs start narrow: one category, one location cluster, one clean offer set, then expand once realtime leads start landing.
            </div>
          </section>

          {hasLaunchpadLiveOutput && liveSurfacePaths ? (
            <section className="rounded-[30px] border border-emerald-200 bg-emerald-50 p-5 shadow-[0_24px_70px_-52px_rgba(16,185,129,0.35)]">
              <p className="text-xs font-semibold uppercase tracking-[0.2em] text-emerald-700">Published</p>
              <h2 className="mt-2 text-xl font-semibold text-emerald-950">Your launchpad output is now live.</h2>
              <div className="mt-4 grid gap-3">
                <Link href={liveSurfacePaths.businessPath} className="inline-flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-300">
                  Open business page
                  <ExternalLink className="h-4 w-4" />
                </Link>
                <Link href={liveSurfacePaths.profilePath} className="inline-flex items-center justify-between rounded-2xl border border-emerald-200 bg-white px-4 py-3 text-sm font-semibold text-slate-900 transition hover:border-emerald-300">
                  Open public profile
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </div>
            </section>
          ) : null}
        </aside>
      </div>

      <div className="grid gap-6 xl:grid-cols-2">
        <GeneratedListSection title="Service Packs" eyebrow="Generated listings" emptyCopy="Generate a draft to preview service packs." items={preview?.generatedServices || []} icon={<Sparkles className="h-4 w-4" />} priceLabel="From" />
        <GeneratedListSection title="Product Packs" eyebrow="Generated listings" emptyCopy="If you choose product or hybrid mode, product packs will show up here." items={preview?.generatedProducts || []} icon={<Package className="h-4 w-4" />} priceLabel="Price" />
      </div>

      <div className="grid gap-6 xl:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">How it works</p>
          <div className="mt-4 space-y-4">
            {launchpadSteps.map((step, index) => (
              <div key={step.title} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">Step {index + 1}</p>
                <p className="mt-2 text-base font-semibold text-slate-950">{step.title}</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{step.description}</p>
              </div>
            ))}
          </div>
        </section>

        <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]">
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">Generated FAQ</p>
          <div className="mt-4 grid gap-3">
            {(preview?.generatedFaq || []).length === 0 ? (
              <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">
                Generate a draft to preview the launchpad FAQ pack for your business page.
              </div>
            ) : (
              preview?.generatedFaq.map((item) => (
                <article key={item.question} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
                  <p className="text-sm font-semibold text-slate-950">{item.question}</p>
                  <p className="mt-2 text-sm leading-6 text-slate-600">{item.answer}</p>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

function Field({
  children,
  helper,
  htmlFor,
  label,
  required = false,
}: {
  children: React.ReactNode;
  helper?: string;
  htmlFor: string;
  label: string;
  required?: boolean;
}) {
  return (
    <label htmlFor={htmlFor} className="block">
      <span className="text-sm font-semibold text-slate-800">
        {label}
        {required ? <span className="ml-1 text-[var(--brand-700)]">*</span> : null}
      </span>
      {helper ? <span className="mt-1 block text-xs text-slate-500">{helper}</span> : null}
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function StatCard({ label, value, helper }: { label: string; value: string; helper?: string }) {
  return (
    <div className="flex min-h-[116px] flex-col justify-between rounded-[22px] border border-white/18 bg-white/10 px-4 py-4 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.18em] text-white/70">{label}</p>
      <p className="mt-2 text-lg font-semibold text-white">{value}</p>
      {helper ? <p className="mt-1 text-xs text-white/70">{helper}</p> : null}
    </div>
  );
}

function LaunchMetricCard({
  icon,
  label,
  value,
  helper,
}: {
  icon: React.ReactNode;
  label: string;
  value: string;
  helper: string;
}) {
  return (
    <article className="rounded-[26px] border border-slate-200 bg-white p-4 shadow-[0_18px_50px_-38px_rgba(15,23,42,0.28)]">
      <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-slate-950 text-white">{icon}</div>
      <p className="mt-4 text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{value}</p>
      <p className="mt-2 text-sm leading-6 text-slate-600">{helper}</p>
    </article>
  );
}

function PreviewLine({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-start gap-3 rounded-[20px] border border-slate-200 bg-slate-50 px-4 py-3">
      <div className="mt-0.5 text-slate-500">{icon}</div>
      <div>
        <p className="text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
        <p className="mt-1 text-sm leading-6 text-slate-700">{value}</p>
      </div>
    </div>
  );
}

function PreviewMiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[18px] border border-slate-200 bg-white px-3 py-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.16em] text-slate-500">{label}</p>
      <p className="mt-1 text-sm font-semibold text-slate-950">{value}</p>
    </div>
  );
}

function SurfaceLine({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-[18px] border border-white/10 bg-white/5 px-4 py-3">
      <p className="text-sm font-medium text-slate-200">{label}</p>
      <span className="rounded-full border border-white/10 bg-white/10 px-3 py-1 text-xs font-semibold text-white">{value}</span>
    </div>
  );
}

function GeneratedListSection({
  emptyCopy,
  eyebrow,
  icon,
  items,
  priceLabel,
  title,
}: {
  emptyCopy: string;
  eyebrow: string;
  icon: React.ReactNode;
  items: Array<{ title: string; description: string; category: string; price: number | null }>;
  priceLabel: string;
  title: string;
}) {
  return (
    <section className="rounded-[30px] border border-slate-200 bg-white p-5 shadow-[0_24px_70px_-52px_rgba(15,23,42,0.45)]">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.2em] text-slate-500">{eyebrow}</p>
          <h2 className="mt-2 text-2xl font-semibold tracking-tight text-slate-950">{title}</h2>
        </div>
        <div className="inline-flex h-11 w-11 items-center justify-center rounded-2xl bg-slate-950 text-white">{icon}</div>
      </div>

      <div className="mt-4 grid gap-3">
        {items.length === 0 ? (
          <div className="rounded-[22px] border border-dashed border-slate-200 bg-slate-50 px-4 py-5 text-sm text-slate-500">{emptyCopy}</div>
        ) : (
          items.map((item) => (
            <article key={item.title} className="rounded-[22px] border border-slate-200 bg-slate-50 px-4 py-4">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-base font-semibold text-slate-950">{item.title}</p>
                  <p className="mt-1 text-xs font-semibold uppercase tracking-[0.16em] text-slate-500">{item.category}</p>
                </div>
                <div className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-700">
                  {item.price ? `${priceLabel} INR ${item.price.toLocaleString("en-IN")}` : "Quote based"}
                </div>
              </div>
              <p className="mt-3 text-sm leading-6 text-slate-600">{item.description}</p>
            </article>
          ))
        )}
      </div>
    </section>
  );
}
