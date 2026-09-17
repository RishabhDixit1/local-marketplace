"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { AiPromptBar } from "@/app/components/search/AiPromptBar";
import {
  ArrowRight,
  CheckCircle2,
  MapPin,
  X,
  Star,
  Phone,
  LogIn,
  Zap,
  Store,
  Search,
  SearchX,
  Loader2,
  User as UserIcon,
  Sparkles,
  MessageCircle,
  ShieldCheck,
} from "lucide-react";
import ServiQLogo from "@/app/components/ServiQLogo";
import { SignInModal } from "@/app/components/landing/SignInModal";
import { MobileBottomNav } from "@/app/components/MobileBottomNav";
import { StaggerContainer, StaggerItem } from "@/app/components/motion/StaggerChildren";
import { PressScale } from "@/app/components/motion/PressScale";
import { ErrorBoundary } from "@/app/components/ErrorBoundary";
import { appName } from "@/lib/branding";
import { useLocaleContext } from "@/lib/i18n-context";
import LocaleSwitcher from "@/app/components/LocaleSwitcher";
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

function RippleButton({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick: () => void }) {
  const [ripples, setRipples] = useState<Array<{ id: number; x: number; y: number }>>([]);
  const btnRef = useRef<HTMLButtonElement>(null);
  const rippleIdRef = useRef(0);

  const handleClick = (e: React.MouseEvent<HTMLButtonElement>) => {
    const rect = btnRef.current?.getBoundingClientRect();
    if (!rect) { onClick(); return; }
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    const id = ++rippleIdRef.current;
    setRipples((prev) => [...prev, { id, x, y }]);
    setTimeout(() => setRipples((prev) => prev.filter((r) => r.id !== id)), 600);
    onClick();
  };

  return (
    <button ref={btnRef} type="button" onClick={handleClick} className={`relative overflow-hidden ${className || ""}`}>
      {children}
      {ripples.map((r) => (
        <span
          key={r.id}
          className="pointer-events-none absolute animate-[ripple-expand_0.6s_ease-out_forwards] rounded-full bg-white/25"
          style={{ left: r.x - 10, top: r.y - 10, width: 20, height: 20 }}
        />
      ))}
      <style jsx>{`
        @keyframes ripple-expand {
          0% { transform: scale(0); opacity: 0.6; }
          100% { transform: scale(25); opacity: 0; }
        }
      `}</style>
    </button>
  );
}

const CATEGORIES = [
  { label: "Electrician", icon: "⚡", color: "bg-yellow-50 dark:bg-yellow-950/40 text-yellow-700 dark:text-yellow-300 border-yellow-200 dark:border-yellow-800/50" },
  { label: "Plumber", icon: "🔧", color: "bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 border-blue-200 dark:border-blue-800/50" },
  { label: "AC Repair", icon: "❄️", color: "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-200 dark:border-cyan-800/50" },
  { label: "RO Repair", icon: "💧", color: "bg-teal-50 dark:bg-teal-950/40 text-teal-700 dark:text-teal-300 border-teal-200 dark:border-teal-800/50" },
  { label: "Carpenter", icon: "🪚", color: "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-200 dark:border-amber-800/50" },
  { label: "Appliance Repair", icon: "🔌", color: "bg-rose-50 dark:bg-rose-950/40 text-rose-700 dark:text-rose-300 border-rose-200 dark:border-rose-800/50" },
  { label: "Mobile Repair", icon: "📱", color: "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-200 dark:border-indigo-800/50" },
  { label: "Bike Repair", icon: "🏍️", color: "bg-orange-50 dark:bg-orange-950/40 text-orange-700 dark:text-orange-300 border-orange-200 dark:border-orange-800/50" },
  { label: "Hardware Shop", icon: "🏪", color: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800/50" },
  { label: "Electrical Shop", icon: "💡", color: "bg-violet-50 dark:bg-violet-950/40 text-violet-700 dark:text-violet-300 border-violet-200 dark:border-violet-800/50" },
];

function ProviderCard({ provider, onContact, onSelect }: { provider: ProviderCardData; onContact: (p: ProviderCardData) => void; onSelect: (p: ProviderCardData) => void }) {
  const { t } = useLocaleContext();
  const priceLabel = provider.priceMin != null
    ? provider.priceMax != null && provider.priceMax > provider.priceMin
      ? `₹${provider.priceMin} - ₹${provider.priceMax}`
      : `From ₹${provider.priceMin}`
    : null;

  return (
    <div className="nameplate-card group flex h-full flex-col p-4 pt-5">
      <div className="flex items-start gap-3">
        <button type="button" onClick={() => onSelect(provider)} className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-[var(--brand-50)] text-lg font-bold text-[var(--brand-700)] ring-2 ring-[var(--surface-soft)] transition-all hover:ring-[var(--brand-300)] hover:bg-[var(--brand-100)]">
          {provider.name.charAt(0)}
        </button>
        <div className="min-w-0 flex-1">
          <button type="button" onClick={() => onSelect(provider)} className="w-full text-left">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <h3 className="truncate text-sm font-semibold text-[var(--ink-950)] group-hover:text-[var(--brand-700)] transition-colors">{provider.name}</h3>
                <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--ink-500)]">
                  <MapPin className="h-3 w-3 shrink-0" />
                  <span className="truncate">{provider.location || "Local area"}</span>
                </p>
              </div>
              {provider.verified && (
                <span className="nameplate-badge shrink-0 !bg-emerald-50 !text-emerald-600 !border-emerald-200">
                  {t("landing.verified")}
                </span>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-[var(--ink-500)] tabular-nums">
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
              {provider.distanceKm != null && (
                <span className="flex items-center gap-1">
                  <MapPin className="h-3 w-3 text-[var(--ink-500)]" />
                  {provider.distanceKm} km
                </span>
              )}
            </div>
            {provider.bio && (
              <p className="mt-1.5 text-xs leading-relaxed text-[var(--ink-500)] line-clamp-2">
                {provider.bio}
              </p>
            )}
          </button>
          <div className="mt-auto flex items-center justify-between pt-3 border-t border-[var(--surface-border)]/60">
            <div className="min-w-0 flex-1">
              {priceLabel && (
                <span className="text-sm font-bold text-[var(--brand-700)]">{priceLabel}</span>
              )}
            </div>
            <button
              type="button"
              onClick={() => onContact(provider)}
              className="nameplate-card shrink-0 !rounded-xl !px-4 !py-2 text-xs font-semibold text-[var(--ink-700)] transition-all hover:!border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
            >
              <Phone className="h-3.5 w-3.5 inline mr-1.5" />
              {t("landing.contact")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

export function LandingPageClient({
  initialSignIn,
  initialCategory,
}: {
  initialSignIn: boolean;
  initialCategory: string | null;
}) {
  const router = useRouter();
  const { t } = useLocaleContext();
  const [showAuth, setShowAuth] = useState(initialSignIn);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(initialCategory);
  const [showHowItWorks, setShowHowItWorks] = useState(true);
  const [contactProvider, setContactProvider] = useState<ProviderCardData | null>(null);
  const [selectedProvider, setSelectedProvider] = useState<ProviderCardData | null>(null);
  const [realProviders, setRealProviders] = useState<ProviderCardData[]>([]);
  const [realProvidersTotal, setRealProvidersTotal] = useState(0);
  const [realProvidersLoading, setRealProvidersLoading] = useState(true);
  const [realProvidersError, setRealProvidersError] = useState<string | null>(null);
  const [retryCount, setRetryCount] = useState(0);

  useEffect(() => {
    if (initialCategory && !selectedCategory) {
      setSelectedCategory(initialCategory);
    }
  }, [initialCategory, selectedCategory]);

  useEffect(() => {
    let active = true;
    setRealProvidersError(null);
    const params = new URLSearchParams();
    if (selectedCategory) params.set("category", selectedCategory);
    // Only pull what the landing grid can render; the true total comes from
    // facets.totalProviders, so the "N providers near you" copy stays correct
    // without fetching hundreds of rows we slice down to 6 cards.
    params.set("limit", "12");
    fetch(`/api/community/providers-by-category${params.toString() ? `?${params.toString()}` : ""}`)
      .then((r) => { if (!r.ok) throw new Error(`Request failed (${r.status})`); return r.json(); })
      .then((data) => {
        if (!active) return;
        const providers = (data.providers || []) as ProviderCardData[];
        setRealProviders(providers);
        const trueCount =
          Number(data.facets?.totalProviders ?? data.pagination?.total ?? providers.length);
        setRealProvidersTotal(Number.isFinite(trueCount) ? trueCount : providers.length);
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

  const LANDING_PAGE_PROVIDER_LIMIT = 6;

  const providers = useMemo(() => {
    const list = realProviders.length > 0 ? realProviders : [];
    if (selectedCategory) {
      return list;
    }
    return list.slice(0, LANDING_PAGE_PROVIDER_LIMIT);
  }, [realProviders, selectedCategory]);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.has("code") || params.has("error_description") || /\baccess_token=/.test(hash)) {
      const suffix = window.location.search + window.location.hash;
      window.location.replace(`/auth/callback${suffix}`);
      return;
    }
  }, []);

  return (
    <div className="relative min-h-screen bg-[var(--surface-app)] pb-[calc(6rem+env(safe-area-inset-bottom))] lg:pb-0">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-[var(--surface-border)]/80 bg-[var(--surface-elevated)]/95 backdrop-blur-md">
        <div className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <div className="flex items-center gap-3">
            <ServiQLogo href="/" ariaLabel={t("nav.home")} />
            <div className="hidden sm:flex items-center gap-1.5 rounded-xl bg-[var(--brand-50)] px-3 py-1.5 text-[11px] font-medium text-[var(--brand-700)]">
              <MapPin className="h-3.5 w-3.5" />
              {CROSSINGS_REPUBLIK_COORDS.label}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <LocaleSwitcher />
            <Link
              href="/market"
              className="hidden sm:inline-flex items-center gap-2 rounded-xl border border-[var(--brand-200)] bg-[var(--brand-50)] px-4 py-2 text-sm font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-100)]"
            >
              <Store className="h-4 w-4" />
              {t("nav.explore")}
            </Link>
            <button
              type="button"
              onClick={() => { router.push("/login"); }}
              className="inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-2 text-sm font-semibold text-[var(--ink-700)] transition hover:border-[var(--brand-500)]/40 hover:text-[var(--brand-700)]"
            >
              <LogIn className="h-4 w-4" />
              {t("nav.signIn")}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/* ── Hero Section with visual weight ── */}
        <section className="relative mt-6 overflow-hidden rounded-[28px] border border-[var(--brand-200)]/60 bg-gradient-to-br from-[var(--brand-50)] via-[var(--surface-elevated)] to-[var(--marigold-50)] px-6 py-10 sm:px-10 sm:py-14 lg:px-16 startup-fade">
          {/* Decorative orbs */}
          <div className="absolute -top-20 -right-20 h-64 w-64 rounded-full bg-[var(--brand-300)]/10 blur-3xl pointer-events-none" />
          <div className="absolute -bottom-16 -left-16 h-48 w-48 rounded-full bg-[var(--marigold-300)]/10 blur-3xl pointer-events-none" />

          <div className="relative z-10 text-center">
            <h1 className="text-3xl font-normal tracking-tight text-[var(--ink-950)] sm:text-4xl lg:text-5xl startup-fade" style={{ fontFamily: "var(--font-display)" }}>
              {t("landing.heroTitle")}
            </h1>
            <p className="mt-3 text-sm text-[var(--ink-500)] sm:text-base startup-fade-delay">
              {t("landing.heroSubtitle")}
            </p>
            <div className="mx-auto mt-7 max-w-2xl startup-fade-delay">
              <AiPromptBar placeholder={t("landing.searchPlaceholder")} />
            </div>
            <div className="mt-4 flex items-center justify-center gap-3 text-xs text-[var(--ink-500)]">
              <span>{t("landing.or")}</span>
              <Link
                href="/market"
                className="inline-flex items-center gap-1 font-semibold text-[var(--brand-700)] hover:text-[var(--brand-500)]"
              >
                {t("landing.browseMarketplace")} <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          </div>
        </section>

        {/* ── How ServiQ Works - Visual Step Sequence ── */}
        {showHowItWorks && (
          <section className="relative mt-8 overflow-hidden rounded-[20px] border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-6 py-6 sm:px-8 startup-fade-delay">
            <button
              type="button"
              onClick={() => setShowHowItWorks(false)}
              className="absolute right-3 top-3 rounded-lg p-1 text-[var(--ink-500)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink-700)]"
              aria-label={t("landing.dismiss")}
            >
              <X className="h-4 w-4" />
            </button>

            <h2 className="text-center text-sm font-semibold uppercase tracking-wider text-[var(--ink-500)]" style={{ fontFamily: "var(--font-display)" }}>
              {t("landing.howItWorks", { appName })}
            </h2>

            <div className="relative mt-6 flex flex-col items-center gap-6 sm:flex-row sm:justify-center sm:gap-0 sm:overflow-hidden">
              {/* Connecting line (desktop) — clipped to icon row, never touches text */}
              <div className="pointer-events-none absolute top-6 left-1/2 z-0 hidden h-0.5 w-[40%] -translate-x-1/2 bg-gradient-to-r from-transparent via-[var(--brand-300)] to-transparent sm:block" />

              {[
                { step: "1", icon: Search, label: t("landing.step1"), desc: "Browse services in your neighborhood" },
                { step: "2", icon: MessageCircle, label: t("landing.step2"), desc: "Compare and contact providers directly" },
                { step: "3", icon: ShieldCheck, label: t("landing.step3"), desc: "Get quality work done with confidence" },
              ].map((s, i) => (
                <div key={s.step} className="relative z-10 flex flex-1 flex-col items-center text-center sm:max-w-[200px]">
                  <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-900)] text-white shadow-lg shadow-[var(--brand-900)]/20">
                    <s.icon className="h-5 w-5" />
                  </div>
                  <div className="mt-3 flex items-center gap-2">
                    <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[var(--marigold-50)] text-[10px] font-bold text-[var(--marigold-600)] border border-[var(--marigold-200)]">
                      {s.step}
                    </span>
                    <span className="text-sm font-semibold text-[var(--ink-950)]">{s.label}</span>
                  </div>
                  <p className="mt-1 text-xs text-[var(--ink-500)]">{s.desc}</p>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* ── Category pills - nameplate style ── */}
        <section className="mt-10">
          <div className="flex flex-wrap items-center justify-center gap-2">
            {CATEGORIES.map((cat) => (
              <PressScale key={cat.label} as="div">
                <button
                  type="button"
                  onClick={() => setSelectedCategory(selectedCategory === cat.label ? null : cat.label)}
                  className={`nameplate-card !rounded-xl !px-4 !py-2.5 inline-flex items-center gap-1.5 text-xs font-semibold transition-all ${
                    selectedCategory === cat.label
                      ? "!border-[var(--brand-500)] !bg-[var(--brand-50)] text-[var(--brand-700)]"
                      : `hover:!border-[var(--brand-300)] text-[var(--ink-700)]`
                  }`}
                >
                  <span className="text-sm">{cat.icon}</span>
                  {cat.label}
                </button>
              </PressScale>
            ))}
          </div>
        </section>

        {/* ── Results count ── */}
        <div className="mt-8 flex items-center justify-between">
          <p className="text-sm text-[var(--ink-500)]">
            {!selectedCategory && realProvidersTotal > LANDING_PAGE_PROVIDER_LIMIT
              ? t("landing.showingProviders", { count: LANDING_PAGE_PROVIDER_LIMIT, total: realProvidersTotal })
              : t("landing.providersNearYou", { count: realProvidersTotal || realProviders.length })}
          </p>
          {selectedCategory && (
            <button
              type="button"
              onClick={() => setSelectedCategory(null)}
              className="inline-flex items-center rounded-lg px-3 py-1.5 text-xs font-semibold text-[var(--brand-700)] hover:bg-[var(--brand-50)]"
            >
              {t("landing.clearFilter")}
            </button>
          )}
        </div>

        {/* ── Provider cards grid ── */}
        <ErrorBoundary>
          <StaggerContainer>
            <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {providers.map((provider) => (
                <StaggerItem key={provider.id}>
                  <ProviderCard
                    provider={provider}
                    onSelect={(p) => setSelectedProvider(p)}
                    onContact={(p) => {
                      router.push(`/login?next=${encodeURIComponent(`/dashboard/chat?providerId=${p.id}`)}`);
                    }}
                  />
                </StaggerItem>
              ))}
            </div>
          </StaggerContainer>
        </ErrorBoundary>

        {providers.length === 0 && !realProvidersLoading && !realProvidersError && (
          <div className="mt-12 text-center">
            <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 dark:border-[var(--surface-border)] bg-[var(--surface-soft)]">
              <SearchX className="h-7 w-7 text-[var(--ink-500)]" />
            </div>
            <p className="text-sm font-semibold text-[var(--ink-700)]">{t("landing.noProviders")}</p>
            <p className="mt-1 text-sm text-[var(--ink-500)]">{t("landing.noProvidersHint")}</p>
            {selectedCategory && (
              <button
                type="button"
                onClick={() => setSelectedCategory(null)}
                className="mt-4 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-2.5 text-xs font-semibold text-white hover:bg-[var(--brand-700)]"
              >
                {t("landing.clearAllFilters")}
              </button>
            )}
          </div>
        )}

        {realProvidersError && (
          <div className="mt-12 text-center">
            <p className="text-sm text-rose-500">{t("landing.couldNotLoad", { error: realProvidersError })}</p>
            <button
              type="button"
              onClick={() => setRetryCount((c) => c + 1)}
              className="mt-3 inline-flex items-center gap-2 rounded-xl border border-[var(--surface-border)] px-4 py-2 text-xs font-semibold text-[var(--ink-700)] transition hover:border-[var(--border-strong)] hover:text-[var(--ink-950)]"
            >{t("common.retry")}</button>
          </div>
        )}

        {realProvidersLoading && (
          <div className="mt-12 flex items-center justify-center gap-2 text-sm text-[var(--ink-500)]">
            <Loader2 className="h-4 w-4 animate-spin" />
            {t("landing.loadingProviders")}
          </div>
        )}

        {/* ── CTA: Looking for services ── */}
        <div className="nameplate-card mt-12 !bg-gradient-to-br !from-[var(--brand-50)] !to-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--brand-900)] shadow-lg shadow-[var(--brand-900)]/20">
            <Search className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>{t("landing.lookingForServices")}</h3>
          <p className="mt-2 text-sm text-[var(--ink-500)]">Find trusted providers for any service in your neighborhood</p>
          <Link
            href="/login?next=/dashboard"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--brand-900)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] shadow-md"
          ><Search className="h-4 w-4" /> {t("landing.browseMarketplace")}</Link>
        </div>

        {/* ── CTA: List your business ── */}
        <div className="nameplate-card mt-6 !border-dashed !border-[var(--brand-300)] !bg-gradient-to-br !from-[var(--marigold-50)] !to-white p-8 text-center">
          <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-[var(--marigold-500)] shadow-lg shadow-[var(--marigold-500)]/20">
            <Store className="h-6 w-6 text-white" />
          </div>
          <h3 className="text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>{t("landing.areYouProvider")}</h3>
          <p className="mt-2 text-sm text-[var(--ink-500)]">List your business on {appName} and get more customers from your neighborhood</p>
          <Link
            href="/onboarding/provider/locality"
            className="mt-5 inline-flex items-center gap-2 rounded-xl bg-[var(--marigold-500)] px-6 py-3 text-sm font-semibold text-white transition hover:bg-[var(--marigold-600)] shadow-md"
          ><Store className="h-4 w-4" /> {t("landing.listYourBusiness")}</Link>
        </div>

        {/* ── Location info ── */}
        <div className="nameplate-card mt-12 p-6 !bg-[var(--surface-soft)]">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <h3 className="text-sm font-semibold text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>{t("landing.servingArea", { area: CROSSINGS_REPUBLIK_COORDS.label })}</h3>
              <p className="mt-1 text-xs text-[var(--ink-500)]">
                {LOCAL_SOCIETIES.slice(0, 5).join(", ")}{t("landing.andMore")}
              </p>
            </div>
            <div className="flex items-center gap-2 text-xs text-[var(--ink-500)]">
              <MapPin className="h-3.5 w-3.5" />
              Ghaziabad, Uttar Pradesh 201016
            </div>
          </div>
        </div>

        {/* ── Footer ── */}
        <footer className="mt-12 border-t border-[var(--surface-border)] pt-8 pb-8 text-center">
          <p className="text-xs text-[var(--ink-500)]">
            {t("landing.builtForCommunity", { appName, area: "your neighbourhood" })}
          </p>
          <p className="mt-2 text-xs text-[var(--ink-500)]">
            <a href="mailto:info@serviqapp.com" className="hover:text-[var(--brand-700)]">info@serviqapp.com</a>
            {" "}&middot;{" "}
            <a href="tel:+919696707492" className="hover:text-[var(--brand-700)]">+91 9696707492</a>
          </p>
        </footer>
      </main>

      {/* ── Provider Detail Modal ── */}
      {selectedProvider && (
        <div className="fixed inset-0 z-50 flex items-start justify-center overflow-y-auto bg-slate-950/40 px-4 pt-[8vh] pb-8 backdrop-blur-sm" onClick={() => setSelectedProvider(null)}>
          <div className="relative w-full max-w-lg overflow-hidden rounded-[28px] border border-[var(--surface-border)] bg-[var(--surface-elevated)] shadow-2xl" onClick={(e) => e.stopPropagation()}>
            <button
              type="button"
              onClick={() => setSelectedProvider(null)}
              className="absolute right-4 top-4 z-10 rounded-xl p-1.5 text-[var(--ink-500)] transition hover:bg-[var(--surface-soft)] hover:text-[var(--ink-700)]"
              aria-label={t("common.close")}
            >
              <X className="h-5 w-5" />
            </button>
            <div className="p-6 sm:p-8">
              <div className="flex items-center gap-4">
                <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-[var(--brand-50)] text-2xl font-bold text-[var(--brand-700)] ring-2 ring-[var(--surface-soft)]">
                  {selectedProvider.name.charAt(0)}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <h2 className="text-xl font-normal text-[var(--ink-950)]" style={{ fontFamily: "var(--font-display)" }}>{selectedProvider.name}</h2>
                    {selectedProvider.verified && (
                      <span className="nameplate-badge !bg-emerald-50 !text-emerald-600 !border-emerald-200">{t("landing.verified")}</span>
                    )}
                  </div>
                  <p className="mt-0.5 flex items-center gap-1 text-sm text-[var(--ink-500)]">
                    <MapPin className="h-3.5 w-3.5" />
                    {selectedProvider.location || CROSSINGS_REPUBLIK_COORDS.label}
                  </p>
                </div>
              </div>

              {/* Trust signals summary */}
              <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {selectedProvider.avgRating != null && (
                  <div className="nameplate-inset p-3 text-center">
                    <Star className="mx-auto h-4 w-4 text-[var(--marigold-400)]" fill="currentColor" />
                    <p className="mt-1 text-sm font-bold text-[var(--ink-950)]">{selectedProvider.avgRating.toFixed(1)}</p>
                    <p className="text-[10px] text-[var(--ink-500)]">{selectedProvider.reviewCount} {t("landing.reviews")}</p>
                  </div>
                )}
                {selectedProvider.completedJobs > 0 && (
                  <div className="nameplate-inset p-3 text-center">
                    <CheckCircle2 className="mx-auto h-4 w-4 text-[var(--ink-500)]" />
                    <p className="mt-1 text-sm font-bold text-[var(--ink-950)]">{selectedProvider.completedJobs}</p>
                    <p className="text-[10px] text-[var(--ink-500)]">{t("landing.jobsDone")}</p>
                  </div>
                )}
                {selectedProvider.responseMinutes != null && (
                  <div className="nameplate-inset p-3 text-center">
                    <Zap className="mx-auto h-4 w-4 text-[var(--brand-500)]" />
                    <p className="mt-1 text-sm font-bold text-[var(--ink-950)]">{selectedProvider.responseMinutes} {t("landing.minutes")}</p>
                    <p className="text-[10px] text-[var(--ink-500)]">{t("landing.response")}</p>
                  </div>
                )}
                {selectedProvider.distanceKm != null && (
                  <div className="nameplate-inset p-3 text-center">
                    <MapPin className="mx-auto h-4 w-4 text-[var(--ink-500)]" />
                    <p className="mt-1 text-sm font-bold text-[var(--ink-950)]">{selectedProvider.distanceKm}</p>
                    <p className="text-[10px] text-[var(--ink-500)]">{t("landing.kmAway")}</p>
                  </div>
                )}
              </div>

              {/* Bio */}
              {selectedProvider.bio && (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">{t("landing.about")}</p>
                  <p className="mt-1.5 text-sm leading-relaxed text-[var(--ink-700)]">{selectedProvider.bio}</p>
                </div>
              )}

              {/* Services */}
              {selectedProvider.services && selectedProvider.services.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">{t("landing.services")}</p>
                  <div className="mt-2 flex flex-wrap gap-2">
                    {selectedProvider.services.map((s) => (
                      <span key={s} className="nameplate-badge !bg-[var(--surface-soft)] !text-[var(--ink-700)] !border-[var(--surface-border)]">{s}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Listings */}
              {selectedProvider.listings && selectedProvider.listings.length > 0 && (
                <div className="mt-5">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.2em] text-[var(--ink-500)]">{t("landing.availableListings")}</p>
                  <div className="mt-2 space-y-2">
                    {selectedProvider.listings.map((l) => (
                      <div key={l.id} className="nameplate-inset flex items-center justify-between px-3.5 py-2.5">
                        <span className="text-sm text-[var(--ink-700)]">{l.title}</span>
                        {l.price != null && <span className="text-sm font-bold text-[var(--brand-700)]">₹{l.price}</span>}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Contact action */}
              <div className="mt-6 flex gap-2">
                <RippleButton
                  onClick={() => { setContactProvider(selectedProvider); setSelectedProvider(null); }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)]"
                ><Phone className="h-4 w-4" /> {t("landing.contact")}</RippleButton>
                <button
                  type="button"
                  onClick={() => { router.push(`/profile/${selectedProvider.id}`); }}
                  className="flex-1 inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--brand-200)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--brand-700)] transition hover:bg-[var(--brand-50)]"
                ><UserIcon className="h-4 w-4" /> {t("landing.viewProfile")}</button>
                <button
                  type="button"
                  onClick={() => setSelectedProvider(null)}
                  className="inline-flex items-center justify-center gap-2 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] px-4 py-3 text-sm font-semibold text-[var(--ink-700)] transition hover:bg-[var(--surface-soft)]"
                >{t("common.close")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      <SignInModal
        show={showAuth || !!contactProvider}
        contactProvider={contactProvider}
        onClose={() => { setShowAuth(false); setContactProvider(null); }}
        onAuthComplete={() => { setSelectedProvider(null); }}
      />
      <MobileBottomNav />
    </div>
  );
}
