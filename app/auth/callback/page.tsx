"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "../../../lib/supabase";

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
    }, 15000);

    const completeLogin = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        if (error) throw error;

        if (data.session) {
          router.replace("/dashboard");
          return;
        }

        const {
          data: { subscription },
        } = supabase.auth.onAuthStateChange((event, session) => {
          if (event === "SIGNED_IN" && session) {
            router.replace("/dashboard");
          }
        });

        // Cleanup handled by outer return.
        return () => subscription.unsubscribe();
      } catch {
        setMessage("Unable to complete sign-in. Please request a new login link.");
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
    <main className="min-h-screen grid place-items-center px-6 py-10 bg-slate-950 text-white">
      <div className="w-full max-w-md rounded-xl border border-white/10 bg-white/5 p-6 text-center space-y-3">
        <h1 className="text-xl font-semibold">Signing You In</h1>
        <p className="text-sm text-white/80">{message}</p>
      </div>
    </main>
  );
}
