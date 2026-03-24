"use client";

import { useEffect, useMemo, useRef } from "react";
import maplibregl, {
  GeoJSONSource,
  type CircleLayerSpecification,
  type HeatmapLayerSpecification,
  type LineLayerSpecification,
  type SymbolLayerSpecification,
} from "maplibre-gl";
import { BUILDINGS_LAYER_ID, COMMAND_CENTER_CAMERA } from "@/app/components/maps/hooks/useMapbox";
import type { RealtimeMarketplacePin } from "@/app/components/maps/types";

const PIN_SOURCE_ID = "command-center-live-pins";
const ARC_SOURCE_ID = "command-center-live-arcs";
const PARTICLE_SOURCE_ID = "command-center-live-particles";
const RADAR_SOURCE_ID = "command-center-radar";

const HEATMAP_LAYER_ID = "command-center-heatmap";
const CLUSTER_GLOW_LAYER_ID = "command-center-cluster-glow";
const CLUSTER_LAYER_ID = "command-center-clusters";
const CLUSTER_COUNT_LAYER_ID = "command-center-cluster-count";
const UNCLUSTERED_GLOW_LAYER_ID = "command-center-unclustered-glow";
const UNCLUSTERED_CORE_LAYER_ID = "command-center-unclustered-core";
const ARC_GLOW_LAYER_ID = "command-center-arc-glow";
const ARC_LAYER_ID = "command-center-arc";
const PARTICLE_LAYER_ID = "command-center-particles";
const PARTICLE_CORE_LAYER_ID = "command-center-particles-core";
const RADAR_RING_LAYER_ID = "command-center-radar-ring";
const RADAR_CORE_LAYER_ID = "command-center-radar-core";

const hasMapStyle = (map: maplibregl.Map) => Boolean((map as maplibregl.Map & { style?: unknown }).style);

const EMPTY_POINT_COLLECTION: GeoJSON.FeatureCollection<GeoJSON.Point> = {
  type: "FeatureCollection",
  features: [],
};

const EMPTY_LINE_COLLECTION: GeoJSON.FeatureCollection<GeoJSON.LineString> = {
  type: "FeatureCollection",
  features: [],
};

const addRealtimeSourcesAndLayers = (map: maplibregl.Map) => {
  if (!map.getSource(PIN_SOURCE_ID)) {
    map.addSource(PIN_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_POINT_COLLECTION,
      cluster: true,
      clusterMaxZoom: 13,
      clusterRadius: 56,
    });
  }

  if (!map.getSource(ARC_SOURCE_ID)) {
    map.addSource(ARC_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_LINE_COLLECTION,
      lineMetrics: true,
    });
  }

  if (!map.getSource(PARTICLE_SOURCE_ID)) {
    map.addSource(PARTICLE_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_POINT_COLLECTION,
    });
  }

  if (!map.getSource(RADAR_SOURCE_ID)) {
    map.addSource(RADAR_SOURCE_ID, {
      type: "geojson",
      data: EMPTY_POINT_COLLECTION,
    });
  }

  const layerAnchor = map.getLayer(BUILDINGS_LAYER_ID) ? BUILDINGS_LAYER_ID : undefined;

  const heatmapLayer: HeatmapLayerSpecification = {
    id: HEATMAP_LAYER_ID,
    type: "heatmap",
    source: PIN_SOURCE_ID,
    maxzoom: 15,
    paint: {
      "heatmap-weight": [
        "+",
        0.65,
        ["*", ["coalesce", ["get", "urgentWeight"], 0], 0.55],
        ["*", ["coalesce", ["get", "newWeight"], 0], 0.35],
      ],
      "heatmap-intensity": ["interpolate", ["linear"], ["zoom"], 3, 0.25, 9, 0.7, 15, 1.1],
      "heatmap-radius": ["interpolate", ["linear"], ["zoom"], 3, 18, 8, 34, 13, 52],
      "heatmap-opacity": ["interpolate", ["linear"], ["zoom"], 4, 0.38, 11, 0.52, 15, 0.1],
      "heatmap-color": [
        "interpolate",
        ["linear"],
        ["heatmap-density"],
        0,
        "rgba(2,6,23,0)",
        0.15,
        "rgba(29,78,216,0.18)",
        0.45,
        "rgba(37,99,235,0.32)",
        0.75,
        "rgba(56,189,248,0.52)",
        1,
        "rgba(125,211,252,0.72)",
      ],
    },
  };

  const clusterGlowLayer: CircleLayerSpecification = {
    id: CLUSTER_GLOW_LAYER_ID,
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": "rgba(96,165,250,0.26)",
      "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 22, 12, 34, 48, 48],
      "circle-blur": 0.75,
      "circle-opacity": 0.42,
      "circle-stroke-width": 0,
    },
  };

  const clusterLayer: CircleLayerSpecification = {
    id: CLUSTER_LAYER_ID,
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["has", "point_count"],
    paint: {
      "circle-color": ["interpolate", ["linear"], ["get", "point_count"], 2, "#1d4ed8", 10, "#2563eb", 40, "#38bdf8"],
      "circle-radius": ["interpolate", ["linear"], ["get", "point_count"], 2, 16, 12, 24, 48, 34],
      "circle-stroke-color": "rgba(248,250,252,0.94)",
      "circle-stroke-width": 1.2,
      "circle-opacity": 0.78,
    },
  };

  const clusterCountLayer: SymbolLayerSpecification = {
    id: CLUSTER_COUNT_LAYER_ID,
    type: "symbol",
    source: PIN_SOURCE_ID,
    filter: ["has", "point_count"],
    layout: {
      "text-field": ["get", "point_count_abbreviated"],
      "text-font": ["Noto Sans Regular"],
      "text-size": 11,
    },
    paint: {
      "text-color": "#f8fafc",
      "text-halo-color": "rgba(2,6,23,0.82)",
      "text-halo-width": 1,
    },
  };

  const unclusteredGlowLayer: CircleLayerSpecification = {
    id: UNCLUSTERED_GLOW_LAYER_ID,
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "rgba(125,211,252,0.58)",
        ["boolean", ["feature-state", "hover"], false],
        "rgba(96,165,250,0.5)",
        "rgba(59,130,246,0.34)",
      ],
      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        18,
        ["boolean", ["feature-state", "hover"], false],
        15,
        12,
      ],
      "circle-opacity": 0.54,
      "circle-blur": 0.85,
    },
  };

  const unclusteredCoreLayer: CircleLayerSpecification = {
    id: UNCLUSTERED_CORE_LAYER_ID,
    type: "circle",
    source: PIN_SOURCE_ID,
    filter: ["!", ["has", "point_count"]],
    paint: {
      "circle-color": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        "#7dd3fc",
        ["boolean", ["feature-state", "hover"], false],
        "#60a5fa",
        "#2563eb",
      ],
      "circle-radius": [
        "case",
        ["boolean", ["feature-state", "selected"], false],
        7,
        ["boolean", ["feature-state", "hover"], false],
        6,
        5,
      ],
      "circle-stroke-color": "#ffffff",
      "circle-stroke-width": 1.35,
      "circle-opacity": 0.98,
    },
  };

  const arcGlowLayer: LineLayerSpecification = {
    id: ARC_GLOW_LAYER_ID,
    type: "line",
    source: ARC_SOURCE_ID,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-color": "rgba(56,189,248,0.24)",
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 2.2, 12, 4.8],
      "line-opacity": 0.26,
      "line-blur": 1,
    },
  };

  const arcLayer: LineLayerSpecification = {
    id: ARC_LAYER_ID,
    type: "line",
    source: ARC_SOURCE_ID,
    layout: {
      "line-cap": "round",
      "line-join": "round",
    },
    paint: {
      "line-width": ["interpolate", ["linear"], ["zoom"], 4, 1.1, 12, 2.4],
      "line-opacity": 0.62,
      "line-gradient": [
        "interpolate",
        ["linear"],
        ["line-progress"],
        0,
        "rgba(37,99,235,0)",
        0.22,
        "rgba(59,130,246,0.28)",
        0.58,
        "rgba(125,211,252,0.84)",
        1,
        "rgba(125,211,252,0)",
      ],
    },
  };

  const particleLayer: CircleLayerSpecification = {
    id: PARTICLE_LAYER_ID,
    type: "circle",
    source: PARTICLE_SOURCE_ID,
    paint: {
      "circle-color": "rgba(56,189,248,0.24)",
      "circle-radius": ["coalesce", ["get", "size"], 4],
      "circle-opacity": ["coalesce", ["get", "opacity"], 0.22],
      "circle-blur": 0.9,
    },
  };

  const particleCoreLayer: CircleLayerSpecification = {
    id: PARTICLE_CORE_LAYER_ID,
    type: "circle",
    source: PARTICLE_SOURCE_ID,
    paint: {
      "circle-color": "rgba(224,242,254,0.92)",
      "circle-radius": ["max", 0.8, ["*", ["coalesce", ["get", "size"], 4], 0.32]],
      "circle-opacity": ["max", 0.18, ["*", ["coalesce", ["get", "opacity"], 0.18], 0.8]],
    },
  };

  const radarRingLayer: CircleLayerSpecification = {
    id: RADAR_RING_LAYER_ID,
    type: "circle",
    source: RADAR_SOURCE_ID,
    paint: {
      "circle-color": "rgba(56,189,248,0.16)",
      "circle-stroke-color": "rgba(125,211,252,0.66)",
      "circle-stroke-width": 1.2,
      "circle-opacity": 0.34,
      "circle-radius": 28,
      "circle-blur": 0.4,
    },
  };

  const radarCoreLayer: CircleLayerSpecification = {
    id: RADAR_CORE_LAYER_ID,
    type: "circle",
    source: RADAR_SOURCE_ID,
    paint: {
      "circle-color": "#7dd3fc",
      "circle-radius": 4.8,
      "circle-opacity": 0.92,
      "circle-stroke-color": "rgba(255,255,255,0.9)",
      "circle-stroke-width": 1.4,
    },
  };

  if (!map.getLayer(HEATMAP_LAYER_ID)) {
    map.addLayer(heatmapLayer, layerAnchor);
  }
  if (!map.getLayer(CLUSTER_GLOW_LAYER_ID)) {
    map.addLayer(clusterGlowLayer);
  }
  if (!map.getLayer(CLUSTER_LAYER_ID)) {
    map.addLayer(clusterLayer);
  }
  if (!map.getLayer(CLUSTER_COUNT_LAYER_ID)) {
    map.addLayer(clusterCountLayer);
  }
  if (!map.getLayer(UNCLUSTERED_GLOW_LAYER_ID)) {
    map.addLayer(unclusteredGlowLayer);
  }
  if (!map.getLayer(UNCLUSTERED_CORE_LAYER_ID)) {
    map.addLayer(unclusteredCoreLayer);
  }
  if (!map.getLayer(ARC_GLOW_LAYER_ID)) {
    map.addLayer(arcGlowLayer, BUILDINGS_LAYER_ID);
  }
  if (!map.getLayer(ARC_LAYER_ID)) {
    map.addLayer(arcLayer, BUILDINGS_LAYER_ID);
  }
  if (!map.getLayer(PARTICLE_LAYER_ID)) {
    map.addLayer(particleLayer);
  }
  if (!map.getLayer(PARTICLE_CORE_LAYER_ID)) {
    map.addLayer(particleCoreLayer);
  }
  if (!map.getLayer(RADAR_RING_LAYER_ID)) {
    map.addLayer(radarRingLayer);
  }
  if (!map.getLayer(RADAR_CORE_LAYER_ID)) {
    map.addLayer(radarCoreLayer);
  }
};

const curveBetweenPoints = (from: [number, number], to: [number, number], arcHeight = 0.22) => {
  const [fromLng, fromLat] = from;
  const [toLng, toLat] = to;
  const midLng = (fromLng + toLng) / 2;
  const midLat = (fromLat + toLat) / 2;
  const deltaLng = toLng - fromLng;
  const deltaLat = toLat - fromLat;
  const length = Math.hypot(deltaLng, deltaLat) || 1;
  const normalLng = (-deltaLat / length) * arcHeight * length;
  const normalLat = (deltaLng / length) * arcHeight * length;
  const control: [number, number] = [midLng + normalLng, midLat + normalLat];
  const coordinates: [number, number][] = [];

  for (let step = 0; step <= 28; step += 1) {
    const t = step / 28;
    const inv = 1 - t;
    coordinates.push([
      inv * inv * fromLng + 2 * inv * t * control[0] + t * t * toLng,
      inv * inv * fromLat + 2 * inv * t * control[1] + t * t * toLat,
    ]);
  }

  return coordinates;
};

const buildArcCollection = (pins: RealtimeMarketplacePin[], activeItemId: string | null) => {
  const activePin = pins.find((pin) => pin.id === activeItemId) || pins[0];

  if (!activePin || pins.length < 2) {
    return EMPTY_LINE_COLLECTION;
  }

  const relatedPins = pins
    .filter((pin) => pin.id !== activePin.id)
    .sort((left, right) => {
      const categoryMatch = Number(right.category === activePin.category) - Number(left.category === activePin.category);
      if (categoryMatch !== 0) return categoryMatch;

      const urgencyMatch = Number(right.urgent) - Number(left.urgent);
      if (urgencyMatch !== 0) return urgencyMatch;

      const leftDistance = Math.hypot(left.lat - activePin.lat, left.lng - activePin.lng);
      const rightDistance = Math.hypot(right.lat - activePin.lat, right.lng - activePin.lng);
      return leftDistance - rightDistance;
    })
    .slice(0, 3);

  return {
    type: "FeatureCollection",
    features: relatedPins.map((pin) => ({
      type: "Feature",
      properties: {
        id: `${activePin.id}:${pin.id}`,
      },
      geometry: {
        type: "LineString",
        coordinates: curveBetweenPoints([activePin.lng, activePin.lat], [pin.lng, pin.lat]),
      },
    })),
  } satisfies GeoJSON.FeatureCollection<GeoJSON.LineString>;
};

const buildParticleCollection = (pins: RealtimeMarketplacePin[]) => {
  const features: GeoJSON.Feature<GeoJSON.Point>[] = [];

  pins.forEach((pin, index) => {
    const bursts = pin.isNew || pin.urgent ? 3 : 1;

    for (let burstIndex = 0; burstIndex < bursts; burstIndex += 1) {
      const offsetLng = ((index + 1) * (burstIndex + 2)) % 5;
      const offsetLat = ((index + 2) * (burstIndex + 3)) % 7;

      features.push({
        type: "Feature",
        properties: {
          size: pin.isNew ? 6 : 4,
          opacity: pin.isNew ? 0.34 : pin.urgent ? 0.28 : 0.18,
        },
        geometry: {
          type: "Point",
          coordinates: [pin.lng + (offsetLng - 2) * 0.015, pin.lat + (offsetLat - 3) * 0.012],
        },
      });
    }
  });

  return {
    type: "FeatureCollection",
    features,
  } satisfies GeoJSON.FeatureCollection<GeoJSON.Point>;
};

type RealtimeLayerProps = {
  map: maplibregl.Map | null;
  pins: RealtimeMarketplacePin[];
  center: {
    lat: number;
    lng: number;
  } | null;
  activeItemId: string | null;
  selectedItemId: string | null;
  useWebGlPins: boolean;
  liteMode: boolean;
  onSelectItem: (itemId: string) => void;
};

export default function RealtimeLayer({
  map,
  pins,
  center,
  activeItemId,
  selectedItemId,
  useWebGlPins,
  liteMode,
  onSelectItem,
}: RealtimeLayerProps) {
  const hoveredFeatureIdRef = useRef<string | number | null>(null);
  const previousSelectedIdRef = useRef<string | number | null>(null);

  const pointCollection = useMemo(
    () =>
      ({
        type: "FeatureCollection",
        features: pins.map((pin) => ({
          id: pin.id,
          type: "Feature",
          properties: {
            id: pin.id,
            title: pin.title,
            urgentWeight: pin.urgent ? 1 : 0,
            newWeight: pin.isNew ? 1 : 0,
          },
          geometry: {
            type: "Point",
            coordinates: [pin.lng, pin.lat],
          },
        })),
      }) satisfies GeoJSON.FeatureCollection<GeoJSON.Point>,
    [pins]
  );

  const arcCollection = useMemo(() => buildArcCollection(pins, activeItemId), [activeItemId, pins]);
  const particleCollection = useMemo(() => buildParticleCollection(pins), [pins]);
  const radarCollection = useMemo(
    () =>
      ({
        type: "FeatureCollection",
        features: center
          ? [
              {
                type: "Feature",
                properties: {},
                geometry: {
                  type: "Point",
                  coordinates: [center.lng, center.lat],
                },
              },
            ]
          : [],
      }) satisfies GeoJSON.FeatureCollection<GeoJSON.Point>,
    [center]
  );

  useEffect(() => {
    if (!map || !hasMapStyle(map)) return;
    addRealtimeSourcesAndLayers(map);
  }, [map]);

  useEffect(() => {
    if (!map || !hasMapStyle(map)) return;
    (map.getSource(PIN_SOURCE_ID) as GeoJSONSource | undefined)?.setData(pointCollection);
    (map.getSource(ARC_SOURCE_ID) as GeoJSONSource | undefined)?.setData(arcCollection);
    (map.getSource(PARTICLE_SOURCE_ID) as GeoJSONSource | undefined)?.setData(particleCollection);
    (map.getSource(RADAR_SOURCE_ID) as GeoJSONSource | undefined)?.setData(radarCollection);
  }, [arcCollection, map, particleCollection, pointCollection, radarCollection]);

  useEffect(() => {
    if (!map || !hasMapStyle(map)) return;
    const visibility = useWebGlPins ? "visible" : "none";
    [CLUSTER_GLOW_LAYER_ID, CLUSTER_LAYER_ID, CLUSTER_COUNT_LAYER_ID, UNCLUSTERED_GLOW_LAYER_ID, UNCLUSTERED_CORE_LAYER_ID].forEach(
      (layerId) => {
        if (map.getLayer(layerId)) {
          map.setLayoutProperty(layerId, "visibility", visibility);
        }
      }
    );
  }, [map, useWebGlPins]);

  useEffect(() => {
    if (!map || !hasMapStyle(map)) return;

    const heavyLayerVisibility = liteMode ? "none" : "visible";
    [HEATMAP_LAYER_ID, ARC_GLOW_LAYER_ID, ARC_LAYER_ID, PARTICLE_LAYER_ID, PARTICLE_CORE_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", heavyLayerVisibility);
      }
    });

    [RADAR_RING_LAYER_ID, RADAR_CORE_LAYER_ID].forEach((layerId) => {
      if (map.getLayer(layerId)) {
        map.setLayoutProperty(layerId, "visibility", center ? "visible" : "none");
      }
    });
  }, [center, liteMode, map]);

  useEffect(() => {
    if (!map || !hasMapStyle(map)) return;

    if (previousSelectedIdRef.current) {
      map.setFeatureState({ source: PIN_SOURCE_ID, id: previousSelectedIdRef.current }, { selected: false });
    }

    if (selectedItemId) {
      map.setFeatureState({ source: PIN_SOURCE_ID, id: selectedItemId }, { selected: true });
      previousSelectedIdRef.current = selectedItemId;
      return;
    }

    previousSelectedIdRef.current = null;
  }, [map, selectedItemId]);

  useEffect(() => {
    if (!map || !hasMapStyle(map) || !useWebGlPins) return;

    const setHoverState = (nextId: string | number | null) => {
      if (hoveredFeatureIdRef.current) {
        map.setFeatureState({ source: PIN_SOURCE_ID, id: hoveredFeatureIdRef.current }, { hover: false });
      }

      hoveredFeatureIdRef.current = nextId;

      if (nextId) {
        map.setFeatureState({ source: PIN_SOURCE_ID, id: nextId }, { hover: true });
      }
    };

    const handleClusterClick = async (event: maplibregl.MapLayerMouseEvent) => {
      const clusterFeature = event.features?.[0];
      if (!clusterFeature) return;

      const clusterId = Number(clusterFeature.properties?.cluster_id);
      const source = map.getSource(PIN_SOURCE_ID) as GeoJSONSource | undefined;
      if (!source || !Number.isFinite(clusterId)) return;

      const expansionZoom = await source.getClusterExpansionZoom(clusterId);
      map.easeTo({
        center: (clusterFeature.geometry as GeoJSON.Point).coordinates as [number, number],
        zoom: expansionZoom,
        pitch: liteMode ? 28 : COMMAND_CENTER_CAMERA.pitch,
        bearing: liteMode ? -6 : COMMAND_CENTER_CAMERA.bearing,
        duration: 960,
        essential: true,
      });
    };

    const handleUnclusteredClick = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const nextId = String(feature?.properties?.id || "");
      if (nextId) {
        onSelectItem(nextId);
      }
    };

    const handleUnclusteredMove = (event: maplibregl.MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      map.getCanvas().style.cursor = "pointer";
      setHoverState(feature?.id ?? null);
    };

    const handleUnclusteredLeave = () => {
      map.getCanvas().style.cursor = "";
      setHoverState(null);
    };

    const handleClusterPointer = () => {
      map.getCanvas().style.cursor = "pointer";
    };

    const clearClusterPointer = () => {
      map.getCanvas().style.cursor = "";
    };

    map.on("click", CLUSTER_LAYER_ID, handleClusterClick);
    map.on("mouseenter", CLUSTER_LAYER_ID, handleClusterPointer);
    map.on("mouseleave", CLUSTER_LAYER_ID, clearClusterPointer);
    map.on("click", UNCLUSTERED_CORE_LAYER_ID, handleUnclusteredClick);
    map.on("mousemove", UNCLUSTERED_CORE_LAYER_ID, handleUnclusteredMove);
    map.on("mouseleave", UNCLUSTERED_CORE_LAYER_ID, handleUnclusteredLeave);

    return () => {
      map.off("click", CLUSTER_LAYER_ID, handleClusterClick);
      map.off("mouseenter", CLUSTER_LAYER_ID, handleClusterPointer);
      map.off("mouseleave", CLUSTER_LAYER_ID, clearClusterPointer);
      map.off("click", UNCLUSTERED_CORE_LAYER_ID, handleUnclusteredClick);
      map.off("mousemove", UNCLUSTERED_CORE_LAYER_ID, handleUnclusteredMove);
      map.off("mouseleave", UNCLUSTERED_CORE_LAYER_ID, handleUnclusteredLeave);
      handleUnclusteredLeave();
    };
  }, [liteMode, map, onSelectItem, useWebGlPins]);

  useEffect(() => {
    if (!map || !hasMapStyle(map)) return;

    let animationFrame = 0;
    const animate = () => {
      if (!hasMapStyle(map)) {
        animationFrame = window.requestAnimationFrame(animate);
        return;
      }

      const time = performance.now() / 1000;
      const pulse = (Math.sin(time * 1.9) + 1) / 2;

      if (map.getLayer(RADAR_RING_LAYER_ID)) {
        map.setPaintProperty(RADAR_RING_LAYER_ID, "circle-radius", 18 + pulse * 22);
        map.setPaintProperty(RADAR_RING_LAYER_ID, "circle-opacity", 0.28 - pulse * 0.18);
      }

      if (map.getLayer(ARC_GLOW_LAYER_ID)) {
        map.setPaintProperty(ARC_GLOW_LAYER_ID, "line-opacity", 0.22 + pulse * 0.16);
      }

      if (map.getLayer(ARC_LAYER_ID)) {
        map.setPaintProperty(ARC_LAYER_ID, "line-opacity", 0.48 + pulse * 0.24);
      }

      animationFrame = window.requestAnimationFrame(animate);
    };

    animationFrame = window.requestAnimationFrame(animate);

    return () => {
      window.cancelAnimationFrame(animationFrame);
    };
  }, [liteMode, map]);

  return null;
}
