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

class ProviderLeadsPage extends ConsumerWidget {
  const ProviderLeadsPage({super.key});

  static List<MobileTaskItem> _leads(MobileTaskSnapshot data) =>
      data.items.where(
        (item) =>
            item.source == MobileTaskSource.helpRequest &&
            item.isProviderTask,
      ).toList();

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final snapshot = ref.watch(taskSnapshotProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Provider Leads')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(taskSnapshotProvider);
            await ref.read(taskSnapshotProvider.future);
          },
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              ServiqAsyncBody<MobileTaskSnapshot>(
                value: snapshot,
                errorTitle: 'Unable to load leads',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: () {
                  ref.invalidate(taskSnapshotProvider);
                },
                loadingBuilder: () => const _Loading(),
                data: (data) {
                  final leads = _leads(data);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _Hero(leads: leads),
                      const SizedBox(height: 16),
                      _Stats(leads: leads),
                      const SizedBox(height: 16),
                      if (leads.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'No leads',
                            message:
                                'When customers reach out for your services through help requests, their leads will appear here.',
                          ),
                        )
                      else
                        ...leads.map(
                          (lead) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _LeadCard(lead: lead),
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
  const _Hero({required this.leads});
  final List<MobileTaskItem> leads;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Leads you received',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            'Review help requests, confirm handoffs, and track progress.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
        ],
      ),
    );
  }
}

class _Stats extends StatelessWidget {
  const _Stats({required this.leads});
  final List<MobileTaskItem> leads;

  @override
  Widget build(BuildContext context) {
    final newLeads = leads
        .where(
          (l) => l.progressStage == MobileTaskProgressStage.pendingAcceptance,
        )
        .length;
    final active = leads
        .where(
          (l) =>
              l.progressStage == MobileTaskProgressStage.accepted ||
              l.progressStage == MobileTaskProgressStage.travelStarted ||
              l.progressStage == MobileTaskProgressStage.workStarted,
        )
        .length;
    final done =
        leads.where((l) => l.status == MobileTaskStatus.completed).length;

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
                label: 'New',
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

class _LeadCard extends StatelessWidget {
  const _LeadCard({required this.lead});
  final MobileTaskItem lead;

  @override
  Widget build(BuildContext context) {
    final action = lead.primaryAction;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              Chip(label: Text(lead.statusLabel)),
              if (lead.budgetLabel.isNotEmpty)
                Chip(label: Text(lead.budgetLabel)),
            ],
          ),
          const SizedBox(height: 12),
          Text(lead.title, style: Theme.of(context).textTheme.titleLarge),
          if (lead.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              lead.description,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: 8),
            Row(
            children: [
              Icon(
                _actionIconData(action.kind),
                size: 16,
                color: AppColors.inkSubtle,
              ),
              const SizedBox(width: 4),
              Text(
                action.label,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: AppColors.inkSubtle,
                ),
              ),
              ],
            ),
          ],
          const SizedBox(height: 6),
          Row(
            children: [
              Icon(Icons.access_time_rounded, size: 14, color: AppColors.inkSubtle),
              const SizedBox(width: 4),
              Text(
                lead.createdLabel,
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
                      context.push(AppRoutes.orderDetail(lead.id)),
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('View details'),
                ),
              ),
              if (action != null) ...[
                const SizedBox(width: 10),
                OutlinedButton(
                  onPressed: () {},
                  child: Text(action.label),
                ),
              ],
            ],
          ),
        ],
      ),
    );
  }

  IconData _actionIconData(MobileTaskPrimaryActionKind kind) {
    switch (kind) {
      case MobileTaskPrimaryActionKind.acceptOrder:
        return Icons.task_alt_rounded;
      case MobileTaskPrimaryActionKind.confirmAccepted:
        return Icons.check_circle_outline_rounded;
      case MobileTaskPrimaryActionKind.startTravel:
        return Icons.route_rounded;
      case MobileTaskPrimaryActionKind.startWork:
        return Icons.build_circle_outlined;
      case MobileTaskPrimaryActionKind.completeTask:
        return Icons.verified_rounded;
    }
  }
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
