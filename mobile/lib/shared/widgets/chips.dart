import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';

enum AppPillSize { regular, mini }

/// Semantic pill variants. The single source of pill color truth: trust,
/// status, verified, featured, premium pills all render through [AppPill].
/// This collapses the former three competing systems (AppPill, TrustBadge,
/// PremiumPill) and standardizes the verified color (audit H-3).
enum AppPillVariant {
  /// Neutral surface (default).
  neutral,

  /// Brand accent (teal).
  accent,

  /// Success / trust (green).
  success,

  /// Warning / urgent (amber).
  warning,

  /// Danger / error (red).
  danger,

  /// Verified / info (blue). THE verified token.
  verified,

  /// Premium (violet).
  premium,

  /// Featured / boosts (marigold).
  featured,

  /// Dark glass pill for hero overlays.
  dark,
}

class AppPill extends StatelessWidget {
  const AppPill({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    this.icon,
    this.size = AppPillSize.regular,
    this.border,
    this.maxWidth,
    this.onPressed,
  });

  /// Neutral pill (surfaceMuted / onSurface).
  const AppPill.neutral(
    this.label, {
    super.key,
    this.icon,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = AppColors.surfaceMuted,
        foregroundColor = _onSurface,
        border = null;

  /// Brand accent pill (accentSoft / accentDeep).
  const AppPill.accent(
    this.label, {
    super.key,
    this.icon,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = AppColors.accentSoft,
        foregroundColor = AppColors.accentDeep,
        border = null;

  /// Success / trust pill (successSoft / success).
  const AppPill.success(
    this.label, {
    super.key,
    this.icon = Icons.verified_rounded,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = AppColors.successSoft,
        foregroundColor = AppColors.success,
        border = null;

  /// Warning / urgent pill (warningSoft / warmDeep).
  const AppPill.warning(
    this.label, {
    super.key,
    this.icon,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = AppColors.warningSoft,
        foregroundColor = AppColors.warmDeep,
        border = null;

  /// Danger pill (dangerSoft / danger).
  const AppPill.danger(
    this.label, {
    super.key,
    this.icon,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = AppColors.dangerSoft,
        foregroundColor = AppColors.danger,
        border = null;

  /// Verified pill (verifiedSoft / verified). Use for identity/verification.
  const AppPill.verified(
    this.label, {
    super.key,
    this.icon = Icons.verified_user_rounded,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = AppColors.verifiedSoft,
        foregroundColor = AppColors.verified,
        border = null;

  /// Premium pill (premiumSoft / premium).
  const AppPill.premium(
    this.label, {
    super.key,
    this.icon,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = AppColors.premiumSoft,
        foregroundColor = AppColors.premium,
        border = null;

  /// Featured pill (marigoldSoft / marigoldDeep) for boosts and placements.
  const AppPill.featured(
    this.label, {
    super.key,
    this.icon = Icons.star_rounded,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = AppColors.marigoldSoft,
        foregroundColor = AppColors.marigoldDeep,
        border = null;

  /// Dark glass pill for hero overlays (readable on imagery).
  const AppPill.dark(
    this.label, {
    super.key,
    this.icon,
    this.size = AppPillSize.regular,
    this.maxWidth,
    this.onPressed,
  })  : backgroundColor = _darkPillBg,
        foregroundColor = Colors.white,
        border = null;

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final IconData? icon;
  final AppPillSize size;
  final BorderSide? border;
  final double? maxWidth;
  final VoidCallback? onPressed;
  final bool bordered = false;

  static const _onSurface = Color(0xFF0D2137);
  static const _darkPillBg = Color(0xCC0A0E17);

  @override
  Widget build(BuildContext context) {
    final isMini = size == AppPillSize.mini;
    final hPad = isMini ? 6.0 : 10.0;
    final vPad = isMini ? 2.0 : 8.0;
    final iconSize = isMini ? 10.0 : 14.0;
    final gap = isMini ? 3.0 : 6.0;
    final fontSize = isMini ? 10.0 : null;
    final effectiveBorder = border ??
        (bordered
            ? BorderSide(color: foregroundColor.withValues(alpha: 0.14))
            : null);

    final pill = Container(
      constraints: maxWidth != null ? BoxConstraints(maxWidth: maxWidth!) : null,
      padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(isMini ? AppRadii.xs : AppRadii.pill),
        border: effectiveBorder != null ? Border.fromBorderSide(effectiveBorder) : null,
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: iconSize, color: foregroundColor),
            SizedBox(width: gap),
          ],
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: (isMini
                      ? Theme.of(context).textTheme.labelSmall
                      : Theme.of(context).textTheme.labelMedium)
                  ?.copyWith(color: foregroundColor, fontSize: fontSize),
            ),
          ),
        ],
      ),
    );

    if (onPressed == null) {
      return pill;
    }
    return Semantics(
      button: true,
      label: label,
      child: InkWell(
        onTap: onPressed,
        borderRadius: BorderRadius.circular(
          isMini ? AppRadii.xs : AppRadii.pill,
        ),
        child: pill,
      ),
    );
  }
}

class AppFilterChip extends StatelessWidget {
  const AppFilterChip({
    super.key,
    required this.label,
    required this.selected,
    required this.onSelected,
    this.leading,
  });

  final String label;
  final bool selected;
  final ValueChanged<bool> onSelected;
  final IconData? leading;

  @override
  Widget build(BuildContext context) {
    return FilterChip(
      label: Text(label),
      selected: selected,
      avatar: leading == null
          ? null
          : Icon(
              leading,
              size: 16,
              color: selected ? AppColors.primary : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
            ),
      onSelected: onSelected,
      selectedColor: AppColors.primarySoft,
      checkmarkColor: AppColors.primary,
      backgroundColor: AppColors.surfaceAlt,
      side: BorderSide(
        color: selected ? AppColors.primarySoft : Theme.of(context).colorScheme.outline,
      ),
      labelStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
        color: selected ? AppColors.primaryDeep : Theme.of(context).colorScheme.onSurface,
      ),
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
    );
  }
}

class AppStatusChip extends StatelessWidget {
  const AppStatusChip({
    super.key,
    required this.label,
    required this.colorMap,
    this.size = AppPillSize.mini,
  });

  final String label;
  final Map<String, (Color bg, Color fg)> colorMap;
  final AppPillSize size;

  @override
  Widget build(BuildContext context) {
    final (bg, fg) = colorMap[label] ?? (Theme.of(context).colorScheme.surfaceContainerHighest, Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7));
    return AppPill(
      label: label.replaceAll('_', ' '),
      backgroundColor: bg,
      foregroundColor: fg,
      size: size,
    );
  }
}

class CountBadge extends StatelessWidget {
  const CountBadge({super.key, required this.count});

  final int count;

  @override
  Widget build(BuildContext context) {
    if (count <= 0) {
      return const SizedBox.shrink();
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 7, vertical: 4),
      decoration: BoxDecoration(
        color: AppColors.danger,
        borderRadius: BorderRadius.circular(AppRadii.pill),
        border: Border.all(color: AppColors.surface, width: 2),
      ),
      child: Text(
        count > 99 ? '99+' : '$count',
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: Colors.white,
          fontSize: count > 99 ? 9 : null,
        ),
      ),
    );
  }
}
