"use client";

import type { User } from "@supabase/supabase-js";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { supabase } from "@/lib/supabase";
import { ensureProfileForUser, fetchProfileByUserId, subscribeToCurrentUserProfile } from "@/lib/profile/client";
import type { ProfileRecord } from "@/lib/profile/types";

type ProfileContextValue = {
  user: User | null;
  profile: ProfileRecord | null;
  loading: boolean;
  errorMessage: string;
  refreshProfile: () => Promise<void>;
  setProfile: (profile: ProfileRecord | null) => void;
};

const ProfileContext = createContext<ProfileContextValue | null>(null);
const PROFILE_REALTIME_REFRESH_DEBOUNCE_MS = 280;

export function ProfileProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<ProfileRecord | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState("");
  const requestVersionRef = useRef(0);
  const realtimeRefreshTimerRef = useRef<number | null>(null);
  const realtimeRefreshInFlightRef = useRef(false);
  const realtimeRefreshQueuedRef = useRef(false);

  const refreshProfile = useCallback(async () => {
    const requestVersion = requestVersionRef.current + 1;
    requestVersionRef.current = requestVersion;

    try {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      const activeUser =
        session?.user ||
        (
          await supabase.auth.getUser().catch(() => ({
            data: { user: null },
          }))
        ).data.user;

      if (requestVersion !== requestVersionRef.current) return;

      if (!activeUser) {
        setUser(null);
        setProfile(null);
        setErrorMessage("");
        setLoading(false);
        return;
      }

      setUser(activeUser);
      const ensuredProfile = await ensureProfileForUser(activeUser);
      if (requestVersion !== requestVersionRef.current) return;

      setProfile(ensuredProfile);
      setErrorMessage("");
      setLoading(false);
    } catch (error) {
      if (requestVersion !== requestVersionRef.current) return;

      setLoading(false);
      setErrorMessage(
        error instanceof Error ? error.message : "Unable to load your profile right now. Check your connection and retry."
      );
    }
  }, []);

  useEffect(() => {
    const initialRefreshId = window.setTimeout(() => {
      void refreshProfile();
    }, 0);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.user) {
        setUser(null);
        setProfile(null);
        setLoading(false);
        setErrorMessage("");
        return;
      }

      setLoading(true);
      void refreshProfile();
    });

    return () => {
      window.clearTimeout(initialRefreshId);
      subscription.unsubscribe();
    };
  }, [refreshProfile]);

  useEffect(() => {
    if (!user?.id) return;

    const runRealtimeProfileRefresh = () => {
      if (realtimeRefreshInFlightRef.current) {
        realtimeRefreshQueuedRef.current = true;
        return;
      }

      realtimeRefreshInFlightRef.current = true;
      void fetchProfileByUserId(user.id, user)
        .then((latestProfile) => {
          if (latestProfile?.id) {
            setProfile(latestProfile);
            setErrorMessage("");
          }
        })
        .catch(() => {
          // Ignore transient realtime refresh failures and keep the last known profile in memory.
        })
        .finally(() => {
          realtimeRefreshInFlightRef.current = false;
          if (realtimeRefreshQueuedRef.current) {
            realtimeRefreshQueuedRef.current = false;
            scheduleRealtimeProfileRefresh();
          }
        });
    };

    const scheduleRealtimeProfileRefresh = () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
      }

      realtimeRefreshTimerRef.current = window.setTimeout(() => {
        realtimeRefreshTimerRef.current = null;
        runRealtimeProfileRefresh();
      }, PROFILE_REALTIME_REFRESH_DEBOUNCE_MS);
    };

    const unsubscribe = subscribeToCurrentUserProfile(user.id, scheduleRealtimeProfileRefresh);

    return () => {
      if (realtimeRefreshTimerRef.current) {
        window.clearTimeout(realtimeRefreshTimerRef.current);
        realtimeRefreshTimerRef.current = null;
      }
      realtimeRefreshQueuedRef.current = false;
      unsubscribe();
    };
  }, [user]);

  return (
    <ProfileContext.Provider
      value={{
        user,
        profile,
        loading,
        errorMessage,
        refreshProfile,
        setProfile,
      }}
    >
      {children}
    </ProfileContext.Provider>
  );
}

export const useProfileContext = () => {
  const context = useContext(ProfileContext);
  if (!context) {
    throw new Error("useProfileContext must be used inside ProfileProvider.");
  }
  return context;
};
