import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../data/admin_repository.dart';

class AdminPage extends ConsumerStatefulWidget {
  const AdminPage({super.key});

  @override
  ConsumerState<AdminPage> createState() => _AdminPageState();
}

class _AdminPageState extends ConsumerState<AdminPage>
    with SingleTickerProviderStateMixin {
  late TabController _tabController;

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: 3, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: const Text('Admin'),
        bottom: TabBar(
          controller: _tabController,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Users'),
            Tab(text: 'Reports'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _OverviewTab(),
          _UsersTab(),
          _ReportsTab(),
        ],
      ),
    );
  }
}

class _OverviewTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(adminStatsProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(AppErrorMapper.toMessage(e)),
            const SizedBox(height: 12),
            FilledButton.tonal(
              onPressed: () => ref.invalidate(adminStatsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (stats) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(adminStatsProvider);
          await ref.read(adminStatsProvider.future);
        },
        child: ListView(
          padding: const EdgeInsets.all(16),
          children: [
            _StatCard(
              icon: Icons.people_rounded,
              label: 'Total users',
              value: '${stats.totalUsers}',
              color: AppColors.primary,
            ),
            const SizedBox(height: 8),
            _StatCard(
              icon: Icons.handyman_rounded,
              label: 'Providers',
              value: '${stats.totalProviders}',
              color: AppColors.verified,
            ),
            const SizedBox(height: 8),
            _StatCard(
              icon: Icons.person_search_rounded,
              label: 'Seekers',
              value: '${stats.totalSeekers}',
              color: AppColors.accent,
            ),
            const SizedBox(height: 8),
            _StatCard(
              icon: Icons.shopping_bag_rounded,
              label: 'Orders',
              value: '${stats.totalOrders}',
              subValue: '${stats.completedOrders} completed',
              color: AppColors.ink,
            ),
            const SizedBox(height: 8),
            _StatCard(
              icon: Icons.star_rounded,
              label: 'Avg rating',
              value: stats.averageRating.toStringAsFixed(1),
              color: AppColors.accent,
            ),
            const SizedBox(height: 8),
            _StatCard(
              icon: Icons.shield_rounded,
              label: 'Avg trust score',
              value: stats.averageTrustScore.toStringAsFixed(1),
              color: AppColors.verified,
            ),
          ],
        ),
      ),
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({
    required this.icon,
    required this.label,
    required this.value,
    this.subValue,
    required this.color,
  });

  final IconData icon;
  final String label;
  final String value;
  final String? subValue;
  final Color color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            padding: const EdgeInsets.all(10),
            decoration: BoxDecoration(
              color: color.withValues(alpha: 0.12),
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(icon, color: color, size: 22),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(label, style: Theme.of(context).textTheme.bodySmall),
                const SizedBox(height: 2),
                Text(
                  value,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.bold,
                  ),
                ),
                if (subValue != null)
                  Text(
                    subValue!,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
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

class _UsersTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(adminUsersProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(AppErrorMapper.toMessage(e)),
            const SizedBox(height: 12),
            FilledButton.tonal(
              onPressed: () => ref.invalidate(adminUsersProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (users) => RefreshIndicator(
        onRefresh: () async {
          ref.invalidate(adminUsersProvider);
          await ref.read(adminUsersProvider.future);
        },
        child: ListView.builder(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
          itemCount: users.length,
          itemBuilder: (context, index) {
            final user = users[index];
            return Container(
              padding: const EdgeInsets.all(12),
              margin: const EdgeInsets.only(bottom: 6),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(color: AppColors.border),
              ),
              child: Row(
                children: [
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          user.name ?? '—',
                          style: const TextStyle(fontWeight: FontWeight.w600),
                        ),
                        if (user.email != null)
                          Text(user.email!,
                              style: TextStyle(
                                  fontSize: 12, color: AppColors.inkSubtle)),
                        Row(
                          children: [
                            if (user.role != null)
                              _Label(text: user.role!),
                            const SizedBox(width: 6),
                            _Label(text: 'Trust: ${user.trustScore.toStringAsFixed(1)}'),
                            if (user.abuseReports > 0) ...[
                              const SizedBox(width: 6),
                              _Label(
                                text: '${user.abuseReports} reports',
                                color: AppColors.dangerSoft,
                              ),
                            ],
                          ],
                        ),
                      ],
                    ),
                  ),
                  if (user.abuseReports > 0)
                    Icon(Icons.warning_amber_rounded,
                        size: 18, color: AppColors.danger),
                ],
              ),
            );
          },
        ),
      ),
    );
  }
}

class _Label extends StatelessWidget {
  const _Label({required this.text, this.color});
  final String text;
  final Color? color;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: color ?? AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(text,
          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w500)),
    );
  }
}

class _ReportsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(adminReportsProvider);

    return async.when(
      loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(AppErrorMapper.toMessage(e)),
            const SizedBox(height: 12),
            FilledButton.tonal(
              onPressed: () => ref.invalidate(adminReportsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (reports) {
        if (reports.isEmpty) {
          return const Center(
            child: Text('No reports.',
                style: TextStyle(color: AppColors.inkSubtle)),
          );
        }
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(adminReportsProvider);
            await ref.read(adminReportsProvider.future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            itemCount: reports.length,
            itemBuilder: (context, index) {
              final report = reports[index];
              return Container(
                padding: const EdgeInsets.all(12),
                margin: const EdgeInsets.only(bottom: 6),
                decoration: BoxDecoration(
                  color: AppColors.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: AppColors.border),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(report.reason ?? '—',
                        style: const TextStyle(fontWeight: FontWeight.w600)),
                    const SizedBox(height: 4),
                    Text(
                      '${report.cardType ?? '—'} · ${report.feedbackType ?? '—'}',
                      style: TextStyle(
                          fontSize: 12, color: AppColors.inkSubtle),
                    ),
                    if (report.createdAt != null)
                      Text(
                        '${report.createdAt!.day}/${report.createdAt!.month}/${report.createdAt!.year}',
                        style: TextStyle(
                            fontSize: 11, color: AppColors.inkFaint),
                      ),
                  ],
                ),
              );
            },
          ),
        );
      },
    );
  }
}
