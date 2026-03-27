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
const POST_OWNER_FIELDS = ["user_id", "author_id", "created_by", "requester_id", "owner_id", "provider_id"] as const;

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

    const schedulePostRefreshIfOwnedByProfile = (payload: { new?: Record<string, unknown>; old?: Record<string, unknown> }) => {
      const record =
        payload?.new && typeof payload.new === "object"
          ? payload.new
          : payload?.old && typeof payload.old === "object"
          ? payload.old
          : null;
      if (!record) return;

      const ownerId =
        POST_OWNER_FIELDS.map((field) => record[field]).find((value) => typeof value === "string" && value.length > 0) ||
        "";
      if (ownerId === profileId) {
        scheduleRefresh();
      }
    };

    const channel = supabase
      .channel(`public-profile-live-${profileId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "profiles", filter: `id=eq.${profileId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "trust_scores", filter: `profile_id=eq.${profileId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "profile_sections", filter: `profile_id=eq.${profileId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "services", filter: `profile_id=eq.${profileId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "products", filter: `profile_id=eq.${profileId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "portfolio", filter: `profile_id=eq.${profileId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "work_history", filter: `profile_id=eq.${profileId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "availability", filter: `profile_id=eq.${profileId}` }, scheduleRefresh)
      .on("postgres_changes", { event: "*", schema: "public", table: "payment_methods", filter: `profile_id=eq.${profileId}` }, scheduleRefresh)
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
      .on("postgres_changes", { event: "*", schema: "public", table: "posts" }, schedulePostRefreshIfOwnedByProfile)
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
