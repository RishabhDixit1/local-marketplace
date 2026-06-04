"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import {
  ArrowRight,
  Building2,
  Loader2,
  MapPin,
  Star,
  Store,
  Users,
  Zap,
  CheckCircle2,
} from "lucide-react";
import { appName } from "@/lib/branding";

type LocalityData = {
  id: string;
  name: string;
  slug: string;
  zone_type: string;
  description: string | null;
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

const CATEGORIES = [
  { label: "Electrician", slug: "electrician", icon: "⚡" },
  { label: "Plumber", slug: "plumber", icon: "🔧" },
  { label: "AC Repair", slug: "ac-repair-service", icon: "❄️" },
  { label: "RO Repair", slug: "ro-water-purifier-repair", icon: "💧" },
  { label: "Carpenter", slug: "carpenter-minor-fitting", icon: "🪚" },
  { label: "Appliance Repair", slug: "appliance-repair", icon: "🔌" },
  { label: "Tailoring", slug: "tailoring-and-alterations", icon: "🧵" },
  { label: "Clothing", slug: "clothing-and-fashion", icon: "👕" },
];

export default function SocietyPage() {
  const params = useParams();
  const societySlug = params.society as string;

  const [locality, setLocality] = useState<LocalityData | null>(null);
  const [allLocalities, setAllLocalities] = useState<LocalityData[]>([]);
  const [providers, setProviders] = useState<ProviderData[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    async function load() {
      try {
        const locRes = await fetch("/api/localities").then((r) => r.json());
        if (!active || !locRes.ok) return;

        const localities: LocalityData[] = locRes.localities || [];
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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (error || !locality) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-20 text-center">
        <Building2 className="mx-auto mb-4 h-12 w-12 text-slate-300" />
        <h1 className="text-xl font-bold text-slate-900">Society not found</h1>
        <p className="mt-2 text-sm text-slate-500">We couldn&apos;t find &ldquo;{societyName}&rdquo;. Try browsing all societies.</p>
        <Link
          href="/market/crossing-republik"
          className="mt-6 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white"
        >
          Browse All Societies <ArrowRight className="h-4 w-4" />
        </Link>
      </div>
    );
  }

  const otherLocalities = allLocalities.filter((l) => l.id !== locality.id).slice(0, 6);

  return (
    <div className="mx-auto min-h-screen w-full max-w-5xl px-4 pb-20 pt-6 sm:px-6 sm:pt-10">
      <div className="mb-6">
        <Link
          href="/market/crossing-republik"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-[var(--brand-700)] hover:text-[var(--brand-500)]"
        >
          <ArrowRight className="h-3 w-3 rotate-180" />
          Back to Crossing Republik
        </Link>
      </div>

      <section className="mb-10 text-center">
        <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <Building2 className="h-8 w-8 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-2xl font-extrabold text-slate-900 sm:text-3xl">
          <span className="text-[var(--brand-700)]">{locality.name}</span>
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          {locality.description || `Local services and providers in ${locality.name}`}
        </p>

        <div className="mx-auto mt-5 inline-flex items-center gap-4 divide-x divide-slate-200 rounded-2xl border border-slate-200 bg-white px-5 py-2.5 shadow-sm">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-700">
            <Users className="h-3.5 w-3.5 text-[var(--brand-600)]" />
            {providers.length} Providers
          </div>
          <div className="flex items-center gap-1.5 pl-4 text-xs font-semibold text-slate-700">
            <MapPin className="h-3.5 w-3.5 text-[var(--brand-600)]" />
            Crossing Republik, Ghaziabad
          </div>
        </div>
      </section>

      <section className="mb-10">
        <h2 className="mb-4 text-lg font-bold text-slate-900">Browse by Category</h2>
        <div className="flex flex-wrap gap-2">
          {CATEGORIES.map((cat) => (
            <Link
              key={cat.slug}
              href={`/market/${locality.slug}/${cat.slug}`}
              className="inline-flex items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-2 text-xs font-semibold text-slate-700 transition hover:border-[var(--brand-300)] hover:shadow-sm"
            >
              <span className="text-sm">{cat.icon}</span>
              {cat.label}
            </Link>
          ))}
        </div>
      </section>

      <section className="mb-10">
        <div className="mb-4 flex items-center justify-between">
          <h2 className="text-lg font-bold text-slate-900">Providers in {locality.name}</h2>
          <Link
            href={`/dashboard/people?locality_id=${locality.id}`}
            className="text-xs font-semibold text-[var(--brand-700)] hover:text-[var(--brand-500)]"
          >
            View All <ArrowRight className="ml-0.5 inline h-3 w-3" />
          </Link>
        </div>

        {providers.length === 0 ? (
          <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
            <Users className="mx-auto mb-3 h-8 w-8 text-slate-300" />
            <p className="text-sm font-semibold text-slate-600">No providers in {locality.name} yet</p>
            <p className="mt-1 text-xs text-slate-400">Check back soon or browse nearby societies.</p>
          </div>
        ) : (
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {providers.slice(0, 12).map((provider) => (
              <Link
                key={provider.id}
                href={`/profile/${provider.id}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[var(--brand-300)] hover:shadow-md"
              >
                <div className="flex items-start gap-3">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-lg font-bold text-[var(--brand-700)]">
                    {provider.name?.charAt(0) || "?"}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <h3 className="text-sm font-bold text-slate-900">{provider.name}</h3>
                        <p className="mt-0.5 text-xs text-slate-500">{provider.location || locality.name}</p>
                      </div>
                      {provider.verified && (
                        <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-200">Verified</span>
                      )}
                    </div>
                    <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-slate-500">
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
                          <CheckCircle2 className="h-3 w-3 text-slate-400" />
                          {provider.completed_jobs} jobs
                        </span>
                      )}
                    </div>
                    {provider.bio && (
                      <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2">{provider.bio}</p>
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
          <h2 className="mb-4 text-lg font-bold text-slate-900">Nearby Societies</h2>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {otherLocalities.map((l) => (
              <Link
                key={l.id}
                href={`/market/${l.slug}`}
                className="rounded-2xl border border-slate-200 bg-white p-4 transition hover:border-[var(--brand-300)]"
              >
                <div className="flex items-center gap-2">
                  <MapPin className="h-4 w-4 text-slate-400" />
                  <span className="text-sm font-semibold text-slate-900">{l.name}</span>
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
        <h3 className="mt-3 text-lg font-bold text-slate-900">Are you a service provider in {locality.name}?</h3>
        <p className="mt-1 text-sm text-slate-500">List your business on {appName} and get customers from your neighborhood.</p>
        <Link
          href="/onboarding/provider/locality"
          className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
        ><Store className="h-4 w-4" /> List Your Business</Link>
      </section>
    </div>
  );
}
