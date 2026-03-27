"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { ChevronLeft, Loader2 } from "lucide-react";
import DragDropLayout from "@/app/components/profile-builder/DragDropLayout";
import { useProfileContext } from "@/app/components/profile/ProfileContext";
import { supabase } from "@/lib/supabase";
import { createDefaultProfileSections, mergeProfileSections, sortProfileSections, type ProfileSectionRecord } from "@/lib/profile/marketplace";

export default function ProfileLayoutPage() {
  const { profile, loading } = useProfileContext();
  const [sections, setSections] = useState<ProfileSectionRecord[]>([]);
  const [pageLoading, setPageLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!profile?.id) return;

    let active = true;
    setPageLoading(true);
    setErrorMessage("");

    const load = async () => {
      try {
        const { data, error } = await supabase
          .from("profile_sections")
          .select("id,profile_id,section_type,section_order,is_visible,created_at")
          .eq("profile_id", profile.id);

        if (!active) return;

        if (error) {
          setSections(createDefaultProfileSections(profile.id));
          setErrorMessage(error.message);
          return;
        }

        const rows = ((data as ProfileSectionRecord[] | null) || []).filter((row) => row.section_type);
        const merged = rows.length > 0 ? mergeProfileSections(rows, profile.id) : createDefaultProfileSections(profile.id);
        setSections(sortProfileSections(merged));
      } catch (error) {
        if (!active) return;
        setSections(createDefaultProfileSections(profile.id));
        setErrorMessage(error instanceof Error ? error.message : "Unable to load layout sections.");
      } finally {
        if (!active) return;
        setPageLoading(false);
      }
    };

    void load();

    return () => {
      active = false;
    };
  }, [profile?.id]);

  if (loading || pageLoading) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center rounded-[28px] border border-slate-200 bg-white p-8">
        <Loader2 className="h-5 w-5 animate-spin text-slate-500" />
      </div>
    );
  }

  if (!profile?.id) {
    return (
      <div className="space-y-4">
        <div className="rounded-[24px] border border-slate-200 bg-white p-5 text-slate-700">
          Please sign in to edit your profile layout.
        </div>
        <Link href="/dashboard/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950">
          <ChevronLeft className="h-4 w-4" />
          Back to profile
        </Link>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      <div className="flex items-center justify-between gap-3">
        <Link href="/dashboard/profile" className="inline-flex items-center gap-2 text-sm font-semibold text-slate-700 transition hover:text-slate-950">
          <ChevronLeft className="h-4 w-4" />
          Back to profile
        </Link>
      </div>

      {errorMessage ? (
        <div className="rounded-[24px] border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-700">{errorMessage}</div>
      ) : null}

      <DragDropLayout profileId={profile.id} initialSections={sections} />
    </div>
  );
}
