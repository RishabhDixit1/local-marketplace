import 'dart:ui';

import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';

class PrimaryButton extends StatelessWidget {
  const PrimaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.expanded = true,
    this.gradient = false,
  });

  final String label;
  final Widget? icon;
  final VoidCallback? onPressed;
  final bool expanded;
  final bool gradient;

  @override
  Widget build(BuildContext context) {
    Widget child;
    if (gradient) {
      child = _GradientFilledButton(
        onPressed: onPressed,
        child: icon == null
            ? Text(label)
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [icon!, const SizedBox(width: AppSpacing.xs), Text(label)],
              ),
      );
    } else {
      child = icon == null
          ? FilledButton(onPressed: onPressed, child: Text(label))
          : FilledButton.icon(
              onPressed: onPressed,
              icon: icon!,
              label: Text(label),
            );
    }

    final sized = !expanded
        ? child
        : SizedBox(width: double.infinity, child: child);

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: sized,
    );
  }
}

class _GradientFilledButton extends StatelessWidget {
  const _GradientFilledButton({
    required this.onPressed,
    required this.child,
  });

  final VoidCallback? onPressed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    final opacity = disabled ? 0.4 : 1.0;

    return Semantics(
      button: true,
      enabled: !disabled,
      child: GestureDetector(
        onTap: disabled ? null : onPressed,
        child: Container(
          padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppGradients.premiumAccent.colors.first.withValues(alpha: opacity),
                AppGradients.premiumAccent.colors.last.withValues(alpha: opacity),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.lg),
            boxShadow: disabled
                ? null
                : [
                    BoxShadow(
                      color: AppColors.accent.withValues(alpha: 0.3),
                      blurRadius: 12,
                      offset: const Offset(0, 4),
                    ),
                  ],
          ),
          child: Center(
            child: DefaultTextStyle(
              style: TextStyle(
                color: Colors.white,
                fontSize: 15,
                fontWeight: FontWeight.w700,
                letterSpacing: 0.3,
              ),
              child: child,
            ),
          ),
        ),
      ),
    );
  }
}

class SecondaryButton extends StatelessWidget {
  const SecondaryButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.expanded = true,
    this.glass = false,
  });

  final String label;
  final Widget? icon;
  final VoidCallback? onPressed;
  final bool expanded;
  final bool glass;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;

    Widget child;
    if (glass) {
      child = _GlassOutlinedButton(
        onPressed: onPressed,
        child: icon == null
            ? Text(label)
            : Row(
                mainAxisSize: MainAxisSize.min,
                children: [icon!, const SizedBox(width: AppSpacing.xs), Text(label)],
              ),
      );
    } else {
      final style = OutlinedButton.styleFrom(
        side: BorderSide(
          color: isDark ? AppColors.glassStrokeDark : AppColors.accent,
        ),
        foregroundColor: AppColors.accent,
        shape: RoundedRectangleBorder(
          borderRadius: BorderRadius.circular(AppRadii.lg),
        ),
        padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
      );
      child = icon == null
          ? OutlinedButton(style: style, onPressed: onPressed, child: Text(label))
          : OutlinedButton.icon(
              style: style,
              onPressed: onPressed,
              icon: icon!,
              label: Text(label),
            );
    }

    final sized = !expanded
        ? child
        : SizedBox(width: double.infinity, child: child);

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: sized,
    );
  }
}

class _GlassOutlinedButton extends StatelessWidget {
  const _GlassOutlinedButton({
    required this.onPressed,
    required this.child,
  });

  final VoidCallback? onPressed;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final disabled = onPressed == null;
    final isDark = Theme.of(context).brightness == Brightness.dark;

    return Semantics(
      button: true,
      enabled: !disabled,
      child: GestureDetector(
        onTap: disabled ? null : onPressed,
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
              decoration: BoxDecoration(
                color: isDark
                    ? AppColors.darkSurface.withValues(alpha: 0.6)
                    : Colors.white.withValues(alpha: 0.8),
                borderRadius: BorderRadius.circular(AppRadii.lg),
                border: Border.all(
                  color: isDark ? AppColors.glassStrokeDark : AppColors.glassStroke,
                ),
              ),
              child: Center(
                child: DefaultTextStyle(
                  style: TextStyle(
                    color: isDark ? Colors.white : AppColors.accent,
                    fontSize: 15,
                    fontWeight: FontWeight.w600,
                  ),
                  child: child,
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

/// Outlined destructive action (cancel order, remove item).
class DangerButton extends StatelessWidget {
  const DangerButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.expanded = true,
  });

  final String label;
  final Widget? icon;
  final VoidCallback? onPressed;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final style = OutlinedButton.styleFrom(
      foregroundColor: Theme.of(context).colorScheme.error,
      side: BorderSide(color: Theme.of(context).colorScheme.error),
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 14),
    );
    final child = icon == null
        ? OutlinedButton(
            style: style,
            onPressed: onPressed,
            child: Text(label),
          )
        : OutlinedButton.icon(
            style: style,
            onPressed: onPressed,
            icon: icon!,
            label: Text(label),
          );

    final sized = !expanded
        ? child
        : SizedBox(width: double.infinity, child: child);

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: sized,
    );
  }
}

class GhostButton extends StatelessWidget {
  const GhostButton({
    super.key,
    required this.label,
    this.icon,
    this.onPressed,
    this.expanded = false,
  });

  final String label;
  final Widget? icon;
  final VoidCallback? onPressed;
  final bool expanded;

  @override
  Widget build(BuildContext context) {
    final child = icon == null
        ? TextButton(onPressed: onPressed, child: Text(label))
        : TextButton.icon(
            onPressed: onPressed,
            icon: icon!,
            label: Text(label),
          );

    final sized = !expanded
        ? child
        : SizedBox(width: double.infinity, child: child);

    return Semantics(
      button: true,
      enabled: onPressed != null,
      label: label,
      child: sized,
    );
  }
}
