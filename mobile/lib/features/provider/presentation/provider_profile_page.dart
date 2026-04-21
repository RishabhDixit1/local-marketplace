import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/feed/data/feed_repository.dart';
import '../../../features/feed/domain/feed_snapshot.dart';
import '../../../features/people/data/people_repository.dart';
import '../../../features/people/domain/people_snapshot.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/profile_avatar_tile.dart';
import '../../../shared/components/section_header.dart';
import '../../../shared/components/trust_badge.dart';

class ProviderProfilePage extends ConsumerWidget {
  const ProviderProfilePage({super.key, required this.providerId});

  final String providerId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final peopleAsync = ref.watch(peopleSnapshotProvider);
    final feedAsync = ref.watch(feedSnapshotProvider(MobileFeedScope.all));

    return Scaffold(
      appBar: AppBar(title: const Text('Provider profile')),
      body: SafeArea(
        child: peopleAsync.when(
          data: (peopleSnapshot) {
            final provider = peopleSnapshot.people
                .where((person) => person.id == providerId)
                .cast<MobilePersonCard?>()
                .firstWhere((person) => person != null, orElse: () => null);

            if (provider == null) {
              return ListView(
                padding: const EdgeInsets.all(16),
                children: const [
                  SectionCard(
                    child: EmptyStateView(
                      title: 'Provider not found',
                      message:
                          'This profile is no longer available in the nearby network.',
                    ),
                  ),
                ],
              );
            }

            final relatedItems =
                feedAsync.asData?.value.items
                    .where((item) => item.providerId == providerId)
                    .toList() ??
                const <MobileFeedItem>[];
            final publicProfilePath = relatedItems
                .map((item) => item.publicProfilePath)
                .firstWhere((path) => path.trim().isNotEmpty, orElse: () => '');

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
              children: [
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ProfileAvatarTile(
                        name: provider.name,
                        subtitle: provider.headline,
                        avatarUrl: provider.avatarUrl,
                      ),
                      const SizedBox(height: 16),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: [
                          TrustBadge(label: provider.verificationLabel),
                          TrustBadge(
                            label: provider.ratingLabel,
                            icon: Icons.star_rounded,
                            backgroundColor: AppColors.warningSoft,
                            foregroundColor: AppColors.warning,
                          ),
                          TrustBadge(
                            label: provider.activityLabel,
                            icon: provider.isOnline
                                ? Icons.bolt_rounded
                                : Icons.schedule_rounded,
                            backgroundColor: AppColors.accentSoft,
                            foregroundColor: AppColors.accent,
                          ),
                        ],
                      ),
                      const SizedBox(height: 16),
                      Text(
                        provider.locationLabel,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${provider.workLabel} • ${provider.priceLabel}',
                        style: Theme.of(
                          context,
                        ).textTheme.bodySmall?.copyWith(color: AppColors.ink),
                      ),
                      const SizedBox(height: 16),
                      Row(
                        children: [
                          Expanded(
                            child: PrimaryButton(
                              label: 'Contact',
                              onPressed: () {
                                context.push(
                                  '${AppRoutes.chat}?recipientId=${provider.id}',
                                );
                              },
                            ),
                          ),
                          const SizedBox(width: 12),
                          Expanded(
                            child: SecondaryButton(
                              label: 'Request quote',
                              onPressed: () =>
                                  context.push(AppRoutes.createRequest),
                            ),
                          ),
                        ],
                      ),
                      const SizedBox(height: 12),
                      GhostButton(
                        label: publicProfilePath.trim().isEmpty
                            ? 'Copy provider ID'
                            : 'Copy public profile',
                        onPressed: () async {
                          await Clipboard.setData(
                            ClipboardData(
                              text: publicProfilePath.trim().isEmpty
                                  ? provider.id
                                  : publicProfilePath,
                            ),
                          );
                          if (!context.mounted) {
                            return;
                          }
                          ScaffoldMessenger.of(context).showSnackBar(
                            SnackBar(
                              content: Text(
                                publicProfilePath.trim().isEmpty
                                    ? 'Provider ID copied.'
                                    : 'Public profile path copied.',
                              ),
                            ),
                          );
                        },
                        expanded: true,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                LayoutBuilder(
                  builder: (context, constraints) {
                    final width = (constraints.maxWidth - 12) / 2;
                    return Wrap(
                      spacing: 12,
                      runSpacing: 12,
                      children: [
                        SizedBox(
                          width: width,
                          child: MetricTile(
                            label: 'Completed jobs',
                            value: provider.completedJobs.toString(),
                            icon: Icons.task_alt_rounded,
                          ),
                        ),
                        SizedBox(
                          width: width,
                          child: MetricTile(
                            label: 'Open leads',
                            value: provider.openLeads.toString(),
                            icon: Icons.flash_on_rounded,
                          ),
                        ),
                        SizedBox(
                          width: width,
                          child: MetricTile(
                            label: 'Profile readiness',
                            value: '${provider.completionPercent}%',
                            icon: Icons.shield_outlined,
                          ),
                        ),
                        SizedBox(
                          width: width,
                          child: MetricTile(
                            label: 'Nearby activity',
                            value: provider.postCount.toString(),
                            icon: Icons.public_rounded,
                          ),
                        ),
                      ],
                    );
                  },
                ),
                const SizedBox(height: 16),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      const SectionHeader(
                        title: 'Services and signals',
                        subtitle:
                            'Built to help nearby users trust the provider quickly.',
                      ),
                      const SizedBox(height: 14),
                      Wrap(
                        spacing: 8,
                        runSpacing: 8,
                        children: provider.primaryTags
                            .map(
                              (tag) => Container(
                                padding: const EdgeInsets.symmetric(
                                  horizontal: 10,
                                  vertical: 8,
                                ),
                                decoration: BoxDecoration(
                                  color: AppColors.surfaceMuted,
                                  borderRadius: BorderRadius.circular(
                                    AppRadii.md,
                                  ),
                                ),
                                child: Text(
                                  tag,
                                  style: Theme.of(
                                    context,
                                  ).textTheme.labelMedium,
                                ),
                              ),
                            )
                            .toList(),
                      ),
                      const SizedBox(height: 14),
                      Text(
                        provider.headline,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SectionHeader(
                  title: 'Related local posts',
                  subtitle:
                      'Recent listings and activity from the same provider in your area.',
                ),
                const SizedBox(height: 12),
                if (feedAsync.isLoading)
                  const SectionCard(child: CircularProgressIndicator())
                else if (relatedItems.isEmpty)
                  const SectionCard(
                    child: EmptyStateView(
                      title: 'No recent posts yet',
                      message:
                          'This provider is visible in the people directory, but recent feed activity has not loaded yet.',
                    ),
                  )
                else
                  ...relatedItems
                      .take(3)
                      .map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 12),
                          child: FeedCard(
                            item: item,
                            onPrimaryTap: () =>
                                context.push(AppRoutes.createRequest),
                            onSecondaryTap: () => context.push(
                              '${AppRoutes.chat}?recipientId=$providerId',
                            ),
                            primaryLabel: 'Request service',
                            secondaryLabel: 'Message',
                          ),
                        ),
                      ),
              ],
            );
          },
          loading: () => const Center(child: CircularProgressIndicator()),
          error: (error, _) => ListView(
            padding: const EdgeInsets.all(16),
            children: [SectionCard(child: Text(error.toString()))],
          ),
        ),
      ),
    );
  }
}
