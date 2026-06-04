"use client";

import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Loader2, UserPen } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

type ProfileValues = {
  full_name: string;
  headline: string;
  bio: string;
  phone: string;
  website: string;
};

export default function ProviderProfileOnboarding() {
  const router = useRouter();
  const [values, setValues] = useState<ProfileValues>({
    full_name: "",
    headline: "",
    bio: "",
    phone: "",
    website: "",
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase.from("profiles").select("full_name, headline, bio, phone, website").eq("id", user.id).single();
      if (data) {
        setValues({
          full_name: data.full_name || "",
          headline: data.headline || "",
          bio: data.bio || "",
          phone: data.phone || "",
          website: data.website || "",
        });
      }
      setLoading(false);
    };
    void loadProfile();
  }, []);

  const set = (field: keyof ProfileValues) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    setValues((prev) => ({ ...prev, [field]: e.target.value }));
  };

  const handleSubmit = useCallback(async () => {
    setSaving(true);
    setError("");
    try {
      const result = await fetchAuthedJson<{ ok: boolean; message?: string }>(
        supabase,
        "/api/profile/save",
        {
          method: "POST",
          body: JSON.stringify({
            values: {
              full_name: values.full_name,
              headline: values.headline,
              bio: values.bio,
              phone: values.phone,
              website: values.website,
            },
          }),
        }
      );
      if (result?.ok) {
        router.push("/onboarding/provider/publish");
      } else {
        setError(result?.message || "Failed to save profile");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setSaving(false);
    }
  }, [values, router]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div>
      <div className="mb-6">
        <div className="mx-auto mb-3 flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--brand-100)]">
          <UserPen className="h-6 w-6 text-[var(--brand-700)]" />
        </div>
        <h1 className="text-center text-xl font-bold text-slate-900">Complete your business profile</h1>
        <p className="mt-1 text-center text-sm text-slate-500">
          Help customers learn more about your services
        </p>
      </div>

      {error && (
        <div className="mb-4 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2 text-sm text-rose-700">{error}</div>
      )}

      <div className="space-y-4">
        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Business / Display Name *</label>
          <input
            type="text"
            value={values.full_name}
            onChange={set("full_name")}
            placeholder="Your business name"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Headline</label>
          <input
            type="text"
            value={values.headline}
            onChange={set("headline")}
            placeholder="e.g. Certified Electrician with 10+ years experience"
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
          />
        </div>

        <div>
          <label className="mb-1.5 block text-xs font-semibold text-slate-600">Bio</label>
          <textarea
            value={values.bio}
            onChange={set("bio")}
            placeholder="Tell customers about yourself and your services"
            rows={3}
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
          />
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Phone</label>
            <input
              type="tel"
              value={values.phone}
              onChange={set("phone")}
              placeholder="+91 98765 43210"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
            />
          </div>
          <div>
            <label className="mb-1.5 block text-xs font-semibold text-slate-600">Website</label>
            <input
              type="url"
              value={values.website}
              onChange={set("website")}
              placeholder="https://example.com"
              className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2.5 text-sm outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
            />
          </div>
        </div>
      </div>

      <div className="mt-6 space-y-3">
        <button
          type="button"
          onClick={() => void handleSubmit()}
          disabled={saving || !values.full_name}
          className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:bg-[var(--brand-800)] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {saving ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" /> Saving...
            </>
          ) : (
            "Continue"
          )}
        </button>
        <button
          type="button"
          onClick={() => router.push("/onboarding/provider/publish")}
          className="w-full rounded-2xl border border-slate-200 bg-white py-3 text-sm font-semibold text-slate-600 transition hover:bg-slate-50"
        >
          Skip for now
        </button>
      </div>
    </div>
  );
}
