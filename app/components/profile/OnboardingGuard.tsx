"use client";

import { startTransition, useEffect } from "react";
import { useRouter } from "next/navigation";
import { AlertCircle, Loader2, RefreshCw } from "lucide-react";
import { useProfileContext } from "@/app/components/profile/ProfileContext";

export default function OnboardingGuard({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { loading, user, profile, errorMessage, refreshProfile } = useProfileContext();

  useEffect(() => {
    if (loading) return;

    if (!user) {
      startTransition(() => {
        router.replace("/");
      });
      return;
    }

  }, [loading, router, user]);

  if (loading) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="w-full max-w-xl rounded-[28px] border border-slate-200 bg-white/90 p-6 shadow-xl shadow-slate-200/60 backdrop-blur">
          <div className="flex items-center gap-3 text-slate-700">
            <Loader2 className="h-5 w-5 animate-spin text-indigo-600" />
            <div>
              <p className="text-sm font-semibold">Preparing your dashboard</p>
              <p className="text-xs text-slate-500">Checking your session and loading your profile.</p>
            </div>
          </div>
          <div className="mt-6 space-y-3">
            <div className="h-24 animate-pulse rounded-3xl bg-slate-100" />
            <div className="grid gap-3 sm:grid-cols-2">
              <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
              <div className="h-32 animate-pulse rounded-3xl bg-slate-100" />
            </div>
          </div>
        </div>
      </div>
    );
  }

  if (errorMessage && !profile) {
    return (
      <div className="grid min-h-[60vh] place-items-center">
        <div className="w-full max-w-lg rounded-[28px] border border-rose-200 bg-white p-6 shadow-lg shadow-rose-100">
          <div className="flex items-start gap-3">
            <div className="rounded-2xl bg-rose-100 p-2 text-rose-600">
              <AlertCircle className="h-5 w-5" />
            </div>
            <div className="space-y-2">
              <h2 className="text-lg font-semibold text-slate-900">Profile bootstrap failed</h2>
              <p className="text-sm text-slate-600">{errorMessage}</p>
              <button
                type="button"
                onClick={() => void refreshProfile()}
                className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700 transition hover:border-indigo-300 hover:text-indigo-700"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
