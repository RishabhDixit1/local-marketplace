"use client";

import { useCallback, useDeferredValue, useEffect, useMemo, useRef } from "react";
import { createRoot, type Root } from "react-dom/client";
import maplibregl from "maplibre-gl";
import AnimatedMarker from "@/app/components/maps/AnimatedMarker";
import RealtimeLayer from "@/app/components/maps/RealtimeLayer";
import { COMMAND_CENTER_CAMERA, useMapbox } from "@/app/components/maps/hooks/useMapbox";
import { useRealtimePins } from "@/app/components/maps/hooks/useRealtimePins";
import type { MarketplaceMapItem, RealtimeMarketplacePin } from "@/app/components/maps/types";

const MAX_DOM_MARKERS = 100;
const DENSE_CLUSTER_THRESHOLD = 10;

type MarkerHandle = {
  marker: maplibregl.Marker;
  root: Root;
  cleanup: () => void;
};

type MapCanvasProps = {
  items: MarketplaceMapItem[];
  center?: {
    lat: number;
    lng: number;
  } | null;
  activeItemId?: string | null;
  selectedItemId?: string | null;
  onSelectItem?: (itemId: string) => void;
};

const measurePinSpread = (pins: RealtimeMarketplacePin[]) => {
  const lats = pins.map((pin) => pin.lat);
  const lngs = pins.map((pin) => pin.lng);

  return {
    latSpan: Math.max(...lats) - Math.min(...lats),
    lngSpan: Math.max(...lngs) - Math.min(...lngs),
  };
};

const isDensePinSet = (pins: RealtimeMarketplacePin[]) => {
  if (pins.length < 5) {
    return false;
  }

  const spread = measurePinSpread(pins);
  return spread.latSpan < 0.24 && spread.lngSpan < 0.24;
};

const buildCameraForPins = (
  map: maplibregl.Map,
  pins: RealtimeMarketplacePin[],
  liteMode: boolean,
  center?: {
    lat: number;
    lng: number;
  } | null
) => {
  const bounds = pins.reduce(
    (accumulator, pin) => accumulator.extend([pin.lng, pin.lat]),
    new maplibregl.LngLatBounds([pins[0].lng, pins[0].lat], [pins[0].lng, pins[0].lat])
  );
  if (center) {
    bounds.extend([center.lng, center.lat]);
  }
  const spread = measurePinSpread(pins);
  const compactArea = spread.latSpan < 0.2 && spread.lngSpan < 0.2;
  const pitch = liteMode ? 22 : compactArea ? 40 : COMMAND_CENTER_CAMERA.pitch;
  const bearing = liteMode ? -6 : compactArea ? -12 : COMMAND_CENTER_CAMERA.bearing;

  return map.cameraForBounds(bounds, {
    padding: {
      top: liteMode ? 58 : 72,
      right: liteMode ? 18 : 40,
      bottom: liteMode ? 56 : 52,
      left: liteMode ? 18 : 40,
    },
    maxZoom: compactArea ? (liteMode ? 12.6 : 13.8) : liteMode ? 12.8 : 13.4,
    bearing,
    pitch,
  });
};

export default function MapCanvas({
  items,
  center,
  activeItemId = null,
  selectedItemId = null,
  onSelectItem,
}: MapCanvasProps) {
  const deferredItems = useDeferredValue(items);
  const containerRef = useRef<HTMLDivElement | null>(null);
  const markersRef = useRef<Map<string, MarkerHandle>>(new Map());
  const lastBoundsSignatureRef = useRef("");
  const lastSelectedItemIdRef = useRef<string | null>(null);

  const { map, isReady, isLiteMode } = useMapbox({ containerRef, center });
  const { pins, livePins } = useRealtimePins(deferredItems);
  const useWebGlPins =
    isLiteMode || livePins.length > MAX_DOM_MARKERS || livePins.length >= DENSE_CLUSTER_THRESHOLD || isDensePinSet(livePins);

  const handleSelectItem = useCallback((itemId: string) => {
    onSelectItem?.(itemId);
  }, [onSelectItem]);

  const highlightedItemId = activeItemId ?? selectedItemId ?? livePins[0]?.id ?? null;
  const selectedPin = useMemo(
    () => livePins.find((pin) => pin.id === selectedItemId) || null,
    [livePins, selectedItemId]
  );

  useEffect(() => {
    if (!map || !isReady) {
      return;
    }

    const nextSignature = pins
      .filter((pin) => pin.phase !== "exiting")
      .map((pin) => `${pin.id}:${pin.lat.toFixed(3)}:${pin.lng.toFixed(3)}`)
      .join("|");

    if (!nextSignature || nextSignature === lastBoundsSignatureRef.current) {
      return;
    }

    lastBoundsSignatureRef.current = nextSignature;

    if (livePins.length > 1) {
      const camera = buildCameraForPins(map, livePins, isLiteMode, center || null);
      if (camera) {
        map.easeTo({
          ...camera,
          duration: 1200,
          essential: true,
        });
      }
      return;
    }

    if (livePins.length === 1) {
      map.flyTo({
        center: [livePins[0].lng, livePins[0].lat],
        zoom: isLiteMode ? 12.2 : 13.2,
        pitch: isLiteMode ? 28 : COMMAND_CENTER_CAMERA.pitch,
        bearing: isLiteMode ? -6 : COMMAND_CENTER_CAMERA.bearing,
        speed: 0.75,
        curve: 1.2,
        essential: true,
      });
      return;
    }

    if (center) {
      map.easeTo({
        center: [center.lng, center.lat],
        zoom: isLiteMode ? 10.8 : 12.2,
        pitch: isLiteMode ? 22 : COMMAND_CENTER_CAMERA.pitch,
        bearing: isLiteMode ? -6 : COMMAND_CENTER_CAMERA.bearing,
        duration: 920,
        essential: true,
      });
    }
  }, [center, isLiteMode, isReady, livePins, map, pins]);

  useEffect(() => {
    if (!map || !isReady || !selectedPin || lastSelectedItemIdRef.current === selectedPin.id) {
      return;
    }

    lastSelectedItemIdRef.current = selectedPin.id;
    map.flyTo({
      center: [selectedPin.lng, selectedPin.lat],
      zoom: Math.max(map.getZoom(), isLiteMode ? 12.4 : 13.4),
      pitch: isLiteMode ? 24 : COMMAND_CENTER_CAMERA.pitch,
      bearing: isLiteMode ? -6 : COMMAND_CENTER_CAMERA.bearing,
      speed: 0.78,
      curve: 1.28,
      essential: true,
    });
  }, [isLiteMode, isReady, map, selectedPin]);

  useEffect(() => {
    if (!map || !isReady) {
      return;
    }

    const markerMap = markersRef.current;
    const nextPins = useWebGlPins ? [] : pins;
    const nextIds = new Set(nextPins.map((pin) => pin.id));

    nextPins.forEach((pin) => {
      const existing = markerMap.get(pin.id);

      if (existing) {
        existing.marker.setLngLat([pin.lng, pin.lat]);
        existing.root.render(
          <AnimatedMarker
            active={highlightedItemId === pin.id}
            selected={selectedItemId === pin.id}
            phase={pin.phase}
            urgent={!!pin.urgent}
          />
        );
        return;
      }

      const element = document.createElement("button");
      element.type = "button";
      element.className = "command-center-marker-anchor";
      element.setAttribute("aria-label", `Focus ${pin.title}`);

      const handleClick = () => {
        handleSelectItem(pin.id);
      };

      const handlePointerEnter = () => {
        element.classList.add("is-hovered");
      };

      const handlePointerLeave = () => {
        element.classList.remove("is-hovered");
      };

      element.addEventListener("click", handleClick);
      element.addEventListener("pointerenter", handlePointerEnter);
      element.addEventListener("pointerleave", handlePointerLeave);

      const root = createRoot(element);
      root.render(
        <AnimatedMarker
          active={highlightedItemId === pin.id}
          selected={selectedItemId === pin.id}
          phase={pin.phase}
          urgent={!!pin.urgent}
        />
      );

      const marker = new maplibregl.Marker({
        element,
        anchor: "center",
        pitchAlignment: "map",
        rotationAlignment: "map",
      })
        .setLngLat([pin.lng, pin.lat])
        .addTo(map);

      markerMap.set(pin.id, {
        marker,
        root,
        cleanup: () => {
          element.removeEventListener("click", handleClick);
          element.removeEventListener("pointerenter", handlePointerEnter);
          element.removeEventListener("pointerleave", handlePointerLeave);
        },
      });
    });

    markerMap.forEach((handle, markerId) => {
      if (nextIds.has(markerId)) {
        return;
      }

      handle.cleanup();
      handle.marker.remove();
      handle.root.unmount();
      markerMap.delete(markerId);
    });

    return () => {
      if (!useWebGlPins) {
        return;
      }

      markerMap.forEach((handle, markerId) => {
        handle.cleanup();
        handle.marker.remove();
        handle.root.unmount();
        markerMap.delete(markerId);
      });
    };
  }, [handleSelectItem, highlightedItemId, isReady, map, pins, selectedItemId, useWebGlPins]);

  useEffect(() => {
    const markerMap = markersRef.current;

    return () => {
      markerMap.forEach((handle) => {
        handle.cleanup();
        handle.marker.remove();
        handle.root.unmount();
      });
      markerMap.clear();
    };
  }, []);

  return (
    <>
      <div ref={containerRef} className="h-full w-full" />
      {map && isReady ? (
        <RealtimeLayer
          map={map}
          pins={livePins}
          center={center || null}
          activeItemId={highlightedItemId}
          selectedItemId={selectedItemId}
          useWebGlPins={useWebGlPins}
          liteMode={isLiteMode}
          onSelectItem={handleSelectItem}
        />
      ) : null}
    </>
  );
}
