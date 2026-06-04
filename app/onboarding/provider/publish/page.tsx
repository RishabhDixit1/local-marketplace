"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { CheckCircle2, Loader2, Rocket, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

type Profile = {
  id: string;
  full_name: string;
  headline: string;
  bio: string;
  locality_id: string | null;
  service_area_radius_km: number | null;
  phone: string;
  website: string;
};

type Locality = { id: string; name: string };

export default function ProviderPublishOnboarding() {
  const router = useRouter();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [localities, setLocalities] = useState<Locality[]>([]);
  const [slotsCount, setSlotsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [publishing, setPublishing] = useState(false);
  const [published, setPublished] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadData = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: prof } = await supabase
        .from("profiles")
        .select("id, full_name, headline, bio, locality_id, service_area_radius_km, phone, website")
        .eq("id", user.id)
        .single();
      if (prof) setProfile(prof as Profile);

      const locRes = await fetch("/api/localities?phase=1");
      const locJson = await locRes.json();
      if (locJson.ok) setLocalities(locJson.localities || []);

      const slotRes = await fetch(`/api/provider/availability?provider_id=${user.id}`);
      const slotJson = await slotRes.json();
      if (slotJson.ok) setSlotsCount(slotJson.slots?.length ?? 0);

      setLoading(false);
    };
    void loadData();
  }, []);

  const handlePublish = useCallback(async () => {
    setPublishing(true);
    setError("");
    try {
      const result = await fetchAuthedJson<{ ok: boolean; message?: string }>(
        supabase,
        "/api/profile/save",
        {
          method: "POST",
          body: JSON.stringify({
            values: { onboarding_completed: true },
          }),
        }
      );
      if (result?.ok) {
        setPublished(true);
        setTimeout(() => router.push("/dashboard"), 1200);
      } else {
        setError(result?.message || "Failed to publish");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setPublishing(false);
    }
  }, [router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  if (published) {
    return (
      <div className="flex flex-col items-center justify-center py-20 text-center">
        <div className="mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-emerald-100">
          <CheckCircle2 className="h-8 w-8 text-emerald-600" />
        </div>
        <h2 className="text-lg font-bold text-slate-900">You&apos;re live!</h2>
        <p className="mt-1 text-sm text-slate-500">Redirecting to your dashboard...</p>
      </div>
    );
  }

  const localityName = localities.find((l) => l.id === profile?.locality_id)?.name || "Not set";

  return (
    <div>
      <div className="mb-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <Rocket className="h-6 w-6 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-center text-xl font-bold text-slate-900">Review &amp; publish</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Here&apos;s a summary of your provider profile
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="space-y-3">
        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Business Name</p>
          <p className="mt-1 text-sm font-semibold text-slate-900">{profile?.full_name || "Not set"}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Headline</p>
          <p className="mt-1 text-sm text-slate-700">{profile?.headline || "Not set"}</p>
        </div>

        <div className="rounded-2xl border border-slate-200 bg-white p-4">
          <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Bio</p>
          <p className="mt-1 text-sm text-slate-700">{profile?.bio || "Not set"}</p>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Service Area</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">{localityName}</p>
            {profile?.service_area_radius_km && (
              <p className="text-xs text-slate-500">{profile.service_area_radius_km} km radius</p>
            )}
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Availability</p>
            <p className="mt-1 text-sm font-semibold text-slate-900">
              {slotsCount > 0 ? `${slotsCount} time slots set` : "Not configured"}
            </p>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Phone</p>
            <p className="mt-1 text-sm text-slate-700">{profile?.phone || "Not set"}</p>
          </div>
          <div className="rounded-2xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-[0.12em] text-slate-500">Website</p>
            <p className="mt-1 text-sm text-slate-700">{profile?.website || "Not set"}</p>
          </div>
        </div>

        {(!profile?.full_name || !profile?.locality_id || slotsCount === 0) && (
          <div className="flex items-start gap-2 rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
            <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
            <p>
              You can publish now and complete the rest later from your dashboard settings.<br />
              Missing: {!profile?.full_name ? "Business name, " : ""}
              {!profile?.locality_id ? "Service area, " : ""}
              {slotsCount === 0 ? "Availability" : ""}
            </p>
          </div>
        )}

        <button
          type="button"
          onClick={() => void handlePublish()}
          disabled={publishing}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {publishing ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Publishing...
            </>
          ) : (
            <>
              <Rocket className="h-4 w-4" /> Publish Profile
            </>
          )}
        </button>
      </div>
    </div>
  );
}
