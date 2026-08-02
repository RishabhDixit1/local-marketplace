"use client";

import Link from "next/link";
import Image from "next/image";
import { useParams } from "next/navigation";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";
import { CartProvider } from "@/app/components/store/CartContext";
import { CartDrawer } from "@/app/components/store/CartDrawer";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  ChevronRight,
  Loader2,
  MapPin,
  Star,
  Store,
  Users,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { PageMeta } from "@/app/components/PageMeta";
import { appName } from "@/lib/branding";

type LocalityData = {
  id: string;
  name: string;
  slug: string;
  zone_type: string;
  description: string | null;
  city: string;
  state: string;
  zone_slug: string | null;
};

type ProviderData = {
  id: string;
  name: string;
  location: string;
  avatar_url: string;
  bio: string;
  services: string[];
  avg_rating: number | null;
  review_count: number;
  completed_jobs: number;
  response_minutes: number | null;
  price_min: number | null;
  price_max: number | null;
  verified: boolean;
};

export default function SocietyPage() {
  const params = useParams();
  const societySlug = params.society as string;

  const [locality, setLocality] = useState<LocalityData | null>(null);
  const [allLocalities, setAllLocalities] = useState<LocalityData[]>([]);
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const getZoneHref = () => {
    if (!locality) return "/market";
    if (locality.zone_slug) return `/market/zone/${locality.zone_slug}`;
    return "/market";
  };

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const locRes = await fetch("/api/localities").then((r) => r.json());
        if (!active) return;

        const localities: LocalityData[] = locRes.ok ? (locRes.localities || []) : [];
        const match = localities.find(
          (l: LocalityData) => l.slug === societySlug || l.name.toLowerCase().replace(/\s+/g, "-") === societySlug
        );
        if (!match) {
          if (active) setError("Society not found");
          return;
        }

        setLocality(match);
        setAllLocalities(localities.filter((l: LocalityData) => l.zone_type === "society"));

        const provRes = await fetch(`/api/localities/${match.id}/providers?limit=50`).then((r) => r.json());
        if (active && provRes.ok) {
          setProviders(provRes.providers || []);
        }
      } catch {
        if (active) setError("Failed to load data");
      } finally {
        if (active) setLoading(false);
      }
    }
    void load();
    return () => { active = false; };
  }, [societySlug]);

  const societyName = locality?.name || societySlug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
  const zoneHref = getZoneHref();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-[var(--ink-500)]" />
      </div>
    );
  }

  if (error || !locality) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--surface-soft)]">
          <Building2 className="h-8 w-8 text-[var(--ink-500)]" />
        </div>
        <h1 className="text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>Society not found</h1>
        <p className="mt-2 text-sm text-[var(--ink-500)]">We couldn&apos;t find &ldquo;{societyName}&rdquo;. Try browsing all societies.</p>
        <Link
          href={zoneHref}
          className="nameplate-card mt-6 inline-flex items-center gap-2 !border-[var(--brand-900)] !bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition-all hover:!bg-[var(--brand-800)]"
        >
          Browse All Societies <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const otherLocalities = allLocalities.filter((l) => l.id !== locality.id).slice(0, 6);

  const zoneName = locality.zone_slug
    ? locality.zone_slug.replace(/-/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
    : locality.city || "Market";

  return (
    <CartProvider>
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-[calc(9rem+env(safe-area-inset-bottom))] pt-6 sm:px-6 sm:pt-10 lg:pb-20">
      <PageMeta title={societyName} description={`Local services and products available in ${societyName}, ${locality.city}`} path={`/market/${params.society}`} />
      <div className="mb-4 flex items-center text-xs text-[var(--ink-500)]">
        <span className="hidden sm:inline-flex items-center gap-1.5">
          <Link href="/market" className="hover:text-[var(--brand-700)]">Home</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href="/market" className="hover:text-[var(--brand-700)]">Markets</Link>
          <ChevronRight className="h-3 w-3" />
          <Link href={zoneHref} className="hover:text-[var(--brand-700)]">{zoneName}</Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-[var(--ink-700)] font-semibold">{locality.name}</span>
        </span>
        <Link href={zoneHref} className="sm:hidden inline-flex items-center gap-1.5 hover:text-[var(--brand-700)]">
          <ChevronRight className="h-3 w-3 rotate-180" /> {zoneName}
        </Link>
      </div>
      <div className="mb-6">
        <Link
          href={zoneHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-500)]"
        >
          <ArrowRight className="h-3 w-3 rotate-180" />
          Back to {zoneName}
        </Link>
      </div>

      <section className="nameplate-hero -mx-4 mb-10 rounded-b-[28px] px-4 pt-8 pb-10 text-center sm:-mx-6 sm:px-6">
        <div className="relative z-10">
          <div className="mx-auto mb-5 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-900)] shadow-lg">
            <Building2 className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-normal text-[var(--ink-950)] sm:text-4xl" style={{ fontFamily: "var(--font-display)" }}>
            {locality.name}
          </h1>
          <p className="mt-2 text-sm text-[var(--ink-500)]">
            {locality.description || `Local services and providers in ${locality.name}`}
          </p>

          <div className="nameplate-stat-bar mx-auto mt-6">
            <div className="nameplate-stat-item">
              <Users className="h-4 w-4 text-[var(--brand-600)]" />
              <span className="font-bold text-[var(--ink-950)]">{providers.length}</span>
              <span className="text-[var(--ink-500)]">Providers</span>
            </div>
            <div className="nameplate-stat-item">
              <MapPin className="h-4 w-4 text-[var(--brand-600)]" />
              <span className="font-bold text-[var(--ink-950)]">{locality.city || "Local"}</span>
              <span className="text-[var(--ink-500)]">{locality.state || ""}</span>
            </div>
          </div>
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>Providers in {locality.name}</h2>
          <Link
            href={`/dashboard/people?locality_id=${locality.id}`}
            className="text-xs font-semibold text-[var(--brand-700)] transition hover:text-[var(--brand-500)]"
          >
            View All <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </div>

        {providers.length === 0 ? (
          <div className="nameplate-card !border-dashed bg-[var(--surface-soft)]/50 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-[var(--ink-500)]" />
            <p className="text-sm font-semibold text-[var(--ink-700)]">No providers in {locality.name} yet</p>
            <p className="mt-1 text-xs text-[var(--ink-500)]">Check back soon or browse nearby societies.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {providers.slice(0, 12).map((provider) => (
              <Link
                key={provider.id}
                href={`/profile/${provider.id}`}
                className="nameplate-card group flex flex-col overflow-hidden p-4 pt-5"
              >
                <div className="flex items-start gap-3">
                  {provider.avatar_url ? (
                    <Image
                      src={provider.avatar_url}
                      alt={provider.name}
                      width={48}
                      height={48}
                      className="h-12 w-12 shrink-0 rounded-xl object-cover ring-2 ring-[var(--surface-soft)] transition group-hover:ring-[var(--brand-300)]"
                    />
                  ) : (
                    <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-lg font-semibold text-[var(--brand-700)] ring-2 ring-[var(--surface-soft)] transition group-hover:ring-[var(--brand-300)]">
                      {provider.name?.charAt(0) || "?"}
                    </div>
                  )}
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <h3 className="truncate text-sm font-semibold text-[var(--ink-950)] group-hover:text-[var(--brand-700)] transition-colors">{provider.name}</h3>
                        <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-500)]">
                          <MapPin className="h-3 w-3 shrink-0" />
                          <span className="truncate">{provider.services?.[0] || provider.location || "Local provider"}</span>
                        </p>
                      </div>
                      {provider.verified && (
                        <span className="nameplate-badge shrink-0 !bg-emerald-50 !text-emerald-600 !border-emerald-200">Verified</span>
                      )}
                    </div>
                    <div className="mt-2.5 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-500)] tabular-nums">
                      {provider.avg_rating ? (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-[var(--marigold-400)]" fill="currentColor" />
                          <span className="font-semibold text-[var(--ink-700)]">{provider.avg_rating.toFixed(1)}</span>
                          <span>({provider.review_count})</span>
                        </span>
                      ) : null}
                      {provider.response_minutes ? (
                        <span className="flex items-center gap-1">
                          <Zap className="h-3 w-3 text-[var(--brand-500)]" />
                          {provider.response_minutes} min
                        </span>
                      ) : null}
                      {provider.completed_jobs > 0 && (
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-[var(--ink-500)]" />
                          {provider.completed_jobs} jobs
                        </span>
                      )}
                    </div>
                    {provider.bio && (
                      <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-500)] line-clamp-2">{provider.bio}</p>
                    )}
                  </div>
                </div>
                <div className="mt-auto flex items-center justify-between border-t border-[var(--surface-border)]/60 pt-3">
                  {provider.price_min != null ? (
                    <span className="text-sm font-bold text-[var(--brand-700)] tabular-nums">
                      {provider.price_max != null && provider.price_max > provider.price_min
                        ? `₹${provider.price_min} – ₹${provider.price_max}`
                        : `From ₹${provider.price_min}`}
                    </span>
                  ) : <span />}
                  <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-700)]">
                    View Profile <ArrowRight className="h-3 w-3" />
                  </span>
                </div>
              </Link>
            ))}
          </div>
        )}
      </section>

      {otherLocalities.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-5 text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>Nearby Societies</h2>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {otherLocalities.map((l) => (
              <Link
                key={l.id}
                href={`/market/${l.slug}`}
                className="nameplate-card group block p-4 pt-5"
              >
                <div className="flex items-center gap-2">
                  <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-[var(--brand-50)]">
                    <MapPin className="h-4 w-4 text-[var(--brand-600)]" />
                  </div>
                  <span className="text-sm font-semibold text-[var(--ink-950)] group-hover:text-[var(--brand-700)] transition-colors">{l.name}</span>
                </div>
                <span className="mt-2 inline-flex items-center text-xs font-semibold text-[var(--brand-700)]">
                  Browse providers <ArrowRight className="ml-1 h-3 w-3 transition-transform group-hover:translate-x-0.5" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="nameplate-card p-6 text-center !bg-gradient-to-br !from-[var(--brand-50)] !to-white">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-900)] shadow-md">
          <Store className="h-6 w-6 text-white" />
        </div>
        <h3 className="text-lg font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>Are you a service provider in {locality.name}?</h3>
        <p className="mt-1 text-sm text-[var(--ink-500)]">List your business on {appName} and get customers from your neighborhood.</p>
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
