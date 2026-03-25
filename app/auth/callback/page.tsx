"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";
import { ensureProfileForUser, resolveCurrentProfileDestination } from "@/lib/profile/client";
import ServiQLogo from "@/app/components/ServiQLogo";
import { appName, appTagline } from "@/lib/branding";

export default function AuthCallbackPage() {
  const router = useRouter();
  const [message, setMessage] = useState("Completing sign-in...");

  useEffect(() => {
    let cancelled = false;
    const fallbackTimeout = window.setTimeout(() => {
      if (!cancelled) {
        setMessage("Sign-in is taking longer than expected. Redirecting to login...");
        router.replace("/");
      }
    }, 30000);

    const completeLogin = async () => {
      let subscription: { unsubscribe: () => void } | null = null;
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

        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session?.user) {
          const profile = await ensureProfileForUser(data.session.user).catch(() => null);
          router.replace(resolveCurrentProfileDestination(profile));
          return;
        }

        const {
          data: { subscription: authSubscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (!cancelled && event === "SIGNED_IN" && session) {
            void ensureProfileForUser(session.user)
              .catch(() => null)
              .then((profile) => {
                if (!cancelled) {
                  router.replace(resolveCurrentProfileDestination(profile));
                }
              });
          }
        });
        subscription = authSubscription;

        return () => subscription?.unsubscribe();
      } catch (error) {
        const message =
          error instanceof Error && error.message
            ? error.message
            : "Unable to complete sign-in. Please request a new OTP or magic link.";
        setMessage(message);
      }
    };

    let unsubscribe: (() => void) | undefined;
    void completeLogin().then((cleanup) => {
      if (cleanup) unsubscribe = cleanup;
    });

    return () => {
      cancelled = true;
      window.clearTimeout(fallbackTimeout);
      if (unsubscribe) unsubscribe();
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
