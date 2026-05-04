import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../data/launchpad_repository.dart';
import '../domain/launchpad_models.dart';

class ProviderLaunchpadReviewPage extends ConsumerWidget {
  const ProviderLaunchpadReviewPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final workspace = ref.watch(launchpadWorkspaceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Publish readiness')),
      body: SafeArea(
        child: ServiqAsyncBody<MobileLaunchpadWorkspace>(
          value: workspace,
          errorTitle: 'Unable to load launchpad',
          errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
          onRetry: () => ref.invalidate(launchpadWorkspaceProvider),
          loadingBuilder: () =>
              const Center(child: CircularProgressIndicator()),
          data: (data) {
            final answers =
                data.draft?.answers ?? MobileLaunchpadAnswers.empty();
            final readiness = LaunchpadReadiness.fromAnswers(answers);
            final ratio = readiness.totalCount == 0
                ? 0.0
                : readiness.completedCount / readiness.totalCount;

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Workspace snapshot',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        data.summary.profileExists
                            ? 'Public profile linked.'
                            : 'Public profile not linked yet.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Live inventory · ${data.summary.totalServices} services / ${data.summary.totalProducts} products',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.inkMuted,
                        ),
                      ),
                      if ((data.summary.profilePath ?? '').trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            data.summary.profilePath!.trim(),
                            style: Theme.of(context).textTheme.labelMedium,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Checklist',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      LinearProgressIndicator(
                        value: ratio.clamp(0.0, 1.0),
                        minHeight: 8,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${readiness.completedCount} of ${readiness.totalCount} complete',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.inkMuted,
                        ),
                      ),
                      const SizedBox(height: 12),
                      for (final item in readiness.items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                item.done
                                    ? Icons.check_circle_rounded
                                    : Icons.circle_outlined,
                                color: item.done
                                    ? AppColors.success
                                    : AppColors.inkMuted,
                                size: 22,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.title,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.description,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(color: AppColors.inkMuted),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                PrimaryButton(
                  label: 'Open Business AI Launchpad',
                  icon: const Icon(Icons.rocket_launch_outlined),
                  onPressed: () =>
                      context.push(AppRoutes.providerLaunchpad),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class LaunchpadReadiness {
  LaunchpadReadiness({required this.items});

  factory LaunchpadReadiness.fromAnswers(MobileLaunchpadAnswers answers) {
    final items = [
      LaunchpadReadinessItem(
        title: 'Business basics',
        description:
            'Public name, category, and base location are ready for publishing.',
        done: answers.businessName.isNotEmpty &&
            answers.primaryCategory.isNotEmpty &&
            answers.location.isNotEmpty,
      ),
      LaunchpadReadinessItem(
        title: 'Offer catalog',
        description: 'At least one service or product outline exists.',
        done: answers.coreOfferings.isNotEmpty,
      ),
      LaunchpadReadinessItem(
        title: 'Customer-facing copy',
        description: 'Profile summary or AI-ready outline is present.',
        done: answers.shortDescription.isNotEmpty ||
            (answers.businessName.isNotEmpty &&
                answers.coreOfferings.isNotEmpty),
      ),
      LaunchpadReadinessItem(
        title: 'Contact or availability',
        description: 'Phone or hours gives customers a path to reach you.',
        done: answers.phone.isNotEmpty || answers.hours.isNotEmpty,
      ),
    ];
    return LaunchpadReadiness(items: items);
  }

  final List<LaunchpadReadinessItem> items;

  int get totalCount => items.length;
  int get completedCount => items.where((item) => item.done).length;
}

class LaunchpadReadinessItem {
  const LaunchpadReadinessItem({
    required this.title,
    required this.description,
    required this.done,
  });

  final String title;
  final String description;
  final bool done;
}
