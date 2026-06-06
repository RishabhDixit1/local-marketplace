"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Loader2, User } from "lucide-react";

const INTEREST_OPTIONS = [
  "Home Repairs", "Cleaning", "Electrical", "Plumbing",
  "Painting", "Packing & Moving", "Salon & Spa", "Tutoring",
  "Health & Fitness", "Photography", "Tech Support", "Automotive",
  "Event Planning", "Pet Care", "Gardening", "Other",
];

export default function SeekerOnboardingProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data: profile } = await supabase
        .from("profiles")
        .select("full_name, phone, location, interests")
        .eq("id", user.id)
        .maybeSingle<{ full_name: string | null; phone: string | null; location: string | null; interests: string[] }>();
      if (profile) {
        if (profile.full_name) setFullName(profile.full_name);
        if (profile.phone) setPhone(profile.phone);
        if (profile.location) setLocation(profile.location);
        if (profile.interests?.length) setInterests(profile.interests);
      }
      setLoaded(true);
    })();
  }, []);

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((i) => i !== item) : [...prev, item]
    );
  };

  const saveProfile = async () => {
    setSaving(true);
    setError("");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error("Not authenticated");

      const { error: upsertError } = await supabase.from("profiles").upsert({
        id: user.id,
        full_name: fullName.trim(),
        name: fullName.trim(),
        phone: phone.trim(),
        location: location.trim(),
        interests,
      }, { onConflict: "id" });

      if (upsertError) throw upsertError;
      router.push("/onboarding/seeker/publish");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save profile");
      setSaving(false);
    }
  };

  if (!loaded) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-lg px-4 py-12 sm:px-6">
      <div className="text-center">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-slate-100">
          <User className="h-7 w-7 text-slate-700" />
        </div>
        <h1 className="mt-5 text-2xl font-bold tracking-tight text-slate-900">
          Tell us about yourself
        </h1>
        <p className="mt-2 text-sm text-slate-500">
          Help providers know who they&apos;re working with.
        </p>
      </div>

      <div className="mt-8 space-y-4">
        <div>
          <label className="text-sm font-medium text-slate-900">Full name *</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your full name"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">Phone number *</label>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="10-digit mobile number"
            maxLength={10}
            type="tel"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">Your location *</label>
          <input
            value={location}
            onChange={(e) => setLocation(e.target.value)}
            placeholder="City, area, or society name"
            className="mt-1.5 w-full rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
          />
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">
            Things you&apos;re interested in
          </label>
          <p className="text-xs text-slate-500">Select all that apply.</p>
          <div className="mt-2 flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleInterest(item)}
                className={`rounded-full border px-3.5 py-1.5 text-xs font-medium transition ${
                  interests.includes(item)
                    ? "border-slate-900 bg-slate-900 text-white"
                    : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>
      </div>

      {error ? (
        <p className="mt-4 text-sm font-medium text-rose-600">{error}</p>
      ) : null}

      <div className="mt-8 space-y-3">
        <button
          type="button"
          disabled={saving || !fullName.trim() || !phone.trim() || !location.trim()}
          onClick={saveProfile}
          className="flex w-full items-center justify-center gap-2 rounded-xl bg-slate-900 px-5 py-3.5 text-sm font-semibold text-white transition hover:bg-slate-800 disabled:opacity-50"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          {saving ? "Saving..." : "Save & continue"}
          {!saving ? <ArrowRight className="h-4 w-4" /> : null}
        </button>
      </div>
    </div>
  );
}
