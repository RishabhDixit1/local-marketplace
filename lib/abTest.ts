"use client";

import { track } from "@vercel/analytics";
import { useCallback, useMemo } from "react";

function hashString(str: string): number {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    const char = str.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash | 0;
  }
  return Math.abs(hash);
}

function pickVariant(
  testName: string,
  variants: string[],
  userId?: string,
): string {
  if (userId) {
    const hash = hashString(testName + userId);
    return variants[hash % variants.length];
  }
  return variants[Math.floor(Math.random() * variants.length)];
}

export function getVariant(testName: string, userId?: string): string {
  return pickVariant(testName, ["control", "variant"], userId);
}

export function trackEvent(
  eventName: string,
  data?: Record<string, string | number | boolean | null | undefined>,
): void {
  track(eventName, data);
}

export function useABTest(
  testName: string,
  variants?: string[],
): { variant: string; track: (event: string) => void } {
  const variant = useMemo(
    () => pickVariant(testName, variants ?? ["control", "variant"]),
    [testName, variants],
  );

  const trackCallback = useCallback(
    (event: string) => {
      track(event, { testName, variant });
    },
    [testName, variant],
  );

  return { variant, track: trackCallback };
}
