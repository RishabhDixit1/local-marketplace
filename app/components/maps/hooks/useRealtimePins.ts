"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { MarketplaceMapItem, RealtimeMarketplacePin } from "@/app/components/maps/types";

const ENTER_ANIMATION_MS = 1200;
const EXIT_ANIMATION_MS = 720;
const LIVE_WINDOW_MS = 14000;

const toStablePin = (item: MarketplaceMapItem, index: number, now: number): RealtimeMarketplacePin => ({
  ...item,
  phase: "stable",
  firstSeenAt: now,
  lastSeenAt: now,
  isNew: false,
  order: index,
});

export const useRealtimePins = (items: MarketplaceMapItem[]) => {
  const initialisedRef = useRef(false);
  const [pins, setPins] = useState<RealtimeMarketplacePin[]>(() => {
    const now = Date.now();
    return items.map((item, index) => toStablePin(item, index, now));
  });

  useEffect(() => {
    const now = Date.now();

    setPins((current) => {
      const previousById = new Map(current.map((pin) => [pin.id, pin]));
      const incomingIds = new Set(items.map((item) => item.id));
      const nextPins: RealtimeMarketplacePin[] = [];

      items.forEach((item, index) => {
        const existing = previousById.get(item.id);

        if (!existing) {
          nextPins.push({
            ...item,
            phase: initialisedRef.current ? "entering" : "stable",
            firstSeenAt: now,
            lastSeenAt: now,
            isNew: initialisedRef.current,
            order: index,
          });
          return;
        }

        const isStillEntering = existing.phase === "entering" && now - existing.firstSeenAt < ENTER_ANIMATION_MS;

        nextPins.push({
          ...existing,
          ...item,
          phase: isStillEntering ? "entering" : "stable",
          lastSeenAt: now,
          isNew: now - existing.firstSeenAt < LIVE_WINDOW_MS,
          order: index,
        });
      });

      current.forEach((pin) => {
        if (incomingIds.has(pin.id) || pin.phase === "exiting") {
          return;
        }

        nextPins.push({
          ...pin,
          phase: "exiting",
          lastSeenAt: now,
          isNew: false,
          order: pin.order + items.length + 1,
        });
      });

      return nextPins.sort((left, right) => left.order - right.order);
    });

    initialisedRef.current = true;
  }, [items]);

  useEffect(() => {
    if (!pins.length) {
      return;
    }

    const now = Date.now();
    let nextUpdateAt = Number.POSITIVE_INFINITY;

    pins.forEach((pin) => {
      if (pin.phase === "entering") {
        nextUpdateAt = Math.min(nextUpdateAt, pin.firstSeenAt + ENTER_ANIMATION_MS);
      }
      if (pin.phase === "exiting") {
        nextUpdateAt = Math.min(nextUpdateAt, pin.lastSeenAt + EXIT_ANIMATION_MS);
      }
      if (pin.isNew) {
        nextUpdateAt = Math.min(nextUpdateAt, pin.firstSeenAt + LIVE_WINDOW_MS);
      }
    });

    if (!Number.isFinite(nextUpdateAt)) {
      return;
    }

    const timeoutId = window.setTimeout(
      () => {
        const updateAt = Date.now();
        setPins((current) =>
          current
            .filter((pin) => !(pin.phase === "exiting" && updateAt - pin.lastSeenAt >= EXIT_ANIMATION_MS))
            .map((pin) => ({
              ...pin,
              phase:
                pin.phase === "entering" && updateAt - pin.firstSeenAt >= ENTER_ANIMATION_MS ? "stable" : pin.phase,
              isNew: updateAt - pin.firstSeenAt < LIVE_WINDOW_MS,
            }))
        );
      },
      Math.max(60, nextUpdateAt - now + 16)
    );

    return () => {
      window.clearTimeout(timeoutId);
    };
  }, [pins]);

  const livePins = useMemo(() => pins.filter((pin) => pin.phase !== "exiting"), [pins]);
  const recentPins = useMemo(() => livePins.filter((pin) => pin.isNew), [livePins]);

  return {
    pins,
    livePins,
    recentPins,
  };
};
