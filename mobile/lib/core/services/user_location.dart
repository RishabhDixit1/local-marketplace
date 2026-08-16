import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:geolocator/geolocator.dart';
import 'package:latlong2/latlong.dart';

import '../utils/lat_lng_sanitizer.dart';

/// Resolves the user's current location once, degrading to [null] whenever
/// location is unavailable or permission is denied so callers always get a
/// value instead of an error. Never throws.
final userLocationProvider = FutureProvider<LatLng?>((ref) async {
  try {
    final enabled = await Geolocator.isLocationServiceEnabled();
    if (!enabled) return null;

    var permission = await Geolocator.checkPermission();
    if (permission == LocationPermission.denied) {
      permission = await Geolocator.requestPermission();
    }
    if (permission == LocationPermission.denied ||
        permission == LocationPermission.deniedForever) {
      return null;
    }

    final position = await Geolocator.getCurrentPosition(
      locationSettings: const LocationSettings(
        accuracy: LocationAccuracy.low,
        timeLimit: Duration(seconds: 8),
      ),
    );
    return sanitizeLatLng(position.latitude, position.longitude);
  } catch (e) {
    debugPrint('ServiQ userLocationProvider failed: $e');
    return null;
  }
});
