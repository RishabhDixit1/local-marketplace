"use client";

/* eslint-disable @next/next/no-img-element */

import { useEffect, useRef, useState } from "react";
import { Camera, Check, Loader2, MapPin, Phone } from "lucide-react";
import { useProfileContext } from "@/app/components/profile/ProfileContext";
import RouteObservability from "@/app/components/RouteObservability";
import { formatCoordinatePair, getCoordinates, isUsableLocationLabel } from "@/lib/geo";
import { saveCurrentUserProfile, uploadProfileAvatar } from "@/lib/profile/client";
import { toProfileFormValues } from "@/lib/profile/utils";
import { supabase } from "@/lib/supabase";
import type { StoredProfileRole } from "@/lib/profile/types";

//  helpers 

const BIO_MAX = 120;

const roleOptions: { value: StoredProfileRole; label: string }[] = [
  { value: "seeker", label: "Seeker  I'\''m looking for services" },
  { value: "provider", label: "Provider  I offer services" },
  { value: "business", label: "Both  I seek & provide" },
];

//  main component 

export default function EditProfilePage() {
  const { user, profile, setProfile, loading } = useProfileContext();

  // form state
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [fullName, setFullName] = useState("");
  const [bio, setBio] = useState("");
  const [role, setRole] = useState<StoredProfileRole>("seeker");
  const [location, setLocation] = useState("");
  const [lat, setLat] = useState<number | null>(null);
  const [lng, setLng] = useState<number | null>(null);

  // ui state
  const [saving, setSaving] = useState(false);
  const [locating, setLocating] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  const fileInputRef = useRef<HTMLInputElement>(null);

  //  populate from context 
  useEffect(() => {
    if (!profile) return;
    setFullName(profile.full_name || profile.name || "");
    setBio(profile.bio || "");
    setRole(profile.role ?? "seeker");
    setLocation(profile.location || "");
    setLat(profile.latitude ?? null);
    setLng(profile.longitude ?? null);
  }, [profile]);

  //  realtime subscription 
  useEffect(() => {
    if (!user?.id) return;

    const channel = supabase
      .channel(`edit-profile-${user.id}`)
      .on(
        "postgres_changes",
        { event: "UPDATE", schema: "public", table: "profiles", filter: `id=eq.${user.id}` },
        (payload) => {
          if (payload.new && setProfile) {
            setProfile(payload.new as typeof profile);
          }
        }
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [user?.id, setProfile]);

  //  avatar picker 
  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  //  gps location 
  const handleGps = () => {
    if (!navigator.geolocation) {
      setError("GPS not supported on this device.");
      return;
    }
    setLocating(true);
    setError("");
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const coordinates = getCoordinates(pos.coords.latitude, pos.coords.longitude);
        setLat(coordinates?.latitude ?? null);
        setLng(coordinates?.longitude ?? null);
        setLocating(false);
      },
      () => {
        setError("Could not get GPS location. You can type your location manually.");
        setLocating(false);
      },
      { enableHighAccuracy: false, timeout: 10000 }
    );
  };

  //  save 
  const handleSave = async () => {
    if (!user?.id) return;
    if (!isUsableLocationLabel(location)) {
      setError("Enter a readable area or city name like \"Koramangala, Bengaluru\", not raw GPS coordinates.");
      return;
    }
    setSaving(true);
    setError("");
    setSaved(false);

    try {
      let avatarUrl: string | null = profile?.avatar_url ?? null;

      // 1. upload new avatar if chosen
      if (avatarFile) {
        const uploadResult = await uploadProfileAvatar({ userId: user.id, file: avatarFile });
        avatarUrl = uploadResult;
        setAvatarFile(null);
      }

      const nextProfile = await saveCurrentUserProfile({
        user,
        values: {
          ...toProfileFormValues(profile ?? null),
          fullName,
          location,
          latitude: lat,
          longitude: lng,
          role: role === "seeker" ? "seeker" : "provider",
          bio,
          interests: profile?.interests || profile?.services || [],
          email: profile?.email || user.email || "",
          phone: profile?.phone || user.phone || "",
          website: profile?.website || "",
          avatarUrl: avatarUrl || "",
          availability: profile?.availability || "available",
        },
      });

      setProfile(nextProfile as typeof profile);

      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save. Please try again.");
    } finally {
      setSaving(false);
    }
  };

  //  derived 
  const displayAvatar = avatarPreview || profile?.avatar_url || null;
  const initials = (fullName || profile?.full_name || "?").charAt(0).toUpperCase();

  if (loading) {
    return (
      <div className="flex min-h-[60vh] items-center justify-center">
        <Loader2 className="h-7 w-7 animate-spin text-slate-400" />
      </div>
    );
  }

  //  render 
  return (
    <div className="mx-auto max-w-lg px-0 pb-10 sm:px-4">
      <RouteObservability route="profile" />

      {/* page title */}
      <div className="mb-6 px-4 sm:px-0">
        <h1 className="text-2xl font-bold text-slate-900">Edit Profile</h1>
        <p className="mt-1 text-sm text-slate-500">Your info is private. Only name, photo, and role show on the marketplace.</p>
      </div>

      {/*  avatar  */}
      <div className="mb-8 flex justify-center">
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className="group relative h-24 w-24 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--brand-400)] focus-visible:ring-offset-2"
          aria-label="Change profile photo"
        >
          {displayAvatar ? (
            <img
              src={displayAvatar}
              alt="Profile photo"
              className="h-24 w-24 rounded-full object-cover ring-2 ring-slate-200"
            />
          ) : (
            <span className="flex h-24 w-24 items-center justify-center rounded-full bg-[var(--brand-900)] text-3xl font-bold text-white ring-2 ring-slate-200">
              {initials}
            </span>
          )}
          <span className="absolute inset-0 flex items-center justify-center rounded-full bg-slate-950/40 opacity-0 transition-opacity group-hover:opacity-100">
            <Camera className="h-6 w-6 text-white" />
          </span>
          <span className="absolute -bottom-1 -right-1 flex h-8 w-8 items-center justify-center rounded-full border-2 border-white bg-[var(--brand-700)] text-white shadow-md">
            <Camera className="h-3.5 w-3.5" />
          </span>
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          className="sr-only"
          onChange={handleAvatarChange}
          aria-label="Upload profile photo"
        />
      </div>

      {/*  fields  */}
      <div className="space-y-4 px-4 sm:px-0">

        {/* Full name */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="edit-full-name">
            Full Name
          </label>
          <input
            id="edit-full-name"
            type="text"
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            placeholder="Your name"
            maxLength={80}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/30"
          />
        </div>

        {/* Bio */}
        <div>
          <label className="mb-1.5 flex items-center justify-between text-sm font-semibold text-slate-700" htmlFor="edit-bio">
            <span>Bio</span>
            <span className={`text-xs font-normal ${bio.length >= BIO_MAX ? "text-rose-500" : "text-slate-400"}`}>
              {bio.length}/{BIO_MAX}
            </span>
          </label>
          <textarea
            id="edit-bio"
            value={bio}
            onChange={(e) => setBio(e.target.value.slice(0, BIO_MAX))}
            placeholder="A short line about you..."
            rows={3}
            className="w-full resize-none rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/30"
          />
        </div>

        {/* Role */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="edit-role">
            Role
          </label>
          <select
            id="edit-role"
            value={role}
            onChange={(e) => setRole(e.target.value as StoredProfileRole)}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/30"
          >
            {roleOptions.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Location */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700" htmlFor="edit-location">
            Location
          </label>
          <div className="flex gap-2">
            <input
              id="edit-location"
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              placeholder="Area, city, or neighbourhood"
              className="min-w-0 flex-1 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-base text-slate-900 shadow-sm outline-none transition focus:border-[var(--brand-500)] focus:ring-2 focus:ring-[var(--brand-400)]/30"
            />
            <button
              type="button"
              onClick={handleGps}
              disabled={locating}
              className="inline-flex shrink-0 items-center gap-1.5 rounded-2xl border border-slate-200 bg-white px-4 py-3.5 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:opacity-60"
              aria-label="Use current GPS location"
            >
              {locating ? <Loader2 className="h-4 w-4 animate-spin" /> : <MapPin className="h-4 w-4" />}
              GPS
            </button>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Keep this label human-readable for nearby discovery. GPS saves precise coordinates separately.
          </p>
          {lat !== null && lng !== null ? (
            <p className="mt-2 text-xs font-medium text-emerald-700">
              Precise coordinates saved: {formatCoordinatePair({ latitude: lat, longitude: lng })}
            </p>
          ) : null}
        </div>

        {/* Phone  read-only */}
        <div>
          <label className="mb-1.5 block text-sm font-semibold text-slate-700">
            Phone <span className="font-normal text-slate-400">(read only)</span>
          </label>
          <div className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3.5 text-base text-slate-500 shadow-sm">
            <Phone className="h-4 w-4 shrink-0 text-slate-400" />
            <span>{profile?.phone ?? user?.phone ?? ""}</span>
          </div>
        </div>

        {/* error */}
        {error ? (
          <p className="rounded-2xl bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">{error}</p>
        ) : null}

        {/* save */}
        <button
          type="button"
          onClick={() => void handleSave()}
          disabled={saving}
          className="mt-2 inline-flex w-full items-center justify-center gap-2 rounded-2xl bg-[var(--brand-900)] px-6 py-4 text-base font-semibold text-white shadow-md transition hover:bg-[var(--brand-700)] disabled:opacity-60 active:scale-[0.98]"
        >
          {saving ? (
            <>
              <Loader2 className="h-5 w-5 animate-spin" />
              Saving...
            </>
          ) : saved ? (
            <>
              <Check className="h-5 w-5" />
              Profile updated
            </>
          ) : (
            "Save"
          )}
        </button>
      </div>
    </div>
  );
}
