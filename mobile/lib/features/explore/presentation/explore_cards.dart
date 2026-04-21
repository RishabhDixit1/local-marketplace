import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/app_formatters.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';

class ExploreListingCard extends StatelessWidget {
  const ExploreListingCard({
    super.key,
    required this.item,
    required this.onSave,
  });

  final ExploreItem item;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => context.push(AppRoutes.people),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    AppPill(
                      label: item.type.label,
                      backgroundColor: AppColors.surfaceAlt,
                      foregroundColor: AppColors.ink,
                    ),
                    if (item.urgent)
                      const AppPill(
                        label: 'Urgent',
                        backgroundColor: AppColors.urgentSoft,
                        foregroundColor: AppColors.urgent,
                        icon: Icons.local_fire_department_outlined,
                      ),
                    if (item.verified)
                      const AppPill(
                        label: 'Verified',
                        backgroundColor: AppColors.verifiedSoft,
                        foregroundColor: AppColors.verified,
                        icon: Icons.verified_rounded,
                      ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onSave,
                icon: Icon(
                  item.saved
                      ? Icons.bookmark_rounded
                      : Icons.bookmark_border_rounded,
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(item.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(item.summary, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _MetaChip(
                icon: Icons.place_outlined,
                label:
                    '${item.locality} • ${item.distanceKm.toStringAsFixed(1)} km',
              ),
              _MetaChip(
                icon: Icons.currency_rupee_rounded,
                label: item.priceLabel,
              ),
              _MetaChip(
                icon: Icons.schedule_rounded,
                label: AppFormatters.relativeTime(item.postedAt),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  item.providerName,
                  style: Theme.of(context).textTheme.titleMedium,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  item.trustNote,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: AppSpacing.xs),
                Text(
                  item.socialProof,
                  style: Theme.of(
                    context,
                  ).textTheme.bodySmall?.copyWith(color: AppColors.ink),
                ),
              ],
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => context.push(
                    '${AppRoutes.chat}?recipientId=${item.providerId}',
                  ),
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                  label: const Text('Message'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: FilledButton.icon(
                  onPressed: () => context.push(AppRoutes.people),
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('Open'),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class RecommendedProviderCard extends StatelessWidget {
  const RecommendedProviderCard({
    super.key,
    required this.person,
    required this.onSave,
  });

  final PersonSummary person;
  final VoidCallback onSave;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 280,
      child: AppCard(
        onTap: () => context.push(AppRoutes.people),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  radius: 24,
                  backgroundColor: AppColors.primarySoft,
                  child: Text(
                    AppFormatters.initials(person.name),
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: AppColors.primaryDeep,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        person.name,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        person.headline,
                        maxLines: 2,
                        overflow: TextOverflow.ellipsis,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                IconButton(
                  onPressed: onSave,
                  icon: Icon(
                    person.saved
                        ? Icons.favorite_rounded
                        : Icons.favorite_border_rounded,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                AppPill(
                  label: person.verificationLevel.label,
                  backgroundColor: AppColors.verifiedSoft,
                  foregroundColor: AppColors.verified,
                  icon: Icons.verified_rounded,
                ),
                AppPill(
                  label: '${person.responseTimeMinutes} min reply',
                  backgroundColor: AppColors.surfaceAlt,
                  foregroundColor: AppColors.ink,
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${person.jobsCompleted} jobs • ${person.rating.toStringAsFixed(1)} rating • ${person.mutualConnections} mutuals',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.md),
            FilledButton.icon(
              onPressed: () => context.push(AppRoutes.people),
              icon: const Icon(Icons.person_search_rounded),
              label: const Text('View profile'),
            ),
          ],
        ),
      ),
    );
  }
}

class ExploreMapPlaceholder extends StatelessWidget {
  const ExploreMapPlaceholder({
    super.key,
    required this.locationTitle,
    required this.hotspots,
  });

  final String locationTitle;
  final List<ExploreItem> hotspots;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Local heatmap', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'A live map layer can plug in here later. For now, the app highlights dense local demand zones around $locationTitle.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            height: 180,
            decoration: BoxDecoration(
              gradient: const LinearGradient(
                colors: [Color(0xFFEAF6F0), Color(0xFFF8F2E8)],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.md),
            ),
            child: Stack(
              children: [
                ...List.generate(
                  hotspots.length.clamp(0, 4),
                  (index) => Positioned(
                    left: 24.0 + (index * 58),
                    top: 40.0 + ((index % 2) * 36),
                    child: Container(
                      width: 52,
                      height: 52,
                      decoration: BoxDecoration(
                        color: AppColors.primary.withValues(alpha: 0.16),
                        shape: BoxShape.circle,
                      ),
                      alignment: Alignment.center,
                      child: const Icon(
                        Icons.place_rounded,
                        color: AppColors.primary,
                      ),
                    ),
                  ),
                ),
                const Center(
                  child: Icon(
                    Icons.map_outlined,
                    size: 48,
                    color: AppColors.inkSubtle,
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _MetaChip extends StatelessWidget {
  const _MetaChip({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.inkSubtle),
          const SizedBox(width: AppSpacing.xxs),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
