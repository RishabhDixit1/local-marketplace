"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";
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
import type { ServiceCategoryResponse } from "@/app/api/service-categories/route";

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
  const [categories, setCategories] = useState<ServiceCategoryResponse[]>([]);
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
        const [locRes, catRes] = await Promise.all([
          fetch("/api/localities").then((r) => r.json()),
          fetch("/api/service-categories").then((r) => r.json()),
        ]);
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
        setCategories(catRes.ok ? (catRes.categories || []) : []);

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
        <Building2 className="mx-auto mb-4 h-12 w-12 text-[var(--ink-500)]" />
        <h1 className="text-xl font-extrabold text-[var(--ink-950)]">Society not found</h1>
        <p className="mt-2 text-sm text-[var(--ink-500)]">We couldn&apos;t find &ldquo;{societyName}&rdquo;. Try browsing all societies.</p>
        <Link
          href={zoneHref}
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white"
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
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10 lg:pb-20">
      <PageMeta title={societyName} description={`Local services and products available in ${societyName}, ${locality.city}`} path={`/market/${params.society}`} />
      <div className="mb-4 flex items-center gap-1.5 text-xs text-[var(--ink-500)]">
        <Link href="/" className="hover:text-[var(--brand-700)]">Home</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href="/market" className="hover:text-[var(--brand-700)]">Markets</Link>
        <ChevronRight className="h-3 w-3" />
        <Link href={zoneHref} className="hover:text-[var(--brand-700)]">{zoneName}</Link>
        <ChevronRight className="h-3 w-3" />
        <span className="text-[var(--ink-700)] font-semibold">{locality.name}</span>
      </div>
      <div className="mb-6">
        <Link
          href={zoneHref}
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-700)] hover:text-[var(--brand-500)]"
        >
          <ArrowRight className="h-3 w-3 rotate-180" />
          Back to {zoneName}
        </Link>
      </div>

      <section className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <Building2 className="h-8 w-8 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-2xl font-extrabold text-[var(--ink-950)] sm:text-3xl">
          <span className="text-[var(--brand-700)]">{locality.name}</span>
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-500)]">
          {locality.description || `Local services and providers in ${locality.name}`}
        </p>

        <div className="mx-auto mt-5 inline-flex items-center gap-4 divide-x divide-slate-200 rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-5 py-2.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--ink-700)]">
            <Users className="h-3.5 w-3.5 text-[var(--brand-600)]" />
            {providers.length} Providers
          </div>
          <div className="flex items-center gap-1.5 pl-4 text-xs font-semibold text-[var(--ink-700)]">
            <MapPin className="h-3.5 w-3.5 text-[var(--brand-600)]" />
            {locality.city || "Local"}, {locality.state || ""}
          </div>
        </div>
      </section>

      {categories.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-extrabold text-[var(--ink-950)]">Browse by Category</h2>
          <div className="flex flex-wrap gap-2">
            {categories.slice(0, 12).map((cat) => (
              <Link
                key={cat.id}
                href={`/market/${locality.slug}/${cat.slug}`}
                className="inline-flex items-center gap-1.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-3.5 py-2 text-xs font-semibold text-[var(--ink-700)] transition hover:border-[var(--brand-300)] hover:shadow-sm"
              >
                {cat.icon_slug && <span className="text-sm">{cat.icon_slug}</span>}
                {cat.name}
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-extrabold text-[var(--ink-950)]">Providers in {locality.name}</h2>
          <Link
            href={`/dashboard/people?locality_id=${locality.id}`}
            className="text-xs font-semibold text-[var(--brand-700)] hover:text-[var(--brand-500)]"
          >
            View All <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </div>

        {providers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-[var(--surface-border)] bg-[var(--surface-soft)]/50 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-[var(--ink-500)]" />
            <p className="text-sm font-semibold text-[var(--ink-700)]">No providers in {locality.name} yet</p>
            <p className="mt-1 text-xs text-[var(--ink-500)]">Check back soon or browse nearby societies.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.slice(0, 12).map((provider) => (
              <Link
                key={provider.id}
                href={`/profile/${provider.id}`}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 transition hover:border-[var(--brand-300)] hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-lg font-semibold text-[var(--brand-700)]">
                    {provider.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-extrabold text-[var(--ink-950)]">{provider.name}</h3>
                        <p className="mt-0.5 text-xs text-[var(--ink-500)]">{provider.location || locality.name}</p>
                      </div>
                      {provider.verified && (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-200">Verified</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-500)]">
                      {provider.avg_rating ? (
                        <span className="flex items-center gap-1">
                          <Star className="h-3 w-3 text-amber-400" fill="currentColor" />
                          {provider.avg_rating.toFixed(1)} ({provider.review_count})
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
              </Link>
            ))}
          </div>
        )}
      </section>

      {otherLocalities.length > 0 && (
        <section className="mb-10">
          <h2 className="mb-4 text-lg font-extrabold text-[var(--ink-950)]">Nearby Societies</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherLocalities.map((l) => (
              <Link
                key={l.id}
                href={`/market/${l.slug}`}
                className="rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-4 transition hover:border-[var(--brand-300)]"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-[var(--ink-500)]" />
                  <span className="text-sm font-semibold text-[var(--ink-950)]">{l.name}</span>
                </div>
                <span className="mt-1.5 inline-flex items-center text-xs text-[var(--brand-700)]">
                  Browse providers <ArrowRight className="ml-1 h-3 w-3" />
                </span>
              </Link>
            ))}
          </div>
        </section>
      )}

      <section className="rounded-2xl border border-dashed border-[var(--brand-300)] bg-gradient-to-br from-[var(--brand-50)] to-white p-6 text-center">
        <Store className="mx-auto h-8 w-8 text-[var(--brand-500)]" />
        <h3 className="mt-3 text-lg font-extrabold text-[var(--ink-950)]">Are you a service provider in {locality.name}?</h3>
        <p className="mt-1 text-sm text-[var(--ink-500)]">List your business on {appName} and get customers from your neighborhood.</p>
        <Link
          href="/onboarding/provider/locality"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
        ><Store className="h-4 w-4" /> List Your Business</Link>
      </section>
      <MobileBottomNav />
    </div>
  );
}
