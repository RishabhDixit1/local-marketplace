export type Coordinates = {
  latitude: number;
  longitude: number;
};

export type CoordinateAccuracy = "precise" | "approximate";

export type BrowserCoordinateStatus = "idle" | "locating" | "ready" | "denied" | "unsupported" | "error";
export type BrowserCoordinatePermissionState =
  | PermissionState
  | "unsupported"
  | "unknown";
export type BrowserCoordinateRequestErrorCode =
  | "unsupported"
  | "denied"
  | "timeout"
  | "unavailable"
  | "unknown";
export type BrowserCoordinateRequestResult =
  | {
      ok: true;
      coordinates: Coordinates;
      accuracyMeters: number | null;
      permissionState: BrowserCoordinatePermissionState;
    }
  | {
      ok: false;
      code: BrowserCoordinateRequestErrorCode;
      message: string;
      permissionState: BrowserCoordinatePermissionState;
    };

const EARTH_RADIUS_KM = 6371;
const COORDINATE_LABEL_PATTERN = /^-?\d{1,2}(?:\.\d+)?\s*,\s*-?\d{1,3}(?:\.\d+)?$/;
const DEFAULT_MARKET_COORDINATES: Coordinates = {
  latitude: 12.9716,
  longitude: 77.5946,
};

const toFiniteNumber = (value: unknown) => {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string") {
    const parsed = Number(value);
    if (Number.isFinite(parsed)) return parsed;
  }
  return null;
};

const roundDistance = (distanceKm: number) => Number(distanceKm.toFixed(1));

const normalizeCoordinate = (value: unknown, min: number, max: number) => {
  const parsed = toFiniteNumber(value);
  if (parsed === null) return null;
  if (parsed < min || parsed > max) return null;
  return parsed;
};

export const getCoordinates = (latitude: unknown, longitude: unknown): Coordinates | null => {
  const normalizedLatitude = normalizeCoordinate(latitude, -90, 90);
  const normalizedLongitude = normalizeCoordinate(longitude, -180, 180);
  if (normalizedLatitude === null || normalizedLongitude === null) return null;
  return {
    latitude: normalizedLatitude,
    longitude: normalizedLongitude,
  };
};

export const getCoordinatesFromRow = (
  row: Record<string, unknown> | null | undefined
): Coordinates | null => {
  if (!row) return null;
  const latitude = row.latitude ?? row.lat;
  const longitude = row.longitude ?? row.lng ?? row.long;
  return getCoordinates(latitude, longitude);
};

const hashNumber = (seed: string) => {
  let hash = 0;
  for (let i = 0; i < seed.length; i += 1) {
    hash = (hash * 33 + seed.charCodeAt(i)) % 100000;
  }
  return hash;
};

export const inferCoordinatesFromLocation = (
  location: string | null | undefined,
  seed = ""
): Coordinates => {
  const normalizedLocation = (location || "unknown-location").trim().toLowerCase();
  const normalizedSeed = seed.trim().toLowerCase();
  const source = `${normalizedLocation}|${normalizedSeed}`;

  const latJitter = (hashNumber(`${source}|lat`) / 100000 - 0.5) * 0.18;
  const lngJitter = (hashNumber(`${source}|lng`) / 100000 - 0.5) * 0.18;

  return {
    latitude: Number((DEFAULT_MARKET_COORDINATES.latitude + latJitter).toFixed(6)),
    longitude: Number((DEFAULT_MARKET_COORDINATES.longitude + lngJitter).toFixed(6)),
  };
};

export const resolveCoordinates = (params: {
  row?: Record<string, unknown> | null;
  location?: string | null;
  seed?: string;
}) => {
  return resolveCoordinatesWithAccuracy(params).coordinates;
};

export const resolveCoordinatesWithAccuracy = (params: {
  row?: Record<string, unknown> | null;
  location?: string | null;
  seed?: string;
}): { coordinates: Coordinates; accuracy: CoordinateAccuracy } => {
  const explicitCoordinates = getCoordinatesFromRow(params.row);
  if (explicitCoordinates) {
    return {
      coordinates: explicitCoordinates,
      accuracy: "precise",
    };
  }

  return {
    coordinates: inferCoordinatesFromLocation(params.location, params.seed || ""),
    accuracy: "approximate",
  };
};

export const normalizeLocationLabel = (value: string | null | undefined) => value?.replace(/\s+/g, " ").trim() || "";

export const isCoordinateOnlyLocationLabel = (value: string | null | undefined) =>
  COORDINATE_LABEL_PATTERN.test(normalizeLocationLabel(value));

export const isUsableLocationLabel = (value: string | null | undefined) => {
  const normalized = normalizeLocationLabel(value);
  if (normalized.length < 3) return false;
  if (isCoordinateOnlyLocationLabel(normalized)) return false;
  return /[a-z]/i.test(normalized);
};

export const formatCoordinatePair = (coordinates: Coordinates | null | undefined, digits = 5) => {
  if (!coordinates) return "";
  return `${coordinates.latitude.toFixed(digits)}, ${coordinates.longitude.toFixed(digits)}`;
};

export const haversineDistanceKm = (from: Coordinates, to: Coordinates) => {
  const toRadians = (degrees: number) => (degrees * Math.PI) / 180;
  const deltaLatitude = toRadians(to.latitude - from.latitude);
  const deltaLongitude = toRadians(to.longitude - from.longitude);

  const latitude1 = toRadians(from.latitude);
  const latitude2 = toRadians(to.latitude);

  const a =
    Math.sin(deltaLatitude / 2) * Math.sin(deltaLatitude / 2) +
    Math.cos(latitude1) * Math.cos(latitude2) * Math.sin(deltaLongitude / 2) * Math.sin(deltaLongitude / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return EARTH_RADIUS_KM * c;
};

export const distanceBetweenCoordinatesKm = (
  viewerCoordinates: Coordinates | null,
  targetCoordinates: Coordinates
) => {
  if (!viewerCoordinates) return 0;
  return roundDistance(haversineDistanceKm(viewerCoordinates, targetCoordinates));
};

export const getBrowserGeolocationPermissionState = async (): Promise<BrowserCoordinatePermissionState> => {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
    return "unsupported";
  }

  if (!navigator.permissions?.query) {
    return "unknown";
  }

  try {
    const status = await navigator.permissions.query({
      name: "geolocation" as PermissionName,
    });
    return status.state;
  } catch {
    return "unknown";
  }
};

const getBrowserCoordinateErrorMessage = (code: BrowserCoordinateRequestErrorCode) => {
  switch (code) {
    case "unsupported":
      return "GPS is not supported on this device or browser.";
    case "denied":
      return "Location permission is blocked. Allow GPS access in browser settings or type your area manually.";
    case "timeout":
      return "GPS is taking too long. Move to a clearer spot or type your area manually.";
    case "unavailable":
      return "Your device could not find an exact location. Type your area manually for now.";
    default:
      return "Could not get your current location. Type your area manually.";
  }
};

export const requestBrowserCoordinates = async ({
  timeoutMs = 6000,
  enableHighAccuracy = false,
  maximumAge = 120000,
}: {
  timeoutMs?: number;
  enableHighAccuracy?: boolean;
  maximumAge?: number;
} = {}): Promise<BrowserCoordinateRequestResult> => {
  const permissionState = await getBrowserGeolocationPermissionState();
  if (permissionState === "unsupported") {
    return {
      ok: false,
      code: "unsupported",
      message: getBrowserCoordinateErrorMessage("unsupported"),
      permissionState,
    };
  }

  return new Promise((resolve) => {
    let completed = false;

    const timeoutId = window.setTimeout(() => {
      if (completed) return;
      completed = true;
      resolve({
        ok: false,
        code: "timeout",
        message: getBrowserCoordinateErrorMessage("timeout"),
        permissionState,
      });
    }, timeoutMs);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        if (completed) return;
        completed = true;
        window.clearTimeout(timeoutId);
        const coordinates = getCoordinates(
          position.coords.latitude,
          position.coords.longitude
        );
        if (!coordinates) {
          resolve({
            ok: false,
            code: "unknown",
            message: getBrowserCoordinateErrorMessage("unknown"),
            permissionState,
          });
          return;
        }

        resolve({
          ok: true,
          coordinates,
          accuracyMeters: Number.isFinite(position.coords.accuracy)
            ? position.coords.accuracy
            : null,
          permissionState,
        });
      },
      (error) => {
        if (completed) return;
        completed = true;
        window.clearTimeout(timeoutId);
        const code: BrowserCoordinateRequestErrorCode =
          error.code === error.PERMISSION_DENIED
            ? "denied"
            : error.code === error.TIMEOUT
            ? "timeout"
            : error.code === error.POSITION_UNAVAILABLE
            ? "unavailable"
            : "unknown";

        resolve({
          ok: false,
          code,
          message: getBrowserCoordinateErrorMessage(code),
          permissionState: code === "denied" ? "denied" : permissionState,
        });
      },
      {
        enableHighAccuracy,
        timeout: timeoutMs,
        maximumAge,
      }
    );
  });
};

export const getBrowserCoordinates = async (timeoutMs = 6000): Promise<Coordinates | null> => {
  const result = await requestBrowserCoordinates({ timeoutMs });
  return result.ok ? result.coordinates : null;
};

export const watchBrowserCoordinates = (
  onChange: (coordinates: Coordinates) => void,
  onStatusChange?: (status: BrowserCoordinateStatus) => void
) => {
  if (typeof window === "undefined" || typeof navigator === "undefined" || !navigator.geolocation) {
    onStatusChange?.("unsupported");
    return () => {};
  }

  onStatusChange?.("locating");

  const watchId = navigator.geolocation.watchPosition(
    (position) => {
      const coordinates = getCoordinates(position.coords.latitude, position.coords.longitude);
      if (!coordinates) return;
      onStatusChange?.("ready");
      onChange(coordinates);
    },
    (error) => {
      if (error.code === error.PERMISSION_DENIED) {
        onStatusChange?.("denied");
        return;
      }

      onStatusChange?.("error");
    },
    {
      enableHighAccuracy: true,
      timeout: 10000,
      maximumAge: 15000,
    }
  );

  return () => {
    navigator.geolocation.clearWatch(watchId);
  };
};

export const defaultMarketCoordinates = () => DEFAULT_MARKET_COORDINATES;
