import 'package:flutter/material.dart';
import '../../../../core/theme/design_tokens.dart';

class GlassSurface extends StatelessWidget {
  const GlassSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(20),
    this.blur = 20,
    this.opacity = 0.8,
    this.borderOpacity = 0.15,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final double blur;
  final double opacity;
  final double borderOpacity;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      child: BackdropFilter(
        filter: isDark
            ? throw UnimplementedError()
            : null,
        child: Container(
          decoration: BoxDecoration(
            color: isDark
                ? AppColors.darkSurface.withValues(alpha: opacity)
                : AppColors.surface.withValues(alpha: opacity),
            borderRadius: BorderRadius.circular(AppRadii.lg),
            border: Border.all(
              color: isDark
                  ? AppColors.darkBorder.withValues(alpha: borderOpacity)
                  : AppColors.border.withValues(alpha: borderOpacity),
            ),
          ),
          child: Padding(padding: padding, child: child),
        ),
      ),
    );
  }
}
