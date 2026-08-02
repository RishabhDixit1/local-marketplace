import 'dart:ui';

import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

enum ServiqSurfaceVariant { flat, raised, highlight, glass }

class ServiqSurface extends StatelessWidget {
  const ServiqSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.variant = ServiqSurfaceVariant.flat,
    this.borderRadius,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final ServiqSurfaceVariant variant;
  final BorderRadiusGeometry? borderRadius;

  @override
  Widget build(BuildContext context) {
    final scheme = Theme.of(context).colorScheme;
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final radii = borderRadius ?? BorderRadius.circular(AppRadii.xl);

    final (Color bg, List<BoxShadow> shadows, BoxBorder? border) = switch (variant) {
      ServiqSurfaceVariant.flat => (scheme.surface, AppShadows.soft, null),
      ServiqSurfaceVariant.raised => (scheme.surface, AppShadows.card, null),
      ServiqSurfaceVariant.highlight => (scheme.surfaceContainerHighest, AppShadows.card, null),
      ServiqSurfaceVariant.glass => (
        Colors.transparent,
        AppShadows.glass,
        Border.all(color: isDark ? AppColors.glassStrokeDark : AppColors.glassStroke),
      ),
    };

    if (variant == ServiqSurfaceVariant.glass) {
      return ClipRRect(
        borderRadius: radii,
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
          child: DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: isDark
                    ? [
                        AppColors.darkSurface.withValues(alpha: 0.85),
                        AppColors.darkSurfaceAlt.withValues(alpha: 0.7),
                      ]
                    : [
                        Colors.white.withValues(alpha: 0.9),
                        Colors.white.withValues(alpha: 0.7),
                      ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: radii,
              border: border,
              boxShadow: shadows,
            ),
            child: Padding(padding: padding, child: child),
          ),
        ),
      );
    }

    return DecoratedBox(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: radii,
        border: border ?? Border.all(color: scheme.outline.withValues(alpha: 0.5)),
        boxShadow: shadows,
      ),
      child: ClipRRect(
        borderRadius: radii,
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}
