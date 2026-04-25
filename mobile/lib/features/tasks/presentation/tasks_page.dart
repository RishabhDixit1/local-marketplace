import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/trust_badge.dart';
import '../data/task_repository.dart';
import '../domain/task_snapshot.dart';

enum _TaskRoleFilter {
  all,
  requester,
  provider;

  String get label {
    switch (this) {
      case _TaskRoleFilter.all:
        return 'All';
      case _TaskRoleFilter.requester:
        return 'Requester';
      case _TaskRoleFilter.provider:
        return 'Provider';
    }
  }
}

class TasksPage extends ConsumerStatefulWidget {
  const TasksPage({super.key});

  @override
  ConsumerState<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends ConsumerState<TasksPage> {
  MobileTaskStatus _selectedStatus = MobileTaskStatus.active;
  _TaskRoleFilter _selectedRole = _TaskRoleFilter.all;
  String? _busyTaskId;
  RealtimeChannel? _ordersChannel;
  RealtimeChannel? _helpRequestsChannel;
  RealtimeChannel? _taskEventsChannel;
  SupabaseClient? _client;

  @override
  void initState() {
    super.initState();
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    _bindRealtimeChannels();
  }

  @override
  void dispose() {
    _disposeRealtimeChannels();
    super.dispose();
  }

  void _bindRealtimeChannels() {
    _disposeRealtimeChannels();

    final client = _client;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      return;
    }

    void refresh() {
      ref.invalidate(taskSnapshotProvider);
    }

    _ordersChannel = client
        .channel('mobile-tasks-orders-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'orders',
          callback: (_) => refresh(),
        )
        .subscribe();

    _helpRequestsChannel = client
        .channel('mobile-tasks-help-requests-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'help_requests',
          callback: (_) => refresh(),
        )
        .subscribe();

    _taskEventsChannel = client
        .channel('mobile-tasks-events-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'task_events',
          callback: (_) => refresh(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'notification_escalations',
          callback: (_) => refresh(),
        )
        .subscribe();
  }

  void _disposeRealtimeChannels() {
    final client = _client;
    if (client == null) {
      return;
    }
    if (_ordersChannel != null) {
      client.removeChannel(_ordersChannel!);
      _ordersChannel = null;
    }
    if (_helpRequestsChannel != null) {
      client.removeChannel(_helpRequestsChannel!);
      _helpRequestsChannel = null;
    }
    if (_taskEventsChannel != null) {
      client.removeChannel(_taskEventsChannel!);
      _taskEventsChannel = null;
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(taskSnapshotProvider);
    await ref.read(taskSnapshotProvider.future);
  }

  Future<void> _runPrimaryAction(MobileTaskItem task) async {
    final action = task.primaryAction;
    if (action == null) {
      return;
    }

    setState(() {
      _busyTaskId = task.id;
    });

    try {
      await ref.read(taskRepositoryProvider).performPrimaryAction(task);
      ref.invalidate(taskSnapshotProvider);
      await ref.read(taskSnapshotProvider.future);
      if (!mounted) {
        return;
      }

      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(action.successMessage)));
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (error) {
      if (!mounted) {
        return;
      }

      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } finally {
      if (mounted) {
        setState(() {
          _busyTaskId = null;
        });
      }
    }
  }

  List<MobileTaskItem> _applyRoleFilter(List<MobileTaskItem> items) {
    switch (_selectedRole) {
      case _TaskRoleFilter.all:
        return items;
      case _TaskRoleFilter.requester:
        return items
            .where((item) => item.role == MobileTaskRole.posted)
            .toList();
      case _TaskRoleFilter.provider:
        return items
            .where((item) => item.role == MobileTaskRole.accepted)
            .toList();
    }
  }

  int _countFor(MobileTaskSnapshot snapshot, MobileTaskStatus status) {
    return _applyRoleFilter(snapshot.itemsFor(status)).length;
  }

  int _roleCount(MobileTaskSnapshot snapshot, _TaskRoleFilter filter) {
    switch (filter) {
      case _TaskRoleFilter.all:
        return snapshot.items.length;
      case _TaskRoleFilter.requester:
        return snapshot.items
            .where((item) => item.role == MobileTaskRole.posted)
            .length;
      case _TaskRoleFilter.provider:
        return snapshot.items
            .where((item) => item.role == MobileTaskRole.accepted)
            .length;
    }
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(taskSnapshotProvider);
    final data = snapshot.asData?.value;

    return Scaffold(
      appBar: AppBar(title: const Text('Tasks')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              _TasksHero(
                snapshot: data,
                selectedRole: _selectedRole,
                roleCount: data == null ? 0 : _roleCount(data, _selectedRole),
              ),
              const SizedBox(height: 16),
              if (data != null) ...[
                _TasksFilters(
                  snapshot: data,
                  selectedStatus: _selectedStatus,
                  selectedRole: _selectedRole,
                  onStatusSelected: (status) {
                    setState(() {
                      _selectedStatus = status;
                    });
                  },
                  onRoleSelected: (role) {
                    setState(() {
                      _selectedRole = role;
                    });
                  },
                  countFor: (status) => _countFor(data, status),
                  roleCountFor: (role) => _roleCount(data, role),
                ),
                const SizedBox(height: 16),
              ],
              snapshot.when(
                data: (loaded) {
                  final laneItems = _applyRoleFilter(
                    loaded.itemsFor(_selectedStatus),
                  );

                  if (loaded.items.isEmpty) {
                    return const SectionCard(
                      child: EmptyStateView(
                        title: 'No live tasks yet',
                        message:
                            'Accepted jobs, nearby requests, and active delivery updates will land here once the local marketplace starts moving.',
                      ),
                    );
                  }

                  if (laneItems.isEmpty) {
                    return SectionCard(
                      child: EmptyStateView(
                        title:
                            'Nothing in ${_selectedStatus.label.toLowerCase()}',
                        message: _selectedRole == _TaskRoleFilter.all
                            ? 'Switch lanes to check the rest of your queue.'
                            : 'Try another lane or switch roles to see the rest of your work.',
                      ),
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: laneItems
                        .map(
                          (task) => Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: _TaskActionWrapper(
                              task: task,
                              busy: _busyTaskId == task.id,
                              onPrimaryAction: task.primaryAction == null
                                  ? null
                                  : () => _runPrimaryAction(task),
                              child: _TaskCard(
                                task: task,
                                busy: _busyTaskId == task.id,
                                onPrimaryAction: task.primaryAction == null
                                    ? null
                                    : () => _runPrimaryAction(task),
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  );
                },
                loading: () => const _TasksLoadingState(),
                error: (error, stackTrace) => SectionCard(
                  child: _TasksErrorState(error: error, onRetry: _refresh),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TasksHero extends StatelessWidget {
  const _TasksHero({
    required this.snapshot,
    required this.selectedRole,
    required this.roleCount,
  });

  final MobileTaskSnapshot? snapshot;
  final _TaskRoleFilter selectedRole;
  final int roleCount;

  @override
  Widget build(BuildContext context) {
    final activeCount = snapshot?.countFor(MobileTaskStatus.active) ?? 0;
    final inProgressCount =
        snapshot?.countFor(MobileTaskStatus.inProgress) ?? 0;
    final requesterCount = snapshot == null
        ? 0
        : snapshot!.items
              .where((item) => item.role == MobileTaskRole.posted)
              .length;
    final providerCount = snapshot == null
        ? 0
        : snapshot!.items
              .where((item) => item.role == MobileTaskRole.accepted)
              .length;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B1F33), Color(0xFF1D4ED8), Color(0xFF0EA5A4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Everything moving nearby, in one board.',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            selectedRole == _TaskRoleFilter.all
                ? 'Track active requests, accepted jobs, and completion progress without losing the local context.'
                : '$roleCount ${selectedRole.label.toLowerCase()} tasks are currently visible in this board.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _HeroBadge(
                icon: Icons.flash_on_rounded,
                label: '$activeCount active',
              ),
              _HeroBadge(
                icon: Icons.route_rounded,
                label: '$inProgressCount in progress',
              ),
              _HeroBadge(
                icon: Icons.person_outline_rounded,
                label: '$requesterCount requester',
              ),
              _HeroBadge(
                icon: Icons.storefront_outlined,
                label: '$providerCount provider',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _HeroBadge extends StatelessWidget {
  const _HeroBadge({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.12),
        borderRadius: BorderRadius.circular(999),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: Colors.white, size: 16),
          const SizedBox(width: 8),
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _TasksFilters extends StatelessWidget {
  const _TasksFilters({
    required this.snapshot,
    required this.selectedStatus,
    required this.selectedRole,
    required this.onStatusSelected,
    required this.onRoleSelected,
    required this.countFor,
    required this.roleCountFor,
  });

  final MobileTaskSnapshot snapshot;
  final MobileTaskStatus selectedStatus;
  final _TaskRoleFilter selectedRole;
  final ValueChanged<MobileTaskStatus> onStatusSelected;
  final ValueChanged<_TaskRoleFilter> onRoleSelected;
  final int Function(MobileTaskStatus status) countFor;
  final int Function(_TaskRoleFilter role) roleCountFor;

  @override
  Widget build(BuildContext context) {
    final total = snapshot.items.length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        LayoutBuilder(
          builder: (context, constraints) {
            const gap = 10.0;
            final tileWidth = (constraints.maxWidth - gap) / 2;
            return Wrap(
              spacing: gap,
              runSpacing: gap,
              children: [
                SizedBox(
                  width: tileWidth,
                  child: MetricTile(
                    label: 'Board',
                    value: '$total live tasks',
                    caption: 'Realtime orders and local requests',
                    icon: Icons.dashboard_outlined,
                  ),
                ),
                SizedBox(
                  width: tileWidth,
                  child: MetricTile(
                    label: 'Current lane',
                    value:
                        '${countFor(selectedStatus)} ${selectedStatus.label.toLowerCase()}',
                    caption:
                        '${roleCountFor(selectedRole)} in ${selectedRole.label.toLowerCase()} view',
                    icon: Icons.tune_rounded,
                  ),
                ),
              ],
            );
          },
        ),
        const SizedBox(height: 18),
        Text('Role', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _TaskRoleFilter.values
              .map(
                (role) => ChoiceChip(
                  label: Text('${role.label} (${roleCountFor(role)})'),
                  selected: role == selectedRole,
                  onSelected: (_) => onRoleSelected(role),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 18),
        Text('Task lanes', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: MobileTaskStatus.values
              .map(
                (status) => ChoiceChip(
                  label: Text('${status.label} (${countFor(status)})'),
                  selected: status == selectedStatus,
                  onSelected: (_) => onStatusSelected(status),
                ),
              )
              .toList(),
        ),
      ],
    );
  }
}

class _TaskActionWrapper extends StatelessWidget {
  const _TaskActionWrapper({
    required this.task,
    required this.busy,
    required this.onPrimaryAction,
    required this.child,
  });

  final MobileTaskItem task;
  final bool busy;
  final VoidCallback? onPrimaryAction;
  final Widget child;

  @override
  Widget build(BuildContext context) {
    final action = task.primaryAction;
    if (action == null) {
      return child;
    }

    return Dismissible(
      key: ValueKey('task-${task.id}'),
      direction: busy ? DismissDirection.none : DismissDirection.startToEnd,
      dismissThresholds: const {DismissDirection.startToEnd: 0.25},
      confirmDismiss: (_) async {
        onPrimaryAction?.call();
        return false;
      },
      background: Container(
        padding: const EdgeInsets.symmetric(horizontal: 18),
        decoration: BoxDecoration(
          color: AppColors.primary,
          borderRadius: BorderRadius.circular(12),
        ),
        alignment: Alignment.centerLeft,
        child: Row(
          children: [
            const Icon(Icons.swipe_right_alt_rounded, color: Colors.white),
            const SizedBox(width: 10),
            Text(
              action.label,
              style: Theme.of(
                context,
              ).textTheme.titleMedium?.copyWith(color: Colors.white),
            ),
          ],
        ),
      ),
      child: child,
    );
  }
}

class _TaskCard extends StatelessWidget {
  const _TaskCard({
    required this.task,
    required this.busy,
    required this.onPrimaryAction,
  });

  final MobileTaskItem task;
  final bool busy;
  final VoidCallback? onPrimaryAction;

  @override
  Widget build(BuildContext context) {
    final action = task.primaryAction;
    final showTracker =
        task.isProviderTask || task.status != MobileTaskStatus.active;
    final timelineLabel = _timelineSummary(task);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        _TaskPill(
                          label: task.source.label,
                          background: const Color(0xFFE0F2FE),
                          foreground: const Color(0xFF0B1F33),
                        ),
                        _TaskPill(
                          label: task.listingTypeLabel,
                          background: const Color(0xFFF1F5F9),
                          foreground: const Color(0xFF334155),
                        ),
                        _TaskPill(
                          label: task.statusLabel,
                          background: _statusTint(task.status),
                          foreground: _statusInk(task.status),
                        ),
                      ],
                    ),
                    const SizedBox(height: 14),
                    Text(
                      task.title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      task.description,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 12),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 12,
                  vertical: 10,
                ),
                decoration: BoxDecoration(
                  color: task.isProviderTask
                      ? AppColors.primarySoft
                      : AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: AppColors.border),
                ),
                child: Text(
                  task.role.summary,
                  style: Theme.of(
                    context,
                  ).textTheme.labelLarge?.copyWith(color: AppColors.ink),
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _MetaPill(icon: Icons.payments_outlined, label: task.budgetLabel),
              _MetaPill(
                icon: Icons.location_on_outlined,
                label: task.locationLabel,
              ),
              _MetaPill(icon: Icons.schedule_rounded, label: task.createdLabel),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(14),
            decoration: BoxDecoration(
              color: task.isProviderTask
                  ? AppColors.primarySoft
                  : AppColors.accentSoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  task.isProviderTask ? 'Provider view' : 'Requester view',
                  style: Theme.of(
                    context,
                  ).textTheme.titleSmall?.copyWith(color: AppColors.ink),
                ),
                const SizedBox(height: 6),
                Text(
                  timelineLabel,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                if (action != null) ...[
                  const SizedBox(height: 10),
                  TrustBadge(
                    label: 'Swipe right to ${action.label.toLowerCase()}',
                    icon: Icons.swipe_right_alt_rounded,
                    backgroundColor: Colors.white,
                    foregroundColor: AppColors.primary,
                  ),
                ],
              ],
            ),
          ),
          if (showTracker) ...[
            const SizedBox(height: 18),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(16),
              decoration: BoxDecoration(
                color: const Color(0xFFF8FAFC),
                borderRadius: BorderRadius.circular(22),
                border: Border.all(color: const Color(0xFFE2E8F0)),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          'Progress timeline',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      if (task.isProviderTask)
                        TrustBadge(
                          label: 'Live updates',
                          icon: Icons.bolt_rounded,
                          backgroundColor: Colors.white,
                          foregroundColor: AppColors.primary,
                        ),
                    ],
                  ),
                  const SizedBox(height: 14),
                  ...task.trackerSteps.asMap().entries.map(
                    (entry) => _TrackerStep(
                      step: entry.value,
                      showConnector: entry.key != task.trackerSteps.length - 1,
                    ),
                  ),
                ],
              ),
            ),
          ],
          if (action != null) ...[
            const SizedBox(height: 18),
            FilledButton.icon(
              onPressed: busy ? null : onPrimaryAction,
              icon: busy
                  ? const SizedBox(
                      width: 16,
                      height: 16,
                      child: CircularProgressIndicator(strokeWidth: 2),
                    )
                  : _actionIcon(action.kind),
              label: Text(busy ? 'Updating...' : action.label),
            ),
          ],
        ],
      ),
    );
  }
}

class _TrackerStep extends StatelessWidget {
  const _TrackerStep({required this.step, required this.showConnector});

  final MobileTaskTrackerStep step;
  final bool showConnector;

  @override
  Widget build(BuildContext context) {
    final isDone = step.state == MobileTaskTrackerStepState.done;
    final isActive = step.state == MobileTaskTrackerStepState.active;
    final fill = isDone
        ? const Color(0xFF0EA5A4)
        : isActive
        ? const Color(0xFF1D4ED8)
        : const Color(0xFFE2E8F0);
    final foreground = isDone || isActive
        ? Colors.white
        : const Color(0xFF64748B);

    return Padding(
      padding: EdgeInsets.only(bottom: showConnector ? 2 : 0),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 28,
                  height: 28,
                  decoration: BoxDecoration(
                    color: fill,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isDone ? Icons.check_rounded : Icons.circle,
                    color: foreground,
                    size: isDone ? 16 : 10,
                  ),
                ),
                if (showConnector)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: const Color(0xFFE2E8F0),
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 4, bottom: 12),
                child: Text(
                  step.label,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
                    color: isActive ? const Color(0xFF0B1F33) : null,
                  ),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _TaskPill extends StatelessWidget {
  const _TaskPill({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.labelLarge?.copyWith(color: foreground),
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [Icon(icon, size: 16), const SizedBox(width: 7), Text(label)],
      ),
    );
  }
}

class _TasksLoadingState extends StatelessWidget {
  const _TasksLoadingState();

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
                LoadingShimmer(height: 18, width: 160),
                SizedBox(height: 12),
                LoadingShimmer(height: 14),
                SizedBox(height: 10),
                LoadingShimmer(height: 14, width: 240),
                SizedBox(height: 16),
                LoadingShimmer(height: 88),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _TasksErrorState extends StatelessWidget {
  const _TasksErrorState({required this.error, required this.onRetry});

  final Object error;
  final Future<void> Function() onRetry;

  @override
  Widget build(BuildContext context) {
    final message = switch (error) {
      ApiException apiError => apiError.message,
      _ => error.toString(),
    };

    return ErrorStateView(
      title: 'Unable to load the task board',
      message: message,
      onRetry: onRetry,
    );
  }
}

String _timelineSummary(MobileTaskItem task) {
  if (task.isProviderTask) {
    return switch (task.progressStage) {
      MobileTaskProgressStage.pendingAcceptance =>
        'You still need to confirm this task so the requester sees movement.',
      MobileTaskProgressStage.accepted =>
        'Acceptance is recorded. Start travel when you are on the way.',
      MobileTaskProgressStage.travelStarted =>
        'The requester can see you are on the way. Start work when you arrive.',
      MobileTaskProgressStage.workStarted =>
        'Work is in progress. Mark completion once the job is wrapped.',
      MobileTaskProgressStage.completed =>
        'This job is complete and ready for trust-building follow-through.',
    };
  }

  return switch (task.status) {
    MobileTaskStatus.active =>
      'Your request is still live nearby. Providers can accept or reply from discovery.',
    MobileTaskStatus.inProgress =>
      'A provider has taken action and the local timeline is moving.',
    MobileTaskStatus.completed =>
      'This request is done and now contributes to your local history.',
    MobileTaskStatus.cancelled =>
      'This request was cancelled. Nearby activity has been stopped for now.',
  };
}

Color _statusTint(MobileTaskStatus status) {
  switch (status) {
    case MobileTaskStatus.active:
      return const Color(0xFFE0F2FE);
    case MobileTaskStatus.inProgress:
      return const Color(0xFFEDE9FE);
    case MobileTaskStatus.completed:
      return const Color(0xFFD1FAE5);
    case MobileTaskStatus.cancelled:
      return const Color(0xFFFFE4E6);
  }
}

Color _statusInk(MobileTaskStatus status) {
  switch (status) {
    case MobileTaskStatus.active:
      return const Color(0xFF0B1F33);
    case MobileTaskStatus.inProgress:
      return const Color(0xFF5B21B6);
    case MobileTaskStatus.completed:
      return const Color(0xFF047857);
    case MobileTaskStatus.cancelled:
      return const Color(0xFFBE123C);
  }
}

Widget _actionIcon(MobileTaskPrimaryActionKind kind) {
  switch (kind) {
    case MobileTaskPrimaryActionKind.acceptOrder:
      return const Icon(Icons.task_alt_rounded);
    case MobileTaskPrimaryActionKind.confirmAccepted:
      return const Icon(Icons.check_circle_outline_rounded);
    case MobileTaskPrimaryActionKind.startTravel:
      return const Icon(Icons.route_rounded);
    case MobileTaskPrimaryActionKind.startWork:
      return const Icon(Icons.build_circle_outlined);
    case MobileTaskPrimaryActionKind.completeTask:
      return const Icon(Icons.verified_rounded);
  }
}
