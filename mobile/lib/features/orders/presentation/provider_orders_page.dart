import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../tasks/data/task_repository.dart';
import '../../tasks/domain/task_snapshot.dart';

class ProviderOrdersPage extends ConsumerWidget {
  const ProviderOrdersPage({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(taskSnapshotProvider);
    await ref.read(taskSnapshotProvider.future);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(taskSnapshotProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Provider Orders')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              ServiqAsyncBody<MobileTaskSnapshot>(
                value: snapshot,
                errorTitle: 'Unable to load orders',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: () => _refresh(ref),
                loadingBuilder: () => const _Loading(),
                data: (data) {
                  final orders = data.items
                      .where(
                        (item) =>
                            item.source == MobileTaskSource.order &&
                            item.isProviderTask,
                      )
                      .toList();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Hero(orders: orders),
                      const SizedBox(height: 16),
                      _Stats(orders: orders),
                      const SizedBox(height: 16),
                      if (orders.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'No provider orders',
                            message:
                                'When customers book your services or buy your products, their orders will appear here.',
                          ),
                        )
                      else
                        ...orders.map(
                          (order) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _OrderCard(order: order),
                          ),
                        ),
                    ],
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

class _Hero extends StatelessWidget {
  const _Hero({required this.orders});
  final List<MobileTaskItem> orders;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Orders you received',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            'Accept new leads, track active work, and manage completed orders.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.orders});
  final List<MobileTaskItem> orders;

  @override
  Widget build(BuildContext context) {
    final newLeads = orders
        .where((o) => o.rawStatus == 'new_lead' || o.rawStatus == 'quoted')
        .length;
    final active = orders
        .where(
          (o) =>
              o.status == MobileTaskStatus.active ||
              o.status == MobileTaskStatus.inProgress,
        )
        .length;
    final done = orders
        .where((o) => o.status == MobileTaskStatus.completed)
        .length;

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final width = (constraints.maxWidth - gap * 2) / 3;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'New leads',
                value: newLeads.toString(),
                caption: 'Awaiting response',
                icon: Icons.notifications_active_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Active',
                value: active.toString(),
                caption: 'In progress',
                icon: Icons.assignment_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Completed',
                value: done.toString(),
                caption: 'Done',
                icon: Icons.check_circle_outline,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _OrderCard extends StatelessWidget {
  const _OrderCard({required this.order});
  final MobileTaskItem order;

  @override
  Widget build(BuildContext context) {
    final primaryAction = order.primaryAction;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(order.statusLabel)),
              Chip(label: Text(order.budgetLabel)),
            ],
          ),
          const SizedBox(height: 12),
          Text(order.title, style: Theme.of(context).textTheme.titleLarge),
          if (order.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              order.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.access_time_rounded, size: 14, color: AppColors.inkSubtle),
              const SizedBox(width: 4),
              Text(
                order.createdLabel,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.inkSubtle,
                ),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () =>
                      context.push(AppRoutes.orderDetail(order.id)),
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('View order'),
                ),
              ),
              if (primaryAction != null) ...[
                const SizedBox(width: 10),
                OutlinedButton(
                  onPressed: () => _performAction(context, primaryAction),
                  child: Text(primaryAction.label),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  Future<void> _performAction(
    BuildContext context,
    MobileTaskPrimaryAction action,
  ) async {}
}

class _Loading extends StatelessWidget {
  const _Loading();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 20, width: 160),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 10),
                LoadingShimmer(height: 80),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
