"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";
import { fetchAuthedJson } from "@/lib/clientApi";
import Image from "next/image";
import { BadgeCheck, Loader2, MapPin, Star, User } from "lucide-react";

type MatchProvider = {
  providerId: string;
  score: number | null;
  name: string;
  avatarUrl: string | null;
  location: string | null;
  category: string | null;
  verificationStatus: string | null;
  trustScore: number | null;
};

export default function TopMatchesBanner({ helpRequestId }: { helpRequestId: string }) {
  const [matches, setMatches] = useState<MatchProvider[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      try {
        const data = await fetchAuthedJson<{ ok: boolean; matches: MatchProvider[] }>(
          supabase,
          `/api/help-requests/${helpRequestId}/top-matches`
        );
        if (!cancelled && data?.matches) {
          setMatches(data.matches);
        }
      } catch {
        // ignore
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    void load();
    return () => { cancelled = true; };
  }, [helpRequestId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-500">
        <Loader2 className="h-4 w-4 animate-spin" />
        Finding nearby providers...
      </div>
    );
  }

  if (matches.length === 0) return null;

  return (
    <div className="rounded-2xl border border-emerald-100 bg-emerald-50 p-4">
      <p className="text-sm font-semibold text-emerald-900">
        Top {matches.length} match{matches.length > 1 ? "es" : ""} found
      </p>
      <p className="text-xs text-emerald-700">
        Providers who can help with your request
      </p>
      <div className="mt-3 space-y-2">
        {matches.map((provider) => (
          <div
            key={provider.providerId}
            className="flex items-center gap-3 rounded-xl bg-white px-3 py-2.5 shadow-sm"
          >
            <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-slate-100 text-xs font-semibold text-slate-600">
              {provider.avatarUrl ? (
                /^(data:image\/|blob:)/i.test(provider.avatarUrl) ? (
                  <img src={provider.avatarUrl} alt="" className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <Image src={provider.avatarUrl} alt="" width={32} height={32} className="h-8 w-8 rounded-full object-cover" />
                )
              ) : (
                <User className="h-4 w-4" />
              )}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-semibold text-slate-900 truncate">
                  {provider.name}
                </span>
                {provider.verificationStatus === "verified" && (
                  <BadgeCheck className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                )}
              </div>
              {provider.location && (
                <div className="flex items-center gap-1 text-xs text-slate-500">
                  <MapPin className="h-3 w-3" />
                  {provider.location}
                </div>
              )}
            </div>
            <div className="flex shrink-0 items-center gap-1 text-xs text-slate-500">
              {provider.trustScore != null && (
                <span className="flex items-center gap-0.5">
                  <Star className="h-3 w-3 text-amber-400" />
                  {provider.trustScore}
                </span>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
