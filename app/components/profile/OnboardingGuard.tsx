"use client";

import { startTransition, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import { AlertCircle, RefreshCw } from "lucide-react";
import { useProfileContext } from "@/app/components/profile/ProfileContext";

const ONBOARDING_STEPS = ["/onboarding/provider/locality"];

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const { loading, user, profile, errorMessage, refreshProfile } = useProfileContext();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      startTransition(() => {
        router.replace("/");
      });
      return;
    }

    const role = profile?.role;
    const hasLocality = !!profile?.locality_id;
    const needsLocality = role === "provider" || role === "business";

    if (needsLocality && !hasLocality) {
      const isAlreadyOnOnboarding = ONBOARDING_STEPS.some((step) => pathname?.startsWith(step));
      if (!isAlreadyOnOnboarding) {
        startTransition(() => {
          router.replace("/onboarding/provider/locality");
        });
      }
    }
  }, [loading, router, user, profile, pathname]);

  return (
    <>
      {errorMessage && !profile ? (
        <div className="mb-4 flex items-start gap-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3">
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0 text-rose-600" />
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-rose-900">Profile bootstrap failed</p>
            <p className="mt-0.5 text-xs leading-5 text-rose-700">{errorMessage}</p>
          </div>
          <button
            type="button"
            onClick={() => void refreshProfile()}
            className="inline-flex shrink-0 items-center gap-1.5 rounded-full border border-rose-200 bg-white px-3 py-1.5 text-xs font-semibold text-rose-700 transition hover:border-rose-300 hover:text-rose-900"
          >
            <RefreshCw className="h-3.5 w-3.5" />
            Retry
          </button>
        </div>
      ) : null}
      {children}
    </>
  );
}
