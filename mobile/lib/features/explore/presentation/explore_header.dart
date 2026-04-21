import 'package:flutter/material.dart';

import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';

class ExploreHeader extends StatelessWidget {
  const ExploreHeader({
    super.key,
    required this.locationTitle,
    required this.onSearchTap,
    required this.onFilterTap,
    required this.onNotificationsTap,
    required this.showMap,
    required this.onToggleMap,
  });

  final String locationTitle;
  final VoidCallback onSearchTap;
  final VoidCallback onFilterTap;
  final VoidCallback onNotificationsTap;
  final bool showMap;
  final ValueChanged<bool> onToggleMap;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<ServiqThemeTokens>()!;

    return AppGradientHeroCard(
      gradient: tokens.heroGradient,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Explore nearby',
                        style: Theme.of(context).textTheme.headlineMedium
                            ?.copyWith(color: Colors.white),
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Live opportunities, trusted providers, and urgent needs around $locationTitle.',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Colors.white.withValues(alpha: 0.88),
                        ),
                      ),
                    ],
                  ),
                ),
                IconButton.filledTonal(
                  onPressed: onNotificationsTap,
                  style: IconButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.16),
                    foregroundColor: Colors.white,
                  ),
                  icon: const Icon(Icons.notifications_none_rounded),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.lg),
            GestureDetector(
              onTap: onSearchTap,
              child: Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: AppSpacing.md,
                  vertical: AppSpacing.md,
                ),
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  border: Border.all(
                    color: Colors.white.withValues(alpha: 0.2),
                  ),
                ),
                child: Row(
                  children: [
                    const Icon(Icons.search_rounded),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Text(
                        'Search people, requests, services',
                        style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: AppColors.inkSubtle,
                        ),
                      ),
                    ),
                    TextButton(
                      onPressed: onFilterTap,
                      child: const Text('Filters'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                AppPill(
                  label: locationTitle,
                  backgroundColor: Colors.white.withValues(alpha: 0.16),
                  foregroundColor: Colors.white,
                  icon: Icons.location_on_outlined,
                ),
                const SizedBox(width: AppSpacing.sm),
                AppPill(
                  label: showMap ? 'Map view' : 'List view',
                  backgroundColor: Colors.white.withValues(alpha: 0.16),
                  foregroundColor: Colors.white,
                  icon: showMap
                      ? Icons.map_outlined
                      : Icons.view_agenda_outlined,
                ),
                const Spacer(),
                SegmentedButton<bool>(
                  showSelectedIcon: false,
                  style: SegmentedButton.styleFrom(
                    backgroundColor: Colors.white.withValues(alpha: 0.12),
                    selectedBackgroundColor: Colors.white,
                    foregroundColor: Colors.white,
                    selectedForegroundColor: AppColors.ink,
                  ),
                  segments: const [
                    ButtonSegment<bool>(
                      value: false,
                      label: Text('List'),
                      icon: Icon(Icons.view_agenda_outlined),
                    ),
                    ButtonSegment<bool>(
                      value: true,
                      label: Text('Map'),
                      icon: Icon(Icons.map_outlined),
                    ),
                  ],
                  selected: {showMap},
                  onSelectionChanged: (values) => onToggleMap(values.first),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }
}
