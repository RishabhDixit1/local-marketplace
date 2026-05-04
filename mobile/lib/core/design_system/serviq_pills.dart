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
          color: urgent ? AppColors.danger : AppColors.ink,
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
      constraints: const BoxConstraints(maxWidth: 200),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.inkMuted),
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

/// Price or budget, neutral chip.
class ServiqPricePill extends StatelessWidget {
  const ServiqPricePill({super.key, required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 180),
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
