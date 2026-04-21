import 'package:flutter/material.dart';

import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/app_formatters.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';

class ProfileHero extends StatelessWidget {
  const ProfileHero({super.key, required this.profile});

  final ProfileSummary profile;

  @override
  Widget build(BuildContext context) {
    final tokens = Theme.of(context).extension<ServiqThemeTokens>()!;

    return AppGradientHeroCard(
      gradient: tokens.peopleGradient,
      child: Padding(
        padding: const EdgeInsets.all(AppSpacing.lg),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                CircleAvatar(
                  radius: 34,
                  backgroundColor: AppColors.surface,
                  child: Text(
                    AppFormatters.initials(profile.name),
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                ),
                const SizedBox(width: AppSpacing.md),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        profile.name,
                        style: Theme.of(context).textTheme.headlineSmall,
                      ),
                      const SizedBox(height: AppSpacing.xxs),
                      Text(
                        profile.headline,
                        style: Theme.of(
                          context,
                        ).textTheme.bodyMedium?.copyWith(color: AppColors.ink),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      Wrap(
                        spacing: AppSpacing.xs,
                        runSpacing: AppSpacing.xs,
                        children: [
                          AppPill(
                            label: profile.verificationLevel.label,
                            backgroundColor: AppColors.verifiedSoft,
                            foregroundColor: AppColors.verified,
                            icon: Icons.verified_rounded,
                          ),
                          AppPill(
                            label: '${profile.completionPercent}% complete',
                            backgroundColor: AppColors.primarySoft,
                            foregroundColor: AppColors.primaryDeep,
                            icon: Icons.task_alt_rounded,
                          ),
                          AppPill(
                            label: profile.locality,
                            backgroundColor: AppColors.surface,
                            foregroundColor: AppColors.ink,
                            icon: Icons.location_on_outlined,
                          ),
                        ],
                      ),
                    ],
                  ),
                ),
              ],
            ),
            const SizedBox(height: AppSpacing.md),
            Text(profile.bio, style: Theme.of(context).textTheme.bodyMedium),
          ],
        ),
      ),
    );
  }
}

class ProfileMetricGrid extends StatelessWidget {
  const ProfileMetricGrid({super.key, required this.profile});

  final ProfileSummary profile;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        final width = (constraints.maxWidth - AppSpacing.sm) / 2;
        return Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.sm,
          children: [
            SizedBox(
              width: width,
              child: AppMetricCard(
                label: 'Response',
                value: '${profile.responseRate}%',
                caption: '${profile.responseTimeMinutes} min average',
                icon: Icons.bolt_rounded,
              ),
            ),
            SizedBox(
              width: width,
              child: AppMetricCard(
                label: 'Rating',
                value: profile.rating.toStringAsFixed(1),
                caption: '${profile.reviewCount} reviews',
                icon: Icons.star_rounded,
              ),
            ),
            SizedBox(
              width: width,
              child: AppMetricCard(
                label: 'Connections',
                value: '${profile.connectionsCount}',
                caption: 'Trusted local graph',
                icon: Icons.people_alt_rounded,
              ),
            ),
            SizedBox(
              width: width,
              child: AppMetricCard(
                label: 'Completed',
                value: '${profile.completedTasksCount}',
                caption: '${profile.activeTasksCount} active now',
                icon: Icons.verified_rounded,
              ),
            ),
          ],
        );
      },
    );
  }
}

class SavedPreviewCard extends StatelessWidget {
  const SavedPreviewCard({
    super.key,
    required this.title,
    required this.subtitle,
    required this.items,
  });

  final String title;
  final String subtitle;
  final List<String> items;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(subtitle, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: AppSpacing.md),
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
              child: Row(
                children: [
                  const Icon(Icons.chevron_right_rounded, size: 18),
                  const SizedBox(width: AppSpacing.xs),
                  Expanded(
                    child: Text(
                      item,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ),
                ],
              ),
            ),
          ),
        ],
      ),
    );
  }
}
