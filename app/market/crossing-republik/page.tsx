"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  Building2,
  Loader2,
  MapPin,
  Phone,
  Star,
  Store,
  Users,
  X,
  Zap,
  CheckCircle2,
} from "lucide-react";
import ZoneBrowser from "@/app/components/locality/ZoneBrowser";
import ServiceCategoryGrid from "@/app/components/services/ServiceCategoryGrid";
import { appName } from "@/lib/branding";
import type { LocalityResponse } from "@/app/api/localities/route";

type ProviderCardData = {
  id: string; name: string; location: string; lat: number | null; lng: number | null;
  avatarUrl: string; bio: string; role: string; services: string[];
  avgRating: number | null; reviewCount: number; serviceCount: number;
  completedJobs: number; responseMinutes: number | null; isOnline: boolean;
  priceMin: number | null; priceMax: number | null; distanceKm: number | null;
  verified: boolean;
  listings: { id: string; title: string; price: number | null }[];
};

const CATEGORY_PILLS = [
  { label: "Electrician", icon: "⚡", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { label: "Plumber", icon: "🔧", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { label: "AC Repair", icon: "❄️", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { label: "RO Repair", icon: "💧", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { label: "Carpenter", icon: "🪚", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { label: "Appliance Repair", icon: "🔌", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { label: "Tailoring", icon: "🧵", color: "bg-pink-50 text-pink-700 border-pink-200" },
  { label: "Clothing", icon: "👕", color: "bg-violet-50 text-violet-700 border-violet-200" },
];

function ProviderCard({ provider, onContact, onSelect }: { provider: ProviderCardData; onContact: (p: ProviderCardData) => void; onSelect: (p: ProviderCardData) => void }) {
  const priceLabel = provider.priceMin != null
    ? provider.priceMax != null && provider.priceMax > provider.priceMin
      ? `₹${provider.priceMin} - ₹${provider.priceMax}`
      : `From ₹${provider.priceMin}`
    : null;

  return (
    <div className="group rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[var(--brand-500)]/30 hover:shadow-md hover:shadow-[var(--brand-500)]/5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onSelect(provider)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-lg font-bold text-[var(--brand-700)] transition hover:ring-2 hover:ring-[var(--brand-300)]">
          {provider.name.charAt(0)}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onSelect(provider)} className="w-full text-left">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="text-sm font-bold text-slate-900">{provider.name}</h3>
                <p className="mt-0.5 text-xs text-slate-500">{provider.location || "Crossings Republik"}</p>
              </div>
              {provider.verified && (
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-200">Verified</span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
              {provider.avgRating ? (
                <span className="flex items-center gap-1">
                  <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
                  {provider.avgRating.toFixed(1)} ({provider.reviewCount})
                </span>
              ) : null}
              {provider.responseMinutes ? (
                <span className="flex items-center gap-1">
                  <Zap className="h-3 w-3 text-[var(--brand-500)]" />
                  {provider.responseMinutes} min
                </span>
              ) : null}
              {provider.completedJobs > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-slate-400" />
                  {provider.completedJobs} jobs
                </span>
              )}
              {provider.distanceKm != null && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-slate-400" />
                  {provider.distanceKm} km
                </span>
              )}
              {provider.serviceCount > 0 && (
                <span className="flex items-center gap-1">
                  <CheckCircle2 className="h-3 w-3 text-slate-400" />
                  {provider.serviceCount} service{provider.serviceCount === 1 ? "" : "s"}
                </span>
              )}
            </div>
            {provider.bio && (
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2">{provider.bio}</p>
            )}
          </button>
          <div className="mt-3 flex items-center justify-between">
            {priceLabel && (
              <span className="text-sm font-bold text-[var(--brand-700)]">{priceLabel}</span>
            )}
            <button
              type="button"
              onClick={() => onContact(provider)}
              className="inline-flex items-center gap-1.5 rounded-xl bg-[var(--brand-900)] px-3.5 py-2 text-[11px] font-semibold text-white transition hover:bg-[var(--brand-700)]"
            >
              <Phone className="h-3 w-3" />
              Contact
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export default function CrossingRepublikPage() {
  const router = useRouter();
  const providerSectionRef = useRef<HTMLDivElement>(null);
  const zoneSectionRef = useRef<HTMLDivElement>(null);

  const [localities, setLocalities] = useState<LocalityResponse[]>([]);
  const [categories, setCategories] = useState<Record<string, unknown>[]>([]);
  const [localitiesLoading, setLocalitiesLoading] = useState(true);

  const [providers, setProviders] = useState<ProviderCardData[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);



  useEffect(() => {
    async function load() {
      const [locRes, catRes] = await Promise.all([
        fetch("/api/localities?phase=1").then((r) => r.json()).catch(() => ({ ok: false, localities: [] })),
        fetch("/api/service-categories").then((r) => r.json()).catch(() => ({ ok: false, categories: [] })),
      ]);
      setLocalities((locRes as { ok: boolean; localities?: LocalityResponse[] }).localities || []);
      setCategories((catRes as { ok: boolean; categories?: Record<string, unknown>[] }).categories || []);
      setLocalitiesLoading(false);
    }
    void load();
  }, []);

  useEffect(() => {
    let active = true;
    const loadProviders = async () => {
      setProvidersLoading(true);
      const params = new URLSearchParams();
      if (selectedCategory) params.set("category", selectedCategory);
      try {
        const res = await fetch(`/api/community/providers-by-category${params.toString() ? `?${params.toString()}` : ""}`);
        const data = await res.json();
        if (active) setProviders((data as { providers?: ProviderCardData[] }).providers || []);
      } catch {
        if (active) setProviders([]);
      } finally {
        if (active) setProvidersLoading(false);
      }
    };
    void loadProviders();
    return () => { active = false; };
  }, [selectedCategory]);

  const societies = localities.filter((l) => l.zone_type === "society");
  const marketZones = localities.filter((l) => l.zone_type === "market");

  const areaList = useMemo(() => {
    const names = localities.slice(0, 5).map((l) => l.name);
    const extra = Math.max(0, localities.length - 5);
    return `${names.join(", ")}${extra > 0 ? `, and ${extra}+ areas` : ""}`;
  }, [localities]);

  const filteredProviders = useMemo(() => {
    return providers;
  }, [providers]);

  const scrollToProviders = () => {
    providerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToZones = () => {
    zoneSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
      {/* ── Hero ── */}
      <section className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <MapPin className="h-8 w-8 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
          <span className="text-[var(--brand-700)]">Crossing Republik</span>, Ghaziabad
        </h1>
        <p className="mt-1 text-xs text-slate-500">
          Uttar Pradesh 201016 &mdash; Hyperlocal marketplace
        </p>

        {/* Stats row */}
        {!localitiesLoading && (
          <div className="mx-auto mt-5 inline-flex items-center gap-4 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 shadow-sm">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
              <Building2 className="h-3.5 w-3.5 text-[var(--brand-600)]" />
              {societies.length} Societies
            </div>
            <div className="flex items-center gap-1.5 pl-4 text-xs font-semibold text-slate-700">
              <Store className="h-3.5 w-3.5 text-[var(--brand-600)]" />
              {marketZones.length} Markets
            </div>
            <div className="flex items-center gap-1.5 pl-4 text-xs font-semibold text-slate-700">
              <Users className="h-3.5 w-3.5 text-[var(--brand-600)]" />
              {providers.length} Providers
            </div>
          </div>
        )}

        {/* Action buttons */}
        <div className="mx-auto mt-6 flex max-w-md flex-col gap-2.5 sm:flex-row">
          <button
            type="button"
            onClick={scrollToZones}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-5 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--brand-800)]"
          >
            <Store className="h-4 w-4" />
            View Market
          </button>
          <button
            type="button"
            onClick={scrollToProviders}
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-bold text-slate-700 shadow-sm transition hover:border-slate-300"
          >
            <Users className="h-4 w-4" />
            Browse All Providers
          </button>
        </div>

        {/* Category pills */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
          {CATEGORY_PILLS.map((cat) => (
            <button
              key={cat.label}
              type="button"
              onClick={() => {
                setSelectedCategory(selectedCategory === cat.label ? null : cat.label);
                scrollToProviders();
              }}
              className={`inline-flex items-center gap-1.5 rounded-xl border px-3.5 py-2 text-xs font-semibold transition ${
                selectedCategory === cat.label
                  ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                  : cat.color + " hover:shadow-sm"
              }`}
            >
              <span className="text-sm">{cat.icon}</span>
              {cat.label}
            </button>
          ))}
        </div>

        {/* Coverage text */}
        <p className="mx-auto mt-6 max-w-lg text-xs text-slate-400 leading-relaxed">
          Covering: {areaList}
        </p>
      </section>

      {/* ── Zone Browser Section ── */}
      <section ref={zoneSectionRef} className="mb-10 scroll-mt-24">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Browse Local Zones</h2>
        </div>
        <ZoneBrowser initialLocalities={localities} loading={localitiesLoading} />
      </section>

      {/* ── Services Section ── */}
      <section className="mb-10">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Services Available</h2>
          <p className="text-xs text-slate-500">Browse by category — standard pricing for Crossing Republik</p>
        </div>
        <ServiceCategoryGrid categories={categories as never[]} />
      </section>

      {/* ── Provider Cards Section ── */}
      <section ref={providerSectionRef} className="scroll-mt-24">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {selectedCategory ? `Showing results for ${selectedCategory}` : "Showing results for all"}
          </p>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="text-xs font-semibold text-[var(--brand-700)] hover:text-[var(--brand-500)]"
            >
              Clear filter
            </button>
          )}
        </div>

        {providersLoading ? (
          <div className="flex items-center justify-center gap-2 py-16 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading providers...
          </div>
        ) : filteredProviders.length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {filteredProviders.map((provider) => (
                <ProviderCard
                  key={provider.id}
                  provider={provider}
                  onSelect={(p) => router.push(`/profile/${p.id}`)}
                  onContact={(p) => router.push(`/dashboard/chat?recipientId=${encodeURIComponent(p.id)}`)}
                />
            ))}
          </div>
        ) : selectedCategory ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No providers found nearby</p>
            <p className="mt-1 text-xs text-slate-400">
              Try adjusting your filters or browse all providers
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300"
              >
                <X className="h-3 w-3" />
                Clear Filter
              </button>
            </div>
          </div>
        ) : null}
      </section>

      {/* ── Join CTA ── */}
      <section className="mx-auto mt-12 max-w-lg rounded-2xl border border-dashed border-[var(--brand-300)] bg-gradient-to-br from-[var(--brand-50)] to-white p-6 text-center">
        <Store className="mx-auto h-8 w-8 text-[var(--brand-500)]" />
        <h3 className="mt-3 text-lg font-bold text-slate-900">Are you a service provider?</h3>
        <p className="mt-1 text-sm text-slate-500">List your business on {appName} and get more customers from your neighborhood.</p>
        <Link
          href="/onboarding/provider/locality"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
        ><Store className="h-4 w-4" /> List Your Business</Link>
      </section>
    </div>
  );
}
