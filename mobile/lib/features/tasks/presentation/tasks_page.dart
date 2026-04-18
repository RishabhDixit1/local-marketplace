import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../data/task_repository.dart';
import '../domain/task_snapshot.dart';

class TasksPage extends ConsumerStatefulWidget {
  const TasksPage({super.key});

  @override
  ConsumerState<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends ConsumerState<TasksPage> {
  MobileTaskStatus _selectedStatus = MobileTaskStatus.active;
  String? _busyTaskId;
  RealtimeChannel? _tasksChannel;

  AppBootstrap? _readBootstrap() {
    try {
      return ref.read(appBootstrapProvider);
    } catch (_) {
      return null;
    }
  }
  RealtimeChannel? _ordersChannel;
  RealtimeChannel? _helpRequestsChannel;
  RealtimeChannel? _taskEventsChannel;

  @override
  void initState() {
    super.initState();
    _subscribeToRealtime();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bindRealtimeChannels();
    });
  }

  @override
  void dispose() {
    final client = _readBootstrap()?.client;
    final channel = _tasksChannel;
    if (client != null && channel != null) {
      client.removeChannel(channel);
    }
    super.dispose();
  }

  void _subscribeToRealtime() {
    final client = _readBootstrap()?.client;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      return;
    }

    void invalidateTasks() {
      ref.invalidate(taskSnapshotProvider);
    }

    _tasksChannel = client
        .channel('mobile-tasks-$userId')
    _disposeRealtimeChannels();
    super.dispose();
  }

  void _bindRealtimeChannels() {
    _disposeRealtimeChannels();

    final userId = Supabase.instance.client.auth.currentUser?.id ?? '';
    if (userId.isEmpty) {
      return;
    }

    final client = Supabase.instance.client;
    void refresh() {
      ref.invalidate(taskSnapshotProvider);
    }

    _ordersChannel = client
        .channel('mobile-tasks-orders-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'orders',
          callback: (_) => invalidateTasks(),
        )
          callback: (_) => refresh(),
        )
        .subscribe();

    _helpRequestsChannel = client
        .channel('mobile-tasks-help-requests-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'help_requests',
          callback: (_) => invalidateTasks(),
        )
          callback: (_) => refresh(),
        )
        .subscribe();

    _taskEventsChannel = client
        .channel('mobile-tasks-events-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'task_events',
          callback: (_) => invalidateTasks(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'notification_escalations',
          callback: (_) => invalidateTasks(),
        )
        .subscribe();
  }
          callback: (_) => refresh(),
        )
        .subscribe();
  }

  void _disposeRealtimeChannels() {
    final client = Supabase.instance.client;
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

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(taskSnapshotProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tasks')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              const _TasksHero(),
              const SizedBox(height: 16),
              snapshot.when(
                data: (data) {
                  final items = data.itemsFor(_selectedStatus);

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _TaskFilterBar(
                        selectedStatus: _selectedStatus,
                        snapshot: data,
                        onSelected: (status) {
                          setState(() {
                            _selectedStatus = status;
                          });
                        },
                      ),
                      const SizedBox(height: 16),
                      if (data.items.isEmpty)
                        const SectionCard(child: _TasksEmptyState())
                      else if (items.isEmpty)
                        SectionCard(
                          child: _FilteredEmptyState(status: _selectedStatus),
                        )
                      else
                        ...items.map(
                          (task) => Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: _TaskCard(
                              task: task,
                              busy: _busyTaskId == task.id,
                              onPrimaryAction: task.primaryAction == null
                                  ? null
                                  : () => _runPrimaryAction(task),
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _TasksLoadingState(),
                error: (error, stackTrace) =>
                    SectionCard(child: _TasksErrorState(error: error)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _TasksHero extends StatelessWidget {
  const _TasksHero();

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32),
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
            'Provider execution loop, now backed by live data.',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            'This task board combines current orders with request activity from the existing ServiQ backend so the phone workflow stays aligned with the web app.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          const SizedBox(height: 18),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: const [
              _HeroBadge(icon: Icons.flash_on_rounded, label: 'Open leads'),
              _HeroBadge(icon: Icons.route_rounded, label: 'Travel updates'),
              _HeroBadge(
                icon: Icons.verified_rounded,
                label: 'Completion history',
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

class _TaskFilterBar extends StatelessWidget {
  const _TaskFilterBar({
    required this.selectedStatus,
    required this.snapshot,
    required this.onSelected,
  });

  final MobileTaskStatus selectedStatus;
  final MobileTaskSnapshot snapshot;
  final ValueChanged<MobileTaskStatus> onSelected;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Task lanes', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: MobileTaskStatus.values
              .map(
                (status) => ChoiceChip(
                  label: Text('${status.label} (${snapshot.countFor(status)})'),
                  selected: status == selectedStatus,
                  onSelected: (_) => onSelected(status),
                ),
              )
              .toList(),
        ),
      ],
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
                  color: const Color(0xFFF8FAFC),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(color: const Color(0xFFE2E8F0)),
                ),
                child: Text(
                  task.role.summary,
                  style: Theme.of(context).textTheme.labelLarge,
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
                  Text(
                    'Live tracker',
                    style: Theme.of(context).textTheme.titleMedium,
                  ),
                  const SizedBox(height: 12),
                  ...task.trackerSteps.map(
                    (step) => Padding(
                      padding: const EdgeInsets.only(bottom: 10),
                      child: _TrackerStep(step: step),
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
  const _TrackerStep({required this.step});

  final MobileTaskTrackerStep step;

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

    return Row(
      children: [
        Container(
          width: 28,
          height: 28,
          decoration: BoxDecoration(color: fill, shape: BoxShape.circle),
          child: Icon(
            isDone ? Icons.check_rounded : Icons.circle,
            color: foreground,
            size: isDone ? 16 : 10,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Text(
            step.label,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontWeight: isActive ? FontWeight.w800 : FontWeight.w600,
              color: isActive ? const Color(0xFF0B1F33) : null,
            ),
          ),
        ),
      ],
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
        (index) => const Padding(
          padding: EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: SizedBox(
              height: 220,
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
        ),
      ),
    );
  }
}

class _TasksEmptyState extends StatelessWidget {
  const _TasksEmptyState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'No live tasks yet',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 10),
        Text(
          'As orders and accepted requests start moving through ServiQ, they will land here with mobile-first status tracking.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

class _FilteredEmptyState extends StatelessWidget {
  const _FilteredEmptyState({required this.status});

  final MobileTaskStatus status;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Nothing in ${status.label.toLowerCase()}',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 10),
        Text(
          'Switch task lanes to check the rest of your work queue.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

class _TasksErrorState extends StatelessWidget {
  const _TasksErrorState({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    final message = switch (error) {
      ApiException apiError => apiError.message,
      _ => error.toString(),
    };

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'The mobile task board could not load yet',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 10),
        Text(message, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 10),
        Text(
          'Check the device session, API_BASE_URL, and your Supabase connection, then pull to refresh.',
          style: Theme.of(context).textTheme.bodySmall,
        ),
      ],
    );
  }
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
