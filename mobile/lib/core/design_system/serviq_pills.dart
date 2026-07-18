import 'package:flutter/material.dart';

import '../theme/design_tokens.dart';

/// High-visibility status (open, urgent, in progress, etc.).
class ServiqStatusPill extends StatelessWidget {
  const ServiqStatusPill({
    super.key,
    required this.label,
    this.urgent = false,
    this.maxWidth = 112,
  });

  final String label;
  final bool urgent;
  final double maxWidth;

  @override
  Widget build(BuildContext context) {
    return Container(
      constraints: BoxConstraints(maxWidth: maxWidth),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: urgent ? AppColors.dangerSoft : AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: urgent ? AppColors.danger : Theme.of(context).colorScheme.onSurface,
        ),
      ),
    );
  }
}

/// Location / area line (icon + text), for card metadata rows.
class ServiqLocationPill extends StatelessWidget {
  const ServiqLocationPill({
    super.key,
    required this.label,
    this.icon = Icons.place_outlined,
  });

  final String label;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: 200),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
          const SizedBox(width: 5),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
        ],
      ),
    );
  }
}

/// Loop-specific status pill with per-status colors.
class ServiqLoopStatusPill extends StatelessWidget {
  const ServiqLoopStatusPill({
    super.key,
    required this.label,
    required this.statusKey,
  });

  final String label;
  final String statusKey;

  @override
  Widget build(BuildContext context) {
    final (Color bg, Color fg) = _statusColors(statusKey);

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: fg,
        ),
      ),
    );
  }
}

(Color, Color) _statusColors(String statusKey) {
  switch (statusKey) {
    case 'open':
    case 'available':
      return (AppColors.successSoft, AppColors.success);
    case 'matched':
    case 'booked':
      return (AppColors.accentSoft, AppColors.accentDeep);
    case 'in_progress':
      return (AppColors.warningSoft, AppColors.warmDeep);
    case 'completed':
    case 'fulfilled':
      return (const Color(0xFFE2F6EE), const Color(0xFF0F6E4A));
    default:
      return (AppColors.surfaceMuted, AppColors.primaryDeep);
  }
}

/// Loop type label chip (e.g. "Order", "Requirement").
class ServiqLoopLabelPill extends StatelessWidget {
  const ServiqLoopLabelPill({
    super.key,
    required this.label,
    required this.loopType,
  });

  final String label;
  final String loopType;

  @override
  Widget build(BuildContext context) {
    final Color bg = loopType == 'direct_booking'
        ? AppColors.primarySoft
        : AppColors.warmSoft;
    final Color fg = loopType == 'direct_booking'
        ? AppColors.primaryDeep
        : AppColors.warmDeep;

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelMedium?.copyWith(
          color: fg,
          fontWeight: FontWeight.w700,
        ),
      ),
    );
  }
}

/// Price or budget, neutral chip.
class ServiqPricePill extends StatelessWidget {
  const ServiqPricePill({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(maxWidth: 180),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium,
        ),
      ),
    );
  }
}
