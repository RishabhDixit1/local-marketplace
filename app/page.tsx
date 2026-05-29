"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowRight,
  CheckCircle2,
  ShieldCheck,
  MapPin,
  X,
  Star,
  Search,
  Phone,
  LogIn,
  Zap,
  Store,
  Loader2,
} from "lucide-react";
import { supabase } from "../lib/supabase";
import ServiQLogo from "@/app/components/ServiQLogo";
import { appName } from "@/lib/branding";
import {
  CROSSINGS_REPUBLIK_COORDS,
  LOCAL_SOCIETIES,
} from "@/lib/demo/crossings-republik";

interface ProviderCardData {
  id: string; name: string; location: string; lat: number | null; lng: number | null;
  avatarUrl: string; bio: string; role: string; services: string[];
  avgRating: number | null; reviewCount: number; serviceCount: number;
  completedJobs: number; responseMinutes: number | null; isOnline: boolean;
  priceMin: number | null; priceMax: number | null; distanceKm: number | null;
  verified: boolean;
  listings: { id: string; title: string; price: number | null }[];
}

const isEmailLike = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const CATEGORIES = [
  { label: "Electrician", icon: "⚡", color: "bg-yellow-50 text-yellow-700 border-yellow-200" },
  { label: "Plumber", icon: "🔧", color: "bg-blue-50 text-blue-700 border-blue-200" },
  { label: "AC Repair", icon: "❄️", color: "bg-cyan-50 text-cyan-700 border-cyan-200" },
  { label: "RO Repair", icon: "💧", color: "bg-teal-50 text-teal-700 border-teal-200" },
  { label: "Carpenter", icon: "🪚", color: "bg-amber-50 text-amber-700 border-amber-200" },
  { label: "Appliance Repair", icon: "🔌", color: "bg-rose-50 text-rose-700 border-rose-200" },
  { label: "Mobile Repair", icon: "📱", color: "bg-indigo-50 text-indigo-700 border-indigo-200" },
  { label: "Bike Repair", icon: "🏍️", color: "bg-orange-50 text-orange-700 border-orange-200" },
  { label: "Hardware Shop", icon: "🏪", color: "bg-emerald-50 text-emerald-700 border-emerald-200" },
  { label: "Electrical Shop", icon: "💡", color: "bg-violet-50 text-violet-700 border-violet-200" },
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
                <span className="shrink-0 rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-200">
                  Verified
                </span>
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
              <p className="mt-1.5 text-xs leading-relaxed text-slate-500 line-clamp-2">
                {provider.bio}
              </p>
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

type MagicLinkData = { actionLink: string; emailOtp: string; email: string };

export default function PublicLandingPage() {
  const router = useRouter();
  const [showAuth, setShowAuth] = useState(false);
  const [emailAddress, setEmailAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [magicLinkData, setMagicLinkData] = useState<MagicLinkData | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [contactProvider, setContactProvider] = useState<ProviderCardData | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderCardData | null>(null);
  const [realProviders, setRealProviders] = useState<ProviderCardData[]>([]);
  const [realProvidersLoading, setRealProvidersLoading] = useState(true);
  const [realProvidersError, setRealProvidersError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);
  const contactProviderRef = useRef(contactProvider);
  contactProviderRef.current = contactProvider;

  useEffect(() => {
    let active = true;
    setRealProvidersError(null);
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);
    fetch(`/api/community/providers-by-category${params.toString() ? `?${params.toString()}` : ""}`)
      .then((r) => { if (!r.ok) throw new Error(`Request failed (${r.status})`); return r.json(); })
      .then((data) => {
        if (!active) return;
        setRealProviders((data.providers || []) as ProviderCardData[]);
      })
      .catch((err) => {
        if (!active) return;
        setRealProviders([]);
        setRealProvidersError(err instanceof Error ? err.message : "Something went wrong");
      })
      .finally(() => {
        if (active) setRealProvidersLoading(false);
      });
    return () => { active = false; };
  }, [selectedCategory, retryCount]);

  const providers = useMemo(() => {
    const list = realProviders.length > 0 ? realProviders : [];
    if (searchQuery.trim()) {
      const q = searchQuery.toLowerCase();
      return list.filter(
        (p) =>
          p.name.toLowerCase().includes(q) ||
          (p.bio && p.bio.toLowerCase().includes(q)) ||
          (p.services && p.services.some((s: string) => s.toLowerCase().includes(q)))
      );
    }
    return list;
  }, [searchQuery, realProviders]);

  const completeAuth = useCallback(
    async (user: User) => {
      const { ensureProfileForUser, resolveCurrentProfileDestination } = await import("@/lib/profile/client");
      const profile = await ensureProfileForUser(user).catch(() => null);
      const target = contactProviderRef.current
        ? `/dashboard?providerId=${contactProviderRef.current.id}`
        : resolveCurrentProfileDestination(profile);
      setShowAuth(false);
      setContactProvider(null);
      setSelectedProvider(null);
      router.replace(target);
    },
    [router]
  );

  useEffect(() => {
    let active = true;
    const bootstrapSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!active || !session?.user) return;
      await completeAuth(session.user);
    };
    void bootstrapSession();
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (!active) return;
      if (event === "SIGNED_IN" && session?.user) {
        void completeAuth(session.user);
      }
    });
    return () => { active = false; subscription.unsubscribe(); };
  }, [completeAuth]);

  const sendEmailLink = async () => {
    setErrorMessage("");
    setInfoMessage("");
    setMagicLinkData(null);
    const email = emailAddress.trim().toLowerCase();
    if (!isEmailLike(email)) { setErrorMessage("Enter a valid email address."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; emailSent?: boolean; actionLink?: string; emailOtp?: string; message?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || "Unable to send magic link.");
      if (payload.emailSent === false) {
        setMagicLinkData({ actionLink: payload.actionLink!, emailOtp: payload.emailOtp!, email });
        setInfoMessage(payload.message || "Use the link or code below to sign in.");
      } else {
        setInfoMessage(`Magic link sent to ${email}. Open the email to continue.`);
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send magic link.";
      if (/rate|too many/i.test(message)) setErrorMessage("Too many requests. Wait 60 seconds.");
      else setErrorMessage(message);
    } finally { setLoading(false); }
  };

  const emailLinkSent = infoMessage.startsWith("Magic link sent") || magicLinkData !== null;

  return (
    <div className="relative min-h-screen bg-white">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-slate-200/80 bg-white/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ServiQLogo href="/" ariaLabel="ServiQ home" />
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[var(--brand-50)] px-3 py-1.5 text-[11px] font-medium text-[var(--brand-700)]">
              <MapPin className="h-3.5 w-3.5" />
              {CROSSINGS_REPUBLIK_COORDS.label}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => { setShowAuth(true); setContactProvider(null); }}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
            >
              <LogIn className="h-4 w-4" />
              Sign In
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 pb-16 sm:px-6 lg:px-8">
        {/* ── Dismissible "How it works" banner ── */}
        {showHowItWorks && (
          <div className="relative mt-4 overflow-hidden rounded-2xl border border-[var(--brand-200)] bg-gradient-to-br from-[var(--brand-50)] to-white px-5 py-4 sm:px-6">
            <button
              type="button"
              onClick={() => setShowHowItWorks(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Dismiss"
            >
              <X className="h-4 w-4" />
            </button>
            <div className="flex flex-wrap items-center gap-x-8 gap-y-3">
              <span className="text-sm font-bold text-slate-900">How {appName} works</span>
              <div className="flex flex-wrap items-center gap-x-6 gap-y-2 text-xs text-slate-600">
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-900)] text-[10px] font-bold text-white">1</span>
                  Browse nearby providers
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-900)] text-[10px] font-bold text-white">2</span>
                  Contact & compare
                </span>
                <span className="flex items-center gap-2">
                  <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--brand-900)] text-[10px] font-bold text-white">3</span>
                  Get work done
                </span>
              </div>
            </div>
          </div>
        )}

        {/* ── Hero search ── */}
        <div className="mt-8 text-center sm:mt-12">
          <h1 className="text-2xl font-bold tracking-tight text-slate-900 sm:text-3xl lg:text-4xl">
            What do you need done?
          </h1>
          <p className="mt-2 text-sm text-slate-500 sm:text-base">
            Find trusted providers near you in Crossings Republik
          </p>
          <div className="mx-auto mt-6 max-w-2xl">
            <div className="relative">
              <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder='Try "AC repair", "electrician", "plumber nearby"...'
                className="h-14 w-full rounded-2xl border border-slate-200 bg-white pl-12 pr-4 text-sm text-slate-900 outline-none shadow-sm transition focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[var(--brand-ring)]"
              />
            </div>
          </div>
        </div>

        {/* ── Category pills ── */}
        <div className="mt-8">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.label}
                type="button"
                onClick={() => setSelectedCategory(selectedCategory === cat.label ? null : cat.label)}
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
        </div>

        {/* ── Results count ── */}
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-slate-500">
            {providers.length} {providers.length === 1 ? "provider" : "providers"} near you
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

        {/* ── Provider cards grid ── */}
        <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {providers.map((provider) => (
            <ProviderCard
              key={provider.id}
              provider={provider}
              onSelect={(p) => setSelectedProvider(p)}
              onContact={(p) => {
                setContactProvider(p);
                setShowAuth(false);
              }}
            />
          ))}
        </div>

        {providers.length === 0 && !realProvidersLoading && !realProvidersError && (
          <div className="mt-12 text-center">
            <p className="text-sm text-slate-500">No providers found. Try a different search or category.</p>
          </div>
        )}

        {realProvidersError && (
          <div className="mt-12 text-center">
            <p className="text-sm text-rose-500">Could not load providers. {realProvidersError}</p>
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-600 transition hover:border-slate-300 hover:text-slate-800"
            >Retry</button>
          </div>
        )}

        {realProvidersLoading && (
          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-slate-400">
            <Loader2 className="h-4 w-4 animate-spin" />
            Loading providers...
          </div>
        )}

        {/* ── CTA: List your business ── */}
        <div className="mt-12 rounded-2xl border border-dashed border-[var(--brand-300)] bg-gradient-to-br from-[var(--brand-50)] to-white p-6 text-center">
          <Store className="mx-auto h-8 w-8 text-[var(--brand-500)]" />
          <h3 className="mt-3 text-lg font-bold text-slate-900">Are you a service provider?</h3>
          <p className="mt-1 text-sm text-slate-500">List your business on {appName} and get more customers from your neighborhood.</p>
          <button
            type="button"
            onClick={() => { setShowAuth(true); setContactProvider(null); }}
            className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
          ><Store className="h-4 w-4" /> List Your Business</button>
        </div>

        {/* ── Location info ── */}
        <div className="mt-12 rounded-2xl border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-bold text-slate-900">Serving Crossings Republik & nearby areas</h3>
              <p className="mt-1 text-xs text-slate-500">
                {LOCAL_SOCIETIES.slice(0, 5).join(", ")}, and more
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <MapPin className="h-3.5 w-3.5" />
              Ghaziabad, Uttar Pradesh 201016
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-12 border-t border-slate-200 pt-8 text-center">
          <p className="text-xs text-slate-400">
            {appName} &mdash; Crossings Republik&apos;s local marketplace &middot; Built for the community
          </p>
        </footer>
      </main>

      {/* ── Provider Detail Modal ── */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 pt-[8vh] pb-8 backdrop-blur-sm" onClick={() => setSelectedProvider(null)}>
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedProvider(null)}
              className="absolute right-4 top-4 z-10 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-2xl font-bold text-[var(--brand-700)]">
                  {selectedProvider.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-bold text-slate-900">{selectedProvider.name}</h2>
                    {selectedProvider.verified && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-[10px] font-semibold text-emerald-600 border border-emerald-200">Verified</span>
                    )}
                  </div>
                  <p className="mt-0.5 text-sm text-slate-500">{selectedProvider.location || "Crossings Republik"}</p>
                </div>
              </div>

              {/* Trust signals summary */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {selectedProvider.avgRating != null && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <Star className="mx-auto h-4 w-4 text-amber-400" fill="currentColor" />
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedProvider.avgRating.toFixed(1)}</p>
                    <p className="text-[10px] text-slate-500">{selectedProvider.reviewCount} reviews</p>
                  </div>
                )}
                {selectedProvider.completedJobs > 0 && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <CheckCircle2 className="mx-auto h-4 w-4 text-slate-500" />
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedProvider.completedJobs}</p>
                    <p className="text-[10px] text-slate-500">jobs done</p>
                  </div>
                )}
                {selectedProvider.responseMinutes != null && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <Zap className="mx-auto h-4 w-4 text-[var(--brand-500)]" />
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedProvider.responseMinutes} min</p>
                    <p className="text-[10px] text-slate-500">response</p>
                  </div>
                )}
                {selectedProvider.distanceKm != null && (
                  <div className="rounded-xl border border-slate-100 bg-slate-50 p-3 text-center">
                    <MapPin className="mx-auto h-4 w-4 text-slate-500" />
                    <p className="mt-1 text-sm font-bold text-slate-900">{selectedProvider.distanceKm}</p>
                    <p className="text-[10px] text-slate-500">km away</p>
                  </div>
                )}
              </div>

              {/* Bio */}
              {selectedProvider.bio && (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">About</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-slate-600">{selectedProvider.bio}</p>
                </div>
              )}

              {/* Services */}
              {selectedProvider.services && selectedProvider.services.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Services</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedProvider.services.map((s) => (
                      <span key={s} className="rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1 text-xs font-medium text-slate-700">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Listings */}
              {selectedProvider.listings && selectedProvider.listings.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-400">Available Listings</p>
                  <div className="mt-2 space-y-2">
                    {selectedProvider.listings.map((l) => (
                      <div key={l.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3.5 py-2.5">
                        <span className="text-sm text-slate-700">{l.title}</span>
                        {l.price != null && <span className="text-sm font-bold text-[var(--brand-700)]">₹{l.price}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact action */}
              <div className="mt-6 flex gap-3">
                <button
                  type="button"
                  onClick={() => { setContactProvider(selectedProvider); setSelectedProvider(null); }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
                ><Phone className="h-4 w-4" /> Contact</button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider(null)}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >Close</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ── Auth Modal ── */}
      {(showAuth || contactProvider) && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 pt-[10vh] pb-8 backdrop-blur-sm">
          <div className="relative w-full max-w-md overflow-hidden rounded-[28px] border border-slate-200 bg-white shadow-2xl">
            <button
              type="button"
              onClick={() => { setShowAuth(false); setContactProvider(null); }}
              className="absolute right-4 top-4 rounded-xl p-1.5 text-slate-400 transition hover:bg-slate-100 hover:text-slate-600"
              aria-label="Close"
            >
              <X className="h-5 w-5" />
            </button>

            <div className="p-6 sm:p-8">
              {contactProvider ? (
                <div className="mb-6">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--brand-700)]">Contact Provider</p>
                  <h2 className="mt-1.5 text-xl font-semibold text-slate-900">
                    {contactProvider.name}
                  </h2>
                  <p className="mt-1 text-xs text-slate-500">
                    {contactProvider.services?.[0] || contactProvider.role} &middot; {contactProvider.location}
                  </p>
                  <div className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="text-xs text-slate-600">Sign in or create an account to contact this provider.</p>
                  </div>
                </div>
              ) : null}

              <div className="mb-5">
                <p className="text-[10px] font-semibold uppercase tracking-[0.25em] text-[var(--brand-700)]">Secure Access</p>
                <h2 className="mt-1.5 text-2xl font-semibold text-slate-900">
                  Welcome to {appName}
                </h2>
                <p className="mt-1.5 text-sm leading-[1.55] text-slate-500">
                  Sign in or create an account with a one-time login link sent to your email.
                </p>
              </div>

              <div className="space-y-3">
                {emailLinkSent && !magicLinkData ? (
                  <div className="space-y-4 py-2 text-center">
                    <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
                      <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                    </div>
                    <div>
                      <p className="text-sm font-semibold text-slate-900">Check Your Email</p>
                      <p className="mt-1 text-xs leading-5 text-slate-500">
                        We emailed a secure login link to{" "}
                        <span className="font-medium text-slate-700">{emailAddress}</span>
                      </p>
                    </div>
                    <div className="space-y-2">
                      <a href="https://mail.google.com" target="_blank" rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                      >Open Gmail <ArrowRight size={13} /></a>
                      <a href="https://outlook.live.com" target="_blank" rel="noopener noreferrer"
                        className="inline-flex w-full items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 hover:text-slate-900"
                      >Open Outlook <ArrowRight size={13} /></a>
                    </div>
                    <div className="rounded-xl border border-slate-200 bg-slate-50 p-3 text-left">
                      <p className="text-xs leading-[1.6] text-slate-500">
                        Link valid for 24&nbsp;hours.{" "}
                        <button type="button" onClick={() => { setInfoMessage(""); setErrorMessage(""); }}
                          className="text-[var(--brand-700)] underline underline-offset-2 transition hover:text-[var(--brand-500)]">Use a different email</button>{" "}
                        or{" "}
                        <button type="button" onClick={() => { setInfoMessage(""); void sendEmailLink(); }}
                          className="text-[var(--brand-700)] underline underline-offset-2 transition hover:text-[var(--brand-500)]">resend</button>.
                      </p>
                    </div>
                  </div>
                ) : null}

                {magicLinkData ? (
                  <div className="space-y-3 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] p-4">
                    <p className="text-center text-xs text-slate-600">
                      {infoMessage || "Email delivery unavailable. Use the link or code below to sign in."}
                    </p>
                    <div className="rounded-xl bg-white border border-[var(--brand-200)] overflow-hidden">
                      <a href={magicLinkData.actionLink}
                        className="flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-[var(--brand-700)] hover:bg-[var(--brand-50)] transition">
                        <LogIn className="h-4 w-4" />
                        Click to Sign In
                      </a>
                    </div>
                    <p className="text-center text-sm font-mono tracking-widest text-slate-500">
                      {magicLinkData.emailOtp}
                    </p>
                    <div className="flex justify-center">
                      <button type="button" onClick={() => { setInfoMessage(""); setMagicLinkData(null); setErrorMessage(""); }}
                        className="text-xs text-[var(--brand-700)] underline underline-offset-2 transition hover:text-[var(--brand-500)]">
                        Use a different email
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <div className="space-y-1.5">
                      <label className="block text-xs font-semibold text-slate-600">Email address</label>
                      <input type="email" inputMode="email" autoComplete="email" placeholder="you@example.com"
                        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 placeholder:text-slate-400 outline-none transition hover:border-slate-300 focus:border-[var(--brand-500)] focus:ring-4 focus:ring-[var(--brand-ring)]"
                        value={emailAddress} onChange={(e) => setEmailAddress(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") void sendEmailLink(); }}
                      />
                    </div>
                    <button type="button" onClick={sendEmailLink} disabled={loading}
                      className="inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] active:scale-[0.98] disabled:cursor-not-allowed disabled:opacity-55"
                    >{loading ? "Sending\u2026" : "Send Login Link"}{!loading && <ArrowRight size={15} />}</button>
                    <div className="flex items-start gap-2.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5">
                      <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-500)]" />
                      <p className="text-xs leading-[1.55] text-slate-500">No password needed — a secure link is sent to your inbox. First-time users get an account created automatically.</p>
                    </div>
                  </>
                )}

                {infoMessage && !emailLinkSent && !magicLinkData ? (
                  <div className="rounded-xl border border-emerald-200 bg-emerald-50 px-3.5 py-2.5 text-xs text-emerald-700">{infoMessage}</div>
                ) : null}
                {errorMessage ? (
                  <div className="rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs text-rose-600">{errorMessage}</div>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
