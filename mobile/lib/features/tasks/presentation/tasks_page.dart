import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/design_system/serviq_recovery_banner.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
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

    if (action.kind == MobileTaskPrimaryActionKind.completeTask) {
      await _completeTaskWithFeedback(task);
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

  Future<void> _completeTaskWithFeedback(MobileTaskItem task) async {
    var isConfirmed = false;
    var notes = '';

    final confirmed = await showModalBottomSheet<bool>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  20,
                  4,
                  20,
                  20 + MediaQuery.viewInsetsOf(context).bottom,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Complete this task?',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 16),
                    SwitchListTile(
                      title: const Text('I confirm this task is complete'),
                      value: isConfirmed,
                      onChanged: (v) => setSheetState(() => isConfirmed = v),
                    ),
                    const SizedBox(height: 8),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Notes (optional)',
                        hintText: 'Add any completion notes...',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 3,
                      onChanged: (v) => notes = v,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: isConfirmed
                            ? () => Navigator.of(sheetContext).pop(true)
                            : null,
                        child: const Text('Mark Complete'),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (confirmed != true || !mounted) return;

    setState(() {
      _busyTaskId = task.id;
    });

    try {
      await ref.read(taskRepositoryProvider).completeTask(
        task.id,
        notes: notes,
      );
      ref.invalidate(taskSnapshotProvider);
      await ref.read(taskSnapshotProvider.future);
      if (!mounted) return;

      HapticFeedback.mediumImpact();
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Task completed.')),
      );

      await _showReviewSheet(task);
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (error) {
      if (!mounted) return;
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

  Future<void> _showReviewSheet(MobileTaskItem task) async {
    var rating = 5;
    var comment = '';

    await showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        return StatefulBuilder(
          builder: (context, setSheetState) {
            return SafeArea(
              child: Padding(
                padding: EdgeInsets.fromLTRB(
                  20,
                  4,
                  20,
                  20 + MediaQuery.viewInsetsOf(context).bottom,
                ),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'How was your experience?',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 16),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: List.generate(5, (index) {
                        final star = index + 1;
                        return IconButton(
                          icon: Icon(
                            star <= rating
                                ? Icons.star_rounded
                                : Icons.star_outline_rounded,
                            color: star <= rating
                                ? AppColors.warning
                                : AppColors.inkMuted,
                            size: 36,
                          ),
                          onPressed: () =>
                              setSheetState(() => rating = star),
                        );
                      }),
                    ),
                    const SizedBox(height: 12),
                    TextField(
                      decoration: const InputDecoration(
                        labelText: 'Review (optional)',
                        hintText: 'Share your experience...',
                        border: OutlineInputBorder(),
                      ),
                      maxLines: 3,
                      onChanged: (v) => comment = v,
                    ),
                    const SizedBox(height: 16),
                    SizedBox(
                      width: double.infinity,
                      child: FilledButton(
                        onPressed: () =>
                            Navigator.of(sheetContext).pop(),
                        child: const Text('Submit'),
                      ),
                    ),
                    const SizedBox(height: 8),
                  ],
                ),
              ),
            );
          },
        );
      },
    );

    if (!mounted) return;

    try {
      await ref.read(taskRepositoryProvider).submitReview(
        taskId: task.id,
        rating: rating,
        comment: comment,
      );
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Review submitted.')),
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.message),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
    } catch (error) {
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(error.toString()),
          backgroundColor: Theme.of(context).colorScheme.error,
        ),
      );
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

  MobileTaskItem? _nextActionTaskFor(MobileTaskSnapshot snapshot) {
    final items = _itemsForLane(snapshot, _TaskBoardLane.needsAction);
    return items.isEmpty ? null : items.first;
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
    final m = match;
    if (m == null) {
      return;
    }

    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      setState(() {
        _selectedLane = switch (m.status) {
          MobileTaskStatus.active => _TaskBoardLane.active,
          MobileTaskStatus.inProgress => _TaskBoardLane.inProgress,
          MobileTaskStatus.completed ||
          MobileTaskStatus.cancelled => _TaskBoardLane.done,
        };
        _selectedRole = m.isProviderTask
            ? _TaskRoleFilter.provider
            : _TaskRoleFilter.requester;
      });
    });
  }

  void _showFiltersSheet(MobileTaskSnapshot snapshot) {
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
            child: StatefulBuilder(
              builder: (context, setSheetState) {
                void updateLane(_TaskBoardLane lane) {
                  setState(() => _selectedLane = lane);
                  setSheetState(() {});
                }

                void updateRole(_TaskRoleFilter role) {
                  setState(() => _selectedRole = role);
                  setSheetState(() {});
                }

                return SingleChildScrollView(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    mainAxisSize: MainAxisSize.min,
                    children: [
                      Text(
                        'Filter Work',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 16),
                      _TasksFilters(
                        snapshot: snapshot,
                        selectedLane: _selectedLane,
                        selectedRole: _selectedRole,
                        onLaneSelected: updateLane,
                        onRoleSelected: updateRole,
                        countFor: (lane) => _countFor(snapshot, lane),
                        roleCountFor: (role) => _roleCount(snapshot, role),
                      ),
                      const SizedBox(height: 12),
                      SizedBox(
                        width: double.infinity,
                        child: FilledButton(
                          onPressed: () => Navigator.of(sheetContext).pop(),
                          child: const Text('Show work'),
                        ),
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(taskSnapshotProvider);
    final data = snapshot.asData?.value;
    final nextActionTask = data == null ? null : _nextActionTaskFor(data);
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
                nextActionTask: nextActionTask,
                onOpenNextAction: nextActionTask == null
                    ? null
                    : () => _showTaskDetailSheet(nextActionTask),
              ),
              if (data?.hasPartialFailure == true) ...[
                const SizedBox(height: 12),
                ServiqRecoveryBanner(
                  message: data!.warnings.join(' '),
                  actionLabel: 'Retry',
                  onAction: () => ref.invalidate(taskSnapshotProvider),
                ),
              ],
              const SizedBox(height: 16),
              if (data != null) ...[
                _WorkBoardSummary(
                  snapshot: data,
                  selectedLane: _selectedLane,
                  selectedRole: _selectedRole,
                  countFor: (lane) => _countFor(data, lane),
                  roleCountFor: (role) => _roleCount(data, role),
                  onShowNextActions: _selectedLane == _TaskBoardLane.needsAction
                      ? null
                      : () => setState(
                          () => _selectedLane = _TaskBoardLane.needsAction,
                        ),
                  onOpenFilters: () => _showFiltersSheet(data),
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
                            child: GestureDetector(
                              onTap: () => _showTaskDetailSheet(task),
                              child: TaskCard(
                                task: task,
                                busy: _busyTaskId == task.id,
                                onPrimaryAction: task.primaryAction == null
                                    ? null
                                    : () => _runPrimaryAction(task),
                                focused: task.id == widget.focusTaskId,
                              ),
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
        LayoutBuilder(
          builder: (context, constraints) {
            final quoteButton = FilledButton.icon(
              onPressed: () => context.push(
                AppRoutes.quoteRoom(mode: quoteMode, targetId: task.id),
              ),
              icon: const Icon(Icons.request_quote_outlined),
              label: const Text('Quote room'),
            );
            final orderButton = task.source == MobileTaskSource.order
                ? OutlinedButton.icon(
                    onPressed: () =>
                        context.push(AppRoutes.orderDetail(task.id)),
                    icon: const Icon(Icons.receipt_long_outlined),
                    label: const Text('Order'),
                  )
                : null;

            if (orderButton == null) {
              return SizedBox(width: double.infinity, child: quoteButton);
            }

            if (constraints.maxWidth < 360) {
              return Column(
                crossAxisAlignment: CrossAxisAlignment.stretch,
                children: [
                  quoteButton,
                  const SizedBox(height: 10),
                  orderButton,
                ],
              );
            }

            return Row(
              children: [
                Expanded(child: quoteButton),
                const SizedBox(width: 10),
                Expanded(child: orderButton),
              ],
            );
          },
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
    required this.nextActionTask,
    required this.onOpenNextAction,
  });

  final MobileTaskSnapshot? snapshot;
  final _TaskRoleFilter selectedRole;
  final int roleCount;
  final MobileTaskItem? nextActionTask;
  final VoidCallback? onOpenNextAction;

  @override
  Widget build(BuildContext context) {
    final activeCount = snapshot?.countFor(MobileTaskStatus.active) ?? 0;
    final inProgressCount =
        snapshot?.countFor(MobileTaskStatus.inProgress) ?? 0;
    final nextTask = nextActionTask;

    return SectionCard(
      padding: const EdgeInsets.all(16),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: AppColors.primarySoft,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: const Icon(
                  Icons.fact_check_outlined,
                  color: AppColors.primary,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Next up',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      nextTask == null
                          ? selectedRole == _TaskRoleFilter.all
                                ? 'No task needs action right now.'
                                : 'No ${selectedRole.label.toLowerCase()} task needs action across $roleCount visible tasks.'
                          : '${nextTask.primaryAction?.label ?? _nextStepShortLabel(nextTask)}: ${nextTask.title}',
                      maxLines: 3,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ],
          ),
          if (nextTask != null && onOpenNextAction != null) ...[
            const SizedBox(height: 14),
            SizedBox(
              width: double.infinity,
              child: FilledButton.icon(
                onPressed: onOpenNextAction,
                icon: const Icon(Icons.arrow_forward_rounded),
                label: const Text('Review next task'),
              ),
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
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, color: AppColors.inkMuted, size: 16),
          const SizedBox(width: 8),
          Text(label, style: Theme.of(context).textTheme.labelLarge),
        ],
      ),
    );
  }
}

class _WorkBoardSummary extends StatelessWidget {
  const _WorkBoardSummary({
    required this.snapshot,
    required this.selectedLane,
    required this.selectedRole,
    required this.countFor,
    required this.roleCountFor,
    required this.onShowNextActions,
    required this.onOpenFilters,
  });

  final MobileTaskSnapshot snapshot;
  final _TaskBoardLane selectedLane;
  final _TaskRoleFilter selectedRole;
  final int Function(_TaskBoardLane lane) countFor;
  final int Function(_TaskRoleFilter role) roleCountFor;
  final VoidCallback? onShowNextActions;
  final VoidCallback onOpenFilters;

  @override
  Widget build(BuildContext context) {
    final visibleCount = countFor(selectedLane);
    final nextActionCount = countFor(_TaskBoardLane.needsAction);
    final title = selectedLane == _TaskBoardLane.needsAction
        ? 'Next-action queue'
        : '${selectedLane.label} work';
    final message = selectedLane == _TaskBoardLane.needsAction
        ? '$visibleCount task${visibleCount == 1 ? '' : 's'} ready for a one-tap update.'
        : '$visibleCount ${selectedLane.label.toLowerCase()} task${visibleCount == 1 ? '' : 's'} in ${selectedRole.label.toLowerCase()} view.';

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(title, style: Theme.of(context).textTheme.titleLarge),
                    const SizedBox(height: 5),
                    Text(message, style: Theme.of(context).textTheme.bodySmall),
                  ],
                ),
              ),
              OutlinedButton.icon(
                onPressed: onOpenFilters,
                style: OutlinedButton.styleFrom(
                  minimumSize: const Size(0, 44),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
                icon: const Icon(Icons.tune_rounded),
                label: const Text('Filters'),
              ),
            ],
          ),
          if (onShowNextActions != null) ...[
            const SizedBox(height: 12),
            SizedBox(
              width: double.infinity,
              child: TextButton.icon(
                onPressed: onShowNextActions,
                icon: const Icon(Icons.flash_on_rounded),
                label: const Text('Back to next actions'),
              ),
            ),
          ],
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(
                label: '${snapshot.items.length} total',
                icon: Icons.dashboard_outlined,
                backgroundColor: AppColors.surfaceMuted,
                foregroundColor: AppColors.ink,
              ),
              TrustBadge(
                label: '$nextActionCount next',
                icon: Icons.flash_on_rounded,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primary,
              ),
              TrustBadge(
                label:
                    '${roleCountFor(selectedRole)} ${selectedRole.label.toLowerCase()}',
                icon: selectedRole == _TaskRoleFilter.provider
                    ? Icons.handshake_outlined
                    : Icons.person_outline_rounded,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _TasksFilters extends StatefulWidget {
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
  State<_TasksFilters> createState() => _TasksFiltersState();
}

class _TasksFiltersState extends State<_TasksFilters> {
  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('Role filter', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        Wrap(
          spacing: 10,
          runSpacing: 10,
          children: _TaskRoleFilter.values
              .map(
                (role) => ChoiceChip(
                  label: Text('${role.label} (${widget.roleCountFor(role)})'),
                  selected: role == widget.selectedRole,
                  onSelected: (_) => widget.onRoleSelected(role),
                ),
              )
              .toList(),
        ),
        const SizedBox(height: 18),
        Text('Status lane', style: Theme.of(context).textTheme.titleMedium),
        const SizedBox(height: 10),
        TaskStatusTabs(
          selectedId: widget.selectedLane.id,
          onSelected: (id) => widget.onLaneSelected(
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
                  count: widget.countFor(lane),
                ),
              )
              .toList(),
        ),
      ],
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
    return task.primaryAction?.label ?? 'Next step';
  }

  return switch (task.status) {
    MobileTaskStatus.active =>
      task.isProviderTask ? 'Confirm handoff' : 'Watch Chat',
    MobileTaskStatus.inProgress => 'Track progress',
    MobileTaskStatus.completed => 'Review history',
    MobileTaskStatus.cancelled => 'No action needed',
  };
}


