import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/utils/lat_lng_sanitizer.dart';

/// A [FlutterMap] wrapper that guarantees a finite camera center and finite
/// marker points before flutter_map ever projects them.
///
/// - [center] is sanitized on every build; when it cannot be sanitized it
///   falls back to [kServiQDefaultCenter] instead of `LatLng(0, 0)`.
/// - Markers whose [Marker.point] is non-finite are dropped rather than
///   crashing on the next pan/pinch-zoom projection.
/// - As defense-in-depth, every map event is watched; if the camera center
///   ever becomes non-finite (a source the app missed), the camera is reset
///   to [kServiQDefaultCenter] instead of letting `Crs.checkLatLng` throw.
class SafeFlutterMap extends StatefulWidget {
  const SafeFlutterMap({
    super.key,
    required this.center,
    this.zoom = kServiQDefaultZoom,
    this.minZoom = 8,
    this.maxZoom = 16,
    this.markers = const [],
    this.tileProvider,
  });

  /// Desired initial center. Sanitized before render; falls back to
  /// [kServiQDefaultCenter] when null or invalid.
  final LatLng? center;

  final double zoom;
  final double minZoom;
  final double maxZoom;

  /// Markers to render. Markers with a non-finite point are omitted.
  final List<Marker> markers;

  /// Optional custom tile provider (used to make tests deterministic).
  final TileProvider? tileProvider;

  @override
  State<SafeFlutterMap> createState() => _SafeFlutterMapState();
}

class _SafeFlutterMapState extends State<SafeFlutterMap> {
  final _controller = MapController();

  @override
  Widget build(BuildContext context) {
    final safeCenter =
        sanitizeLatLngPoint(widget.center) ?? kServiQDefaultCenter;
    final safeMarkers = <Marker>[];
    for (final marker in widget.markers) {
      final point = sanitizeLatLngPoint(marker.point);
      if (point != null) {
        safeMarkers.add(marker);
      } else {
        warnDroppedCoordinate(
          'map marker',
          marker.key?.toString() ?? 'unnamed marker',
          marker.point.latitude,
          marker.point.longitude,
        );
      }
    }

    return FlutterMap(
      mapController: _controller,
      options: MapOptions(
        initialCenter: safeCenter,
        initialZoom: widget.zoom,
        minZoom: widget.minZoom,
        maxZoom: widget.maxZoom,
        onMapEvent: _onMapEvent,
      ),
      children: [
        TileLayer(
          urlTemplate: 'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
          userAgentPackageName: 'com.serviq.app',
          tileProvider: widget.tileProvider,
        ),
        if (safeMarkers.isNotEmpty) MarkerLayer(markers: safeMarkers),
      ],
    );
  }

  void _onMapEvent(MapEvent event) {
    final center = event.camera.center;
    if (center.latitude.isNaN ||
        center.latitude.isInfinite ||
        center.longitude.isNaN ||
        center.longitude.isInfinite ||
        center.latitude < -90 ||
        center.latitude > 90 ||
        center.longitude < -180 ||
        center.longitude > 180) {
      debugPrint(
        'ServiQ map: resetting non-finite camera center '
        '(${center.latitude}, ${center.longitude}) to safe default',
      );
      final zoom = event.camera.zoom.isFinite
          ? event.camera.zoom.clamp(widget.minZoom, widget.maxZoom)
          : kServiQDefaultZoom;
      _controller.move(kServiQDefaultCenter, zoom);
    }
  }
}
