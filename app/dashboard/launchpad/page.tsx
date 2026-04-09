"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ChevronDown, ChevronUp, Loader2, MapPin, Rocket, Sparkles } from "lucide-react";
import RouteObservability from "@/app/components/RouteObservability";
import { formatCoordinatePair, getCoordinates, isUsableLocationLabel } from "@/lib/geo";
import { supabase } from "@/lib/supabase";
import { DEFAULT_LAUNCHPAD_ANSWERS } from "@/lib/launchpad/validation";
import type { LaunchpadAnswers, LaunchpadBrandTone, LaunchpadOfferingType, SaveLaunchpadDraftResponse } from "@/lib/api/launchpad";

// ─────────────────────────────────────────────
// Static data
// ─────────────────────────────────────────────

const CATEGORIES = [
  "Plumber", "Electrician", "AC Repair", "Carpenter", "Painter",
  "Cleaning", "RO Service", "Appliance Repair", "Mechanic", "Mobile Repair",
  "Computer Repair", "Tutor", "Delivery", "Tailor", "Beautician",
  "Photographer", "CCTV", "Internet / WiFi", "Other",
] as const;

const BUSINESS_TYPES = [
  "Plumbing", "Electrical", "Cleaning & Housekeeping", "AC & Appliance Repair",
  "Carpentry & Furniture", "Painting & Waterproofing", "Beauty & Wellness",
  "Education & Tutoring", "Delivery & Logistics", "Photography & Events",
  "Computer & Mobile Repair", "Security & CCTV", "Internet & Networking",
  "Food & Catering", "Healthcare & Medical", "Auto & Vehicle Service",
  "Tailoring & Alterations", "Other Local Service",
] as const;

const OFFERING_OPTIONS: { value: LaunchpadOfferingType; label: string; desc: string }[] = [
  { value: "services", label: "Services", desc: "I provide skilled services" },
  { value: "products", label: "Products", desc: "I sell goods or items" },
  { value: "hybrid", label: "Both", desc: "Services and products" },
];

const TONE_OPTIONS: { value: LaunchpadBrandTone; label: string; emoji: string }[] = [
  { value: "professional", label: "Professional", emoji: "🏢" },
  { value: "friendly", label: "Friendly", emoji: "😊" },
  { value: "fast", label: "Fast & Reliable", emoji: "⚡" },
  { value: "premium", label: "Premium", emoji: "✨" },
  { value: "community", label: "Community", emoji: "🤝" },
];

const GPS_TIMEOUT = 3000;

// ─────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────

const getGps = (): Promise<{ latitude: number; longitude: number } | null> =>
  new Promise((resolve) => {
    if (!navigator?.geolocation) return resolve(null);
    const t = window.setTimeout(() => resolve(null), GPS_TIMEOUT);
    navigator.geolocation.getCurrentPosition(
      (pos) => { clearTimeout(t); resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }); },
      () => { clearTimeout(t); resolve(null); },
      { enableHighAccuracy: false, timeout: GPS_TIMEOUT - 200 }
    );
  });

// ─────────────────────────────────────────────
// Component
// ─────────────────────────────────────────────

export default function LaunchpadPage() {
  const router = useRouter();

  // form state
  const [answers, setAnswers] = useState<LaunchpadAnswers>({ ...DEFAULT_LAUNCHPAD_ANSWERS });
  const [locating, setLocating] = useState(false);
  const [showExtras, setShowExtras] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  // pre-fill from profile on load
  useEffect(() => {
    let active = true;
    void (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user || !active) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name,location,latitude,longitude,phone,website")
        .eq("id", user.id)
        .maybeSingle<{
          full_name?: string | null;
          location?: string | null;
          latitude?: number | null;
          longitude?: number | null;
          phone?: string | null;
          website?: string | null;
        }>();
      if (!active || !profile) return;
      setAnswers((prev) => ({
        ...prev,
        businessName: prev.businessName || profile.full_name || "",
        location: prev.location || profile.location || "",
        latitude: prev.latitude ?? profile.latitude ?? null,
        longitude: prev.longitude ?? profile.longitude ?? null,
        phone: prev.phone || profile.phone || "",
        website: prev.website || profile.website || "",
      }));
    })();
    return () => { active = false; };
  }, []);

  const set = <K extends keyof LaunchpadAnswers>(key: K, value: LaunchpadAnswers[K]) =>
    setAnswers((prev) => ({ ...prev, [key]: value }));

  const handleGps = async () => {
    setLocating(true);
    setError("");
    const coords = await getGps();
    if (coords) {
      const normalized = getCoordinates(coords.latitude, coords.longitude);
      set("latitude", normalized?.latitude ?? null);
      set("longitude", normalized?.longitude ?? null);
    } else {
      setError("Could not get GPS location. Type your area manually.");
    }
    setLocating(false);
  };

  const handleGenerate = async () => {
    if (!answers.businessName.trim()) { setError("Enter your business name."); return; }
    if (!answers.businessType) { setError("Select a business type."); return; }
    if (!answers.primaryCategory) { setError("Select a primary category."); return; }
    if (!answers.location.trim()) { setError("Enter your location."); return; }
    if (!isUsableLocationLabel(answers.location)) {
      setError("Enter a readable area or city name like \"Indiranagar, Bengaluru\", not raw GPS coordinates.");
      return;
    }
    if (!answers.serviceArea.trim()) { setError("Enter your service area."); return; }
    if (!answers.shortDescription.trim() || answers.shortDescription.trim().length < 24) {
      setError("Write a short description (at least 24 characters)."); return;
    }
    if (!answers.coreOfferings.trim()) { setError("List at least one core offering."); return; }

    setSubmitting(true);
    setError("");

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error("Please sign in again.");

      const response = await fetch("/api/launchpad/draft", {
        method: "POST",
        headers: { Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ answers }),
      });
      const payload = (await response.json().catch(() => null)) as SaveLaunchpadDraftResponse | null;

      if (!response.ok || !payload?.ok) {
        throw new Error(
          payload && !payload.ok
            ? (payload as { message?: string }).message || "Failed to generate."
            : "Failed to generate."
        );
      }

      router.push(`/dashboard/launchpad/review?draft=${payload.draft.id}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not generate. Please try again.");
      setSubmitting(false);
    }
  };

  // ─── render ───────────────────────────────
  return (
    <div className="mx-auto max-w-2xl">
      <RouteObservability route="launchpad" />

      {/* header */}
      <div className="mb-6">
        <div className="flex items-center gap-3 mb-2">
          <div className="inline-flex h-10 w-10 items-center justify-center rounded-2xl bg-[var(--brand-900)] text-white shadow">
            <Rocket className="h-5 w-5" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-slate-900">Set Up Business</h1>
            <p className="text-sm text-slate-500">
              Let AI draft your profile, services, products, pricing, and inventory without creating a feed post.
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-6">

        {/* ── Section 1: Your Business ────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Your Business</h2>
          <div className="space-y-4">

            {/* Business name */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-name">
                Business name
              </label>
              <input
                id="lp-name"
                type="text"
                value={answers.businessName}
                onChange={(e) => set("businessName", e.target.value)}
                placeholder="e.g. Sharma Plumbing Services"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
              />
            </div>

            {/* Business type */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-type">
                Business type
              </label>
              <select
                id="lp-type"
                value={answers.businessType}
                onChange={(e) => set("businessType", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20"
              >
                <option value="">Select business type</option>
                {BUSINESS_TYPES.map((bt) => <option key={bt} value={bt}>{bt}</option>)}
              </select>
            </div>

            {/* Primary category */}
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-category">
                Primary category
              </label>
              <select
                id="lp-category"
                value={answers.primaryCategory}
                onChange={(e) => set("primaryCategory", e.target.value)}
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20"
              >
                <option value="">Select category</option>
                {CATEGORIES.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>

            {/* Offering type */}
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">What do you offer?</p>
              <div className="grid grid-cols-3 gap-2">
                {OFFERING_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("offeringType", opt.value)}
                    className={`flex flex-col items-center gap-1 rounded-2xl border py-3 px-2 text-xs font-semibold transition ${
                      answers.offeringType === opt.value
                        ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span className="text-sm font-bold">{opt.label}</span>
                    <span className="text-[10px] font-normal text-center leading-tight opacity-70">{opt.desc}</span>
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 2: What You Offer ───────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">What You Offer</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-offerings">
                Core offerings
              </label>
              <p className="mb-2 text-xs text-slate-500">List your main services or products, one per line or comma-separated.</p>
              <textarea
                id="lp-offerings"
                value={answers.coreOfferings}
                onChange={(e) => set("coreOfferings", e.target.value)}
                rows={3}
                placeholder="e.g. Tap repair, pipe leakage, bathroom fitting, water tank cleaning"
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
              />
            </div>
          </div>
        </section>

        {/* ── Section 3: Location ─────────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Where You Work</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-location">
                Your location
              </label>
              <div className="flex gap-2">
                <input
                  id="lp-location"
                  type="text"
                  value={answers.location}
                  onChange={(e) => set("location", e.target.value)}
                  placeholder="Area, city"
                  className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                />
                <button
                  type="button"
                  onClick={() => void handleGps()}
                  disabled={locating}
                  className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:opacity-60"
                  aria-label="Detect GPS"
                >
                  {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
                  GPS
                </button>
              </div>
              <p className="mt-2 text-xs text-slate-500">
                Keep this label human-readable for customers. GPS stores precise coordinates separately.
              </p>
              {typeof answers.latitude === "number" && typeof answers.longitude === "number" ? (
                <p className="mt-2 text-xs font-medium text-emerald-700">
                  Precise coordinates saved:{" "}
                  {formatCoordinatePair({ latitude: answers.latitude, longitude: answers.longitude }, 4)}
                </p>
              ) : null}
            </div>
            <div>
              <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-service-area">
                Service area
              </label>
              <input
                id="lp-service-area"
                type="text"
                value={answers.serviceArea}
                onChange={(e) => set("serviceArea", e.target.value)}
                placeholder="Neighbourhoods or areas you cover, comma-separated"
                className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
              />
            </div>
            <div>
              <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700" htmlFor="lp-radius">
                <span>Service radius (km)</span>
                <span className="font-bold text-[var(--brand-700)]">{answers.serviceRadiusKm} km</span>
              </label>
              <input
                id="lp-radius"
                type="range"
                min={1}
                max={50}
                step={1}
                value={answers.serviceRadiusKm}
                onChange={(e) => set("serviceRadiusKm", Number(e.target.value))}
                className="w-full accent-[var(--brand-700)]"
              />
              <div className="mt-1 flex justify-between text-xs text-slate-400">
                <span>1 km</span><span>50 km</span>
              </div>
            </div>
          </div>
        </section>

        {/* ── Section 4: Your Brand ───────────────────── */}
        <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 text-sm font-bold uppercase tracking-wide text-slate-500">Your Brand</h2>
          <div className="space-y-4">
            <div>
              <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700" htmlFor="lp-desc">
                <span>Short description</span>
                <span className={`text-xs font-normal ${answers.shortDescription.length > 0 && answers.shortDescription.length < 24 ? "text-amber-500" : "text-slate-400"}`}>
                  {answers.shortDescription.length} chars (min 24)
                </span>
              </label>
              <textarea
                id="lp-desc"
                value={answers.shortDescription}
                onChange={(e) => set("shortDescription", e.target.value)}
                rows={3}
                placeholder="We fix plumbing issues quickly and cleanly. Available 7 days a week."
                className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
              />
            </div>
            <div>
              <p className="mb-2 text-sm font-semibold text-slate-700">Brand tone</p>
              <div className="flex flex-wrap gap-2">
                {TONE_OPTIONS.map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => set("brandTone", opt.value)}
                    className={`flex items-center gap-1.5 rounded-2xl border px-3 py-2 text-sm font-semibold transition ${
                      answers.brandTone === opt.value
                        ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    <span>{opt.emoji}</span>
                    {opt.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </section>

        {/* ── Extras toggle ────────────────────────────── */}
        <button
          type="button"
          onClick={() => setShowExtras((prev) => !prev)}
          className="flex w-full items-center justify-between rounded-2xl border border-slate-200 bg-white px-5 py-3.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
        >
          <span>Add more details (optional)</span>
          {showExtras ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
        </button>

        {showExtras ? (
          <section className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <div className="space-y-4">
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-catalog">
                  Service/product catalog <span className="font-normal text-slate-400">(paste your menu or price list)</span>
                </label>
                <textarea
                  id="lp-catalog"
                  value={answers.catalogText}
                  onChange={(e) => set("catalogText", e.target.value)}
                  rows={4}
                  placeholder="Tap replacement – ₹299&#10;Pipe repair – ₹499&#10;Bathroom fitting – ₹1,200"
                  className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                />
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-pricing">
                  Pricing notes <span className="font-normal text-slate-400">(how you charge)</span>
                </label>
                <input
                  id="lp-pricing"
                  type="text"
                  value={answers.pricingNotes}
                  onChange={(e) => set("pricingNotes", e.target.value)}
                  placeholder="e.g. Starting from ₹299 per visit. Quotes given before starting."
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-phone">Phone</label>
                  <input
                    id="lp-phone"
                    type="tel"
                    value={answers.phone}
                    onChange={(e) => set("phone", e.target.value)}
                    placeholder="+91 98765 43210"
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                  />
                </div>
                <div>
                  <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-website">Website</label>
                  <input
                    id="lp-website"
                    type="url"
                    value={answers.website}
                    onChange={(e) => set("website", e.target.value)}
                    placeholder="https://..."
                    className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                  />
                </div>
              </div>
              <div>
                <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="lp-hours">Working hours</label>
                <input
                  id="lp-hours"
                  type="text"
                  value={answers.hours}
                  onChange={(e) => set("hours", e.target.value)}
                  placeholder="Mon–Sat 8am–8pm, Sunday on-call"
                  className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/20 placeholder:text-slate-400"
                />
              </div>
            </div>
          </section>
        ) : null}

        {/* error */}
        {error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>
        ) : null}

        {/* CTA */}
        <button
          type="button"
          onClick={() => void handleGenerate()}
          disabled={submitting}
          className="inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] py-4 text-base font-bold text-white shadow-md transition hover:bg-[var(--brand-700)] disabled:opacity-60 active:scale-[0.98]"
        >
          {submitting ? (
            <><Loader2 className="h-5 w-5 animate-spin" /> Generating pack…</>
          ) : (
            <><Sparkles className="h-5 w-5" /> Generate Business Pack</>
          )}
        </button>

        <p className="pb-6 text-center text-xs text-slate-400">
          Your profile, service listings, and FAQ will be drafted for review before publishing.
        </p>
      </div>
    </div>
  );
}
