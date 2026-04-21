import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/app_formatters.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';

class PersonCard extends StatelessWidget {
  const PersonCard({
    super.key,
    required this.person,
    required this.onPrimaryAction,
    required this.onSave,
    required this.onMore,
  });

  final PersonSummary person;
  final VoidCallback onPrimaryAction;
  final VoidCallback onSave;
  final VoidCallback onMore;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: () => context.push(AppRoutes.chat),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 24,
                backgroundColor: AppColors.primarySoft,
                child: Text(AppFormatters.initials(person.name)),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            person.name,
                            style: Theme.of(context).textTheme.titleMedium,
                          ),
                        ),
                        if (person.isOnline)
                          const AppPill(
                            label: 'Online',
                            backgroundColor: AppColors.successSoft,
                            foregroundColor: AppColors.success,
                          ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(
                      person.headline,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              IconButton(
                onPressed: onSave,
                icon: Icon(
                  person.saved ? Icons.star_rounded : Icons.star_border_rounded,
                ),
              ),
              IconButton(
                onPressed: onMore,
                icon: const Icon(Icons.more_horiz_rounded),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(person.bio, style: Theme.of(context).textTheme.bodySmall),
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
                label:
                    '${person.rating.toStringAsFixed(1)} • ${person.reviewCount} reviews',
                backgroundColor: AppColors.warningSoft,
                foregroundColor: AppColors.warning,
                icon: Icons.star_rounded,
              ),
              AppPill(
                label: '${person.responseTimeMinutes} min reply',
                backgroundColor: AppColors.surfaceAlt,
                foregroundColor: AppColors.ink,
                icon: Icons.schedule_rounded,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _MetaPill(
                icon: Icons.location_on_outlined,
                label:
                    '${person.locality} • ${person.distanceKm.toStringAsFixed(1)} km',
              ),
              _MetaPill(
                icon: Icons.people_alt_outlined,
                label: '${person.mutualConnections} mutuals',
              ),
              _MetaPill(
                icon: Icons.task_alt_rounded,
                label: '${person.jobsCompleted} jobs',
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: person.serviceCategories
                .map(
                  (item) => AppPill(
                    label: item,
                    backgroundColor: AppColors.surfaceAlt,
                    foregroundColor: AppColors.ink,
                  ),
                )
                .toList(),
          ),
          const SizedBox(height: AppSpacing.md),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => context.push(
                    '${AppRoutes.chat}?recipientId=${person.id}',
                  ),
                  icon: const Icon(Icons.chat_bubble_outline_rounded),
                  label: const Text('Message'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: FilledButton(
                  onPressed: onPrimaryAction,
                  child: Text(person.connectionState.label),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class ConnectionSummaryCard extends StatelessWidget {
  const ConnectionSummaryCard({super.key, required this.person});

  final PersonSummary person;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 250,
      child: AppCard(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              children: [
                CircleAvatar(
                  backgroundColor: AppColors.primarySoft,
                  child: Text(AppFormatters.initials(person.name)),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Text(
                    person.name,
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              person.headline,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              '${person.locality} • ${person.responseTimeMinutes} min reply',
              style: Theme.of(context).textTheme.bodySmall,
            ),
            const SizedBox(height: AppSpacing.sm),
            const AppPill(
              label: 'Trusted connection',
              backgroundColor: AppColors.primarySoft,
              foregroundColor: AppColors.primaryDeep,
            ),
          ],
        ),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

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
