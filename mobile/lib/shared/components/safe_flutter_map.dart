import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import '../../core/theme/design_tokens.dart';
import '../../core/utils/lat_lng_sanitizer.dart';
import '../../l10n/l10n.dart';

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

  /// Tile-load failure tracking. OSM tiles fail silently as grey squares,
  /// which reads as a broken app; when failures keep accumulating we surface
  /// a compact "map unavailable" banner instead. Transient failures (a few
  /// cancelled tiles during a fast pan/zoom) must NOT trigger it, so the
  /// counter needs [kTileErrorThreshold] hits AND fresh failures within the
  /// decay window - quiet periods reset it and auto-dismiss the banner.
  static const int kTileErrorThreshold = 6;
  static const Duration kTileErrorDecay = Duration(seconds: 6);
  int _tileErrors = 0;
  bool _showTileBanner = false;
  Timer? _decayTimer;

  void _onTileError() {
    _tileErrors += 1;
    if (_tileErrors >= kTileErrorThreshold &&
        !_showTileBanner &&
        mounted) {
      setState(() => _showTileBanner = true);
    }
    // Any new error pushes the recovery deadline out; a quiet window means
    // tiles are loading again, so clear the state.
    _decayTimer?.cancel();
    _decayTimer = Timer(kTileErrorDecay, () {
      if (!mounted) return;
      _tileErrors = 0;
      if (_showTileBanner) setState(() => _showTileBanner = false);
    });
  }

  @override
  void dispose() {
    _decayTimer?.cancel();
    super.dispose();
  }

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
          errorTileCallback: (_, _, _) => _onTileError(),
        ),
        if (_showTileBanner)
          Positioned(
            top: AppSpacing.xs,
            left: AppSpacing.sm,
            right: AppSpacing.sm,
            child: IgnorePointer(
              child: Align(
                alignment: Alignment.topCenter,
                child: Container(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: 6,
                  ),
                  decoration: BoxDecoration(
                    color: Theme.of(context)
                        .colorScheme
                        .surface
                        .withValues(alpha: 0.92),
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                    border: Border.all(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.12),
                    ),
                    boxShadow: [
                      BoxShadow(
                        color: Colors.black.withValues(alpha: 0.12),
                        blurRadius: 8,
                        offset: const Offset(0, 2),
                      ),
                    ],
                  ),
                  child: Row(
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Icon(
                        Icons.wifi_off_rounded,
                        size: 14,
                        color:
                            AppColors.primary.withValues(alpha: 0.7),
                      ),
                      const SizedBox(width: 6),
                      Text(
                        AppLocalizations.of(context).mapTilesUnavailable,
                        style: TextStyle(
                          fontSize: 11,
                          fontWeight: FontWeight.w600,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.65),
                        ),
                      ),
                    ],
                  ),
                ),
              ),
            ),
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
