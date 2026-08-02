import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';

enum AppPillSize { regular, mini }

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
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final IconData? icon;
  final AppPillSize size;
  final BorderSide? border;
  final double? maxWidth;

  @override
  Widget build(BuildContext context) {
    final isMini = size == AppPillSize.mini;
    final hPad = isMini ? 6.0 : 10.0;
    final vPad = isMini ? 2.0 : 8.0;
    final iconSize = isMini ? 10.0 : 14.0;
    final gap = isMini ? 3.0 : 6.0;
    final fontSize = isMini ? 10.0 : null;

    return Container(
      constraints: maxWidth != null ? BoxConstraints(maxWidth: maxWidth!) : null,
      padding: EdgeInsets.symmetric(horizontal: hPad, vertical: vPad),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(isMini ? AppRadii.xs : AppRadii.pill),
        border: border != null ? Border.fromBorderSide(border!) : null,
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
