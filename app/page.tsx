"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { ArrowRight, CheckCircle2, Clock3, ShieldCheck, Users2 } from "lucide-react";
import { supabase } from "../lib/supabase";
import { ensureProfileForUser, resolveCurrentProfileDestination } from "@/lib/profile/client";
import ServiQLogo from "@/app/components/ServiQLogo";
import { appName, appTagline } from "@/lib/branding";

const AUTH_HARD_TIMEOUT_MS = 30000;
const AUTH_REACHABILITY_TIMEOUT_MS = 5000;

const cleanUrl = (value: string | undefined): string => value?.trim().replace(/\/+$/, "") ?? "";
const isAbortLikeMessage = (value: string): boolean =>
  /aborterror|signal is aborted|aborted without reason/i.test(value);

const getSupabaseConfig = (): { url: string; host: string; anonKey: string } | null => {
  const url = cleanUrl(process.env.NEXT_PUBLIC_SUPABASE_URL);
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY?.trim() ?? "";

  if (!url || !anonKey) return null;

  try {
    return {
      url,
      host: new URL(url).host,
      anonKey,
    };
  } catch {
    return null;
  }
};

const buildSupabaseReachabilityMessage = (host: string): string =>
  `Browser could not complete Supabase auth request (${host}). Check VPN/firewall and disable ad-block/privacy extensions, then retry.`;

type SendLinkResponse = {
  ok: boolean;
  error?: string;
};

const probeSupabaseAuthReachability = async (url: string): Promise<boolean> => {
  const healthPromise = fetch(`${url}/auth/v1/health`, {
    method: "GET",
    cache: "no-store",
  })
    .then(() => true)
    .catch(() => false);

  let timeoutId: number | undefined;
  const timeoutPromise = new Promise<boolean>((resolve) => {
    timeoutId = window.setTimeout(() => resolve(false), AUTH_REACHABILITY_TIMEOUT_MS);
  });

  try {
    return await Promise.race([healthPromise, timeoutPromise]);
  } finally {
    if (timeoutId) window.clearTimeout(timeoutId);
  }
};

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [sent, setSent] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    let active = true;
    let authSubscription: { unsubscribe: () => void } | null = null;

    const redirectAuthenticatedUser = async () => {
      const {
        data: { user },
      } = await supabase.auth.getUser();

      if (!active || !user) return;

      const profile = await ensureProfileForUser(user).catch(() => null);
      if (!active) return;

      router.replace(resolveCurrentProfileDestination(profile));
    };

    const completeLoginFromHash = async () => {
      try {
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const accessToken = hashParams.get("access_token");
        const refreshToken = hashParams.get("refresh_token");
        const authError =
          hashParams.get("error_description") || hashParams.get("error") || hashParams.get("message");

        if (authError) {
          if (active) setErrorMessage(decodeURIComponent(authError));
          return;
        }

        if (accessToken && refreshToken) {
          const { error } = await supabase.auth.setSession({
            access_token: accessToken,
            refresh_token: refreshToken,
          });

          if (!active) return;

          if (error) {
            setErrorMessage(error.message || "Unable to complete sign-in. Please request a new login link.");
            return;
          }

          window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          await redirectAuthenticatedUser();
          return;
        }

        const { data, error } = await supabase.auth.getSession();
        if (!active) return;
        if (error) return;

        if (data.session) {
          await redirectAuthenticatedUser();
          return;
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (!active) return;
          if (event === "SIGNED_IN" && session) {
            void redirectAuthenticatedUser();
          }
        });
        authSubscription = subscription;
      } catch {
        if (active) {
          setErrorMessage("Unable to complete sign-in. Please request a new login link.");
        }
      }
    };

    void completeLoginFromHash();

    return () => {
      active = false;
      authSubscription?.unsubscribe();
    };
  }, [router]);

  const withHardTimeout = async <T,>(promise: Promise<T>, timeoutMs = AUTH_HARD_TIMEOUT_MS): Promise<T> => {
    let timeoutId: number | undefined;

    const timeoutPromise = new Promise<never>((_, reject) => {
      timeoutId = window.setTimeout(() => {
        reject(new Error(`Request timed out after ${Math.round(timeoutMs / 1000)} seconds.`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      if (timeoutId) window.clearTimeout(timeoutId);
    }
  };

  const login = async () => {
    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage("Enter your email address to continue.");
      return;
    }
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      setErrorMessage("No internet connection. Reconnect and try again.");
      return;
    }

    setLoading(true);
    setErrorMessage("");

    const browserOrigin = cleanUrl(typeof window !== "undefined" ? window.location.origin : "");
    if (!browserOrigin) {
      setErrorMessage("Could not resolve app URL for auth redirect. Please refresh and try again.");
      setLoading(false);
      setSent(false);
      return;
    }

    const redirectTo = `${browserOrigin}/auth/callback`;
    const supabaseConfig = getSupabaseConfig();

    if (!supabaseConfig) {
      setErrorMessage(
        "Supabase config is invalid. Check NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY in .env.local."
      );
      setLoading(false);
      setSent(false);
      return;
    }

    try {
      const response = await withHardTimeout(
        fetch("/api/auth/send-link", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: trimmedEmail,
            redirectTo,
          }),
        }),
        AUTH_HARD_TIMEOUT_MS
      );
      const payload = (await response.json().catch(() => null)) as SendLinkResponse | null;

      if (!response.ok || !payload?.ok) {
        const message = payload?.error || "Unable to send login link right now.";

        if (/redirect|site url|not allowed|url/i.test(message)) {
          setErrorMessage(
            `Auth redirect is not allowed. Add ${redirectTo} in Supabase Auth Redirect URLs.`
          );
        } else if (isAbortLikeMessage(message)) {
          setErrorMessage("Request was interrupted before completion. Retry in a few seconds.");
        } else if (/fetch|network|failed to fetch|load failed|dns|firewall|vpn/i.test(message)) {
          const isSupabaseReachable = await probeSupabaseAuthReachability(supabaseConfig.url);

          if (!isSupabaseReachable) {
            setErrorMessage(buildSupabaseReachabilityMessage(supabaseConfig.host));
          } else {
            setErrorMessage(
              "Network request failed in the browser. Disable VPN/ad-block/privacy extensions and retry."
            );
          }
        } else if (/rate|too many/i.test(message)) {
          setErrorMessage("Too many requests. Wait a minute and try again.");
        } else {
          setErrorMessage(message);
        }

        setSent(false);
        return;
      }

      setErrorMessage("");
      setSent(true);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unable to send login link right now.";
      if (/timed out/i.test(message)) {
        const isSupabaseReachable = await probeSupabaseAuthReachability(supabaseConfig.url);

        if (!isSupabaseReachable) {
          setErrorMessage(buildSupabaseReachabilityMessage(supabaseConfig.host));
        } else {
          setErrorMessage(
            "Auth server is taking too long. The link may still arrive shortly, or you can retry now."
          );
        }
      } else if (isAbortLikeMessage(message)) {
        setErrorMessage("Request was interrupted before completion. Retry in a few seconds.");
      } else if (/fetch|network|failed to fetch|load failed/i.test(message)) {
        setErrorMessage(buildSupabaseReachabilityMessage(supabaseConfig.host));
      } else {
        setErrorMessage(
          "Network/auth request failed. Verify Supabase URL/anon key and allowed redirect URLs, then retry."
        );
      }
      setSent(false);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-[var(--surface-app)] px-4 py-5 sm:px-8 sm:py-10">
      <div className="mx-auto max-w-6xl startup-fade">
        <div className="mb-4 flex items-center justify-between gap-3">
          <ServiQLogo compact />
          <span className="rounded-full border border-slate-200 bg-white px-3 py-1 text-[11px] font-semibold text-slate-600">
            Human-centered service network
          </span>
        </div>

        <section className="relative overflow-hidden rounded-[30px] border border-slate-200 bg-white shadow-[0_38px_90px_-52px_rgba(15,23,42,0.45)]">
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_12%_16%,rgba(20,184,166,0.08),transparent_42%),radial-gradient(circle_at_86%_86%,rgba(14,165,233,0.08),transparent_44%)]" />

          <div className="relative grid lg:grid-cols-[1.08fr_0.92fr]">
            <div className="relative overflow-hidden bg-[linear-gradient(158deg,var(--brand-900)_0%,var(--brand-700)_100%)] p-7 text-white sm:p-10">
              <div className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.06)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.04)_1px,transparent_1px)] [background-size:36px_36px]" />

              <div className="relative">
                <ServiQLogo
                  showTagline
                  wordmarkClassName="text-white"
                  taglineClassName="text-white/70"
                  markClassName="border-white/30 bg-white/10 text-white shadow-black/20"
                  markDotClassName="bg-cyan-300"
                  qClassName="text-cyan-300"
                  qRingClassName="border-cyan-300/60"
                />

                <p className="mt-10 text-xs uppercase tracking-[0.22em] text-cyan-100/80">Trusted For Everyday Urgency</p>
                <h1 className="brand-display mt-3 text-4xl font-semibold leading-tight sm:text-5xl">
                  Reliable help for real life, delivered by people nearby.
                </h1>
                <p className="mt-5 max-w-xl text-base text-slate-100/92 sm:text-lg">{appTagline}</p>

                <div className="mt-7 grid gap-3 sm:grid-cols-2">
                  <div className="rounded-2xl border border-white/18 bg-white/10 p-4 backdrop-blur-sm">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <ShieldCheck size={16} className="text-cyan-200" />
                      Verified ecosystem
                    </p>
                    <p className="mt-2 text-xs text-slate-100/80">Profiles, context, and trust signals before each conversation.</p>
                  </div>
                  <div className="rounded-2xl border border-white/18 bg-white/10 p-4 backdrop-blur-sm">
                    <p className="flex items-center gap-2 text-sm font-semibold">
                      <Clock3 size={16} className="text-cyan-200" />
                      Fast turnaround
                    </p>
                    <p className="mt-2 text-xs text-slate-100/80">Post needs in seconds and start response threads immediately.</p>
                  </div>
                </div>

                <div className="mt-7 flex flex-wrap gap-2 text-xs font-medium text-white/90">
                  <span className="rounded-full border border-white/25 bg-white/8 px-3 py-1.5">Live matching</span>
                  <span className="rounded-full border border-white/25 bg-white/8 px-3 py-1.5">Quality-first</span>
                  <span className="rounded-full border border-white/25 bg-white/8 px-3 py-1.5">Built for trust</span>
                </div>
              </div>
            </div>

            <div className="p-7 sm:p-10 lg:p-12 startup-fade-delay">
              <div className="mx-auto w-full max-w-md">
                <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">Secure Access</p>
                <h2 className="brand-display mt-2 text-3xl font-semibold text-slate-900 sm:text-[2rem]">Welcome to {appName}</h2>
                <p className="mt-2 text-sm leading-6 text-slate-600">Use your email to receive a secure passwordless sign-in link.</p>

                {!sent ? (
                  <div className="mt-8 space-y-4">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-slate-700">Email address</label>
                      <input
                        type="email"
                        placeholder="you@example.com"
                        className="focus-ring w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-slate-900 placeholder:text-slate-400"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                      />
                    </div>

                    {!!errorMessage && (
                      <div className="rounded-xl border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {errorMessage}
                      </div>
                    )}

                    <button
                      onClick={login}
                      disabled={loading}
                      className="focus-ring inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[var(--brand-900)] px-4 py-3 text-sm font-semibold text-white transition hover:bg-[var(--brand-700)] disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loading ? "Sending Secure Link..." : "Send Login Link"}
                      {!loading ? <ArrowRight size={14} /> : null}
                    </button>

                    <p className="text-xs text-slate-500">Passwordless login. Secure by default.</p>
                  </div>
                ) : (
                  <div className="mt-8 rounded-2xl border border-emerald-200 bg-emerald-50 p-5">
                    <div className="flex items-start gap-3">
                      <span className="mt-0.5 inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                        <CheckCircle2 size={16} />
                      </span>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-emerald-900">Check your email</h3>
                        <p className="mt-1 text-sm text-emerald-800">
                          We sent a secure sign-in link to <span className="font-semibold">{email}</span>.
                        </p>
                        <p className="mt-2 text-xs text-emerald-700/90">Delivery can take 30-90 seconds. Check spam/promotions if needed.</p>
                      </div>
                    </div>

                    {!!errorMessage && (
                      <div className="mt-3 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-xs text-rose-700">
                        {errorMessage}
                      </div>
                    )}

                    <button
                      onClick={login}
                      disabled={loading}
                      className="focus-ring mt-4 inline-flex w-full items-center justify-center rounded-xl border border-emerald-300 bg-white px-4 py-2.5 text-sm font-semibold text-emerald-800 transition hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-70"
                    >
                      {loading ? "Sending..." : "Send Again"}
                    </button>
                  </div>
                )}

                <div className="mt-6 rounded-xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <p className="flex items-center gap-2 text-xs font-semibold uppercase tracking-[0.14em] text-slate-500">
                    <Users2 size={13} />
                    Single account model
                  </p>
                  <p className="mt-1 text-sm text-slate-700">Switch between seeking and providing services with the same account.</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <p className="mt-4 text-center text-xs text-slate-500">
          {appName} is built for local communities. Powered by Supabase and Next.js.
        </p>
      </div>
    </div>
  );
}
