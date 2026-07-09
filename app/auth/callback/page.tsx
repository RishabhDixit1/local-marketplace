"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { PageMeta } from "@/app/components/PageMeta";
import ServiQLogo from "@/app/components/ServiQLogo";
import { appName, appTagline } from "@/lib/branding";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [message, setMessage] = useState("Verifying your identity...");
  const handledRef = useRef(false);

  const steps = [
    { label: "Verifying", progress: 30 },
    { label: "Creating profile", progress: 65 },
    { label: "Redirecting", progress: 100 },
  ];

  useEffect(() => {
    let cancelled = false;
    const fallbackTimeout = window.setTimeout(() => {
      if (!cancelled) {
        setMessage("Sign-in is taking longer than expected. Redirecting to login...");
        setStep(-1);
        router.replace("/");
      }
    }, 60000);

    const redirectToDestination = async (session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>) => {
      if (handledRef.current || cancelled) return;
      handledRef.current = true;

      setStep(1);
      setMessage("Creating your profile...");

      const providers = session.user.app_metadata?.providers;
      const providerList = Array.isArray(providers) ? providers : [];
      const needsPassword = !session.user.user_metadata?.password_set && providerList.includes("email");
      if (needsPassword) {
        if (!cancelled) router.replace("/auth/set-password");
        return;
      }
      const { ensureProfileForUser, resolveCurrentProfileDestination } = await import("@/lib/profile/client");
      const profile = await ensureProfileForUser(session.user).catch(() => null);

      try {
        const referralCode = typeof localStorage !== "undefined" ? localStorage.getItem("referral_code") : null;
        if (referralCode) {
          localStorage.removeItem("referral_code");
          const { fetchAuthedJson } = await import("@/lib/clientApi");
          const res = await fetchAuthedJson(supabase, `/api/referrals?code=${encodeURIComponent(referralCode)}`, {
            method: "PATCH",
          }) as { ok: boolean; message?: string } | null;
          if (res && res.ok === false) {
            console.warn("[callback] Referral redemption failed:", res.message);
          }
        }
      } catch (err) {
        console.error("[callback] Referral redemption error:", err);
      }

      setStep(2);
      setMessage("Redirecting to your dashboard...");

      if (!cancelled) {
        router.replace(resolveCurrentProfileDestination(profile));
      }
    };

    let authSubscription: { unsubscribe: () => void } | null = null;

    const completeLogin = async () => {
      // Register auth listener FIRST so no SIGNED_IN event is missed
      // between getSession() checking and the listener being attached.
      const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
        if (!cancelled && event === "SIGNED_IN" && session) {
          void redirectToDestination(session);
        }
      });
      authSubscription = subscription;

      try {
        const params = new URLSearchParams(window.location.search);
        const hashParams = new URLSearchParams(window.location.hash.replace(/^#/, ""));
        const authCode = params.get("code");
        const authError = params.get("error_description") || params.get("error");
        const hashError = hashParams.get("error_description") || hashParams.get("error");
        const hashAccessToken = hashParams.get("access_token");
        const hashRefreshToken = hashParams.get("refresh_token");
        if (authError) {
          throw new Error(decodeURIComponent(authError));
        }
        if (hashError) {
          throw new Error(decodeURIComponent(hashError));
        }

        if (hashAccessToken && hashRefreshToken) {
          const { error: setSessionError } = await supabase.auth.setSession({
            access_token: hashAccessToken,
            refresh_token: hashRefreshToken,
          });
          if (setSessionError) throw setSessionError;

          if (window.location.hash) {
            window.history.replaceState(null, "", `${window.location.pathname}${window.location.search}`);
          }
        }

        if (authCode) {
          const { error: exchangeError } = await supabase.auth.exchangeCodeForSession(authCode);
          if (exchangeError) throw exchangeError;
        }

        // Session might already be set by the listener above (via SIGNED_IN event
        // from setSession/exchangeCodeForSession). Only redirect if not handled.
        if (!handledRef.current && !cancelled) {
          const { data, error } = await supabase.auth.getSession();
          if (error) throw error;

          if (data.session?.user) {
            await redirectToDestination(data.session);
          }
        }
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Unable to complete sign-in. Please request a new OTP or magic link.";
        setMessage(message);
      }
    };

    void completeLogin();

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimeout);
      authSubscription?.unsubscribe();
    };
  }, [router]);

  const progress = step >= 0 && step < steps.length ? steps[step].progress : step === -1 ? 0 : 100;

  return (
    <main className="min-h-screen grid place-items-center bg-[var(--surface-app)] px-6 py-10">
      <PageMeta title="Signing in" description="Verifying your identity" />
      <div className="w-full max-w-md rounded-2xl border border-[var(--surface-border)] bg-[var(--surface-elevated)] p-7 text-center shadow-[0_24px_60px_-38px_rgba(var(--shadow-rgb),0.45)] space-y-5 startup-fade">
        <div className="flex justify-center">
          <ServiQLogo compact href="/" ariaLabel="Open homepage" />
        </div>
        <h1 className="brand-display text-2xl font-semibold text-[var(--ink-950)]">Signing You In to {appName}</h1>

        <div className="space-y-2">
          <div className="h-2 w-full overflow-hidden rounded-full bg-[var(--surface-soft)]">
            <div
              className="h-full rounded-full bg-gradient-to-r from-[var(--brand-600)] to-[var(--brand-400)] transition-all duration-700 ease-out"
              style={{ width: `${progress}%` }}
            />
          </div>
          <div className="flex justify-between px-0.5">
            {steps.map((s, i) => (
              <span
                key={s.label}
                className={`text-[10px] font-medium transition-colors duration-300 ${
                  i <= step ? "text-[var(--brand-700)]" : "text-[var(--ink-500)]"
                }`}
              >
                {s.label}
              </span>
            ))}
          </div>
        </div>

        <p className="text-sm text-[var(--ink-700)]">{message}</p>
        <p className="text-xs text-[var(--ink-500)]">{appTagline}</p>
      </div>
    </main>
  );
}
