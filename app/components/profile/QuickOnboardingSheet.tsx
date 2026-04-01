"use client";

import { useMemo, useState } from "react";
import { Loader2, MapPin, Phone, UserRound } from "lucide-react";
import { useProfileContext } from "@/app/components/profile/ProfileContext";
import { saveCurrentUserProfile } from "@/lib/profile/client";
import { toProfileFormValues } from "@/lib/profile/utils";
import { supabase } from "@/lib/supabase";

type RoleChoice = "user" | "provider" | "both";

export default function QuickOnboardingSheet() {
  const { user, profile, setProfile } = useProfileContext();
  const [name, setName] = useState(profile?.full_name || profile?.name || "");
  const [location, setLocation] = useState(profile?.location || "");
  const [phone, setPhone] = useState(profile?.phone || "");
  const [roleChoice, setRoleChoice] = useState<RoleChoice>(
    profile?.role === "business" ? "both" : profile?.role === "seeker" ? "user" : "provider"
  );
  const [locating, setLocating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const shouldShow = useMemo(() => {
    if (!user || !profile) return false;
    return !profile.onboarding_completed;
  }, [profile, user]);

  if (!shouldShow || !user || !profile) return null;

  const submit = async () => {
    setSaving(true);
    setError("");

    try {
      const nextValues = {
        ...toProfileFormValues(profile),
        fullName: name,
        location,
        phone,
        role: (roleChoice === "user" ? "seeker" : "provider") as "seeker" | "provider",
      };

      const nextProfile = await saveCurrentUserProfile({
        user: { id: user.id, email: user.email || undefined },
        values: nextValues,
      });

      const metadata = {
        ...(nextProfile.metadata || {}),
        onboardingRoleChoice: roleChoice,
      };

      const storedRole = roleChoice === "user" ? "seeker" : roleChoice === "both" ? "business" : "provider";

      const { data, error: metadataError } = await supabase
        .from("profiles")
        .update({ metadata, role: storedRole })
        .eq("id", user.id)
        .select("*")
        .maybeSingle();

      if (!metadataError && data) {
        setProfile(data as typeof nextProfile);
      } else {
        setProfile(nextProfile);
      }
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Unable to save onboarding details.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1800] grid place-items-end bg-slate-950/45 p-3 sm:place-items-center">
      <div className="w-full max-w-md rounded-3xl border border-slate-200 bg-white p-5 shadow-2xl">
        <h2 className="text-xl font-bold text-slate-900">Quick setup</h2>
        <p className="mt-1 text-sm text-slate-600">Complete these basics and start using ServiQ in under 30 seconds.</p>

        <div className="mt-4 space-y-3">
          <label className="block">
            <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
              <UserRound className="h-3.5 w-3.5" /> Name
            </span>
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder="Your full name"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
            />
          </label>

          <label className="block">
            <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">Role</span>
            <select
              value={roleChoice}
              onChange={(event) => setRoleChoice(event.target.value as RoleChoice)}
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
            >
              <option value="user">User</option>
              <option value="provider">Provider</option>
              <option value="both">Both</option>
            </select>
          </label>

          <label className="block">
            <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
              <MapPin className="h-3.5 w-3.5" /> Location
            </span>
            <div className="space-y-2">
              <input
                value={location}
                onChange={(event) => setLocation(event.target.value)}
                placeholder="City or area"
                className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
              />
              <button
                type="button"
                disabled={locating}
                onClick={() => {
                  if (!navigator.geolocation) {
                    setError("GPS is not supported on this device.");
                    return;
                  }
                  setLocating(true);
                  setError("");
                  navigator.geolocation.getCurrentPosition(
                    (position) => {
                      const { latitude, longitude } = position.coords;
                      setLocation(`GPS ${latitude.toFixed(5)}, ${longitude.toFixed(5)}`);
                      setLocating(false);
                    },
                    () => {
                      setError("Could not fetch GPS location. You can still enter city manually.");
                      setLocating(false);
                    },
                    { enableHighAccuracy: false, timeout: 10000 }
                  );
                }}
                className="w-full rounded-xl border border-slate-200 px-3 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                {locating ? "Fetching GPS..." : "Use current GPS location"}
              </button>
            </div>
          </label>

          <label className="block">
            <span className="mb-1 inline-flex items-center gap-1 text-xs font-semibold text-slate-600">
              <Phone className="h-3.5 w-3.5" /> Phone
            </span>
            <input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="10-digit mobile number"
              className="w-full rounded-xl border border-slate-200 px-3 py-2.5 text-sm text-slate-900"
            />
          </label>
        </div>

        {error ? <p className="mt-3 rounded-xl bg-rose-50 px-3 py-2 text-xs font-medium text-rose-700">{error}</p> : null}

        <button
          type="button"
          disabled={saving}
          onClick={() => void submit()}
          className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-indigo-600 px-4 py-3 text-sm font-semibold text-white hover:bg-indigo-500 disabled:opacity-60"
        >
          {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
          Continue to app
        </button>
      </div>
    </div>
  );
}
