import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/design_system/serviq_surface.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/trust_badge.dart';
import '../../chat/data/chat_repository.dart';
import '../../chat/domain/chat_models.dart';
import '../../profile/data/profile_repository.dart';
import '../../profile/domain/mobile_profile_snapshot.dart';
import '../../tasks/data/task_repository.dart';
import '../../tasks/domain/task_snapshot.dart';

class ControlPage extends ConsumerWidget {
  const ControlPage({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(profileSnapshotProvider);
    ref.invalidate(taskSnapshotProvider);
    ref.invalidate(chatConversationsProvider);
    await Future.wait([
      ref.read(profileSnapshotProvider.future),
      ref.read(taskSnapshotProvider.future).catchError((_) {
        return MobileTaskSnapshot(currentUserId: '', items: const []);
      }),
      ref.read(chatConversationsProvider.future).catchError((_) {
        return const <ChatConversation>[];
      }),
    ]);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final profile = ref.watch(profileSnapshotProvider);
    final tasks = ref.watch(taskSnapshotProvider).asData?.value;
    final conversations = ref.watch(chatConversationsProvider).asData?.value;

    return Scaffold(
      appBar: AppBar(
        title: const Text('Business Control'),
        actions: [
          IconButton(
            tooltip: 'Refresh control data',
            onPressed: () => _refresh(ref),
            icon: const Icon(Icons.refresh_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 28),
            children: [
              ServiqAsyncBody<MobileProfileSnapshot>(
                value: profile,
                errorTitle: 'Unable to load Business Control',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: () => _refresh(ref),
                loadingBuilder: () => const _ControlLoadingState(),
                data: (snapshot) {
                  if (snapshot.roleFamily != 'provider') {
                    return _ProviderConversionPanel(snapshot: snapshot);
                  }

                  return _ProviderControlDashboard(
                    snapshot: snapshot,
                    tasks: tasks,
                    unreadCount:
                        conversations?.fold<int>(
                          0,
                          (count, item) => count + item.unreadCount,
                        ) ??
                        0,
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _ProviderControlDashboard extends StatelessWidget {
  const _ProviderControlDashboard({
    required this.snapshot,
    required this.tasks,
    required this.unreadCount,
  });

  final MobileProfileSnapshot snapshot;
  final MobileTaskSnapshot? tasks;
  final int unreadCount;

  @override
  Widget build(BuildContext context) {
    final activeTasks =
        tasks?.items
            .where(
              (task) =>
                  task.isProviderTask &&
                  (task.status == MobileTaskStatus.active ||
                      task.status == MobileTaskStatus.inProgress),
            )
            .length ??
        0;
    final needsAction =
        tasks?.items
            .where((task) => task.isProviderTask && task.primaryAction != null)
            .length ??
        0;
    final offerCount = snapshot.serviceCount + snapshot.productCount;
    final setupScore = _setupScore(snapshot);
    final nextAction = _nextBestAction(
      snapshot: snapshot,
      needsAction: needsAction,
      unreadCount: unreadCount,
      activeTasks: activeTasks,
    );

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        _ControlHero(
          setupScore: setupScore,
          nextAction: nextAction,
          offerCount: offerCount,
          unreadCount: unreadCount,
          activeTasks: activeTasks,
          needsAction: needsAction,
        ),
        const SizedBox(height: 14),
        _ControlMetricGrid(
          setupScore: setupScore,
          offerCount: offerCount,
          unreadCount: unreadCount,
          activeTasks: activeTasks,
        ),
        const SizedBox(height: 14),
        _SetupProgressPanel(snapshot: snapshot),
        const SizedBox(height: 14),
        _ControlActionPanel(
          needsAction: needsAction,
          unreadCount: unreadCount,
          offerCount: offerCount,
        ),
        const SizedBox(height: 14),
        _TrustRevenuePanel(snapshot: snapshot, tasks: tasks),
        const SizedBox(height: 14),
        _AnalyticsPanel(snapshot: snapshot, tasks: tasks),
      ],
    );
  }
}

class _ControlHero extends StatelessWidget {
  const _ControlHero({
    required this.setupScore,
    required this.nextAction,
    required this.offerCount,
    required this.unreadCount,
    required this.activeTasks,
    required this.needsAction,
  });

  final int setupScore;
  final _ControlNextAction nextAction;
  final int offerCount;
  final int unreadCount;
  final int activeTasks;
  final int needsAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: AppColors.inkStrong,
        borderRadius: BorderRadius.circular(AppRadii.md),
        boxShadow: AppShadows.card,
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Business Control',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            'Your setup, listings, leads, quotes, and work handoffs in one place.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.78),
            ),
          ),
          const SizedBox(height: 18),
          _DarkNextAction(action: nextAction),
          const SizedBox(height: 16),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _DarkPill(label: '$setupScore% setup'),
              _DarkPill(label: '$offerCount offers'),
              _DarkPill(label: '$unreadCount unread'),
              _DarkPill(label: '$needsAction actions'),
              _DarkPill(label: '$activeTasks active work'),
            ],
          ),
        ],
      ),
    );
  }
}

class _DarkNextAction extends StatelessWidget {
  const _DarkNextAction({required this.action});

  final _ControlNextAction action;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.white.withValues(alpha: 0.1),
      borderRadius: BorderRadius.circular(AppRadii.sm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.sm),
        onTap: () => context.push(action.route),
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            children: [
              Container(
                width: 38,
                height: 38,
                decoration: BoxDecoration(
                  color: Colors.white,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                ),
                child: Icon(action.icon, color: AppColors.primary),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Next best action',
                      style: Theme.of(context).textTheme.labelMedium?.copyWith(
                        color: Colors.white.withValues(alpha: 0.72),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      action.label,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(
                        context,
                      ).textTheme.titleMedium?.copyWith(color: Colors.white),
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}

class _DarkPill extends StatelessWidget {
  const _DarkPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelMedium?.copyWith(color: Colors.white),
      ),
    );
  }
}

class _ControlMetricGrid extends StatelessWidget {
  const _ControlMetricGrid({
    required this.setupScore,
    required this.offerCount,
    required this.unreadCount,
    required this.activeTasks,
  });

  final int setupScore;
  final int offerCount;
  final int unreadCount;
  final int activeTasks;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final tileWidth = constraints.maxWidth < 360
            ? constraints.maxWidth
            : (constraints.maxWidth - gap) / 2;
        final tiles = [
          (
            'Setup',
            '$setupScore%',
            'Profile and offer readiness',
            Icons.rocket_launch_outlined,
          ),
          (
            'Listings',
            offerCount.toString(),
            'Services and products live',
            Icons.inventory_2_outlined,
          ),
          (
            'Inbox',
            unreadCount.toString(),
            'Unread lead follow-ups',
            Icons.chat_bubble_outline_rounded,
          ),
          (
            'Work',
            activeTasks.toString(),
            'Active provider tasks',
            Icons.assignment_turned_in_outlined,
          ),
        ];

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            for (final tile in tiles)
              SizedBox(
                width: tileWidth,
                child: MetricTile(
                  label: tile.$1,
                  value: tile.$2,
                  caption: tile.$3,
                  icon: tile.$4,
                ),
              ),
          ],
        );
      },
    );
  }
}

class _SetupProgressPanel extends StatelessWidget {
  const _SetupProgressPanel({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final rows = [
      (
        'Profile basics',
        snapshot.profile.fullName.isNotEmpty &&
            snapshot.profile.headline.isNotEmpty,
        snapshot.profile.headline.isEmpty
            ? 'Add name and headline'
            : snapshot.profile.headline,
      ),
      (
        'Service area',
        snapshot.profile.location.isNotEmpty,
        snapshot.profile.location.isEmpty
            ? 'Add public service area'
            : snapshot.profile.location,
      ),
      (
        'Offer catalog',
        snapshot.serviceCount + snapshot.productCount > 0,
        '${snapshot.serviceCount} services / ${snapshot.productCount} products',
      ),
      (
        'Proof and trust',
        snapshot.portfolioCount + snapshot.reviewCount > 0,
        '${snapshot.portfolioCount} proof items / ${snapshot.reviewCount} reviews',
      ),
      (
        'Availability',
        snapshot.availabilityCount > 0 ||
            snapshot.profile.availability.isNotEmpty,
        _humanize(snapshot.profile.availability),
      ),
    ];

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Setup progress', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'These are the business foundations ServiQ uses before showing you strongly in discovery.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          LinearProgressIndicator(
            value: (_setupScore(snapshot) / 100).clamp(0.0, 1.0),
            minHeight: 10,
            borderRadius: BorderRadius.circular(AppRadii.pill),
          ),
          const SizedBox(height: 14),
          for (final row in rows)
            _ControlChecklistRow(label: row.$1, done: row.$2, detail: row.$3),
          const SizedBox(height: 8),
          _ControlLinkRow(
            icon: Icons.auto_awesome_rounded,
            label: 'Continue Business AI setup',
            route: AppRoutes.providerLaunchpad,
          ),
          _ControlLinkRow(
            icon: Icons.fact_check_outlined,
            label: 'Review publish readiness',
            route: AppRoutes.providerLaunchpadReview,
          ),
        ],
      ),
    );
  }
}

class _ControlActionPanel extends StatelessWidget {
  const _ControlActionPanel({
    required this.needsAction,
    required this.unreadCount,
    required this.offerCount,
  });

  final int needsAction;
  final int unreadCount;
  final int offerCount;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Lead control', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Reply, quote, and move work forward without hunting across tabs.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(
                label: '$unreadCount unread',
                icon: Icons.mark_chat_unread_outlined,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primary,
              ),
              TrustBadge(
                label: '$needsAction work actions',
                icon: Icons.flash_on_rounded,
                backgroundColor: AppColors.warningSoft,
                foregroundColor: AppColors.warning,
              ),
              TrustBadge(
                label: '$offerCount live offers',
                icon: Icons.storefront_outlined,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
            ],
          ),
          const SizedBox(height: 14),
          _ControlLinkRow(
            icon: Icons.chat_bubble_outline_rounded,
            label: 'Open Inbox',
            route: AppRoutes.chat,
          ),
          _ControlLinkRow(
            icon: Icons.assignment_outlined,
            label: 'Open Work',
            route: AppRoutes.tasks,
          ),
          _ControlLinkRow(
            icon: Icons.inventory_2_outlined,
            label: 'Manage listings',
            route: AppRoutes.providerListings,
          ),
        ],
      ),
    );
  }
}

class _TrustRevenuePanel extends StatelessWidget {
  const _TrustRevenuePanel({required this.snapshot, required this.tasks});

  final MobileProfileSnapshot snapshot;
  final MobileTaskSnapshot? tasks;

  @override
  Widget build(BuildContext context) {
    final completed =
        tasks?.items
            .where(
              (task) =>
                  task.isProviderTask &&
                  task.status == MobileTaskStatus.completed,
            )
            .length ??
        0;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Trust and revenue',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: 8),
          Text(
            'The signals that help nearby customers trust your work and complete orders.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          _ControlChecklistRow(
            label: 'Trust score',
            done: snapshot.trustScore >= 60,
            detail: '${snapshot.trustScore} trust score',
          ),
          _ControlChecklistRow(
            label: 'Reviews',
            done: snapshot.reviewCount > 0,
            detail:
                '${snapshot.reviewCount} reviews / ${snapshot.averageRating.toStringAsFixed(1)} avg',
          ),
          _ControlChecklistRow(
            label: 'Completed work',
            done: completed > 0,
            detail: '$completed completed provider tasks visible on mobile',
          ),
          const SizedBox(height: 8),
          _ControlLinkRow(
            icon: Icons.receipt_long_outlined,
            label: 'Open orders',
            route: AppRoutes.orders,
          ),
          _ControlLinkRow(
            icon: Icons.verified_user_outlined,
            label: 'Open trust and verification',
            route: AppRoutes.profileTrust,
          ),
        ],
      ),
    );
  }
}

class _AnalyticsPanel extends StatelessWidget {
  const _AnalyticsPanel({required this.snapshot, required this.tasks});

  final MobileProfileSnapshot snapshot;
  final MobileTaskSnapshot? tasks;

  @override
  Widget build(BuildContext context) {
    final completed = tasks?.items
        .where((t) => t.isProviderTask && t.status == MobileTaskStatus.completed)
        .length ?? 0;
    final totalTasks = tasks?.items.where((t) => t.isProviderTask).length ?? 0;
    final completionRate = totalTasks > 0 ? (completed / totalTasks * 100).round() : 0;
    final trustScore = snapshot.trustScore;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Analytics', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(
            'Your key performance indicators at a glance.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          LayoutBuilder(
            builder: (context, constraints) {
              final narrow = constraints.maxWidth < 360;
              final tileWidth = narrow ? constraints.maxWidth : (constraints.maxWidth - 10) / 2;
              return Wrap(
                spacing: 10,
                runSpacing: 10,
                children: [
                  SizedBox(
                    width: tileWidth,
                    child: MetricTile(
                      label: 'Completion rate',
                      value: '$completionRate%',
                      caption: '$completed of $totalTasks tasks completed',
                      icon: Icons.trending_up_rounded,
                    ),
                  ),
                  SizedBox(
                    width: tileWidth,
                    child: MetricTile(
                      label: 'Trust score',
                      value: trustScore.toString(),
                      caption: '${snapshot.reviewCount} reviews',
                      icon: Icons.verified_outlined,
                    ),
                  ),
                  SizedBox(
                    width: tileWidth,
                    child: MetricTile(
                      label: 'Services',
                      value: snapshot.serviceCount.toString(),
                      caption: 'Active listings',
                      icon: Icons.design_services_outlined,
                    ),
                  ),
                  SizedBox(
                    width: tileWidth,
                    child: MetricTile(
                      label: 'Products',
                      value: snapshot.productCount.toString(),
                      caption: 'Catalog items',
                      icon: Icons.inventory_2_outlined,
                    ),
                  ),
                ],
              );
            },
          ),
          const SizedBox(height: 12),
          _ControlLinkRow(
            icon: Icons.receipt_long_outlined,
            label: 'View all orders',
            route: AppRoutes.orders,
          ),
        ],
      ),
    );
  }
}

class _ProviderConversionPanel extends StatelessWidget {
  const _ProviderConversionPanel({required this.snapshot});

  final MobileProfileSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionCard(
          variant: ServiqSurfaceVariant.highlight,
          child: EmptyStateView(
            icon: Icons.storefront_outlined,
            title: 'Business Control is for providers',
            message:
                '${snapshot.displayName}, set up a provider profile to manage listings, leads, quotes, and orders from this control room.',
            actionLabel: 'Start Business AI setup',
            onAction: () => context.push(AppRoutes.providerOnboarding),
          ),
        ),
        const SizedBox(height: 14),
        _ControlLinkRow(
          icon: Icons.person_search_outlined,
          label: 'Find nearby providers instead',
          route: AppRoutes.people,
        ),
        _ControlLinkRow(
          icon: Icons.add_circle_outline_rounded,
          label: 'Post a Need',
          route: AppRoutes.createNeed,
        ),
      ],
    );
  }
}

class _ControlChecklistRow extends StatelessWidget {
  const _ControlChecklistRow({
    required this.label,
    required this.done,
    required this.detail,
  });

  final String label;
  final bool done;
  final String detail;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 12),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            done ? Icons.check_circle_rounded : Icons.radio_button_off_rounded,
            color: done ? AppColors.success : AppColors.inkMuted,
            size: 20,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.labelLarge),
                const SizedBox(height: 3),
                Text(
                  detail.isEmpty ? 'Needs attention' : detail,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ControlLinkRow extends StatelessWidget {
  const _ControlLinkRow({
    required this.icon,
    required this.label,
    required this.route,
  });

  final IconData icon;
  final String label;
  final String route;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 8),
      child: Material(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.sm),
        child: InkWell(
          borderRadius: BorderRadius.circular(AppRadii.sm),
          onTap: () => context.push(route),
          child: Padding(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 12),
            child: Row(
              children: [
                Icon(icon, color: AppColors.primary),
                const SizedBox(width: 10),
                Expanded(
                  child: Text(
                    label,
                    style: Theme.of(context).textTheme.labelLarge,
                  ),
                ),
                const Icon(
                  Icons.chevron_right_rounded,
                  color: AppColors.inkMuted,
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ControlLoadingState extends StatelessWidget {
  const _ControlLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        4,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 20, width: 180),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 10),
                LoadingShimmer(height: 14, width: 240),
                SizedBox(height: 16),
                LoadingShimmer(height: 86),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ControlNextAction {
  const _ControlNextAction({
    required this.label,
    required this.route,
    required this.icon,
  });

  final String label;
  final String route;
  final IconData icon;
}

_ControlNextAction _nextBestAction({
  required MobileProfileSnapshot snapshot,
  required int needsAction,
  required int unreadCount,
  required int activeTasks,
}) {
  if (_setupScore(snapshot) < 80) {
    return const _ControlNextAction(
      label: 'Finish Business AI setup',
      route: AppRoutes.providerLaunchpad,
      icon: Icons.auto_awesome_rounded,
    );
  }
  if (snapshot.serviceCount + snapshot.productCount == 0) {
    return const _ControlNextAction(
      label: 'Publish your first listing',
      route: AppRoutes.providerListings,
      icon: Icons.inventory_2_outlined,
    );
  }
  if (unreadCount > 0) {
    return const _ControlNextAction(
      label: 'Reply to new lead messages',
      route: AppRoutes.chat,
      icon: Icons.mark_chat_unread_outlined,
    );
  }
  if (needsAction > 0 || activeTasks > 0) {
    return const _ControlNextAction(
      label: 'Update active work',
      route: AppRoutes.tasks,
      icon: Icons.assignment_turned_in_outlined,
    );
  }
  return const _ControlNextAction(
    label: 'Review profile trust signals',
    route: AppRoutes.profileTrust,
    icon: Icons.verified_user_outlined,
  );
}

int _setupScore(MobileProfileSnapshot snapshot) {
  final checks = [
    snapshot.profile.fullName.isNotEmpty,
    snapshot.profile.headline.isNotEmpty,
    snapshot.profile.location.isNotEmpty,
    snapshot.serviceCount + snapshot.productCount > 0,
    snapshot.portfolioCount + snapshot.reviewCount > 0,
    snapshot.availabilityCount > 0 || snapshot.profile.availability.isNotEmpty,
  ];
  final complete = checks.where((done) => done).length;
  return ((complete / checks.length) * 100).round();
}

String _humanize(String raw) {
  final normalized = raw.trim().toLowerCase();
  if (normalized.isEmpty) {
    return 'Needs attention';
  }
  return normalized
      .split('_')
      .map(
        (segment) => segment.isEmpty
            ? segment
            : '${segment[0].toUpperCase()}${segment.substring(1)}',
      )
      .join(' ');
}
