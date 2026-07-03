"use client";

import { useMemo, useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { ArrowRight, Loader2, MapPin, User } from "lucide-react";

const INTEREST_OPTIONS = [
  "Home Repairs", "Cleaning", "Electrical", "Plumbing",
  "Painting", "Packing & Moving", "Salon & Spa", "Tutoring",
  "Health & Fitness", "Photography", "Tech Support", "Automotive",
  "Event Planning", "Pet Care", "Gardening", "Other",
];

function formatPhone(value: string) {
  const digits = value.replace(/\D/g, "").slice(0, 10);
  if (digits.length <= 5) return digits;
  if (digits.length <= 8) return `${digits.slice(0, 5)} ${digits.slice(5)}`;
  return `${digits.slice(0, 5)} ${digits.slice(5, 8)} ${digits.slice(8)}`;
}

function useGeolocation() {
  const [locating, setLocating] = useState(false);
  const [error, setError] = useState("");
  const locate = useCallback(() => {
    return new Promise<string>((resolve) => {
      if (!navigator.geolocation) {
        setError("Geolocation is not supported by your browser.");
        resolve("");
        return;
      }
      setLocating(true);
      setError("");
      navigator.geolocation.getCurrentPosition(
        async (pos) => {
          try {
            const res = await fetch(
              `https://nominatim.openstreetmap.org/reverse?format=json&lat=${pos.coords.latitude}&lon=${pos.coords.longitude}&addressdetails=1`,
              { headers: { "Accept-Language": "en" } }
            );
            const data = await res.json();
            const addr = data.address;
            const parts = [addr.city, addr.town, addr.suburb, addr.village, addr.county].filter(Boolean);
            const city = parts[0] ?? "";
            const state = addr.state ?? "";
            const result = `${city}, ${state}`.replace(/^, |, $/g, "").trim() || "Unknown location";
            setLocating(false);
            resolve(result);
          } catch {
            setLocating(false);
            setError("Could not determine your location.");
            resolve("");
          }
        },
        () => {
          setLocating(false);
          setError("Location access denied. Enter your location manually.");
          resolve("");
        },
        { timeout: 10000 }
      );
    });
  }, []);
  return { locate, locating, error, setError };
}

export default function SeekerOnboardingProfilePage() {
  const router = useRouter();
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [location, setLocation] = useState("");
  const [interests, setInterests] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [loaded, setLoaded] = useState(false);
  const geo = useGeolocation();

  const rawPhone = useMemo(() => phone.replace(/\s/g, ""), [phone]);
  const isValidPhone = rawPhone.length === 10 && /^\d+$/.test(rawPhone);

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

  const handleDetectLocation = async () => {
    const result = await geo.locate();
    if (result) setLocation(result);
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
        phone: rawPhone,
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
          <div className="relative mt-1.5">
            <span className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-sm font-medium text-slate-400">
              +91
            </span>
            <input
              value={formatPhone(phone)}
              onChange={(e) => setPhone(e.target.value)}
              placeholder="XXXXX XXXXX"
              maxLength={12}
              type="tel"
              className="w-full rounded-xl border border-slate-200 px-4 py-3 pl-14 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
          </div>
          {phone.length > 0 && (
            <p className={`mt-1 text-xs ${isValidPhone ? "text-emerald-600" : "text-amber-600"}`}>
              {isValidPhone ? "✓ Valid mobile number" : "Enter a 10-digit mobile number"}
            </p>
          )}
        </div>

        <div>
          <label className="text-sm font-medium text-slate-900">Your location *</label>
          <div className="mt-1.5 flex gap-2">
            <input
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="City, area, or society name"
              className="min-w-0 flex-1 rounded-xl border border-slate-200 px-4 py-3 text-sm outline-none focus:border-slate-400 focus:ring-4 focus:ring-slate-100"
            />
            <button
              type="button"
              disabled={geo.locating}
              onClick={handleDetectLocation}
              className="flex shrink-0 items-center gap-1.5 rounded-xl border border-slate-200 bg-white px-3.5 py-3 text-xs font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:opacity-50"
            >
              {geo.locating ? (
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
              ) : (
                <MapPin className="h-3.5 w-3.5" />
              )}
              Detect
            </button>
          </div>
          {geo.error ? (
            <p className="mt-1 text-xs text-amber-600">{geo.error}</p>
          ) : null}
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
          disabled={saving || !fullName.trim() || !isValidPhone || !location.trim()}
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
