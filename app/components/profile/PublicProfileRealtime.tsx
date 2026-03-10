"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Activity, Loader2, Radio } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { ProfileRoleFamily } from "@/lib/profile/types";

type PublicProfileRealtimeProps = {
  profileId: string;
  roleFamily: ProfileRoleFamily;
};

type LiveState = "connecting" | "live" | "syncing";

export default function PublicProfileRealtime({ profileId, roleFamily }: PublicProfileRealtimeProps) {
  const router = useRouter();
  const refreshTimerRef = useRef<number | null>(null);
  const [liveState, setLiveState] = useState<LiveState>("connecting");

  useEffect(() => {
    if (!profileId) return;

    const scheduleRefresh = () => {
      setLiveState("syncing");
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }

      refreshTimerRef.current = window.setTimeout(() => {
        router.refresh();
        setLiveState("live");
      }, 250);
    };

    const channel = supabase
      .channel(`public-profile-live-${profileId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${profileId}` }, scheduleRefresh)
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "service_listings", filter: `provider_id=eq.${profileId}` },
        scheduleRefresh
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "product_catalog", filter: `provider_id=eq.${profileId}` },
        scheduleRefresh
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "reviews", filter: `provider_id=eq.${profileId}` }, scheduleRefresh)
      .on(
        "postgres_changes",
        {
          event: "*",
          schema: "public",
          table: "orders",
          filter: `${roleFamily === "provider" ? "provider_id" : "consumer_id"}=eq.${profileId}`,
        },
        scheduleRefresh
      )
      .on("postgres_changes", { event: "*", schema: "public", table: "posts", filter: `user_id=eq.${profileId}` }, scheduleRefresh)
      .subscribe((status) => {
        if (status === "SUBSCRIBED") {
          setLiveState("live");
        }
      });

    return () => {
      if (refreshTimerRef.current) {
        window.clearTimeout(refreshTimerRef.current);
      }
      void supabase.removeChannel(channel);
    };
  }, [profileId, roleFamily, router]);

  return (
    <div className="inline-flex items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1.5 text-xs font-semibold text-emerald-700">
      {liveState === "connecting" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : liveState === "syncing" ? (
        <Activity className="h-3.5 w-3.5" />
      ) : (
        <Radio className="h-3.5 w-3.5" />
      )}
      {liveState === "connecting" ? "Connecting live updates" : liveState === "syncing" ? "Syncing changes" : "Live profile"}
    </div>
  );
}
