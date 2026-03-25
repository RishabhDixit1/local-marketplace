"use client";

import { useEffect, useRef, useState, type RefObject } from "react";
import maplibregl, { type LayerSpecification, type StyleSpecification } from "maplibre-gl";

const BASE_SOURCE_ID = "command-center-base";
const VECTOR_SOURCE_ID = "command-center-vector";
export const BUILDINGS_LAYER_ID = "command-center-buildings";
export const COMMAND_CENTER_CAMERA = {
  pitch: 46,
  bearing: -14,
} as const;

const AUTO_ROTATION_STEP = 0.02;
const MOBILE_CAMERA = {
  pitch: 22,
  bearing: -4,
} as const;

const COMMAND_CENTER_STYLE: StyleSpecification = {
  version: 8,
  glyphs: "https://tiles.openfreemap.org/fonts/{fontstack}/{range}.pbf",
  sources: {
    [BASE_SOURCE_ID]: {
      type: "raster",
      tiles: [
        "https://a.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://b.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://c.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
        "https://d.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}.png",
      ],
      tileSize: 256,
      attribution: "&copy; OpenStreetMap contributors &copy; CARTO",
    },
    [VECTOR_SOURCE_ID]: {
      type: "vector",
      url: "https://tiles.openfreemap.org/planet",
    },
  },
  layers: [
    {
      id: "command-center-background",
      type: "background",
      paint: {
        "background-color": "#020617",
      },
    },
    {
      id: "command-center-raster",
      type: "raster",
      source: BASE_SOURCE_ID,
      paint: {
        "raster-opacity": 0.98,
        "raster-brightness-max": 0.82,
        "raster-brightness-min": 0.26,
        "raster-contrast": 0.2,
        "raster-saturation": 0.04,
        "raster-fade-duration": 120,
      },
    },
  ],
};

const buildingLayer: LayerSpecification = {
  id: BUILDINGS_LAYER_ID,
  type: "fill-extrusion",
  source: VECTOR_SOURCE_ID,
  "source-layer": "building",
  minzoom: 12.6,
  paint: {
    "fill-extrusion-base": ["coalesce", ["get", "render_min_height"], 0],
    "fill-extrusion-height": ["coalesce", ["get", "render_height"], 18],
    "fill-extrusion-color": [
      "interpolate",
      ["linear"],
      ["coalesce", ["get", "render_height"], 0],
      0,
      "rgba(15,23,42,0.28)",
      18,
      "rgba(30,41,59,0.36)",
      60,
      "rgba(29,78,216,0.34)",
      120,
      "rgba(37,99,235,0.44)",
      240,
      "rgba(56,189,248,0.52)",
    ],
    "fill-extrusion-opacity": 0.72,
    "fill-extrusion-vertical-gradient": true,
  },
};

const applyCommandCenterScene = (map: maplibregl.Map, liteMode: boolean) => {
  if (!map.getLayer(BUILDINGS_LAYER_ID)) {
    map.addLayer(buildingLayer);
  }

  if (liteMode) {
    map.setLayoutProperty(BUILDINGS_LAYER_ID, "visibility", "visible");
    return;
  }

  map.setLayoutProperty(BUILDINGS_LAYER_ID, "visibility", "visible");

  map.setSky({
    "sky-color": "#0f172a",
    "horizon-color": "#1e3a8a",
    "fog-color": "#0f172a",
    "fog-ground-blend": 0.14,
    "horizon-fog-blend": 0.18,
    "sky-horizon-blend": 0.16,
    "atmosphere-blend": 0.24,
  });
};

type UseMapboxParams = {
  containerRef: RefObject<HTMLDivElement | null>;
  center?: {
    lat: number;
    lng: number;
  } | null;
};

const detectLiteMode = () => {
  if (typeof window === "undefined") {
    return false;
  }

  const coarsePointer = window.matchMedia("(pointer: coarse)").matches;
  const narrowViewport = window.matchMedia("(max-width: 768px)").matches;
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  return coarsePointer || narrowViewport || reducedMotion;
};

export const useMapbox = ({ containerRef, center }: UseMapboxParams) => {
  const mapRef = useRef<maplibregl.Map | null>(null);
  const readyRef = useRef(false);
  const interactingRef = useRef(false);
  const [map, setMap] = useState<maplibregl.Map | null>(null);
  const [isReady, setIsReady] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [isLiteMode, setIsLiteMode] = useState(false);

  useEffect(() => {
    const applyMode = () => {
      setIsLiteMode(detectLiteMode());
    };

    applyMode();
    window.addEventListener("resize", applyMode);
    window.addEventListener("orientationchange", applyMode);

    return () => {
      window.removeEventListener("resize", applyMode);
      window.removeEventListener("orientationchange", applyMode);
    };
  }, []);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) {
      return;
    }

    const liteMode = detectLiteMode();

    const map = new maplibregl.Map({
      container: containerRef.current,
      style: COMMAND_CENTER_STYLE,
      center: [center?.lng ?? 77.5946, center?.lat ?? 12.9716],
      zoom: center ? (liteMode ? 10.8 : 11.8) : 5.4,
      pitch: liteMode ? MOBILE_CAMERA.pitch : COMMAND_CENTER_CAMERA.pitch,
      bearing: liteMode ? MOBILE_CAMERA.bearing : COMMAND_CENTER_CAMERA.bearing,
      attributionControl: false,
      dragRotate: !liteMode,
      touchPitch: !liteMode,
      touchZoomRotate: true,
      maxPitch: liteMode ? 46 : 75,
      maxZoom: 18,
      minZoom: 2.2,
    });

    if (liteMode) {
      map.touchZoomRotate.disableRotation();
    }

    mapRef.current = map;
    setMap(map);
    setIsLiteMode(liteMode);
    map.addControl(new maplibregl.AttributionControl({ compact: true }));
    let loadFrame = 0;

    const handleLoad = () => {
      applyCommandCenterScene(map, liteMode);
      loadFrame = window.requestAnimationFrame(() => {
        readyRef.current = true;
        setIsReady(true);
      });
    };

    const beginInteraction = () => {
      interactingRef.current = true;
      setIsDragging(true);
    };

    const endInteraction = () => {
      interactingRef.current = false;
      setIsDragging(false);
    };

    map.on("load", handleLoad);
    map.on("dragstart", beginInteraction);
    map.on("dragend", endInteraction);
    map.on("rotatestart", beginInteraction);
    map.on("rotateend", endInteraction);
    map.on("pitchstart", beginInteraction);
    map.on("pitchend", endInteraction);

    const resize = () => {
      map.resize();
    };

    window.addEventListener("resize", resize);
    window.addEventListener("orientationchange", resize);

    let animationFrame = 0;
    const rotateCamera = () => {
      if (!liteMode && readyRef.current && !interactingRef.current && !document.hidden) {
        map.rotateTo(map.getBearing() + AUTO_ROTATION_STEP, { duration: 0 });
      }
      animationFrame = window.requestAnimationFrame(rotateCamera);
    };

    animationFrame = window.requestAnimationFrame(rotateCamera);

    return () => {
      readyRef.current = false;
      setIsReady(false);
      setIsDragging(false);
      interactingRef.current = false;
      window.cancelAnimationFrame(loadFrame);
      window.cancelAnimationFrame(animationFrame);
      window.removeEventListener("resize", resize);
      window.removeEventListener("orientationchange", resize);
      map.off("load", handleLoad);
      map.off("dragstart", beginInteraction);
      map.off("dragend", endInteraction);
      map.off("rotatestart", beginInteraction);
      map.off("rotateend", endInteraction);
      map.off("pitchstart", beginInteraction);
      map.off("pitchend", endInteraction);
      map.remove();
      mapRef.current = null;
      setMap(null);
    };
  }, [center, containerRef]);

  useEffect(() => {
    if (!map || !readyRef.current) {
      return;
    }

    applyCommandCenterScene(map, isLiteMode);
    map.dragRotate.enable();
    map.touchZoomRotate.enableRotation();

    if (isLiteMode) {
      map.dragRotate.disable();
      map.touchZoomRotate.disableRotation();
      map.easeTo({
        pitch: MOBILE_CAMERA.pitch,
        bearing: MOBILE_CAMERA.bearing,
        duration: 0,
      });
      return;
    }

    map.easeTo({
      pitch: COMMAND_CENTER_CAMERA.pitch,
      bearing: COMMAND_CENTER_CAMERA.bearing,
      duration: 0,
    });
  }, [isLiteMode, map]);

  return {
    map,
    isReady,
    isDragging,
    isLiteMode,
  };
};
