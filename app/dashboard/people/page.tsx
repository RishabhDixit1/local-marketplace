"use client";

import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ArrowLeft, Building2, Loader2, MapPin, ShieldCheck, Store, Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";

type Locality = {
  id: string;
  name: string;
  slug: string;
  zone_type: string;
};

type PeopleProfile = {
  id: string;
  full_name: string;
  avatar_url: string;
  locality_name: string;
  trust_score: number;
  completed_jobs: number;
  service_category_ids: string[];
};

export default function PeoplePage() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const [localities, setLocalities] = useState<Locality[]>([]);
  const [selectedLocalityId, setSelectedLocalityId] = useState(
    searchParams.get("locality_id") || ""
  );
  const [people, setPeople] = useState<PeopleProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadingLocalities, setLoadingLocalities] = useState(true);

  const selectedLocalityName = useMemo(() => {
    if (!selectedLocalityId) return null;
    return localities.find((l) => l.id === selectedLocalityId)?.name || null;
  }, [selectedLocalityId, localities]);

  useEffect(() => {
    fetch("/api/localities?zone_type=society&phase=1")
      .then((r) => r.json())
      .then((data) => {
        if (data.ok) setLocalities(data.localities || []);
      })
      .finally(() => setLoadingLocalities(false));
  }, []);

  const loadPeople = useCallback(async (localityId: string) => {
    if (!localityId) {
      setPeople([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await fetchAuthedJson<{ ok: boolean; providers: PeopleProfile[] }>(
        supabase,
        `/api/localities/${localityId}/providers?limit=50`,
        { method: "GET" }
      );
      if (data?.ok) {
        setPeople(data.providers || []);
      }
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedLocalityId) {
      loadPeople(selectedLocalityId);
    } else {
      setPeople([]);
      setLoading(false);
    }
  }, [selectedLocalityId, loadPeople]);

  const handleLocalityChange = (value: string) => {
    setSelectedLocalityId(value);
    const params = new URLSearchParams(searchParams.toString());
    if (value) {
      params.set("locality_id", value);
    } else {
      params.delete("locality_id");
    }
    router.replace(`/dashboard/people?${params.toString()}`);
  };

  return (
    <div className="mx-auto w-full max-w-[1000px] space-y-4 px-3 pb-8 pt-5 sm:px-6 sm:pt-6">
      <div className="flex flex-wrap items-center gap-3">
        <Link
          href="/dashboard"
          className="inline-flex h-8 w-8 items-center justify-center rounded-xl border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300"
        >
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div>
          <h1 className="text-lg font-bold text-slate-900 sm:text-xl">
            {selectedLocalityName ? `${selectedLocalityName} Providers` : "People Directory"}
          </h1>
          <p className="text-xs text-slate-500">
            {selectedLocalityName
              ? `Providers and neighbours in ${selectedLocalityName}`
              : "Find providers and neighbours in your locality"}
          </p>
        </div>
      </div>

      <div className="space-y-3">
        <div className="relative">
          <Building2 className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <select
            value={selectedLocalityId}
            onChange={(e) => handleLocalityChange(e.target.value)}
            className="w-full appearance-none rounded-xl border border-slate-200 bg-white py-2.5 pl-9 pr-8 text-sm text-slate-700 outline-none transition focus:border-[var(--brand-400)] focus:ring-1 focus:ring-[var(--brand-400)]"
          >
            <option value="">All societies (select one to filter)</option>
            {localities.map((loc) => (
              <option key={loc.id} value={loc.id}>
                {loc.name}
              </option>
            ))}
          </select>
          <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-400">
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
            </svg>
          </div>
        </div>

        {loadingLocalities && (
          <div className="flex items-center justify-center py-4">
            <Loader2 className="h-5 w-5 animate-spin text-slate-400" />
          </div>
        )}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <Loader2 className="h-6 w-6 animate-spin text-slate-400" />
        </div>
      ) : !selectedLocalityId ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
          <Users className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">Select a society</p>
          <p className="mt-1 text-xs text-slate-500">
            Choose a locality above to see providers and neighbours in that area
          </p>
        </div>
      ) : people.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-200 bg-slate-50/50 p-10 text-center">
          <MapPin className="mx-auto mb-3 h-10 w-10 text-slate-300" />
          <p className="text-sm font-semibold text-slate-700">No providers found</p>
          <p className="mt-1 text-xs text-slate-500">
            No providers have registered in this locality yet
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-xs text-slate-500">
            <Users className="h-3.5 w-3.5" />
            {people.length} provider{people.length === 1 ? "" : "s"} in this area
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            {people.map((profile) => (
              <Link
                key={profile.id}
                href={`/dashboard/chat?recipientId=${profile.id}`}
                className="flex items-start gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-[var(--brand-300)] hover:shadow-md"
              >
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-[var(--brand-100)] to-[var(--brand-200)] text-lg font-bold text-[var(--brand-700)]">
                  {profile.full_name?.charAt(0)?.toUpperCase() || "?"}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="truncate text-sm font-bold text-slate-900">
                    {profile.full_name || "Unknown"}
                  </h3>
                  {profile.locality_name && (
                    <p className="flex items-center gap-1 text-xs text-slate-500">
                      <MapPin className="h-3 w-3" />
                      {profile.locality_name}
                    </p>
                  )}
                  <div className="mt-1.5 flex flex-wrap items-center gap-2 text-[10px] text-slate-500">
                    {profile.trust_score > 0 && (
                      <span className="rounded-full bg-amber-50 px-2 py-0.5 text-amber-700">
                        ⭐ {profile.trust_score.toFixed(1)}
                      </span>
                    )}
                    {profile.trust_score >= 70 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                        <ShieldCheck className="mr-0.5 inline h-3 w-3" />Trusted
                      </span>
                    )}
                    {profile.completed_jobs > 0 && (
                      <span className="rounded-full bg-emerald-50 px-2 py-0.5 text-emerald-700">
                        {profile.completed_jobs} jobs
                      </span>
                    )}
                    {profile.service_category_ids.length > 0 && (
                      <span className="rounded-full bg-blue-50 px-2 py-0.5 text-blue-700">
                        {profile.service_category_ids.length} services
                      </span>
                    )}
                  </div>
                </div>
                <Store className="mt-1 h-4 w-4 shrink-0 text-slate-300" />
              </Link>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
