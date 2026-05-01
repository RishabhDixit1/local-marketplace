import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../quotes/domain/quote_models.dart';
import '../../tasks/data/task_repository.dart';
import '../../tasks/domain/task_snapshot.dart';

class OrdersPage extends ConsumerWidget {
  const OrdersPage({super.key});

  Future<void> _refresh(WidgetRef ref) async {
    ref.invalidate(taskSnapshotProvider);
    await ref.read(taskSnapshotProvider.future);
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(taskSnapshotProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Orders')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () => _refresh(ref),
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              snapshot.when(
                data: (data) {
                  final orders = data.items
                      .where((item) => item.source == MobileTaskSource.order)
                      .toList();
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _OrdersHero(orders: orders),
                      const SizedBox(height: 16),
                      _OrdersStats(orders: orders),
                      const SizedBox(height: 16),
                      if (orders.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'No orders yet',
                            message:
                                'Product purchases, service bookings, and accepted quotes will collect here.',
                          ),
                        )
                      else
                        ...orders.map(
                          (order) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _OrderTaskCard(order: order),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _OrdersLoading(),
                error: (error, _) => SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load orders',
                    message: AppErrorMapper.toMessage(error),
                    onRetry: () => _refresh(ref),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _OrdersHero extends StatelessWidget {
  const _OrdersHero({required this.orders});

  final List<MobileTaskItem> orders;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Orders and checkout',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            'Track marketplace purchases, payment state, fulfillment notes, and quote-to-order conversion.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class _OrdersStats extends StatelessWidget {
  const _OrdersStats({required this.orders});

  final List<MobileTaskItem> orders;

  @override
  Widget build(BuildContext context) {
    final active = orders
        .where(
          (order) =>
              order.status == MobileTaskStatus.active ||
              order.status == MobileTaskStatus.inProgress,
        )
        .length;
    final done = orders
        .where(
          (order) =>
              order.status == MobileTaskStatus.completed ||
              order.status == MobileTaskStatus.cancelled,
        )
        .length;
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Active',
                value: active.toString(),
                caption: '${orders.length} total',
                icon: Icons.shopping_bag_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'History',
                value: done.toString(),
                caption: 'Completed or closed',
                icon: Icons.receipt_long_outlined,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _OrderTaskCard extends StatelessWidget {
  const _OrderTaskCard({required this.order});

  final MobileTaskItem order;

  @override
  Widget build(BuildContext context) {
    final quoteMode = MobileQuoteTargetMode.order.apiValue;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(order.statusLabel)),
              Chip(label: Text(order.isProviderTask ? 'Selling' : 'Buying')),
              Chip(label: Text(order.budgetLabel)),
            ],
          ),
          const SizedBox(height: 12),
          Text(order.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 6),
          Text(
            order.description,
            maxLines: 3,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: () =>
                      context.push(AppRoutes.orderDetail(order.id)),
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('Details'),
                ),
              ),
              const SizedBox(width: 10),
              IconButton.outlined(
                tooltip: 'Quote',
                onPressed: () => context.push(
                  AppRoutes.quoteRoom(mode: quoteMode, targetId: order.id),
                ),
                icon: const Icon(Icons.request_quote_outlined),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _OrdersLoading extends StatelessWidget {
  const _OrdersLoading();

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
