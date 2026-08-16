import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';
import '../../core/utils/app_formatters.dart';

/// Deterministic color-per-name initials palette. All colors are mid-to-dark
/// enough that white initials stay legible in both light and dark themes.
const List<Color> kAppAvatarPalette = <Color>[
  Color(0xFF0F766E),
  Color(0xFF4338CA),
  Color(0xFFBE123C),
  Color(0xFFB45309),
  Color(0xFF047857),
  Color(0xFF0369A1),
  Color(0xFF6D28D9),
  Color(0xFF9F1239),
];

Color appAvatarColorFor(String name) {
  final trimmed = name.trim();
  if (trimmed.isEmpty) {
    return AppColors.avatarFallback;
  }
  var hash = 0;
  for (final unit in trimmed.codeUnits) {
    hash = (hash * 31 + unit) & 0x7fffffff;
  }
  return kAppAvatarPalette[hash % kAppAvatarPalette.length];
}

/// Single avatar system for the app: a photo when available, otherwise a
/// deterministic color-coded initials circle. Never a flat grey circle with
/// a lone letter. Optionally renders an online-status dot.
class AppAvatar extends StatelessWidget {
  const AppAvatar({
    super.key,
    required this.name,
    this.avatarUrl = '',
    this.radius = 20,
    this.showOnlineStatus = false,
    this.isOnline = false,
    this.onlineStatusColor,
    this.semanticLabel,
  });

  final String name;
  final String avatarUrl;
  final double radius;
  final bool showOnlineStatus;
  final bool isOnline;
  final Color? onlineStatusColor;
  final String? semanticLabel;

  Color get _backgroundColor => appAvatarColorFor(name);
  bool get _hasImage => avatarUrl.trim().isNotEmpty;

  @override
  Widget build(BuildContext context) {
    final label = semanticLabel ?? name.trim();
    final dotSize = (radius * 0.42).clamp(6.0, 11.0);

    Widget avatar = CircleAvatar(
      radius: radius,
      backgroundColor: _backgroundColor,
      backgroundImage: _hasImage
          ? ResizeImage.resizeIfNeeded(
              (radius * 2 * MediaQuery.devicePixelRatioOf(context)).round(),
              (radius * 2 * MediaQuery.devicePixelRatioOf(context)).round(),
              CachedNetworkImageProvider(avatarUrl),
            )
          : null,
      onBackgroundImageError: _hasImage ? (_, _) {} : null,
      child: Text(
        AppFormatters.initials(name),
        style: TextStyle(
          color: Colors.white,
          fontWeight: FontWeight.w700,
          fontSize: radius * 0.72,
        ),
      ),
    );

    if (showOnlineStatus) {
      avatar = Stack(
        children: [
          avatar,
          Positioned(
            right: 0,
            bottom: 0,
            child: Container(
              width: dotSize,
              height: dotSize,
              decoration: BoxDecoration(
                color: isOnline
                    ? (onlineStatusColor ?? AppColors.primary)
                    : Theme.of(context).colorScheme.outline,
                shape: BoxShape.circle,
                border: Border.all(
                  color: Theme.of(context).colorScheme.surface,
                  width: 2,
                ),
              ),
            ),
          ),
        ],
      );
    }

    return Semantics(
      image: true,
      label: label,
      child: avatar,
    );
  }
}
