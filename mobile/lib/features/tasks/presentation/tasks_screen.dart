import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../../../shared/widgets/section_header.dart';
import '../data/tasks_repository.dart';
import 'task_cards.dart';

class TasksScreen extends ConsumerStatefulWidget {
  const TasksScreen({super.key});

  @override
  ConsumerState<TasksScreen> createState() => _TasksScreenState();
}

class _TasksScreenState extends ConsumerState<TasksScreen> {
  TaskStatus? _selectedStatus;
  TaskRoleView? _selectedRole;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).trackScreen('tasks_screen');
    });
  }

  Future<void> _refresh() async {
    ref.invalidate(tasksBoardProvider);
    await ref.read(tasksBoardProvider.future);
  }

  List<TaskItem> _filterTasks(List<TaskItem> items) {
    return items.where((task) {
      if (_selectedStatus != null && task.status != _selectedStatus) {
        return false;
      }
      if (_selectedRole != null && task.role != _selectedRole) {
        return false;
      }
      return true;
    }).toList();
  }

  TaskStatus _nextStatus(TaskStatus status) => switch (status) {
    TaskStatus.open => TaskStatus.quoted,
    TaskStatus.quoted => TaskStatus.scheduled,
    TaskStatus.scheduled => TaskStatus.inProgress,
    TaskStatus.inProgress => TaskStatus.completed,
    TaskStatus.completed => TaskStatus.completed,
    TaskStatus.cancelled => TaskStatus.cancelled,
  };

  @override
  Widget build(BuildContext context) {
    final boardAsync = ref.watch(tasksBoardProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Tasks')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageInset,
              AppSpacing.sm,
              AppSpacing.pageInset,
              120,
            ),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Run local work from one board',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Track quotes, schedules, execution, and completion without losing context.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: TaskRoleView.values
                          .map(
                            (role) => AppFilterChip(
                              label: role.label,
                              selected: _selectedRole == role,
                              onSelected: (_) => setState(
                                () => _selectedRole = _selectedRole == role
                                    ? null
                                    : role,
                              ),
                            ),
                          )
                          .toList(),
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    SingleChildScrollView(
                      scrollDirection: Axis.horizontal,
                      child: Row(
                        children: TaskStatus.values
                            .map(
                              (status) => Padding(
                                padding: const EdgeInsets.only(
                                  right: AppSpacing.sm,
                                ),
                                child: AppFilterChip(
                                  label: status.label,
                                  selected: _selectedStatus == status,
                                  onSelected: (_) => setState(
                                    () => _selectedStatus =
                                        _selectedStatus == status
                                        ? null
                                        : status,
                                  ),
                                ),
                              ),
                            )
                            .toList(),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              boardAsync.when(
                data: (board) {
                  final filtered = _filterTasks(board.items);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppSectionHeader(
                        title: 'Live board',
                        subtitle:
                            '${filtered.length} tasks match your current lane filters.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (filtered.isEmpty)
                        const AppEmptyState(
                          title: 'No tasks in this lane',
                          message:
                              'Switch role or status filters to reveal the rest of your work.',
                        )
                      else
                        ...filtered.map(
                          (task) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: TaskBoardCard(
                              task: task,
                              onOpen: () =>
                                  context.push(AppRoutes.taskDetail(task.id)),
                              onAdvanceStatus:
                                  task.status == TaskStatus.completed ||
                                      task.status == TaskStatus.cancelled
                                  ? null
                                  : () async {
                                      await ref
                                          .read(tasksRepositoryProvider)
                                          .updateStatus(
                                            task,
                                            _nextStatus(task.status),
                                          );
                                      ref.invalidate(tasksBoardProvider);
                                    },
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const CardListSkeleton(count: 4),
                error: (error, _) => AppErrorState(
                  title: 'Tasks could not load',
                  message: AppErrorMapper.toMessage(error),
                  onRetry: _refresh,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
