import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../../../shared/widgets/section_header.dart';
import '../data/profile_hub_repository.dart';
import 'profile_widgets.dart';

class ProfileScreen extends ConsumerStatefulWidget {
  const ProfileScreen({super.key});

  @override
  ConsumerState<ProfileScreen> createState() => _ProfileScreenState();
}

class _ProfileScreenState extends ConsumerState<ProfileScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).trackScreen('profile_screen');
    });
  }

  Future<void> _refresh() async {
    ref.invalidate(profileHubProvider);
    await ref.read(profileHubProvider.future);
  }

  @override
  Widget build(BuildContext context) {
    final profileAsync = ref.watch(profileHubProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageInset,
              AppSpacing.sm,
              AppSpacing.pageInset,
              120,
            ),
            children: [
              profileAsync.when(
                data: (hub) {
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProfileHero(profile: hub.profile),
                      const SizedBox(height: AppSpacing.lg),
                      Row(
                        children: [
                          Expanded(
                            child: FilledButton.icon(
                              onPressed: () =>
                                  context.push(AppRoutes.editProfile),
                              icon: const Icon(Icons.edit_outlined),
                              label: const Text('Edit profile'),
                            ),
                          ),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                ScaffoldMessenger.of(context).showSnackBar(
                                  const SnackBar(
                                    content: Text('Profile share link copied.'),
                                  ),
                                );
                              },
                              icon: const Icon(Icons.share_outlined),
                              label: const Text('Share'),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      ProfileMetricGrid(profile: hub.profile),
                      const SizedBox(height: AppSpacing.lg),
                      const AppSectionHeader(
                        title: 'Credibility snapshot',
                        subtitle:
                            'Keep the public story clear, concise, and conversion-friendly.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: AppSpacing.xs,
                              runSpacing: AppSpacing.xs,
                              children: hub.profile.roles
                                  .map(
                                    (role) => AppPill(
                                      label: role.label,
                                      backgroundColor: AppColors.surfaceAlt,
                                      foregroundColor: AppColors.ink,
                                    ),
                                  )
                                  .toList(),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              'Availability',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: AppSpacing.xxs),
                            Text(
                              hub.profile.availabilityLabel,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Text(
                              'Service categories',
                              style: Theme.of(context).textTheme.titleMedium,
                            ),
                            const SizedBox(height: AppSpacing.xxs),
                            Wrap(
                              spacing: AppSpacing.xs,
                              runSpacing: AppSpacing.xs,
                              children: hub.profile.serviceCategories
                                  .map(
                                    (category) => AppPill(
                                      label: category,
                                      backgroundColor: AppColors.primarySoft,
                                      foregroundColor: AppColors.primaryDeep,
                                    ),
                                  )
                                  .toList(),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      SavedPreviewCard(
                        title: 'Saved listings',
                        subtitle:
                            '${hub.savedListings.length} nearby requests and opportunities ready for follow-up.',
                        items: hub.savedListings
                            .map((item) => item.title)
                            .toList(),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SavedPreviewCard(
                        title: 'Saved people',
                        subtitle:
                            '${hub.savedPeople.length} providers and neighbors shortlisted for trust and relevance.',
                        items: hub.savedPeople
                            .map((item) => item.name)
                            .toList(),
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SavedPreviewCard(
                        title: 'Recent searches',
                        subtitle:
                            'ServiQ keeps a lightweight memory of your local intent.',
                        items: hub.recentSearches,
                      ),
                      const SizedBox(height: AppSpacing.md),
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Text(
                              'Verification and reviews',
                              style: Theme.of(context).textTheme.titleLarge,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            ...hub.profile.reviews.map(
                              (review) => Padding(
                                padding: const EdgeInsets.only(
                                  bottom: AppSpacing.sm,
                                ),
                                child: Column(
                                  crossAxisAlignment: CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      '${review.author} • ${review.rating.toStringAsFixed(1)}',
                                      style: Theme.of(
                                        context,
                                      ).textTheme.titleMedium,
                                    ),
                                    const SizedBox(height: AppSpacing.xxs),
                                    Text(
                                      review.comment,
                                      style: Theme.of(
                                        context,
                                      ).textTheme.bodyMedium,
                                    ),
                                  ],
                                ),
                              ),
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            OutlinedButton.icon(
                              onPressed: () => context.push(AppRoutes.settings),
                              icon: const Icon(Icons.settings_outlined),
                              label: const Text('Open settings'),
                            ),
                          ],
                        ),
                      ),
                    ],
                  );
                },
                loading: () => const CardListSkeleton(count: 4),
                error: (error, _) => AppErrorState(
                  title: 'Profile is unavailable',
                  message: AppErrorMapper.toMessage(error),
                  onRetry: _refresh,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
