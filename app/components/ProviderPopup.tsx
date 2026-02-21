"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

type Props = {
  userId: string;
  children: React.ReactNode;
};

type Profile = {
  name: string;
  location: string;
  bio: string;
  role: string;
  services: string[];
  availability: string;
  avatar_url?: string;
};

export default function ProviderPopup({
  userId,
  children,
}: Props) {
  const [profile, setProfile] =
    useState<Profile | null>(null);

  const [show, setShow] = useState(false);

  useEffect(() => {
    if (!userId) return;

    const fetchProfile = async () => {
      const { data } = await supabase
        .from("profiles")
        .select("*")
        .eq("id", userId)
        .single();

      if (data) setProfile(data);
    };

    fetchProfile();
  }, [userId]);

  return (
    <div
      className="relative inline-block"
      onMouseEnter={() => setShow(true)}
      onMouseLeave={() => setShow(false)}
    >
      {children}

      {show && profile && (
        <div className="absolute z-50 top-14 left-0 w-72 bg-slate-900 border border-slate-800 rounded-2xl p-4 shadow-2xl animate-in fade-in">

          {/* Header */}
          <div className="flex items-center gap-3 mb-3">
            <img
              src={
                profile.avatar_url ||
                "https://i.pravatar.cc/150"
              }
              className="w-12 h-12 rounded-full"
            />

            <div>
              <h4 className="font-semibold">
                {profile.name || "Provider"}
              </h4>
              <p className="text-xs text-slate-400">
                {profile.location || "Unknown"}
              </p>
            </div>
          </div>

          {/* Role */}
          <div className="text-xs bg-indigo-600 inline-block px-2 py-1 rounded mb-2">
            {profile.role || "Provider"}
          </div>

          {/* Bio */}
          <p className="text-sm text-slate-300 mb-3">
            {profile.bio ||
              "No bio added yet."}
          </p>

          {/* Services */}
          <div className="flex flex-wrap gap-1">
            {profile.services?.map(
              (service, i) => (
                <span
                  key={i}
                  className="text-xs bg-slate-800 px-2 py-1 rounded"
                >
                  {service}
                </span>
              )
            )}
          </div>

          {/* Availability */}
          <div className="mt-3 text-xs text-green-400">
            ● {profile.availability || "Available"}
          </div>
        </div>
      )}
    </div>
  );
}