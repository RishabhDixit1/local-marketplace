// ignore_for_file: prefer_const_constructors_in_immutables
import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class PremiumScaffold extends StatelessWidget {
  const PremiumScaffold({
    super.key,
    required this.child,
    this.padding = EdgeInsets.zero,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;

  @override
  Widget build(BuildContext context) {
    final tokens =
        Theme.of(context).extension<ServiqThemeTokens>() ??
        ServiqThemeTokens.light;

    return DecoratedBox(
      decoration: BoxDecoration(gradient: tokens.authGradient),
      child: Padding(padding: padding, child: child),
    );
  }
}

class ServiqBrandLockup extends StatelessWidget {
  ServiqBrandLockup({
    super.key,
    this.compact = false,
    this.foregroundColor,
    this.subtleColor,
  });

  final bool compact;
  final Color? foregroundColor;
  final Color? subtleColor;

  @override
  Widget build(BuildContext context) {
    final fg = foregroundColor ?? Theme.of(context).colorScheme.onSurface;
    final sc = subtleColor ?? Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    final textTheme = Theme.of(context).textTheme;
    final markSize = compact ? 38.0 : 44.0;

    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Container(
          width: markSize,
          height: markSize,
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.onSurface,
            borderRadius: BorderRadius.circular(AppRadii.md),
            boxShadow: AppShadows.glow,
          ),
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Center(
                child: Text(
                  'S',
                  style: textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
              Positioned(
                right: -2,
                bottom: -2,
                child: Container(
                  width: compact ? 10 : 12,
                  height: compact ? 10 : 12,
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                    border: Border.all(color: AppColors.surface, width: 2),
                  ),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(width: AppSpacing.sm),
        Flexible(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'ServiQ',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.titleLarge?.copyWith(
                  color: fg,
                  fontWeight: FontWeight.w900,
                ),
              ),
              if (!compact)
                Text(
                  'Local help, handled cleanly',
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: textTheme.labelSmall?.copyWith(color: sc),
                ),
            ],
          ),
        ),
      ],
    );
  }
}

class PremiumSurface extends StatelessWidget {
  PremiumSurface({
    super.key,
    required this.child,
    this.padding = const EdgeInsets.all(AppSpacing.lg),
    this.backgroundColor = AppColors.surface,
    this.borderColor,
    this.gradient,
    this.onTap,
    this.shadows = AppShadows.card,
  });

  final Widget child;
  final EdgeInsetsGeometry padding;
  final Color backgroundColor;
  final Color? borderColor;
  final Gradient? gradient;
  final VoidCallback? onTap;
  final List<BoxShadow> shadows;

  @override
  Widget build(BuildContext context) {
    final bd = borderColor ?? Theme.of(context).colorScheme.outline;
    final radius = BorderRadius.circular(AppRadii.md);
    final content = DecoratedBox(
      decoration: BoxDecoration(
        color: gradient == null ? backgroundColor : null,
        gradient: gradient,
        borderRadius: radius,
        border: Border.all(color: bd),
        boxShadow: shadows,
      ),
      child: Padding(padding: padding, child: child),
    );

    if (onTap == null) {
      return content;
    }

    return Material(
      color: Colors.transparent,
      child: InkWell(borderRadius: radius, onTap: onTap, child: content),
    );
  }
}

class PremiumPill extends StatelessWidget {
  PremiumPill({
    super.key,
    required this.label,
    this.icon,
    this.backgroundColor = AppColors.surfaceAlt,
    this.foregroundColor,
    this.borderColor,
  });

  final String label;
  final IconData? icon;
  final Color backgroundColor;
  final Color? foregroundColor;
  final Color? borderColor;

  @override
  Widget build(BuildContext context) {
    final fg = foregroundColor ?? Theme.of(context).colorScheme.onSurface;
    final bd = borderColor ?? Theme.of(context).colorScheme.outline;
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: bd),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: fg),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium?.copyWith(
                color: fg,
                fontWeight: FontWeight.w800,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class PremiumTrustSignal extends StatelessWidget {
  const PremiumTrustSignal({
    super.key,
    required this.label,
    required this.caption,
    required this.icon,
    this.color = AppColors.primary,
    this.backgroundColor = AppColors.primarySoft,
  });

  final String label;
  final String caption;
  final IconData icon;
  final Color color;
  final Color backgroundColor;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final labelColor = color == Colors.white ? Colors.white : Theme.of(context).colorScheme.onSurface;
    final captionColor = color == Colors.white
        ? Colors.white.withValues(alpha: 0.72)
        : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);

    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 34,
          height: 34,
          decoration: BoxDecoration(
            color: backgroundColor,
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: Icon(icon, color: color, size: 18),
        ),
        const SizedBox(width: AppSpacing.sm),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: textTheme.labelLarge?.copyWith(color: labelColor),
              ),
              const SizedBox(height: AppSpacing.xxxs),
              Text(
                caption,
                style: textTheme.bodySmall?.copyWith(
                  color: captionColor,
                  fontWeight: FontWeight.w600,
                ),
              ),
            ],
          ),
        ),
      ],
    );
  }
}

class PremiumIntentTile extends StatelessWidget {
  const PremiumIntentTile({
    super.key,
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.selected,
    required this.onTap,
    this.accentColor = AppColors.primary,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final bool selected;
  final VoidCallback onTap;
  final Color accentColor;

  @override
  Widget build(BuildContext context) {
    final textTheme = Theme.of(context).textTheme;
    final color = selected ? accentColor : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);

    return Material(
      color: selected ? accentColor.withValues(alpha: 0.10) : AppColors.surface,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.md),
        side: BorderSide(
          color: selected ? accentColor : Theme.of(context).colorScheme.outline,
          width: selected ? 1.4 : 1,
        ),
      ),
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.md),
        child: Padding(
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            children: [
              Icon(icon, color: color, size: 20),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.labelLarge?.copyWith(
                        color: Theme.of(context).colorScheme.onSurface,
                      ),
                    ),
                    const SizedBox(height: AppSpacing.xxxs),
                    Text(
                      subtitle,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: textTheme.bodySmall?.copyWith(
                        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: AppSpacing.xs),
              Icon(
                selected
                    ? Icons.check_circle_rounded
                    : Icons.radio_button_unchecked_rounded,
                color: color,
                size: 18,
              ),
            ],
          ),
        ),
      ),
    );
  }
}
