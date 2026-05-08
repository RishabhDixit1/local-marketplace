import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/trust_badge.dart';
import '../data/task_repository.dart';
import '../domain/task_snapshot.dart';
import 'task_board_components.dart';

enum _TaskRoleFilter {
  all,
  requester,
  provider;

  String get label {
    switch (this) {
      case _TaskRoleFilter.all:
        return 'All';
      case _TaskRoleFilter.requester:
        return 'Requested';
      case _TaskRoleFilter.provider:
        return 'Helping';
    }
  }
}

enum _TaskBoardLane {
  needsAction,
  active,
  inProgress,
  done;

  String get id => name;

  String get label {
    switch (this) {
      case _TaskBoardLane.needsAction:
        return 'Needs action';
      case _TaskBoardLane.active:
        return 'Active';
      case _TaskBoardLane.inProgress:
        return 'In Progress';
      case _TaskBoardLane.done:
        return 'Done';
    }
  }
}

class TasksPage extends ConsumerStatefulWidget {
  const TasksPage({super.key, this.focusTaskId, this.focusSource});

  final String? focusTaskId;
  final String? focusSource;

  @override
  ConsumerState<TasksPage> createState() => _TasksPageState();
}

class _TasksPageState extends ConsumerState<TasksPage> {
  _TaskBoardLane _selectedLane = _TaskBoardLane.needsAction;
  _TaskRoleFilter _selectedRole = _TaskRoleFilter.all;
  String? _busyTaskId;
  String? _appliedFocusTaskId;

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

  List<MobileTaskItem> _itemsForLane(
    MobileTaskSnapshot snapshot,
    _TaskBoardLane lane,
  ) {
    final items = switch (lane) {
      _TaskBoardLane.needsAction =>
        snapshot.items.where((item) => item.primaryAction != null).toList(),
      _TaskBoardLane.active => snapshot.itemsFor(MobileTaskStatus.active),
      _TaskBoardLane.inProgress => snapshot.itemsFor(
        MobileTaskStatus.inProgress,
      ),
      _TaskBoardLane.done =>
        snapshot.items
            .where(
              (item) =>
                  item.status == MobileTaskStatus.completed ||
                  item.status == MobileTaskStatus.cancelled,
            )
            .toList(),
    };

    return _applyRoleFilter(items);
  }

  int _countFor(MobileTaskSnapshot snapshot, _TaskBoardLane lane) {
    return _itemsForLane(snapshot, lane).length;
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

  MobileTaskItem? _focusedTaskFor(MobileTaskSnapshot? snapshot) {
    final focusTaskId = widget.focusTaskId?.trim() ?? '';
    if (snapshot == null || focusTaskId.isEmpty) {
      return null;
    }

    for (final item in snapshot.items) {
      if (item.id == focusTaskId) {
        return item;
      }
    }

    return null;
  }

  void _applyFocusIfNeeded(MobileTaskSnapshot snapshot) {
    final focusTaskId = widget.focusTaskId?.trim() ?? '';
    if (focusTaskId.isEmpty || _appliedFocusTaskId == focusTaskId) {
      return;
    }

    _appliedFocusTaskId = focusTaskId;

    MobileTaskItem? match;
    for (final item in snapshot.items) {
      if (item.id == focusTaskId) {
        match = item;
        break;
      }
    }
    if (match == null) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _selectedLane = switch (match!.status) {
          MobileTaskStatus.active => _TaskBoardLane.active,
          MobileTaskStatus.inProgress => _TaskBoardLane.inProgress,
          MobileTaskStatus.completed ||
          MobileTaskStatus.cancelled => _TaskBoardLane.done,
        };
        _selectedRole = match.isProviderTask
            ? _TaskRoleFilter.provider
            : _TaskRoleFilter.requester;
      });
    });
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(taskSnapshotProvider);
    final data = snapshot.asData?.value;
    final focusedTask = _focusedTaskFor(data);
    if (data != null) {
      _applyFocusIfNeeded(data);
    }

    return Scaffold(
      appBar: AppBar(title: const Text('Work')),
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
                focusTaskId: widget.focusTaskId,
                focusSource: widget.focusSource,
              ),
              if ((widget.focusTaskId ?? '').trim().isNotEmpty ||
                  widget.focusSource == 'post_success') ...[
                const SizedBox(height: 12),
                _FocusedTaskBanner(
                  task: focusedTask,
                  focusSource: widget.focusSource,
                ),
              ],
              const SizedBox(height: 16),
              if (data != null) ...[
                _TasksFilters(
                  snapshot: data,
                  selectedLane: _selectedLane,
                  selectedRole: _selectedRole,
                  onLaneSelected: (lane) {
                    setState(() {
                      _selectedLane = lane;
                    });
                  },
                  onRoleSelected: (role) {
                    setState(() {
                      _selectedRole = role;
                    });
                  },
                  countFor: (lane) => _countFor(data, lane),
                  roleCountFor: (role) => _roleCount(data, role),
                ),
                const SizedBox(height: 16),
              ],
              ServiqAsyncBody<MobileTaskSnapshot>(
                value: snapshot,
                errorTitle: 'Tasks unavailable',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: _refresh,
                loadingBuilder: () => const _TasksLoadingState(),
                data: (loaded) {
                  final laneItems = _itemsForLane(loaded, _selectedLane);

                  if (loaded.items.isEmpty) {
                    return const SectionCard(
                      child: EmptyStateView(
                        title: 'No tasks yet',
                        message: 'Post or accept work to start tracking.',
                      ),
                    );
                  }

                  if (laneItems.isEmpty) {
                    return SectionCard(
                      child: EmptyStateView(
                        title: _selectedLane == _TaskBoardLane.needsAction
                            ? 'Nothing needs action'
                            : 'Nothing in ${_selectedLane.label.toLowerCase()}',
                        message: _selectedLane == _TaskBoardLane.needsAction
                            ? 'When a task needs acceptance, travel, work, completion, or payment follow-up, it will rise here.'
                            : _selectedRole == _TaskRoleFilter.all
                            ? 'Switch lanes or open Find.'
                            : 'Switch roles or lanes.',
                      ),
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: laneItems
                        .map(
                          (task) => Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: Column(
                              children: [
                                _TaskActionWrapper(
                                  task: task,
                                  busy: _busyTaskId == task.id,
                                  onPrimaryAction: task.primaryAction == null
                                      ? null
                                      : () => _runPrimaryAction(task),
                                  child: TaskCard(
                                    task: task,
                                    busy: _busyTaskId == task.id,
                                    onPrimaryAction: task.primaryAction == null
                                        ? null
                                        : () => _runPrimaryAction(task),
                                    focused: task.id == widget.focusTaskId,
                                  ),
                                ),
                                _TaskSecondaryActions(
                                  task: task,
                                  onOpenDetail: () =>
                                      _showTaskDetailSheet(task),
                                ),
                              ],
                            ),
                          ),
                        )
                        .toList(),
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  void _showTaskDetailSheet(MobileTaskItem task) {
    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              4,
              20,
              20 + MediaQuery.viewInsetsOf(sheetContext).bottom,
            ),
            child: SingleChildScrollView(
              child: _TaskDetailSheet(
                task: task,
                busy: _busyTaskId == task.id,
                onPrimaryAction: task.primaryAction == null
                    ? null
                    : () {
                        Navigator.of(sheetContext).pop();
                        _runPrimaryAction(task);
                      },
              ),
            ),
          ),
        );
      },
    );
  }
}

class _TaskSecondaryActions extends StatelessWidget {
  const _TaskSecondaryActions({required this.task, required this.onOpenDetail});

  final MobileTaskItem task;
  final VoidCallback onOpenDetail;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: 8),
      child: Align(
        alignment: Alignment.centerRight,
        child: TextButton.icon(
          onPressed: onOpenDetail,
          icon: const Icon(Icons.open_in_new_rounded),
          label: const Text('Details'),
        ),
      ),
    );
  }
}

class _TaskDetailSheet extends StatelessWidget {
  const _TaskDetailSheet({
    required this.task,
    required this.busy,
    required this.onPrimaryAction,
  });

  final MobileTaskItem task;
  final bool busy;
  final VoidCallback? onPrimaryAction;

  @override
  Widget build(BuildContext context) {
    final quoteMode = task.source == MobileTaskSource.order
        ? 'order'
        : 'help_request';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Task detail', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(
          'Review the job, timeline, quote room, and next one-tap update.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
        const SizedBox(height: 14),
        TaskCard(
          task: task,
          busy: busy,
          onPrimaryAction: onPrimaryAction,
          focused: true,
        ),
        const SizedBox(height: 12),
        Row(
          children: [
            Expanded(
              child: FilledButton.icon(
                onPressed: () => context.push(
                  AppRoutes.quoteRoom(mode: quoteMode, targetId: task.id),
                ),
                icon: const Icon(Icons.request_quote_outlined),
                label: const Text('Quote room'),
              ),
            ),
            if (task.source == MobileTaskSource.order) ...[
              const SizedBox(width: 10),
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: () => context.push(AppRoutes.orderDetail(task.id)),
                  icon: const Icon(Icons.receipt_long_outlined),
                  label: const Text('Order'),
                ),
              ),
            ],
          ],
        ),
      ],
    );
  }
}

class _TasksHero extends StatelessWidget {
  const _TasksHero({
    required this.snapshot,
    required this.selectedRole,
    required this.roleCount,
    this.focusTaskId,
    this.focusSource,
  });

  final MobileTaskSnapshot? snapshot;
  final _TaskRoleFilter selectedRole;
  final int roleCount;
  final String? focusTaskId;
  final String? focusSource;

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
            'Operations board',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            selectedRole == _TaskRoleFilter.all
                ? 'Track requests, work, and handoffs.'
                : '$roleCount ${selectedRole.label.toLowerCase()} tasks are currently visible in this board.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          if ((focusTaskId ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 14),
            _HeroBadge(
              icon: Icons.push_pin_outlined,
              label: focusSource == 'notification'
                  ? 'Focused from notification'
                  : 'Focused task view',
            ),
          ],
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
                label: '$requesterCount requested',
              ),
              _HeroBadge(
                icon: Icons.storefront_outlined,
                label: '$providerCount helping',
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

class _FocusedTaskBanner extends StatelessWidget {
  const _FocusedTaskBanner({required this.task, this.focusSource});

  final MobileTaskItem? task;
  final String? focusSource;

  @override
  Widget build(BuildContext context) {
    final fromPostSuccess = focusSource == 'post_success';
    final fromNotification = focusSource == 'notification';
    final currentTask = task;
    final title = fromPostSuccess
        ? 'Your request is live. Track it here.'
        : fromNotification
        ? 'Opened from notification'
        : 'Focused task';
    final message = currentTask == null
        ? 'Loading the latest task details, status, and next step for this request.'
        : currentTask.isProviderTask
        ? 'You are the provider on "${currentTask.title}". Keep the requester updated from this task timeline.'
        : 'You requested "${currentTask.title}". Watch provider replies in Chat and accepted work in this timeline.';

    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: AppColors.primarySoft,
              borderRadius: BorderRadius.circular(12),
            ),
            child: Icon(
              fromPostSuccess
                  ? Icons.task_alt_rounded
                  : Icons.push_pin_outlined,
              color: AppColors.primary,
            ),
          ),
          const SizedBox(width: 12),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 5),
                Text(message, style: Theme.of(context).textTheme.bodyMedium),
                if (currentTask != null) ...[
                  const SizedBox(height: 10),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      TrustBadge(
                        label: currentTask.statusLabel,
                        icon: Icons.flag_outlined,
                        backgroundColor: _statusTint(currentTask.status),
                        foregroundColor: _statusInk(currentTask.status),
                      ),
                      TrustBadge(
                        label: currentTask.role.summary,
                        icon: currentTask.isProviderTask
                            ? Icons.handshake_outlined
                            : Icons.person_outline_rounded,
                        backgroundColor: AppColors.surfaceMuted,
                        foregroundColor: AppColors.ink,
                      ),
                      TrustBadge(
                        label: _nextStepShortLabel(currentTask),
                        icon: Icons.arrow_forward_rounded,
                        backgroundColor: AppColors.accentSoft,
                        foregroundColor: AppColors.accent,
                      ),
                    ],
                  ),
                ],
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _TasksFilters extends StatelessWidget {
  const _TasksFilters({
    required this.snapshot,
    required this.selectedLane,
    required this.selectedRole,
    required this.onLaneSelected,
    required this.onRoleSelected,
    required this.countFor,
    required this.roleCountFor,
  });

  final MobileTaskSnapshot snapshot;
  final _TaskBoardLane selectedLane;
  final _TaskRoleFilter selectedRole;
  final ValueChanged<_TaskBoardLane> onLaneSelected;
  final ValueChanged<_TaskRoleFilter> onRoleSelected;
  final int Function(_TaskBoardLane lane) countFor;
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
                        '${countFor(selectedLane)} ${selectedLane.label.toLowerCase()}',
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
        Text('Your role', style: Theme.of(context).textTheme.titleMedium),
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
        Text('Status', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        TaskStatusTabs(
          selectedId: selectedLane.id,
          onSelected: (id) => onLaneSelected(
            _TaskBoardLane.values.firstWhere(
              (lane) => lane.id == id,
              orElse: () => _TaskBoardLane.active,
            ),
          ),
          tabs: _TaskBoardLane.values
              .map(
                (lane) => TaskStatusTabData(
                  id: lane.id,
                  label: lane.label,
                  count: countFor(lane),
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
          borderRadius: BorderRadius.circular(AppRadii.md),
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

String _nextStepShortLabel(MobileTaskItem task) {
  if (task.primaryAction != null) {
    return task.primaryAction!.label;
  }

  return switch (task.status) {
    MobileTaskStatus.active =>
      task.isProviderTask ? 'Confirm handoff' : 'Watch Chat',
    MobileTaskStatus.inProgress => 'Track progress',
    MobileTaskStatus.completed => 'Review history',
    MobileTaskStatus.cancelled => 'No action needed',
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
