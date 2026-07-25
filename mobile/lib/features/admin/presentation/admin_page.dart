import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/design_system/serviq_chrome.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../data/admin_repository.dart';
import '../domain/admin_models.dart';

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
    _tabController = TabController(length: 7, vsync: this);
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
          isScrollable: true,
          tabs: const [
            Tab(text: 'Overview'),
            Tab(text: 'Users'),
            Tab(text: 'Reports'),
            Tab(text: 'Listings'),
            Tab(text: 'Orders'),
            Tab(text: 'Disputes'),
            Tab(text: 'Verifications'),
          ],
        ),
      ),
      body: TabBarView(
        controller: _tabController,
        children: [
          _OverviewTab(),
          _UsersTab(),
          _ReportsTab(),
          _ListingsTab(),
          _OrdersTab(),
          _DisputesTab(),
          _VerificationsTab(),
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
      loading: () => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
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
              color: Theme.of(context).colorScheme.onSurface,
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
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(10),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
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
                      color: Theme.of(context).colorScheme.onSurface
                          .withValues(alpha: 0.6),
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
      loading: () => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
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
                color: Theme.of(context).colorScheme.surface,
                borderRadius: BorderRadius.circular(8),
                border: Border.all(
                  color: Theme.of(context).colorScheme.outline,
                ),
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
                          Text(
                            user.email!,
                            style: TextStyle(
                              fontSize: 12,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.6),
                            ),
                          ),
                        Row(
                          children: [
                            if (user.role != null) _Label(text: user.role!),
                            const SizedBox(width: 6),
                            _Label(
                              text: 'Trust: ${user.trustScore.toStringAsFixed(1)}',
                            ),
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
                    Icon(
                      Icons.warning_amber_rounded,
                      size: 18,
                      color: AppColors.danger,
                    ),
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
        color: color ?? Theme.of(context).colorScheme.surfaceContainerHighest,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w500),
      ),
    );
  }
}

class _ReportsTab extends ConsumerStatefulWidget {
  @override
  ConsumerState<_ReportsTab> createState() => _ReportsTabState();
}

class _ReportsTabState extends ConsumerState<_ReportsTab> {
  String? _busyReportId;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(adminReportsProvider);

    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
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
          return Center(
            child: Text(
              'No reports.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface
                    .withValues(alpha: 0.6),
              ),
            ),
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
                  color: Theme.of(context).colorScheme.surface,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(
                    color: Theme.of(context).colorScheme.outline,
                  ),
                ),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      report.reason ?? '—',
                      style: const TextStyle(fontWeight: FontWeight.w600),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      '${report.cardType ?? '—'} · ${report.feedbackType ?? '—'}',
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(context).colorScheme.onSurface
                            .withValues(alpha: 0.6),
                      ),
                    ),
                    if (report.createdAt != null)
                      Text(
                        '${report.createdAt!.day}/${report.createdAt!.month}/${report.createdAt!.year}',
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context).colorScheme.onSurface
                              .withValues(alpha: 0.45),
                        ),
                      ),
                    const SizedBox(height: 8),
                    Row(
                      children: [
                        FilledButton.tonal(
                          onPressed: _busyReportId == report.id
                              ? null
                              : () async {
                                  setState(() => _busyReportId = report.id);
                                  try {
                                    await ref
                                        .read(adminRepositoryProvider)
                                        .dismissReport(report.id);
                                    ref.invalidate(adminReportsProvider);
                                    if (context.mounted) {
                                      ServiqToast.show(
                                        context,
                                        message: 'Report dismissed',
                                        tone: ServiqToastTone.success,
                                      );
                                    }
                                  } catch (e) {
                                    if (context.mounted) {
                                      ServiqToast.show(
                                        context,
                                        message: AppErrorMapper.toMessage(e),
                                        tone: ServiqToastTone.danger,
                                      );
                                    }
                                  } finally {
                                    if (mounted) setState(() => _busyReportId = null);
                                  }
                                },
                          child: _busyReportId == report.id
                              ? const SizedBox(
                                  width: 16,
                                  height: 16,
                                  child: CircularProgressIndicator(strokeWidth: 2),
                                )
                              : const Text('Dismiss'),
                        ),
                      ],
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

class _ListingsTab extends ConsumerStatefulWidget {
  @override
  ConsumerState<_ListingsTab> createState() => _ListingsTabState();
}

class _ListingsTabState extends ConsumerState<_ListingsTab> {
  String _filter = 'all';

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(adminListingsProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: Row(
            children: [
              _FilterChip(
                label: 'All',
                selected: _filter == 'all',
                onTap: () => setState(() => _filter = 'all'),
              ),
              const SizedBox(width: 6),
              _FilterChip(
                label: 'Flagged',
                selected: _filter == 'flagged',
                onTap: () => setState(() => _filter = 'flagged'),
              ),
              const SizedBox(width: 6),
              _FilterChip(
                label: 'Removed',
                selected: _filter == 'removed',
                onTap: () => setState(() => _filter = 'removed'),
              ),
            ],
          ),
        ),
        Expanded(
          child: async.when(
            loading: () => const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            error: (e, _) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.error_outline,
                    size: 40,
                    color: AppColors.danger,
                  ),
                  const SizedBox(height: 12),
                  Text(AppErrorMapper.toMessage(e)),
                  const SizedBox(height: 12),
                  FilledButton.tonal(
                    onPressed: () => ref.invalidate(adminListingsProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
            data: (listings) {
              final filtered = _filter == 'all'
                  ? listings
                  : listings.where((l) {
                      if (_filter == 'flagged') return l.isFlagged;
                      if (_filter == 'removed') return l.isRemoved;
                      return true;
                    }).toList();
              if (filtered.isEmpty) {
                return Center(
                  child: Text(
                    'No listings.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface
                          .withValues(alpha: 0.6),
                    ),
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(adminListingsProvider);
                  await ref.read(adminListingsProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final listing = filtered[index];
                    return _ListingCard(
                      listing: listing,
                      onFlag: () async {
                        await ref
                            .read(adminRepositoryProvider)
                            .flagListing(listing.id);
                        ref.invalidate(adminListingsProvider);
                      },
                      onUnflag: () async {
                        await ref
                            .read(adminRepositoryProvider)
                            .unflagListing(listing.id);
                        ref.invalidate(adminListingsProvider);
                      },
                      onRemove: () async {
                        await ref
                            .read(adminRepositoryProvider)
                            .removeListing(listing.id);
                        ref.invalidate(adminListingsProvider);
                      },
                      onRestore: () async {
                        await ref
                            .read(adminRepositoryProvider)
                            .restoreListing(listing.id);
                        ref.invalidate(adminListingsProvider);
                      },
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _ListingCard extends StatelessWidget {
  const _ListingCard({
    required this.listing,
    required this.onFlag,
    required this.onUnflag,
    required this.onRemove,
    required this.onRestore,
  });

  final AdminListing listing;
  final VoidCallback onFlag;
  final VoidCallback onUnflag;
  final VoidCallback onRemove;
  final VoidCallback onRestore;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
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
                      listing.title,
                      style: const TextStyle(fontWeight: FontWeight.w600),
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        _Label(text: listing.type),
                        const SizedBox(width: 6),
                        if (listing.ownerName != null)
                          _Label(text: listing.ownerName!),
                        const SizedBox(width: 6),
                        _ListingStatusChip(status: listing.status),
                      ],
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (listing.createdAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${listing.createdAt!.day}/${listing.createdAt!.month}/${listing.createdAt!.year}',
                style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).colorScheme.onSurface
                      .withValues(alpha: 0.45),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              if (!listing.isFlagged)
                FilledButton.tonal(
                  onPressed: onFlag,
                  child: const Text('Flag'),
                ),
              if (listing.isFlagged)
                FilledButton.tonal(
                  onPressed: onUnflag,
                  child: const Text('Unflag'),
                ),
              if (!listing.isRemoved)
                FilledButton.tonal(
                  onPressed: onRemove,
                  style: FilledButton.styleFrom(
                    backgroundColor: AppColors.dangerSoft,
                    foregroundColor: AppColors.danger,
                  ),
                  child: const Text('Remove'),
                ),
              if (listing.isRemoved)
                FilledButton.tonal(
                  onPressed: onRestore,
                  child: const Text('Restore'),
                ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ListingStatusChip extends StatelessWidget {
  const _ListingStatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'active':
        bg = AppColors.successSoft;
        fg = AppColors.success;
      case 'flagged':
        bg = AppColors.warningSoft;
        fg = AppColors.warning;
      case 'removed':
        bg = AppColors.dangerSoft;
        fg = AppColors.danger;
      default:
        bg = Theme.of(context).colorScheme.surfaceContainerHighest;
        fg = Theme.of(context).colorScheme.onSurface;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status[0].toUpperCase() + status.substring(1),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

class _OrdersTab extends ConsumerStatefulWidget {
  @override
  ConsumerState<_OrdersTab> createState() => _OrdersTabState();
}

class _OrdersTabState extends ConsumerState<_OrdersTab> {
  String? _statusFilter;

  @override
  Widget build(BuildContext context) {
    final async = ref.watch(adminOrdersProvider);

    return Column(
      children: [
        Padding(
          padding: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          child: SingleChildScrollView(
            scrollDirection: Axis.horizontal,
            child: Row(
              children: [
                _FilterChip(
                  label: 'All',
                  selected: _statusFilter == null,
                  onTap: () => setState(() => _statusFilter = null),
                ),
                const SizedBox(width: 6),
                for (final s in [
                  'new_lead',
                  'quoted',
                  'accepted',
                  'in_progress',
                  'completed',
                  'cancelled',
                ]) ...[
                  _FilterChip(
                    label: s.replaceAll('_', ' '),
                    selected: _statusFilter == s,
                    onTap: () => setState(() => _statusFilter = s),
                  ),
                  const SizedBox(width: 6),
                ],
              ],
            ),
          ),
        ),
        Expanded(
          child: async.when(
            loading: () => const Center(
              child: CircularProgressIndicator(strokeWidth: 2),
            ),
            error: (e, _) => Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.error_outline,
                    size: 40,
                    color: AppColors.danger,
                  ),
                  const SizedBox(height: 12),
                  Text(AppErrorMapper.toMessage(e)),
                  const SizedBox(height: 12),
                  FilledButton.tonal(
                    onPressed: () => ref.invalidate(adminOrdersProvider),
                    child: const Text('Retry'),
                  ),
                ],
              ),
            ),
            data: (orders) {
              final filtered = _statusFilter == null
                  ? orders
                  : orders
                        .where((o) => o.status == _statusFilter)
                        .toList();
              if (filtered.isEmpty) {
                return Center(
                  child: Text(
                    'No orders.',
                    style: TextStyle(
                      color: Theme.of(context).colorScheme.onSurface
                          .withValues(alpha: 0.6),
                    ),
                  ),
                );
              }
              return RefreshIndicator(
                onRefresh: () async {
                  ref.invalidate(adminOrdersProvider);
                  await ref.read(adminOrdersProvider.future);
                },
                child: ListView.builder(
                  padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
                  itemCount: filtered.length,
                  itemBuilder: (context, index) {
                    final order = filtered[index];
                    return _OrderCard(
                      order: order,
                      onRefund: () async {
                        await ref
                            .read(adminRepositoryProvider)
                            .refundOrder(order.id);
                        ref.invalidate(adminOrdersProvider);
                        if (context.mounted) {
                          ServiqToast.show(
                            context,
                            message: 'Refund initiated',
                            tone: ServiqToastTone.success,
                          );
                        }
                      },
                      onComplete: () async {
                        await ref
                            .read(adminRepositoryProvider)
                            .overrideOrderStatus(order.id, 'completed');
                        ref.invalidate(adminOrdersProvider);
                      },
                      onCancel: () async {
                        await ref
                            .read(adminRepositoryProvider)
                            .overrideOrderStatus(order.id, 'cancelled');
                        ref.invalidate(adminOrdersProvider);
                      },
                    );
                  },
                ),
              );
            },
          ),
        ),
      ],
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({
    required this.order,
    required this.onRefund,
    required this.onComplete,
    required this.onCancel,
  });

  final AdminOrder order;
  final VoidCallback onRefund;
  final VoidCallback onComplete;
  final VoidCallback onCancel;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
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
                      order.id.length > 8
                          ? '...${order.id.substring(order.id.length - 8)}'
                          : order.id,
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: FontWeight.w600,
                        fontFamily: 'monospace',
                        color: Theme.of(context).colorScheme.onSurface
                            .withValues(alpha: 0.7),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        _OrderStatusChip(status: order.status),
                        if (order.deliveryStatus != null) ...[
                          const SizedBox(width: 6),
                          _Label(text: order.deliveryStatus!),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  Text(
                    'INR ${order.price.round()}',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      fontWeight: FontWeight.bold,
                    ),
                  ),
                  if (order.paymentStatus != null)
                    Text(
                      order.paymentStatus!,
                      style: TextStyle(
                        fontSize: 11,
                        color: Theme.of(context).colorScheme.onSurface
                            .withValues(alpha: 0.5),
                      ),
                    ),
                ],
              ),
            ],
          ),
          if (order.createdAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${order.createdAt!.day}/${order.createdAt!.month}/${order.createdAt!.year}',
                style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).colorScheme.onSurface
                      .withValues(alpha: 0.45),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Wrap(
            spacing: 6,
            runSpacing: 6,
            children: [
              FilledButton.tonal(
                onPressed: onRefund,
                child: const Text('Refund'),
              ),
              FilledButton.tonal(
                onPressed: onComplete,
                child: const Text('Complete'),
              ),
              FilledButton.tonal(
                onPressed: onCancel,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.dangerSoft,
                  foregroundColor: AppColors.danger,
                ),
                child: const Text('Cancel'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrderStatusChip extends StatelessWidget {
  const _OrderStatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'new_lead':
        bg = AppColors.accentSoft;
        fg = AppColors.accent;
      case 'quoted':
        bg = AppColors.warningSoft;
        fg = AppColors.warning;
      case 'accepted':
      case 'in_progress':
        bg = AppColors.primarySoft;
        fg = AppColors.primary;
      case 'completed':
        bg = AppColors.successSoft;
        fg = AppColors.success;
      case 'cancelled':
        bg = AppColors.dangerSoft;
        fg = AppColors.danger;
      default:
        bg = Theme.of(context).colorScheme.surfaceContainerHighest;
        fg = Theme.of(context).colorScheme.onSurface;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

class _DisputesTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(adminDisputesProvider);

    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(AppErrorMapper.toMessage(e)),
            const SizedBox(height: 12),
            FilledButton.tonal(
              onPressed: () => ref.invalidate(adminDisputesProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (disputes) {
        if (disputes.isEmpty) {
          return Center(
            child: Text(
              'No disputes.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface
                    .withValues(alpha: 0.6),
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(adminDisputesProvider);
            await ref.read(adminDisputesProvider.future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            itemCount: disputes.length,
            itemBuilder: (context, index) {
              final dispute = disputes[index];
              return _DisputeCard(
                dispute: dispute,
                onDismiss: () async {
                  await ref
                      .read(adminRepositoryProvider)
                      .dismissDispute(dispute.id);
                  ref.invalidate(adminDisputesProvider);
                  if (context.mounted) {
                    ServiqToast.show(
                      context,
                      message: 'Dispute dismissed',
                      tone: ServiqToastTone.success,
                    );
                  }
                },
                onResolveForConsumer: () async {
                  await ref
                      .read(adminRepositoryProvider)
                      .resolveDispute(dispute.id, 'resolved_for_consumer');
                  ref.invalidate(adminDisputesProvider);
                  if (context.mounted) {
                    ServiqToast.show(
                      context,
                      message: 'Resolved for consumer (refund triggered)',
                      tone: ServiqToastTone.success,
                    );
                  }
                },
                onResolveForProvider: () async {
                  await ref
                      .read(adminRepositoryProvider)
                      .resolveDispute(dispute.id, 'resolved_for_provider');
                  ref.invalidate(adminDisputesProvider);
                  if (context.mounted) {
                    ServiqToast.show(
                      context,
                      message: 'Resolved for provider',
                      tone: ServiqToastTone.success,
                    );
                  }
                },
              );
            },
          ),
        );
      },
    );
  }
}

class _DisputeCard extends StatelessWidget {
  const _DisputeCard({
    required this.dispute,
    required this.onDismiss,
    required this.onResolveForConsumer,
    required this.onResolveForProvider,
  });

  final AdminDispute dispute;
  final VoidCallback onDismiss;
  final VoidCallback onResolveForConsumer;
  final VoidCallback onResolveForProvider;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  dispute.reason ?? 'No reason',
                  style: const TextStyle(fontWeight: FontWeight.w600),
                ),
              ),
              _DisputeStatusChip(status: dispute.status),
            ],
          ),
          if (dispute.description != null &&
              dispute.description!.isNotEmpty) ...[
            const SizedBox(height: 4),
            Text(
              dispute.description!,
              style: TextStyle(
                fontSize: 12,
                color: Theme.of(context).colorScheme.onSurface
                    .withValues(alpha: 0.6),
              ),
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
            ),
          ],
          const SizedBox(height: 4),
          Row(
            children: [
              if (dispute.orderId != null)
                _Label(text: 'Order: ${dispute.orderId!.length > 8 ? dispute.orderId!.substring(dispute.orderId!.length - 8) : dispute.orderId}'),
              const SizedBox(width: 6),
              Text(
                'INR ${dispute.orderValue.round()}',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: Theme.of(context).colorScheme.onSurface
                      .withValues(alpha: 0.7),
                ),
              ),
            ],
          ),
          if (dispute.createdAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${dispute.createdAt!.day}/${dispute.createdAt!.month}/${dispute.createdAt!.year}',
                style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).colorScheme.onSurface
                      .withValues(alpha: 0.45),
                ),
              ),
            ),
          if (dispute.status == 'open') ...[
            const SizedBox(height: 8),
            Wrap(
              spacing: 6,
              runSpacing: 6,
              children: [
                FilledButton.tonal(
                  onPressed: onDismiss,
                  child: const Text('Dismiss'),
                ),
                FilledButton.tonal(
                  onPressed: onResolveForConsumer,
                  child: const Text('For consumer'),
                ),
                FilledButton.tonal(
                  onPressed: onResolveForProvider,
                  child: const Text('For provider'),
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _DisputeStatusChip extends StatelessWidget {
  const _DisputeStatusChip({required this.status});
  final String status;

  @override
  Widget build(BuildContext context) {
    Color bg;
    Color fg;
    switch (status) {
      case 'open':
        bg = AppColors.warningSoft;
        fg = AppColors.warning;
      case 'resolved_for_consumer':
        bg = AppColors.accentSoft;
        fg = AppColors.accent;
      case 'resolved_for_provider':
        bg = AppColors.successSoft;
        fg = AppColors.success;
      default:
        bg = Theme.of(context).colorScheme.surfaceContainerHighest;
        fg = Theme.of(context).colorScheme.onSurface;
    }

    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
      decoration: BoxDecoration(
        color: bg,
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        status.replaceAll('_', ' '),
        style: TextStyle(
          fontSize: 10,
          fontWeight: FontWeight.w600,
          color: fg,
        ),
      ),
    );
  }
}

class _VerificationsTab extends ConsumerWidget {
  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(adminVerificationsProvider);

    return async.when(
      loading: () => const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
      error: (e, _) => Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(Icons.error_outline, size: 40, color: AppColors.danger),
            const SizedBox(height: 12),
            Text(AppErrorMapper.toMessage(e)),
            const SizedBox(height: 12),
            FilledButton.tonal(
              onPressed: () => ref.invalidate(adminVerificationsProvider),
              child: const Text('Retry'),
            ),
          ],
        ),
      ),
      data: (verifications) {
        if (verifications.isEmpty) {
          return Center(
            child: Text(
              'No pending verifications.',
              style: TextStyle(
                color: Theme.of(context).colorScheme.onSurface
                    .withValues(alpha: 0.6),
              ),
            ),
          );
        }
        return RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(adminVerificationsProvider);
            await ref.read(adminVerificationsProvider.future);
          },
          child: ListView.builder(
            padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
            itemCount: verifications.length,
            itemBuilder: (context, index) {
              final v = verifications[index];
              return _VerificationCard(
                verification: v,
                onApprove: () async {
                  await ref
                      .read(adminRepositoryProvider)
                      .approveVerification(v.id);
                  ref.invalidate(adminVerificationsProvider);
                  if (context.mounted) {
                    ServiqToast.show(
                      context,
                      message: 'Verification approved',
                      tone: ServiqToastTone.success,
                    );
                  }
                },
                onReject: () async {
                  await ref
                      .read(adminRepositoryProvider)
                      .rejectVerification(v.id);
                  ref.invalidate(adminVerificationsProvider);
                  if (context.mounted) {
                    ServiqToast.show(
                      context,
                      message: 'Verification rejected',
                      tone: ServiqToastTone.warning,
                    );
                  }
                },
              );
            },
          ),
        );
      },
    );
  }
}

class _VerificationCard extends StatelessWidget {
  const _VerificationCard({
    required this.verification,
    required this.onApprove,
    required this.onReject,
  });

  final AdminVerification verification;
  final VoidCallback onApprove;
  final VoidCallback onReject;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(12),
      margin: const EdgeInsets.only(bottom: 6),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        borderRadius: BorderRadius.circular(8),
        border: Border.all(color: Theme.of(context).colorScheme.outline),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            verification.applicantName ?? 'Unknown',
            style: const TextStyle(fontWeight: FontWeight.w600),
          ),
          const SizedBox(height: 4),
          Row(
            children: [
              if (verification.documentType != null)
                _Label(text: verification.documentType!),
              const SizedBox(width: 6),
              if (verification.email != null) _Label(text: verification.email!),
            ],
          ),
          if (verification.createdAt != null)
            Padding(
              padding: const EdgeInsets.only(top: 4),
              child: Text(
                '${verification.createdAt!.day}/${verification.createdAt!.month}/${verification.createdAt!.year}',
                style: TextStyle(
                  fontSize: 11,
                  color: Theme.of(context).colorScheme.onSurface
                      .withValues(alpha: 0.45),
                ),
              ),
            ),
          const SizedBox(height: 8),
          Row(
            children: [
              FilledButton.tonal(
                onPressed: onApprove,
                child: const Text('Approve'),
              ),
              const SizedBox(width: 6),
              FilledButton.tonal(
                onPressed: onReject,
                style: FilledButton.styleFrom(
                  backgroundColor: AppColors.dangerSoft,
                  foregroundColor: AppColors.danger,
                ),
                child: const Text('Reject'),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FilterChip extends StatelessWidget {
  const _FilterChip({
    required this.label,
    required this.selected,
    required this.onTap,
  });

  final String label;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
        decoration: BoxDecoration(
          color: selected
              ? AppColors.primary
              : Theme.of(context).colorScheme.surfaceContainerHighest,
          borderRadius: BorderRadius.circular(16),
        ),
        child: Text(
          label,
          style: TextStyle(
            fontSize: 12,
            fontWeight: FontWeight.w600,
            color: selected
                ? Colors.white
                : Theme.of(context).colorScheme.onSurface,
          ),
        ),
      ),
    );
  }
}
