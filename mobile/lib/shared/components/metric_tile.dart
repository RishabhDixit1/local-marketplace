import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';

class MetricTile extends StatelessWidget {
  const MetricTile({
    super.key,
    required this.label,
    required this.value,
    this.caption,
    this.icon,
    this.gradient = false,
    this.progress,
    this.progressColor,
  });

  final String label;
  final String value;
  final String? caption;
  final IconData? icon;
  final bool gradient;
  final double? progress;
  final Color? progressColor;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final textTheme = Theme.of(context).textTheme;

    return Semantics(
      label: '$label: $value',
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              color: isDark
                  ? AppColors.darkSurface.withValues(alpha: 0.8)
                  : Colors.white.withValues(alpha: 0.85),
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(
                color: isDark ? AppColors.glassStrokeDark : AppColors.glassStroke,
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        label,
                        style: textTheme.bodySmall?.copyWith(
                          fontWeight: FontWeight.w700,
                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                        ),
                      ),
                    ),
                    if (icon != null)
                      Container(
                        width: 28,
                        height: 28,
                        decoration: BoxDecoration(
                          color: AppColors.primarySoft,
                          borderRadius: BorderRadius.circular(AppRadii.sm),
                        ),
                        child: Icon(icon, size: 14, color: AppColors.primary),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                if (progress != null)
                  SizedBox(
                    width: 56,
                    height: 56,
                    child: Stack(
                      alignment: Alignment.center,
                      children: [
                        SizedBox(
                          width: 56,
                          height: 56,
                          child: CircularProgressIndicator(
                            value: progress!.clamp(0.0, 1.0),
                            strokeWidth: 5,
                            backgroundColor: AppColors.surfaceAlt,
                            valueColor: AlwaysStoppedAnimation<Color>(
                              progressColor ?? AppColors.primary,
                            ),
                            strokeCap: StrokeCap.round,
                          ),
                        ),
                        gradient
                            ? ShaderMask(
                                shaderCallback: (bounds) => LinearGradient(
                                  colors: [
                                    AppColors.accent,
                                    AppColors.verified,
                                  ],
                                  begin: Alignment.centerLeft,
                                  end: Alignment.centerRight,
                                ).createShader(bounds),
                                blendMode: BlendMode.srcIn,
                                child: Text(
                                  value,
                                  style: textTheme.titleLarge?.copyWith(
                                    fontWeight: FontWeight.w900,
                                  ),
                                ),
                              )
                            : Text(
                                value,
                                style: textTheme.titleLarge?.copyWith(
                                  fontWeight: FontWeight.w900,
                                ),
                              ),
                      ],
                    ),
                  )
                else if (gradient)
                  ShaderMask(
                    shaderCallback: (bounds) => LinearGradient(
                      colors: [AppColors.accent, AppColors.verified],
                      begin: Alignment.centerLeft,
                      end: Alignment.centerRight,
                    ).createShader(bounds),
                    blendMode: BlendMode.srcIn,
                    child: Text(
                      value,
                      style: textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w900,
                      ),
                    ),
                  )
                else
                  Text(
                    value,
                    style: textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w900,
                    ),
                  ),
                if (caption != null && caption!.trim().isNotEmpty) ...[
                  const SizedBox(height: 6),
                  Text(
                    caption!,
                    style: textTheme.bodySmall?.copyWith(
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                    ),
                  ),
                ],
              ],
            ),
          ),
        ),
      ),
    );
  }
}
