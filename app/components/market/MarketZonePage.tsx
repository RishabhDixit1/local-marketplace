"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter } from "next/navigation";
import {
  Building2,
  ChevronRight,
  LayoutDashboard,
  LogIn,
  MapPin,
  Phone,
  ShoppingCart,
  Star,
  Store,
  Users,
  Zap,
  CheckCircle2,
  Sparkles,
  ArrowRight,
} from "lucide-react";
import ZoneBrowser from "@/app/components/locality/ZoneBrowser";
import ZoneSwitcher from "@/app/components/market/ZoneSwitcher";
import ServiQLogo from "@/app/components/ServiQLogo";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";
import { CartProvider, useCart } from "@/app/components/store/CartContext";
import { CartDrawer } from "@/app/components/store/CartDrawer";
import { appName } from "@/lib/branding";
import { supabase } from "@/lib/supabase";
import type { LocalityResponse } from "@/app/api/localities/route";
import type { User } from "@supabase/supabase-js";
import type { MarketZoneResponse } from "@/app/api/market/[slug]/route";

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
  const [localitiesLoading, setLocalitiesLoading] = useState(true);

  const [providers, setProviders] = useState<ProviderCardData[]>([]);
  const [providersLoading, setProvidersLoading] = useState(true);
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
      const [zoneRes, locRes] = await Promise.all([
        fetch(`/api/market/${slug}`).then((r) => r.json()).catch(() => ({ ok: false })) as Promise<MarketZoneResponse>,
        fetch(`/api/localities?phase=1&zone_slug=${slug}`).then((r) => r.json()).catch(() => ({ ok: false, localities: [] })),
      ]);

      if (zoneRes.ok) {
        setZoneData({ name: zoneRes.area_name ?? "", city: zoneRes.city ?? "", state: zoneRes.state ?? "", phase: zoneRes.phase ?? 1 });
      } else {
        setZoneData({
          name: slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
          city: "",
          state: "",
          phase: 1,
        });
      }
      setLocalities((locRes as { ok: boolean; localities?: LocalityResponse[] }).localities || []);
      setLocalitiesLoading(false);
    }
    void load();
  }, [slug]);

  useEffect(() => {
    let active = true;
    const loadProviders = async () => {
      setProvidersLoading(true);
      try {
        const res = await fetch(`/api/community/providers-by-category`);
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
  }, []);

  const societies = localities.filter((l) => l.zone_type === "society");
  const marketZones = localities.filter((l) => l.zone_type === "market");

  const scrollToProviders = () => {
    providerSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const scrollToZones = () => {
    zoneSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  const zoneDisplayName = zoneData?.name ?? slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());

  return (
    <CartProvider>
      <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] sm:px-6 lg:pb-20">
      <header className="sticky top-0 z-30 -mx-4 mb-0 border-b border-[var(--surface-border)]/80 bg-[var(--surface-elevated)]/95 px-4 backdrop-blur-md sm:-mx-6 sm:px-6">
        <div className="mx-auto flex max-w-5xl items-center justify-between py-3">
          <ServiQLogo href="/" ariaLabel="ServiQ home" />
          <div className="flex items-center gap-2">
            <ZoneSwitcher currentSlug={slug} />
            {user ? (
              <Link
                href="/dashboard"
                className="inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-3 py-2 text-sm font-semibold text-white transition hover:bg-[var(--brand-800)] sm:px-4"
              >
                <LayoutDashboard className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Dashboard</span>
              </Link>
            ) : (
              <Link
                href="/?signin=true"
                className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-3 py-2 text-sm font-semibold text-[var(--ink-700)] transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)] sm:px-4"
              >
                <LogIn className="h-4 w-4 shrink-0" />
                <span className="hidden sm:inline">Sign In</span>
              </Link>
            )}
          </div>
        </div>
      </header>

      <section className="nameplate-hero -mx-4 mb-10 rounded-b-[28px] px-4 pt-8 pb-10 text-center sm:-mx-6 sm:px-6">
        <div className="relative z-10">
          <div className="mb-5 flex items-center justify-center text-xs text-[var(--ink-500)]">
            <Link href="/market" className="hidden sm:inline-flex items-center gap-1.5 hover:text-[var(--brand-700)]">
              Home <ChevronRight className="h-3 w-3" /> Markets <ChevronRight className="h-3 w-3" /> <span className="text-[var(--ink-700)] font-semibold">{zoneDisplayName}</span>
            </Link>
            <Link href="/market" className="sm:hidden inline-flex items-center gap-1.5 hover:text-[var(--brand-700)]">
              <ChevronRight className="h-3 w-3 rotate-180" /> Markets
            </Link>
          </div>

          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-900)] shadow-lg">
            <MapPin className="h-8 w-8 text-white" />
          </div>

          <h1 className="text-3xl font-normal text-[var(--ink-950)] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
            {zoneDisplayName}
            {zoneData?.city && <span className="text-[var(--ink-500)]">, {zoneData.city}</span>}
          </h1>
          <p className="mt-1.5 text-xs text-[var(--ink-500)]">
            {zoneData?.state ?? ""}{zoneData?.state ? " — " : ""}Hyperlocal marketplace
          </p>

          {!localitiesLoading && (
            <div className="nameplate-stat-bar mx-auto mt-6">
              <div className="nameplate-stat-item">
                <Building2 className="h-4 w-4 text-[var(--brand-600)]" />
                <span className="font-bold text-[var(--ink-950)]">{societies.length}</span>
                <span className="text-[var(--ink-500)]">Societies</span>
              </div>
              <div className="nameplate-stat-item">
                <Store className="h-4 w-4 text-[var(--brand-600)]" />
                <span className="font-bold text-[var(--ink-950)]">{marketZones.length}</span>
                <span className="text-[var(--ink-500)]">Markets</span>
              </div>
              <div className="nameplate-stat-item">
                <Users className="h-4 w-4 text-[var(--brand-600)]" />
                <span className="font-bold text-[var(--ink-950)]">{providers.length}</span>
                <span className="text-[var(--ink-500)]">Providers</span>
              </div>
            </div>
          )}

          <div className="mx-auto mt-6 flex max-w-md flex-col gap-2.5 sm:flex-row">
            <button
              type="button"
              onClick={scrollToZones}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl !border-[var(--brand-900)] !bg-[var(--brand-900)] px-5 py-3 text-sm font-bold text-white shadow-md transition-all hover:!bg-[var(--brand-800)] hover:!border-[var(--brand-800)]"
            >
              <Store className="h-4 w-4" />
              View Market
            </button>
            <button
              type="button"
              onClick={scrollToProviders}
              className="flex flex-1 items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-3 text-sm font-bold text-[var(--ink-700)] transition-all hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
            >
              <Users className="h-4 w-4" />
              Browse All Providers
            </button>
          </div>
        </div>
      </section>

      <section ref={zoneSectionRef} className="mb-10 scroll-mt-24">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>Browse Local Zones</h2>
          {zoneData?.phase === 2 && (
            <span className="nameplate-badge nameplate-badge-soon">
              <Store className="h-3 w-3" />
              Coming Soon
            </span>
          )}
        </div>
        {zoneData?.phase === 2 ? (
          <div className="nameplate-card !border-dashed !border-[var(--sage-200)] bg-[var(--sage-50)] p-10 text-center">
            <Store className="mx-auto mb-3 h-10 w-10 text-[var(--sage-400)]" />
            <h3 className="text-lg font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>{zoneData.name} is launching soon</h3>
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

      <section ref={providerSectionRef} className="scroll-mt-24">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>Providers</h2>
        </div>

        {providersLoading ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <div key={i} className="nameplate-card animate-pulse p-4 pt-6">
                <div className="flex items-start gap-3">
                  <div className="h-12 w-12 shrink-0 animate-pulse rounded-xl bg-[var(--surface-soft)]" />
                  <div className="flex-1 space-y-2">
                    <div className="h-4 w-3/4 animate-pulse rounded bg-[var(--surface-soft)]" />
                    <div className="h-3 w-1/2 animate-pulse rounded bg-[var(--surface-soft)]" />
                  </div>
                </div>
                <div className="mt-3 flex gap-3">
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-soft)]" />
                  <div className="h-3 w-16 animate-pulse rounded bg-[var(--surface-soft)]" />
                </div>
              </div>
            ))}
          </div>
        ) : (providers ?? []).length > 0 ? (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
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
        ) : (
          <div className="nameplate-card !border-dashed bg-[var(--surface-soft)]/50 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-[var(--ink-500)]" />
            <p className="text-sm font-semibold text-[var(--ink-700)]">No providers listed yet</p>
            <p className="mt-1 text-xs text-[var(--ink-500)]">
              Check back soon or try browsing nearby societies.
            </p>
          </div>
        )}
      </section>

      <section className="nameplate-card mx-auto mt-12 max-w-lg p-6 text-center !bg-gradient-to-br !from-[var(--brand-50)] !to-white">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-900)] shadow-md">
          <Store className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-lg font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>Are you a service provider?</h3>
        <p className="mt-1 text-sm text-[var(--ink-500)]">List your business on {appName} and get more customers from your neighborhood.</p>
        <Link
          href="/onboarding/provider/locality"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
        ><Store className="h-4 w-4" /> List Your Business</Link>
      </section>
      <CartDrawer />
      <MobileBottomNav />
      </div>
    </CartProvider>
  );
}

function ProviderCard({ provider, onContact, onSelect }: { provider: ProviderCardData; onContact: (p: ProviderCardData) => void; onSelect: (p: ProviderCardData) => void }) {
  const { addItem } = useCart();
  const topListings = (provider.listings || []).slice(0, 3);

  return (
    <div className="nameplate-card group flex h-full flex-col overflow-hidden p-4 pt-5">
      <div className="flex items-start gap-3">
        {provider.avatarUrl ? (
          <Image
            src={provider.avatarUrl}
            alt={provider.name}
            width={48}
            height={48}
            className="h-12 w-12 shrink-0 rounded-xl object-cover ring-2 ring-[var(--surface-soft)] transition group-hover:ring-[var(--brand-300)]"
          />
        ) : (
          <button type="button" onClick={() => onSelect(provider)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-lg font-bold text-[var(--brand-700)] ring-2 ring-[var(--surface-soft)] transition-all hover:ring-[var(--brand-300)] hover:bg-[var(--brand-100)]">
            {provider.name.charAt(0)}
          </button>
        )}
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onSelect(provider)} className="w-full text-left">
            <div className="flex items-start justify-between gap-2">
              <h3 className="min-w-0 truncate text-sm font-semibold text-[var(--ink-950)] group-hover:text-[var(--brand-700)] transition-colors">{provider.name}</h3>
              {provider.verified && (
                <span className="nameplate-badge shrink-0 !bg-emerald-50 !text-emerald-600 !border-emerald-200">Verified</span>
              )}
            </div>
            <p className="mt-0.5 flex items-center gap-1 truncate text-xs text-[var(--ink-500)]">
              <MapPin className="h-3 w-3 shrink-0" />
              {provider.location || "Local"}
            </p>
          </button>
        </div>
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-500)] tabular-nums">
        {provider.avgRating ? (
          <span className="flex items-center gap-1">
            <Star className="h-3 w-3 text-[var(--marigold-400)]" fill="currentColor" />
            <span className="font-semibold text-[var(--ink-700)]">{provider.avgRating.toFixed(1)}</span>
            <span>({provider.reviewCount})</span>
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

      {topListings.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-[var(--surface-border)]/60 pt-3">
          {topListings.map((listing) => (
            <div key={listing.id} className="flex items-center justify-between gap-2">
              <span className="min-w-0 truncate text-xs font-medium text-[var(--ink-700)]">{listing.title}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                {listing.price != null && (
                  <>
                    <span className="text-xs font-bold text-[var(--brand-700)] tabular-nums">₹{listing.price}</span>
                    <button
                      type="button"
                      onClick={() => addItem({ itemType: "service", itemId: listing.id, providerId: provider.id, providerName: provider.name, title: listing.title, price: listing.price! })}
                      className="inline-flex items-center gap-1 rounded-lg bg-[var(--brand-900)] px-2.5 py-1 text-[10px] font-semibold text-white transition hover:bg-[var(--brand-700)]"
                    >
                      <ShoppingCart className="h-2.5 w-2.5" /> Add
                    </button>
                  </>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className="mt-auto flex items-center justify-between pt-3 border-t border-[var(--surface-border)]/60">
        <button
          type="button"
          onClick={() => onSelect(provider)}
          className="inline-flex items-center gap-1 text-xs font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-500)]"
        >
          View Profile <ArrowRight className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={() => onContact(provider)}
          className="nameplate-card !rounded-xl !px-4 !py-2 text-xs font-semibold text-[var(--ink-700)] transition-all hover:!border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
        >
          <Phone className="h-3.5 w-3.5 inline mr-1.5" />
          Contact
        </button>
      </div>
    </div>
  );
}
