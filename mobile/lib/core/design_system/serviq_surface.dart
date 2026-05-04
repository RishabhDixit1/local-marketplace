import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

enum ServiqSurfaceVariant { flat, raised, highlight }

/// Card-like surface using design tokens (prefer over ad-hoc [BoxDecoration]).
class ServiqSurface extends StatelessWidget {
  const ServiqSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(16),
    this.variant = ServiqSurfaceVariant.flat,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final ServiqSurfaceVariant variant;

  @override
  Widget build(BuildContext context) {
    final (Color bg, List<BoxShadow> shadows) = switch (variant) {
      ServiqSurfaceVariant.flat => (AppColors.surface, AppShadows.card),
      ServiqSurfaceVariant.raised => (AppColors.surface, AppShadows.floating),
      ServiqSurfaceVariant.highlight => (AppColors.surfaceTint, AppShadows.card),
    };

    return DecoratedBox(
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
        boxShadow: shadows,
      ),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Padding(padding: padding, child: child),
      ),
    );
  }
}
