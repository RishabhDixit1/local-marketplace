"use client";

import type { User } from "@supabase/supabase-js";
import { useCallback, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowLeft, ArrowRight, CheckCircle2, Mail, ShieldCheck, Star, Users, UserCheck } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { supabase } from "@/lib/supabase";
import { storeLocalAuthSession } from "@/lib/localAuth";
import { Button } from "@/app/components/ui/Button";
import { Input } from "@/app/components/ui/Input";
import ServiQLogo from "@/app/components/ServiQLogo";
import { appName } from "@/lib/branding";
import { FadeInScale } from "@/app/components/motion/FadeIn";
import { StaggerContainer, StaggerItem } from "@/app/components/motion/StaggerChildren";
import { PressScale } from "@/app/components/motion/PressScale";

const isEmailLike = (value: string): boolean => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);

const VALUE_CHIPS = ["Buy", "Sell", "Earn", "Help"] as const;

type MarketplaceStats = {
  totalProviders: number;
  totalUsers: number;
  totalReviews: number;
  averageRating: number | null;
};

type FeaturedReview = {
  reviewerFirstName: string;
  rating: number;
  comment: string;
};

function DotGridBackground() {
  return (
    <svg
      className="pointer-events-none absolute inset-0 h-full w-full opacity-[0.06]"
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <pattern id="login-dot-grid" x="0" y="0" width="24" height="24" patternUnits="userSpaceOnUse">
          <circle cx="2" cy="2" r="1" fill="white" />
        </pattern>
      </defs>
      <rect width="100%" height="100%" fill="url(#login-dot-grid)" />
    </svg>
  );
}

function SoftBlob() {
  return (
    <svg
      className="pointer-events-none absolute -bottom-32 -left-32 h-96 w-96 opacity-[0.04]"
      viewBox="0 0 400 400"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path
        d="M200 0C250 0 300 50 340 100C380 150 400 200 380 260C360 320 300 380 240 395C180 410 120 400 70 360C20 320 -10 260 0 200C10 140 40 80 90 40C140 0 150 0 200 0Z"
        fill="white"
      />
    </svg>
  );
}

function ReviewerAvatar({ name }: { name: string }) {
  const initial = name.charAt(0).toUpperCase();
  return (
    <span className="inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-[var(--brand-500)]/20 text-[11px] font-bold text-[var(--brand-300)]">
      {initial}
    </span>
  );
}

function StarRating({ rating, size = 10 }: { rating: number; size?: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: rating }, (_, i) => (
        <Star key={i} size={size} fill="currentColor" className="text-[var(--brand-300)]" />
      ))}
    </span>
  );
}

function TrustSection({
  stats,
  reviews,
  mounted,
}: {
  stats: MarketplaceStats | null;
  reviews: FeaturedReview[];
  mounted: boolean;
}) {
  const [reviewIndex, setReviewIndex] = useState(0);

  useEffect(() => {
    if (reviews.length < 2) return;
    const interval = setInterval(() => {
      setReviewIndex((prev) => (prev + 1) % reviews.length);
    }, 4000);
    return () => clearInterval(interval);
  }, [reviews.length]);

  return (
    <StaggerContainer>
      <StaggerItem>
        {stats ? (
          <div className="mt-8 grid grid-cols-3 gap-3">
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-3 py-3 text-center backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-300)]/30 to-transparent" />
              <UserCheck size={14} className="mx-auto text-[var(--brand-300)]" />
              <p className="mt-1 text-lg font-bold leading-none text-white">{stats.totalProviders}+</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/40">Providers</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-3 py-3 text-center backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-300)]/30 to-transparent" />
              <Users size={14} className="mx-auto text-[var(--brand-300)]" />
              <p className="mt-1 text-lg font-bold leading-none text-white">{stats.totalUsers}+</p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/40">Members</p>
            </div>
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-3 py-3 text-center backdrop-blur-sm">
              <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-[var(--brand-300)]/30 to-transparent" />
              <Star size={14} className="mx-auto text-[var(--brand-300)]" />
              <p className="mt-1 text-lg font-bold leading-none text-white">
                {stats.averageRating != null ? `${stats.averageRating}${"\u2605"}` : "\u2014"}
              </p>
              <p className="mt-1 text-[10px] font-medium uppercase tracking-wider text-white/40">Rating</p>
            </div>
          </div>
        ) : (
          <div className="mt-8 grid grid-cols-3 gap-3 opacity-30">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.08] to-white/[0.02] px-3 py-3 text-center backdrop-blur-sm">
                <div className="mx-auto h-3.5 w-3.5 animate-pulse rounded-full bg-white/20" />
                <div className="mx-auto mt-2 h-5 w-12 animate-pulse rounded bg-white/20" />
                <div className="mx-auto mt-2 h-3 w-16 animate-pulse rounded bg-white/20" />
              </div>
            ))}
          </div>
        )}
      </StaggerItem>

      <StaggerItem>
        <div className="mt-5 min-h-[80px]">
          {mounted && reviews.length > 0 ? (
            <AnimatePresence mode="wait">
              <motion.div
                key={reviewIndex}
                exit={{ opacity: 0, y: -10, scale: 0.98 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.01] px-4 py-3.5 backdrop-blur-sm"
              >
                <div className="absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-white/20 to-transparent" />
                <div className="flex items-start gap-3">
                  <ReviewerAvatar name={reviews[reviewIndex].reviewerFirstName} />
                  <div className="min-w-0 flex-1">
                    <p className="text-sm leading-[1.55] italic text-white/75">
                      &ldquo;{reviews[reviewIndex].comment}&rdquo;
                    </p>
                    <div className="mt-2 flex items-center gap-2">
                      <StarRating rating={reviews[reviewIndex].rating} size={10} />
                      <span className="text-[11px] text-white/40">&mdash;</span>
                      <span className="text-[11px] font-medium text-white/50">
                        {reviews[reviewIndex].reviewerFirstName}
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>
          ) : mounted ? (
            <div className="relative overflow-hidden rounded-xl border border-white/[0.08] bg-gradient-to-b from-white/[0.06] to-white/[0.01] px-4 py-3.5 backdrop-blur-sm opacity-30">
              <div className="flex items-start gap-3">
                <div className="h-7 w-7 animate-pulse rounded-full bg-white/20" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-full animate-pulse rounded bg-white/20" />
                  <div className="h-3 w-24 animate-pulse rounded bg-white/20" />
                </div>
              </div>
            </div>
          ) : null}
        </div>
      </StaggerItem>
    </StaggerContainer>
  );
}

function BrandPanel() {
  const [chipIndex, setChipIndex] = useState(0);
  const [stats, setStats] = useState<MarketplaceStats | null>(null);
  const [reviews, setReviews] = useState<FeaturedReview[]>([]);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setChipIndex((prev) => (prev + 1) % VALUE_CHIPS.length);
    }, 2200);
    return () => clearInterval(interval);
  }, []);

  useEffect(() => {
    let active = true;
    const fetchData = async () => {
      try {
        const [statsRes, reviewsRes] = await Promise.all([
          fetch("/api/public/marketplace-stats"),
          fetch("/api/public/featured-reviews"),
        ]);
        if (!active) return;
        if (statsRes.ok) {
          const statsData = await statsRes.json();
          if (statsData.ok) {
            setStats({
              totalProviders: statsData.totalProviders,
              totalUsers: statsData.totalUsers,
              totalReviews: statsData.totalReviews,
              averageRating: statsData.averageRating,
            });
          }
        }
        if (reviewsRes.ok) {
          const reviewsData = await reviewsRes.json();
          if (reviewsData.ok && Array.isArray(reviewsData.reviews)) {
            setReviews(reviewsData.reviews);
          }
        }
      } catch {
        // fail silently
      }
    };
    void fetchData();
    return () => { active = false; };
  }, []);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden bg-gradient-to-br from-[var(--brand-900)] via-[var(--brand-700)] to-[var(--brand-600)] px-6 py-12 sm:px-10 lg:px-16">
      <DotGridBackground />
      <SoftBlob />
      <div className="pointer-events-none absolute -inset-x-32 -top-32 h-96 w-[150%] rounded-full bg-[var(--brand-400)]/10 blur-[120px]" />
      <div className="pointer-events-none absolute -bottom-40 -right-40 h-80 w-80 rounded-full bg-[var(--brand-50)]/5 blur-[100px]" />

      <div className="relative z-10 flex flex-col">
        <div className="flex-1">
          <StaggerContainer>
            <StaggerItem>
              <ServiQLogo
                markOnly
                ariaLabel={`${appName} home`}
                markClassName="border-white/20 bg-white/10 text-white shadow-black/20"
                markDotClassName="bg-[var(--brand-300)]"
              />
            </StaggerItem>

            <StaggerItem>
              <h1 className="mt-8 text-3xl font-extrabold leading-tight tracking-tight text-white sm:text-4xl lg:text-4xl xl:text-5xl">
                Your Local Marketplace<br />
                <span className="text-[var(--brand-300)]">&amp; Help App</span>
              </h1>
            </StaggerItem>

            <StaggerItem>
              <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
                World&apos;s First Marketplace &amp; Help Application
              </p>
            </StaggerItem>

            <StaggerItem>
              <p className="mt-4 max-w-md text-sm leading-relaxed text-white/60">
                Ab market mai jaane ki zarurat nahi — just open the app and access the market &amp; people nearby
              </p>
            </StaggerItem>

            <StaggerItem>
              <div className="mt-8 flex items-center gap-3">
                {mounted ? (
                  <AnimatePresence mode="wait">
                    <motion.span
                      key={VALUE_CHIPS[chipIndex]}
                      initial={{ opacity: 0, y: 12, scale: 0.9 }}
                      animate={{ opacity: 1, y: 0, scale: 1 }}
                      exit={{ opacity: 0, y: -12, scale: 0.9 }}
                      transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                      className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm"
                    >
                      {VALUE_CHIPS[chipIndex]}
                    </motion.span>
                  </AnimatePresence>
                ) : (
                  <span className="inline-flex items-center gap-1.5 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-sm font-semibold text-white backdrop-blur-sm">
                    {VALUE_CHIPS[0]}
                  </span>
                )}
                <span className="text-sm text-white/50">on ServiQ</span>
              </div>
            </StaggerItem>
          </StaggerContainer>

          <TrustSection stats={stats} reviews={reviews} mounted={mounted} />
        </div>

        <StaggerContainer>
          <StaggerItem>
            <p className="mt-10 text-xs font-semibold uppercase tracking-[0.25em] text-white/40">
              No Issues, use {appName}
            </p>
          </StaggerItem>
        </StaggerContainer>
      </div>
    </div>
  );
}

function AuthForm() {
  const router = useRouter();
  const [emailAddress, setEmailAddress] = useState("");
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");
  const [otpStep, setOtpStep] = useState(false);
  const [verificationCode, setVerificationCode] = useState("");
  const [verifying, setVerifying] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const hash = window.location.hash;
    if (params.has("code") || params.has("error_description") || /\baccess_token=/.test(hash)) {
      const suffix = window.location.search + window.location.hash;
      window.location.replace(`/auth/callback${suffix}`);
    }
  }, []);

  const isSafeRedirect = (path: string): boolean => /^\/(?!\/)/.test(path);

  const completeAuth = useCallback(
    async (user: User) => {
      const params = new URLSearchParams(window.location.search);
      const next = params.get("next");
      const { ensureProfileForUser, resolveCurrentProfileDestination } = await import("@/lib/profile/client");
      let profile;
      try {
        profile = await ensureProfileForUser(user);
      } catch (err) {
        console.error("[LoginPageClient] Profile bootstrap failed:", err);
        setErrorMessage("We couldn't finish setting up your account. Please try again.");
        return false;
      }
      const target = next && isSafeRedirect(next)
        ? next
        : resolveCurrentProfileDestination(profile);
      router.replace(target);
      return true;
    },
    [router],
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
    setOtpStep(false);
    setVerificationCode("");
    const email = emailAddress.trim().toLowerCase();
    if (!isEmailLike(email)) { setErrorMessage("Enter a valid email address."); return; }
    setLoading(true);
    try {
      const response = await fetch("/api/auth/send-link", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email }),
      });
      const payload = (await response.json().catch(() => null)) as { ok?: boolean; error?: string; emailSent?: boolean; message?: string } | null;
      if (!response.ok || !payload?.ok) throw new Error(payload?.error || payload?.message || "Unable to send verification code.");
      setOtpStep(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send verification code.";
      if (/rate|too many/i.test(message)) setErrorMessage("Too many requests. Wait 60 seconds.");
      else setErrorMessage(message);
    } finally { setLoading(false); }
  };

  const verifyOtpCode = async () => {
    setErrorMessage("");
    const code = verificationCode.trim();
    if (!code || code.length < 6) { setErrorMessage("Enter the complete code from your email."); return; }
    setVerifying(true);
    const email = emailAddress.trim().toLowerCase();

    try {
      const { data, error } = await supabase.auth.verifyOtp({ email, token: code, type: "email" });
      if (error) throw error;
      if (data?.user) {
        if (await completeAuth(data.user)) return;
      }
    } catch (goTrueError) {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        if (await completeAuth(session.user)) return;
      }
      if (goTrueError instanceof Error) console.warn("verifyOtp (GoTrue) failed, falling back to custom API:", goTrueError.message);
    }

    try {
      const response = await fetch("/api/auth/verify-link", {
        method: "POST",
        headers: { "Content-Type" : "application/json" },
        body: JSON.stringify({ email, otp: code }),
      });
      const payload = (await response.json()) as {
        ok?: boolean;
        error?: string;
        user?: { id: string; email: string };
        session?: Record<string, unknown>

;
        accessToken?: string;
        refreshToken?: string;
      };
      if (!payload.ok) throw new Error(payload.error || "Invalid or expired code.");

      if (payload.accessToken && payload.user) {
        storeLocalAuthSession({
          user: payload.user as { id: string; email: string },
          accessToken: payload.accessToken,
          refreshToken: payload.refreshToken || "",
        });
      }

      if (payload.session) {
        const { error: sessionError } = await supabase.auth.setSession(payload.session as never);
        if (!sessionError) return;
      }

      if (payload.user) {
        if (await completeAuth(payload.user as unknown as User)) return;
      }
      setErrorMessage("Signed in, but could not load your profile. Try refreshing.");
    } catch (error) {
      const message = error instanceof Error ? error.message : "Invalid or expired code.";
      setErrorMessage(message);
    } finally { setVerifying(false); }
  };

  useEffect(() => {
    if (verificationCode.trim().length === 6 && otpStep && !verifying) {
      void verifyOtpCode();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [verificationCode, otpStep, verifying]);

  return (
    <div className="relative flex min-h-0 flex-1 flex-col justify-center overflow-hidden bg-[var(--surface-app)] px-6 py-12 sm:px-10 lg:px-16">
      <div className="pointer-events-none absolute -right-40 -top-40 h-80 w-80 rounded-full bg-[var(--brand-500)]/5 blur-[120px]" />
      <div className="mx-auto w-full max-w-sm">
        <FadeInScale delay={0.05}>
          <button
            type="button"
            onClick={() => router.push("/")}
            className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-[var(--ink-500)] transition hover:text-[var(--ink-700)]"
          >
            <ArrowLeft size={14} />
            Back to home
          </button>
        </FadeInScale>
        <FadeInScale delay={0.1}>
          <div className="mb-8">
            <p className="text-xs font-semibold uppercase tracking-[0.2em] text-[var(--brand-700)]">
              Secure Access
            </p>
            <h2 className="mt-2 text-3xl font-extrabold tracking-tight text-[var(--ink-950)]">
              Welcome to {appName}
            </h2>
            <p className="mt-2 text-sm leading-[1.6] text-[var(--ink-500)]">
              Sign in or create an account with a one-time login link sent to your email.
            </p>
          </div>
        </FadeInScale>

        <FadeInScale delay={0.2}>
          <motion.div layout className="space-y-3">
            {otpStep ? (
              <AnimatePresence mode="wait">
                <motion.div
                  key="otp"
                  initial={{ opacity: 0, y: 16 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -16 }}
                  transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                  className="space-y-4 py-2 text-center"
                >
                  <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl border border-emerald-200 bg-emerald-50">
                    <CheckCircle2 className="h-6 w-6 text-emerald-600" />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-[var(--ink-950)]">Check Your Email</p>
                    <p className="mt-1 text-xs leading-5 text-[var(--ink-500)]">
                      We sent a verification code to{" "}
                      <span className="font-medium text-[var(--ink-700)]">{emailAddress}</span>
                    </p>
                  </div>
                  <div className="space-y-2">
                    <Input
                      type="text"
                      inputMode="numeric"
                      autoComplete="one-time-code"
                      placeholder="Enter code from email"
                      size="lg"
                      className="text-center font-mono text-lg tracking-widest placeholder:text-sm placeholder:tracking-normal"
                      value={verificationCode}
                      onChange={(e) => setVerificationCode(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") void verifyOtpCode(); }}
                      maxLength={8}
                      autoFocus
                    />
                    <PressScale as="div">
                      <Button
                        size="lg"
                        className="w-full"
                        onClick={verifyOtpCode}
                        disabled={verifying || verificationCode.trim().length < 6}
                        loading={verifying}
                        rightIcon={!verifying ? <ArrowRight size={15} /> : undefined}
                      >
                        {verifying ? "Verifying\u2026" : "Verify & Sign In"}
                      </Button>
                    </PressScale>
                  </div>
                  <div className="rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] p-3 text-left">
                    <p className="text-xs leading-[1.6] text-[var(--ink-500)]">
                      Code valid for 24&nbsp;hours.{" "}
                      <button type="button" onClick={() => { setOtpStep(false); setErrorMessage(""); setVerificationCode(""); }}
                        className="text-[var(--brand-700)] underline underline-offset-2 transition hover:text-[var(--brand-500)]">Use a different email</button>{" "}
                      or{" "}
                      <button type="button" onClick={() => { setVerificationCode(""); void sendEmailLink(); }}
                        className="text-[var(--brand-700)] underline underline-offset-2 transition hover:text-[var(--brand-500)]">resend code</button>.
                    </p>
                  </div>
                </motion.div>
              </AnimatePresence>
            ) : (
              <motion.div
                key="email"
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: [0.2, 0.8, 0.2, 1] }}
                className="space-y-3"
              >
                <Input
                  type="email"
                  inputMode="email"
                  autoComplete="email"
                  placeholder="you@example.com"
                  size="lg"
                  leftIcon={<Mail className="h-4 w-4" />}
                  value={emailAddress}
                  onChange={(e) => setEmailAddress(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") void sendEmailLink(); }}
                />
                {emailAddress.length > 0 && !isEmailLike(emailAddress) && (
                  <p className="px-1 text-[11px] text-[var(--ink-500)]">
                    Enter a complete email address (e.g. you@example.com)
                  </p>
                )}
                {emailAddress.length > 0 && isEmailLike(emailAddress) && (
                  <p className="flex items-center gap-1 px-1 text-[11px] text-emerald-600">
                    <CheckCircle2 size={11} />
                    Valid email
                  </p>
                )}
                <PressScale as="div">
                  <Button
                    size="lg"
                    className="w-full"
                    onClick={sendEmailLink}
                    disabled={loading}
                    loading={loading}
                    rightIcon={!loading ? <ArrowRight size={15} /> : undefined}
                  >
                    {loading ? "Sending\u2026" : "Send Code"}
                  </Button>
                </PressScale>
                <div className="flex items-start gap-2.5 rounded-xl border border-[var(--surface-border)] bg-[var(--surface-soft)] px-3 py-2.5">
                  <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-[var(--brand-500)]" />
                  <p className="text-xs leading-[1.55] text-[var(--ink-500)]">
                    No password needed &mdash; we&apos;ll email you a verification code. First-time users get an account created automatically.
                  </p>
                </div>


              </motion.div>
            )}

            <AnimatePresence mode="wait">
              {errorMessage ? (
                <motion.div
                  key={errorMessage}
                  initial={{ opacity: 0, y: -8, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: -8, scale: 0.97 }}
                  transition={{ duration: 0.2, ease: [0.2, 0.8, 0.2, 1] }}
                  className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2.5 text-xs text-rose-600"
                >
                  {errorMessage}
                </motion.div>
              ) : null}
            </AnimatePresence>
          </motion.div>
        </FadeInScale>
      </div>
    </div>
  );
}

export function LoginPageClient() {
  return (
    <div className="flex min-h-dvh flex-col bg-[var(--surface-app)] md:flex-row">
      <div className="h-safe-top md:hidden" />
      <div className="flex md:hidden">
        <BrandPanel />
      </div>
      <div className="hidden md:flex md:w-1/2">
        <BrandPanel />
      </div>
      <div className="flex md:w-1/2">
        <AuthForm />
      </div>
      <div className="h-safe-bottom md:hidden" />
    </div>
  );
}
