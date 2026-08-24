import 'package:flutter/material.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:latlong2/latlong.dart';

import 'app_avatar.dart';

/// Shared map pin for providers/storefronts. Shows the person or business
/// avatar (photo when available, otherwise deterministic color-coded
/// initials) inside a white ring so pins are distinguishable from each other
/// instead of rendering as a field of identical teal dots.
Marker providerMapMarker({
  required LatLng point,
  required String name,
  String avatarUrl = '',
  double size = 36,
  VoidCallback? onTap,
}) {
  return Marker(
    point: point,
    width: size,
    height: size,
    child: GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          shape: BoxShape.circle,
          border: Border.all(color: Colors.white, width: 2),
          boxShadow: [
            BoxShadow(
              color: Colors.black.withValues(alpha: 0.25),
              blurRadius: 6,
              offset: const Offset(0, 2),
            ),
          ],
        ),
        child: AppAvatar(
          name: name,
          avatarUrl: avatarUrl,
          radius: (size - 4) / 2,
        ),
      ),
    ),
  );
}
