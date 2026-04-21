import 'package:flutter/material.dart';

import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/app_formatters.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';

class TaskBoardCard extends StatelessWidget {
  const TaskBoardCard({
    super.key,
    required this.task,
    required this.onOpen,
    required this.onAdvanceStatus,
  });

  final TaskItem task;
  final VoidCallback onOpen;
  final VoidCallback? onAdvanceStatus;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      onTap: onOpen,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              AppPill(
                label: task.status.label,
                backgroundColor: _statusBackground(task.status),
                foregroundColor: _statusForeground(task.status),
              ),
              AppPill(
                label: task.role.label,
                backgroundColor: AppColors.surfaceAlt,
                foregroundColor: AppColors.ink,
              ),
              if (task.priority == TaskPriority.urgent)
                const AppPill(
                  label: 'Urgent',
                  backgroundColor: AppColors.urgentSoft,
                  foregroundColor: AppColors.urgent,
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(task.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(task.summary, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _MetaPill(
                icon: Icons.place_outlined,
                label:
                    '${task.locality} • ${task.distanceKm.toStringAsFixed(1)} km',
              ),
              _MetaPill(
                icon: Icons.currency_rupee_rounded,
                label: task.budgetLabel,
              ),
              _MetaPill(
                icon: Icons.attach_file_rounded,
                label: '${task.attachmentCount} attachments',
              ),
              if (task.unreadChatCount > 0)
                _MetaPill(
                  icon: Icons.mark_chat_unread_outlined,
                  label: '${task.unreadChatCount} unread',
                ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt,
              borderRadius: BorderRadius.circular(AppRadii.sm),
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
                  onPressed: onOpen,
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: const Text('Details'),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: FilledButton.icon(
                  onPressed: onAdvanceStatus,
                  icon: const Icon(Icons.navigate_next_rounded),
                  label: Text(_nextActionLabel(task.status)),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Updated ${AppFormatters.relativeTime(task.updatedAt)}',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

String _nextActionLabel(TaskStatus status) => switch (status) {
  TaskStatus.open => 'Review',
  TaskStatus.quoted => 'Schedule',
  TaskStatus.scheduled => 'Start',
  TaskStatus.inProgress => 'Complete',
  TaskStatus.completed => 'Completed',
  TaskStatus.cancelled => 'Closed',
};

Color _statusBackground(TaskStatus status) => switch (status) {
  TaskStatus.open => AppColors.accentSoft,
  TaskStatus.quoted => AppColors.warningSoft,
  TaskStatus.scheduled => AppColors.surfaceAlt,
  TaskStatus.inProgress => AppColors.primarySoft,
  TaskStatus.completed => AppColors.successSoft,
  TaskStatus.cancelled => AppColors.dangerSoft,
};

Color _statusForeground(TaskStatus status) => switch (status) {
  TaskStatus.open => AppColors.accent,
  TaskStatus.quoted => AppColors.warning,
  TaskStatus.scheduled => AppColors.ink,
  TaskStatus.inProgress => AppColors.primaryDeep,
  TaskStatus.completed => AppColors.success,
  TaskStatus.cancelled => AppColors.danger,
};

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.inkSubtle),
          const SizedBox(width: AppSpacing.xxs),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}
