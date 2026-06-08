"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase-browser";
import ServiQLogo from "@/app/components/ServiQLogo";
import { appName, appTagline } from "@/lib/branding";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in...");
  const handledRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    const fallbackTimeout = window.setTimeout(() => {
      if (!cancelled) {
        setMessage("Sign-in is taking longer than expected. Redirecting to login...");
        router.replace("/");
      }
    }, 60000);

    const redirectToDestination = async (session: NonNullable<Awaited<ReturnType<typeof supabase.auth.getSession>>["data"]["session"]>) => {
      if (handledRef.current || cancelled) return;
      handledRef.current = true;

      const providers = session.user.app_metadata?.providers;
      const providerList = Array.isArray(providers) ? providers : [];
      const needsPassword = !session.user.user_metadata?.password_set && providerList.includes("email");
      if (needsPassword) {
        if (!cancelled) router.replace("/auth/set-password");
        return;
      }
      const { ensureProfileForUser, resolveCurrentProfileDestination } = await import("@/lib/profile/client");
      const profile = await ensureProfileForUser(session.user).catch(() => null);
      if (!cancelled) {
        router.replace(resolveCurrentProfileDestination(profile));
      }
    };

    const completeLogin = async () => {
      let subscription: { unsubscribe: () => void } | null = null;

      // Register auth listener FIRST so no SIGNED_IN event is missed
      // between getSession() checking and the listener being attached.
      const {
        data: { subscription: authSubscription },
      } = supabase.auth.onAuthStateChange((event, session) => {
        if (!cancelled && event === "SIGNED_IN" && session) {
          void redirectToDestination(session);
        }
      });
      subscription = authSubscription;

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
    };
  }, [router]);

  return (
    <main className="min-h-screen grid place-items-center bg-[var(--surface-app)] px-6 py-10">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-7 text-center shadow-[0_24px_60px_-38px_rgba(15,23,42,0.45)] space-y-3 startup-fade">
        <div className="flex justify-center">
          <ServiQLogo compact href="/" ariaLabel="Open homepage" />
        </div>
        <h1 className="brand-display text-2xl font-semibold text-slate-900">Signing You In to {appName}</h1>
        <p className="text-sm text-slate-600">{message}</p>
        <p className="text-xs text-slate-500">{appTagline}</p>
      </div>
    </main>
  );
}
