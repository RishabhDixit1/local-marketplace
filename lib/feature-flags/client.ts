import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";

const flagCache = new Map<string, boolean>();

export function useFeatureFlag(flagKey: string): boolean {
  const [enabled, setEnabled] = useState(() => flagCache.get(flagKey) ?? false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      const res = await fetch(
        `/api/feature-flags/check?key=${encodeURIComponent(flagKey)}${user?.id ? `&userId=${encodeURIComponent(user.id)}` : ""}`
      );
      if (cancelled) return;
      if (res.ok) {
        const body = (await res.json()) as { enabled: boolean };
        flagCache.set(flagKey, body.enabled);
        setEnabled(body.enabled);
      }
    })();
    return () => { cancelled = true; };
  }, [flagKey]);

  return enabled;
}
