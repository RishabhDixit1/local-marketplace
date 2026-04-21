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
import 'task_status_timeline.dart';

class TaskDetailScreen extends ConsumerStatefulWidget {
  const TaskDetailScreen({super.key, required this.taskId});

  final String taskId;

  @override
  ConsumerState<TaskDetailScreen> createState() => _TaskDetailScreenState();
}

class _TaskDetailScreenState extends ConsumerState<TaskDetailScreen> {
  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref
          .read(analyticsServiceProvider)
          .trackScreen(
            'task_detail_screen',
            extras: {'task_id': widget.taskId},
          );
    });
  }

  Future<void> _refresh() async {
    ref.invalidate(taskDetailProvider(widget.taskId));
    await ref.read(taskDetailProvider(widget.taskId).future);
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
    final taskAsync = ref.watch(taskDetailProvider(widget.taskId));

    return Scaffold(
      appBar: AppBar(title: const Text('Task detail')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageInset,
              AppSpacing.sm,
              AppSpacing.pageInset,
              AppSpacing.pageInset,
            ),
            children: [
              taskAsync.when(
                data: (task) {
                  if (task == null) {
                    return const AppEmptyState(
                      title: 'Task not found',
                      message:
                          'The task might have been closed or is no longer available on this device.',
                    );
                  }
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      AppCard(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            Wrap(
                              spacing: AppSpacing.xs,
                              runSpacing: AppSpacing.xs,
                              children: [
                                AppPill(
                                  label: task.status.label,
                                  backgroundColor: AppColors.primarySoft,
                                  foregroundColor: AppColors.primaryDeep,
                                ),
                                AppPill(
                                  label: task.role.label,
                                  backgroundColor: AppColors.surfaceAlt,
                                  foregroundColor: AppColors.ink,
                                ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.sm),
                            Text(
                              task.title,
                              style: Theme.of(context).textTheme.headlineSmall,
                            ),
                            const SizedBox(height: AppSpacing.xs),
                            Text(
                              task.summary,
                              style: Theme.of(context).textTheme.bodyMedium,
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Wrap(
                              spacing: AppSpacing.xs,
                              runSpacing: AppSpacing.xs,
                              children: [
                                AppPill(
                                  label: task.locality,
                                  backgroundColor: AppColors.surfaceAlt,
                                  foregroundColor: AppColors.ink,
                                  icon: Icons.location_on_outlined,
                                ),
                                AppPill(
                                  label: task.budgetLabel,
                                  backgroundColor: AppColors.warningSoft,
                                  foregroundColor: AppColors.warning,
                                ),
                                if (task.scheduledFor != null)
                                  AppPill(
                                    label:
                                        'Scheduled ${task.scheduledFor!.day}/${task.scheduledFor!.month}',
                                    backgroundColor: AppColors.accentSoft,
                                    foregroundColor: AppColors.accent,
                                  ),
                              ],
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Container(
                              width: double.infinity,
                              padding: const EdgeInsets.all(AppSpacing.sm),
                              decoration: BoxDecoration(
                                color: AppColors.surfaceAlt,
                                borderRadius: BorderRadius.circular(
                                  AppRadii.sm,
                                ),
                              ),
                              child: Text(
                                task.trustNote,
                                style: Theme.of(context).textTheme.bodySmall,
                              ),
                            ),
                            const SizedBox(height: AppSpacing.md),
                            Row(
                              children: [
                                Expanded(
                                  child: OutlinedButton.icon(
                                    onPressed: () => context.push(
                                      AppRoutes.chatThread(task.linkedThreadId),
                                    ),
                                    icon: const Icon(
                                      Icons.chat_bubble_outline_rounded,
                                    ),
                                    label: const Text('Open chat'),
                                  ),
                                ),
                                const SizedBox(width: AppSpacing.sm),
                                Expanded(
                                  child: FilledButton.icon(
                                    onPressed:
                                        task.status == TaskStatus.completed
                                        ? null
                                        : () async {
                                            await ref
                                                .read(tasksRepositoryProvider)
                                                .updateStatus(
                                                  task,
                                                  _nextStatus(task.status),
                                                );
                                            ref.invalidate(
                                              taskDetailProvider(widget.taskId),
                                            );
                                            ref.invalidate(tasksBoardProvider);
                                          },
                                    icon: const Icon(Icons.update_rounded),
                                    label: const Text('Advance status'),
                                  ),
                                ),
                              ],
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      const AppSectionHeader(
                        title: 'Timeline',
                        subtitle:
                            'Transparent progress keeps both sides aligned and reduces disputes.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      AppCard(
                        child: TaskStatusTimeline(entries: task.timeline),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppSectionHeader(
                        title: 'Offers',
                        subtitle:
                            '${task.offerCount} active responses linked to this task.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (task.offers.isEmpty)
                        const AppEmptyState(
                          title: 'No offers attached',
                          message:
                              'Quotes and provider responses will show here when the task needs selection.',
                        )
                      else
                        ...task.offers.map(
                          (offer) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: AppCard(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    offer.providerName,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.titleMedium,
                                  ),
                                  const SizedBox(height: AppSpacing.xs),
                                  Text(
                                    offer.trustNote,
                                    style: Theme.of(
                                      context,
                                    ).textTheme.bodySmall,
                                  ),
                                  const SizedBox(height: AppSpacing.sm),
                                  Row(
                                    children: [
                                      Expanded(
                                        child: Text(
                                          '${offer.amountLabel} • ${offer.etaLabel}',
                                          style: Theme.of(
                                            context,
                                          ).textTheme.bodyMedium,
                                        ),
                                      ),
                                      FilledButton(
                                        onPressed: () => context.push(
                                          '${AppRoutes.chat}?recipientId=${offer.providerId}',
                                        ),
                                        child: const Text('Message'),
                                      ),
                                    ],
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const CardListSkeleton(count: 3),
                error: (error, _) => AppErrorState(
                  title: 'Task detail failed to load',
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
