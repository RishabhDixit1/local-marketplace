import 'package:flutter/foundation.dart';
import 'package:latlong2/latlong.dart';

/// Known-safe default map center for the app's primary market (Delhi NCR).
///
/// Used whenever a map would otherwise be initialized with a missing or
/// non-finite center. Never silently fall back to `LatLng(0, 0)`.
const LatLng kServiQDefaultCenter = LatLng(28.6139, 77.2090);

/// Default zoom used alongside [kServiQDefaultCenter].
const double kServiQDefaultZoom = 11.0;

/// Returns a finite, in-range [LatLng] for [lat]/[lng], or `null` when the
/// input cannot be safely rendered on a map.
///
/// Rejects:
/// - `null` lat or lng
/// - `NaN` / `Infinity` (e.g. a GPS plugin that reports a missing fix)
/// - coordinates outside valid latitude `[-90, 90]` / longitude `[-180, 180]`
/// - the `(0.0, 0.0)` no-fix sentinel that location plugins and defaulted DB
///   columns emit when a position was never captured
///
/// Route every `LatLng` that enters map state through this function so bad
/// coordinates are dropped before flutter_map ever sees them.
LatLng? sanitizeLatLng(double? lat, double? lng) {
  if (lat == null || lng == null) return null;
  if (lat.isNaN || lat.isInfinite || lng.isNaN || lng.isInfinite) return null;
  if (lat < -90 || lat > 90 || lng < -180 || lng > 180) return null;
  if (lat == 0.0 && lng == 0.0) return null;
  return LatLng(lat, lng);
}

/// Convenience wrapper over [sanitizeLatLng] for an already-constructed
/// [LatLng] (defense-in-depth for coordinates built elsewhere).
LatLng? sanitizeLatLngPoint(LatLng? point) {
  if (point == null) return null;
  return sanitizeLatLng(point.latitude, point.longitude);
}

/// True when [point] holds a coordinate that can be safely rendered on a map.
bool isFiniteLatLng(LatLng? point) => sanitizeLatLngPoint(point) != null;

/// Logs a warning (never throws) for a coordinate that was dropped by
/// [sanitizeLatLng], so bad data is observable without crashing the app.
void warnDroppedCoordinate(
  String context,
  Object id,
  double? lat,
  double? lng,
) {
  debugPrint(
    'ServiQ $context: skipping $id with invalid coordinates '
    '(lat=$lat, lng=$lng)',
  );
}
