import 'package:flutter/material.dart';

import '../../core/theme/design_tokens.dart';

class AppPill extends StatelessWidget {
  const AppPill({
    super.key,
    required this.label,
    required this.backgroundColor,
    required this.foregroundColor,
    this.icon,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;
  final IconData? icon;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: backgroundColor,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          if (icon != null) ...[
            Icon(icon, size: 14, color: foregroundColor),
            const SizedBox(width: 6),
          ],
          Flexible(
            child: Text(
              label,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(
                context,
              ).textTheme.labelMedium?.copyWith(color: foregroundColor),
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
              color: selected ? AppColors.primary : AppColors.inkSubtle,
            ),
      onSelected: onSelected,
      selectedColor: AppColors.primarySoft,
      checkmarkColor: AppColors.primary,
      backgroundColor: AppColors.surfaceAlt,
      side: BorderSide(
        color: selected ? AppColors.primarySoft : AppColors.border,
      ),
      labelStyle: Theme.of(context).textTheme.labelMedium?.copyWith(
        color: selected ? AppColors.primaryDeep : AppColors.ink,
      ),
      showCheckmark: false,
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 6),
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
