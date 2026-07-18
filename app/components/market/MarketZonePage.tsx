"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  Droplets,
  Filter,
  Flame,
  Hammer,
  LayoutDashboard,
  LogIn,
  MapPin,
  Phone,
  Star,
  Store,
  Users,
  Wrench,
  Wind,
  X,
  Zap,
  CheckCircle2,
  type LucideIcon,
} from "lucide-react";
import ZoneBrowser from "@/app/components/locality/ZoneBrowser";
import ZoneSwitcher from "@/app/components/market/ZoneSwitcher";
import ServiceCategoryGrid from "@/app/components/services/ServiceCategoryGrid";
import ServiQLogo from "@/app/components/ServiQLogo";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";
import { appName } from "@/lib/branding";
import { supabase } from "@/lib/supabase";
import type { LocalityResponse } from "@/app/api/localities/route";
import type { ServiceCategoryResponse } from "@/app/api/service-categories/route";
import type { User } from "@supabase/supabase-js";
import type { MarketZoneResponse } from "@/app/api/market/[slug]/route";

const iconMap: Record<string, LucideIcon> = {
  zap: Zap, droplets: Droplets, filter: Filter, wind: Wind,
  flame: Flame, wrench: Wrench, hammer: Hammer,
};

type ProviderCardData = {
  id: string; name: string; location: string; lat: number | null; lng: number | null;
  avatarUrl: string; bio: string; role: string; services: string[];
  avgRating: number | null; reviewCount: number; serviceCount: number;
  completedJobs: number; responseMinutes: number | null; isOnline: boolean;
  priceMin: number | null; priceMax: number | null; distanceKm: number | null;
  verified: boolean;
  listings: { id: string; title: string; price: number | null }[];
};

interface MarketZonePageProps {
  slug: string;
}

export default function MarketZonePage({ slug }: MarketZonePageProps) {
  const router = useRouter();
  const providerSectionRef = useRef<HTMLDivElement>(null);
  const zoneSectionRef = useRef<HTMLDivElement>(null);

  const [zoneData, setZoneData] = useState<{ name: string; city: string; state: string; phase: number } | null>(null);
  const [localities, setLocalities] = useState<LocalityResponse[]>([]);
  const [categories, setCategories] = useState<ServiceCategoryResponse[]>([]);
  const [localitiesLoading, setLocalitiesLoading] = useState(true);

  const [providers, setProviders] = useState<ProviderCardData[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session?.user) setUser(data.session.user);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(session?.user ?? null);
    });
    return () => listener?.subscription.unsubscribe();
  }, []);

  useEffect(() => {
    async function load() {
      const [zoneRes, locRes, catRes] = await Promise.all([
        fetch(`/api/market/${slug}`).then((r) => r.json()).catch(() => ({ ok: false })) as Promise<MarketZoneResponse>,
        fetch(`/api/localities?phase=1&zone_slug=${slug}`).then((r) => r.json()).catch(() => ({ ok: false, localities: [] })),
        fetch("/api/service-categories").then((r) => r.json()).catch(() => ({ ok: false, categories: [] })),
      ]);

      if (zoneRes.ok) {
        setZoneData({ name: zoneRes.area_name ?? "", city: zoneRes.city ?? "", state: zoneRes.state ?? "", phase: zoneRes.phase ?? 1 });
        if (zoneRes.service_categories) {
          setCategories(zoneRes.service_categories as ServiceCategoryResponse[]);
          setLocalitiesLoading(false);
          setLocalities((locRes as { ok: boolean; localities?: LocalityResponse[] }).localities || []);
          return;
        }
      }

      setZoneData({
        name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
        city: "",
        state: "",
        phase: 1,
      });
      setLocalities((locRes as { ok: boolean; localities?: LocalityResponse[] }).localities || []);
      setCategories((catRes as { ok: boolean; categories?: ServiceCategoryResponse[] }).categories || []);
      setLocalitiesLoading(false);
    }
    void load();
  }, [slug]);

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

  const scrollToProviders = () => {
    providerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToZones = () => {
    zoneSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-[calc(5rem+env(safe-area-inset-bottom))] sm:px-6 lg:pb-20">
      <header className="sticky top-0 z-30 -mx-4 mb-4 border-b border-[var(--surface-border)]/80 bg-[var(--surface-elevated)]/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-3">
          <ServiQLogo href="/" ariaLabel="ServiQ home" />
          <div className="flex items-center gap-2">
            <ZoneSwitcher currentSlug={slug} />
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)]"
              >
                <LayoutDashboard className="h-4 w-4" />
                Dashboard
              </Link>
            ) : (
              <Link
                href="/?signin=true"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--ink-700)] transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
              >
                <LogIn className="h-4 w-4" />
                Sign In
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="mb-10 text-center">
        <div className="flex items-center justify-center gap-1.5 text-xs text-[var(--ink-500)] mb-4">
          <Link href="/" className="hover:text-[var(--brand-700)]">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/market" className="hover:text-[var(--brand-700)]">Markets</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[var(--ink-700)] font-semibold">{zoneData?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
        </div>
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <MapPin className="h-8 w-8 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--ink-950)] sm:text-3xl">
          <span className="text-[var(--brand-700)]">{zoneData?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</span>
          {zoneData?.city && `, ${zoneData.city}`}
        </h1>
        <p className="mt-1 text-xs text-[var(--ink-500)]">
          {zoneData?.state ?? ""}
          {zoneData?.state ? " — Hyperlocal marketplace" : "Hyperlocal marketplace"}
        </p>

        {!localitiesLoading && (
          <div className="mx-auto mt-5 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-3 shadow-sm sm:inline-flex sm:divide-x sm:divide-slate-200">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-700)]">
              <Building2 className="h-3.5 w-3.5 text-[var(--brand-600)]" />
              {societies.length} Societies
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-700)] sm:pl-4">
              <Store className="h-3.5 w-3.5 text-[var(--brand-600)]" />
              {marketZones.length} Markets
            </div>
            <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-700)] sm:pl-4">
              <Users className="h-3.5 w-3.5 text-[var(--brand-600)]" />
              {providers.length} Providers
            </div>
          </div>
        )}

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
            className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-3 text-sm font-bold text-[var(--ink-700)] shadow-sm transition hover:border-[var(--border-strong)]"
          >
            <Users className="h-4 w-4" />
            Browse All Providers
          </button>
        </div>

        {categories.length > 0 && (
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2">
            {categories.slice(0, 12).map((cat) => {
              const Icon = iconMap[cat.icon_slug] || Wrench;
              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => {
                    setSelectedCategory(selectedCategory === cat.name ? null : cat.name);
                    scrollToProviders();
                  }}
                  className={`inline-flex items-center gap-1.5 rounded-xl border min-h-11 px-4 py-2.5 text-xs font-semibold transition ${
                    selectedCategory === cat.name
                      ? "border-[var(--brand-500)] bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : "border-[var(--surface-border)] bg-[var(--surface-elevated)] text-[var(--ink-700)] hover:border-[var(--brand-300)] hover:shadow-sm"
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {cat.name}
                </button>
              );
            })}
          </div>
        )}

        <p className="mx-auto mt-6 max-w-lg text-xs text-[var(--ink-500)] leading-relaxed">
          Covering: {areaList}
        </p>
      </section>

      <section ref={zoneSectionRef} className="mb-10 scroll-mt-24">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--ink-950)]">Browse Local Zones</h2>
          {zoneData?.phase === 2 && (
            <span className="inline-flex items-center gap-1 rounded-full bg-purple-100 px-3 py-1 text-[10px] font-semibold text-purple-700 border border-purple-200">
              <Store className="h-3 w-3" />
              Coming Soon
            </span>
          )}
        </div>
        {zoneData?.phase === 2 ? (
          <div className="rounded-2xl border border-dashed border-purple-200 bg-purple-50/50 p-10 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-purple-400" />
            <h3 className="text-lg font-extrabold text-[var(--ink-950)]">{zoneData.name} is launching soon</h3>
            <p className="mt-1 text-sm text-[var(--ink-500)] max-w-md mx-auto">
              We&apos;re currently mapping all markets and vendors in this zone.
              Check back soon for a complete list of local services.
            </p>
          </div>
        ) : (
          <ZoneBrowser
            initialLocalities={localities}
            loading={localitiesLoading}
            zoneSlug={slug}
          />
        )}
      </section>

      {categories.length > 0 && (
        <section className="mb-10">
          <div className="mb-4">
            <h2 className="text-lg font-extrabold text-[var(--ink-950)]">Services Available</h2>
            <p className="text-xs text-[var(--ink-500)]">Browse by category — standard pricing for {zoneData?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())}</p>
          </div>
          <ServiceCategoryGrid categories={categories as never[]} zoneSlug={slug} />
        </section>
      )}

      <section ref={providerSectionRef} className="scroll-mt-24">
        <div className="mb-4 flex items-center justify-between">
          <p className="text-sm text-[var(--ink-500)]">
            {selectedCategory ? `Showing results for ${selectedCategory}` : "Showing results for all"}
          </p>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] hover:bg-[var(--brand-50)]"
            >
              Clear filter
            </button>
          )}
        </div>

        {providersLoading ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4">
                <div className="flex items-start gap-3">
                  <div className="h-11 w-11 shrink-0 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-soft)]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface-soft)]" />
                  </div>
                </div>
                <div className="mt-3 flex gap-3">
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-soft)]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-soft)]" />
                </div>
                <div className="mt-3 h-3 w-full animate-pulse rounded bg-[var(--surface-soft)]" />
                <div className="mt-4 flex items-center justify-between">
                  <div className="h-4 w-20 animate-pulse rounded bg-[var(--surface-soft)]" />
                  <div className="h-9 w-24 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
                </div>
              </div>
            ))}
          </div>
        ) : (providers ?? []).length > 0 ? (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(providers ?? []).map((provider) => (
              <div key={provider.id} className="h-full">
                <ProviderCard
                  provider={provider}
                  onSelect={(p) => router.push(`/profile/${p.id}`)}
                  onContact={(p) => router.push(`/dashboard/chat?recipientId=${encodeURIComponent(p.id)}`)}
                />
              </div>
            ))}
          </div>
        ) : selectedCategory ? (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)]/50 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-[var(--ink-500)]" />
            <p className="text-sm font-semibold text-[var(--ink-700)]">No providers found nearby</p>
            <p className="mt-1 text-xs text-[var(--ink-500)]">
              Try adjusting your filters or browse all providers
            </p>
            <div className="mt-5 flex items-center justify-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-2 text-xs font-semibold text-[var(--ink-700)] transition hover:border-[var(--border-strong)]"
              >
                <X className="h-3 w-3" />
                Clear Filter
              </button>
            </div>
          </div>
        ) : null}
      </section>

      <section className="mx-auto mt-12 max-w-lg rounded-2xl border border-dashed border-[var(--brand-300)] bg-gradient-to-br from-[var(--brand-50)] to-white p-6 text-center">
        <Store className="mx-auto h-8 w-8 text-[var(--brand-500)]" />
        <h3 className="mt-3 text-lg font-extrabold text-[var(--ink-950)]">Are you a service provider?</h3>
        <p className="mt-1 text-sm text-[var(--ink-500)]">List your business on {appName} and get more customers from your neighborhood.</p>
        <Link
          href="/onboarding/provider/locality"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
        ><Store className="h-4 w-4" /> List Your Business</Link>
      </section>
      <MobileBottomNav />
    </div>
  );
}

function ProviderCard({ provider, onContact, onSelect }: { provider: ProviderCardData; onContact: (p: ProviderCardData) => void; onSelect: (p: ProviderCardData) => void }) {
  const priceLabel = provider.priceMin != null
    ? provider.priceMax != null && provider.priceMax > provider.priceMin
      ? `₹${provider.priceMin} - ₹${provider.priceMax}`
      : `From ₹${provider.priceMin}`
    : null;

  return (
    <div className="group flex h-full flex-col overflow-hidden rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 transition hover:border-[var(--brand-500)]/30 hover:shadow-md hover:shadow-[var(--brand-500)]/5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onSelect(provider)} className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-100)] text-base font-bold text-[var(--brand-700)] transition hover:ring-2 hover:ring-[var(--brand-300)]">
          {provider.name.charAt(0)}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onSelect(provider)} className="w-full text-left">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 truncate text-sm font-bold text-[var(--ink-950)]">{provider.name}</h3>
              {provider.verified && (
                <span className="shrink-0 rounded-full border border-emerald-200 bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600">Verified</span>
              )}
            </div>
            <p className="mt-0.5 truncate text-xs text-[var(--ink-500)]">{provider.location || "Local"}</p>
          </button>
        </div>
      </div>

      <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-500)]">
        {provider.avgRating ? (
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
            {provider.avgRating.toFixed(1)} ({provider.reviewCount})
          </span>
        ) : null}
        {provider.responseMinutes ? (
          <span className="flex items-center gap-1">
            <Zap className="h-3 w-3 text-[var(--brand-500)]" />
            ~{provider.responseMinutes} min
          </span>
        ) : null}
        {provider.completedJobs > 0 && (
          <span className="flex items-center gap-1">
            <CheckCircle2 className="h-3 w-3 text-[var(--ink-500)]" />
            {provider.completedJobs} jobs
          </span>
        )}
      </div>

      {provider.bio && (
        <p className="mt-2 text-xs leading-relaxed text-[var(--ink-500)] line-clamp-2">{provider.bio}</p>
      )}

      <div className="mt-auto flex items-center justify-between pt-3">
        {priceLabel ? (
          <span className="text-sm font-bold text-[var(--brand-700)]">{priceLabel}</span>
        ) : <span />}
        <button
          type="button"
          onClick={() => onContact(provider)}
          className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-2 text-xs font-semibold text-[var(--ink-700)] transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
        >
          <Phone className="h-3.5 w-3.5" />
          Contact
        </button>
      </div>
    </div>
  );
}
