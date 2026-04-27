import 'package:flutter/material.dart';

import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../domain/task_snapshot.dart';

class TaskStatusTabData {
  const TaskStatusTabData({
    required this.id,
    required this.label,
    required this.count,
  });

  final String id;
  final String label;
  final int count;
}

class TaskStatusTabs extends StatelessWidget {
  const TaskStatusTabs({
    super.key,
    required this.tabs,
    required this.selectedId,
    required this.onSelected,
  });

  final List<TaskStatusTabData> tabs;
  final String selectedId;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(4),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: LayoutBuilder(
        builder: (context, constraints) {
          final compact = constraints.maxWidth < AppBreakpoints.regular;
          return Wrap(
            spacing: 4,
            runSpacing: 4,
            children: tabs.map((tab) {
              final selected = tab.id == selectedId;
              final width = compact
                  ? (constraints.maxWidth - 4) / 2
                  : (constraints.maxWidth - 12) / 4;
              return SizedBox(
                width: width,
                child: Material(
                  color: selected ? AppColors.surface : Colors.transparent,
                  borderRadius: BorderRadius.circular(AppRadii.sm),
                  child: InkWell(
                    borderRadius: BorderRadius.circular(AppRadii.sm),
                    onTap: () => onSelected(tab.id),
                    child: Padding(
                      padding: const EdgeInsets.symmetric(
                        horizontal: 10,
                        vertical: 10,
                      ),
                      child: Row(
                        mainAxisAlignment: MainAxisAlignment.center,
                        children: [
                          Flexible(
                            child: Text(
                              tab.label,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: Theme.of(context).textTheme.labelLarge
                                  ?.copyWith(
                                    color: selected
                                        ? AppColors.ink
                                        : AppColors.inkMuted,
                                  ),
                            ),
                          ),
                          const SizedBox(width: 6),
                          Container(
                            constraints: const BoxConstraints(minWidth: 22),
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 2,
                            ),
                            decoration: BoxDecoration(
                              color: selected
                                  ? AppColors.ink
                                  : AppColors.surface,
                              borderRadius: BorderRadius.circular(
                                AppRadii.pill,
                              ),
                            ),
                            child: Text(
                              tab.count > 99 ? '99+' : tab.count.toString(),
                              textAlign: TextAlign.center,
                              style: Theme.of(context).textTheme.labelMedium
                                  ?.copyWith(
                                    color: selected
                                        ? Colors.white
                                        : AppColors.inkMuted,
                                  ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ),
                ),
              );
            }).toList(),
          );
        },
      ),
    );
  }
}

class TaskCard extends StatelessWidget {
  const TaskCard({
    super.key,
    required this.task,
    required this.busy,
    required this.onPrimaryAction,
    this.focused = false,
  });

  final MobileTaskItem task;
  final bool busy;
  final VoidCallback? onPrimaryAction;
  final bool focused;

  @override
  Widget build(BuildContext context) {
    final action = task.primaryAction;
    final timelineSteps = _statusTimelineFor(task);

    final card = SectionCard(
      padding: const EdgeInsets.all(14),
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
                      spacing: 7,
                      runSpacing: 7,
                      children: [
                        _TaskPill(
                          label: task.source.label,
                          background: AppColors.verifiedSoft,
                          foreground: AppColors.ink,
                        ),
                        _TaskPill(
                          label: task.statusLabel,
                          background: _statusTint(task.status),
                          foreground: _statusInk(task.status),
                        ),
                        _TaskPill(
                          label: task.isProviderTask ? 'Helping' : 'Requested',
                          background: AppColors.surfaceMuted,
                          foreground: AppColors.inkMuted,
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Text(
                      task.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 6),
                    Text(
                      task.description,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _MetaPill(icon: Icons.payments_outlined, label: task.budgetLabel),
              _MetaPill(
                icon: Icons.location_on_outlined,
                label: task.locationLabel,
              ),
              _MetaPill(icon: Icons.schedule_rounded, label: task.createdLabel),
            ],
          ),
          const SizedBox(height: 12),
          NextActionPanel(
            task: task,
            action: action,
            busy: busy,
            onPrimaryAction: onPrimaryAction,
          ),
          const SizedBox(height: 12),
          TaskTimeline(steps: timelineSteps),
        ],
      ),
    );

    if (!focused) {
      return card;
    }

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.primary, width: 2),
        boxShadow: AppShadows.card,
      ),
      child: card,
    );
  }
}

class TaskTimeline extends StatelessWidget {
  const TaskTimeline({super.key, required this.steps});

  final List<TaskTimelineStep> steps;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Timeline', style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 12),
          ...steps.asMap().entries.map(
            (entry) => _TrackerStep(
              step: entry.value,
              showConnector: entry.key != steps.length - 1,
            ),
          ),
        ],
      ),
    );
  }
}

class NextActionPanel extends StatelessWidget {
  const NextActionPanel({
    super.key,
    required this.task,
    required this.action,
    required this.busy,
    required this.onPrimaryAction,
  });

  final MobileTaskItem task;
  final MobileTaskPrimaryAction? action;
  final bool busy;
  final VoidCallback? onPrimaryAction;

  @override
  Widget build(BuildContext context) {
    final panelColor = task.isProviderTask
        ? AppColors.primarySoft
        : AppColors.accentSoft;
    final accentColor = task.isProviderTask
        ? AppColors.primary
        : AppColors.accent;
    final icon = action == null
        ? Icons.arrow_forward_rounded
        : _actionIconData(action!.kind);

    return LayoutBuilder(
      builder: (context, constraints) {
        final compact = constraints.maxWidth < AppBreakpoints.regular;

        final copy = Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: accentColor),
            const SizedBox(width: 10),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    action?.label ?? _nextStepShortLabel(task),
                    maxLines: 2,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall,
                  ),
                  const SizedBox(height: 4),
                  Text(
                    _nextStepMessage(task),
                    maxLines: 3,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                ],
              ),
            ),
          ],
        );

        final actionButton = action == null
            ? null
            : FilledButton(
                onPressed: busy ? null : onPrimaryAction,
                style: FilledButton.styleFrom(
                  minimumSize: const Size(0, 40),
                  padding: const EdgeInsets.symmetric(horizontal: 12),
                ),
                child: busy
                    ? const SizedBox(
                        width: 16,
                        height: 16,
                        child: CircularProgressIndicator(strokeWidth: 2),
                      )
                    : Text(
                        action!.label,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                      ),
              );

        return Container(
          width: double.infinity,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: panelColor,
            borderRadius: BorderRadius.circular(AppRadii.sm),
            border: Border.all(color: panelColor),
          ),
          child: compact || actionButton == null
              ? Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    copy,
                    if (actionButton != null) ...[
                      const SizedBox(height: 12),
                      SizedBox(width: double.infinity, child: actionButton),
                    ],
                  ],
                )
              : Row(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Expanded(child: copy),
                    const SizedBox(width: 12),
                    Flexible(
                      flex: 0,
                      child: ConstrainedBox(
                        constraints: const BoxConstraints(maxWidth: 180),
                        child: actionButton,
                      ),
                    ),
                  ],
                ),
        );
      },
    );
  }
}

class TaskTimelineStep {
  const TaskTimelineStep({
    required this.title,
    required this.message,
    required this.state,
  });

  final String title;
  final String message;
  final MobileTaskTrackerStepState state;
}

class _TrackerStep extends StatelessWidget {
  const _TrackerStep({required this.step, required this.showConnector});

  final TaskTimelineStep step;
  final bool showConnector;

  @override
  Widget build(BuildContext context) {
    final isDone = step.state == MobileTaskTrackerStepState.done;
    final isActive = step.state == MobileTaskTrackerStepState.active;
    final fill = isDone
        ? AppColors.success
        : isActive
        ? AppColors.accent
        : AppColors.border;
    final foreground = isDone || isActive ? Colors.white : AppColors.inkMuted;

    return Padding(
      padding: EdgeInsets.only(bottom: showConnector ? 2 : 0),
      child: IntrinsicHeight(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Column(
              children: [
                Container(
                  width: 24,
                  height: 24,
                  decoration: BoxDecoration(
                    color: fill,
                    shape: BoxShape.circle,
                  ),
                  child: Icon(
                    isDone ? Icons.check_rounded : Icons.circle,
                    color: foreground,
                    size: isDone ? 15 : 8,
                  ),
                ),
                if (showConnector)
                  Expanded(
                    child: Container(
                      width: 2,
                      margin: const EdgeInsets.symmetric(vertical: 4),
                      color: AppColors.border,
                    ),
                  ),
              ],
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Padding(
                padding: const EdgeInsets.only(top: 3, bottom: 12),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      step.title,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        fontWeight: FontWeight.w800,
                        color: isActive ? AppColors.ink : null,
                      ),
                    ),
                    const SizedBox(height: 2),
                    Text(
                      step.message,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                  ],
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
      constraints: const BoxConstraints(maxWidth: 170),
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(
          context,
        ).textTheme.labelMedium?.copyWith(color: foreground),
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
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 180),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppColors.inkMuted),
            const SizedBox(width: 5),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

List<TaskTimelineStep> _statusTimelineFor(MobileTaskItem task) {
  if (task.isProviderTask) {
    return task.trackerSteps
        .map(
          (step) => TaskTimelineStep(
            title: step.label,
            message: _providerTimelineMessage(step.label, step.state),
            state: step.state,
          ),
        )
        .toList();
  }

  switch (task.status) {
    case MobileTaskStatus.active:
      return const [
        TaskTimelineStep(
          title: 'Request posted',
          message: 'Visible to nearby providers.',
          state: MobileTaskTrackerStepState.done,
        ),
        TaskTimelineStep(
          title: 'Provider replies',
          message: 'Questions and quotes move to Chat.',
          state: MobileTaskTrackerStepState.active,
        ),
        TaskTimelineStep(
          title: 'Provider accepted',
          message: 'The task becomes trackable.',
          state: MobileTaskTrackerStepState.upcoming,
        ),
      ];
    case MobileTaskStatus.inProgress:
      return const [
        TaskTimelineStep(
          title: 'Provider accepted',
          message: 'The handoff is confirmed.',
          state: MobileTaskTrackerStepState.done,
        ),
        TaskTimelineStep(
          title: 'Work moving',
          message: 'Track travel, start, and finish updates.',
          state: MobileTaskTrackerStepState.active,
        ),
        TaskTimelineStep(
          title: 'Done',
          message: 'Close the work and review.',
          state: MobileTaskTrackerStepState.upcoming,
        ),
      ];
    case MobileTaskStatus.completed:
      return const [
        TaskTimelineStep(
          title: 'Accepted',
          message: 'The work had a confirmed provider.',
          state: MobileTaskTrackerStepState.done,
        ),
        TaskTimelineStep(
          title: 'Completed',
          message: 'The task is closed.',
          state: MobileTaskTrackerStepState.done,
        ),
      ];
    case MobileTaskStatus.cancelled:
      return const [
        TaskTimelineStep(
          title: 'Opened',
          message: 'The request entered the marketplace.',
          state: MobileTaskTrackerStepState.done,
        ),
        TaskTimelineStep(
          title: 'Stopped',
          message: 'Matching is no longer active.',
          state: MobileTaskTrackerStepState.active,
        ),
      ];
  }
}

String _providerTimelineMessage(
  String label,
  MobileTaskTrackerStepState state,
) {
  if (state == MobileTaskTrackerStepState.done) {
    return 'Shared with the requester.';
  }

  switch (label) {
    case 'Task accepted':
      return 'Confirm the handoff.';
    case 'Travel started':
      return 'Start travel when you are on the way.';
    case 'Work started':
      return 'Mark work started when you begin.';
    case 'Work completed':
      return 'Close the loop when wrapped.';
    default:
      return 'Keep this step current.';
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

String _nextStepMessage(MobileTaskItem task) {
  if (task.isProviderTask) {
    return switch (task.progressStage) {
      MobileTaskProgressStage.pendingAcceptance =>
        'Confirm the handoff, then update travel and work.',
      MobileTaskProgressStage.accepted =>
        'Start travel when you are on the way.',
      MobileTaskProgressStage.travelStarted =>
        'Start work when you arrive or begin remotely.',
      MobileTaskProgressStage.workStarted =>
        'Mark completion when the job is wrapped.',
      MobileTaskProgressStage.completed =>
        'Keep receipts or follow-up in Chat.',
    };
  }

  return switch (task.status) {
    MobileTaskStatus.active => 'Watch Chat for provider questions.',
    MobileTaskStatus.inProgress =>
      'Use Chat for details and timeline for status.',
    MobileTaskStatus.completed => 'Review history, receipts, or follow-up.',
    MobileTaskStatus.cancelled => 'Create a new request if the need returns.',
  };
}

Color _statusTint(MobileTaskStatus status) {
  switch (status) {
    case MobileTaskStatus.active:
      return AppColors.verifiedSoft;
    case MobileTaskStatus.inProgress:
      return const Color(0xFFEDE9FE);
    case MobileTaskStatus.completed:
      return AppColors.successSoft;
    case MobileTaskStatus.cancelled:
      return AppColors.dangerSoft;
  }
}

Color _statusInk(MobileTaskStatus status) {
  switch (status) {
    case MobileTaskStatus.active:
      return AppColors.ink;
    case MobileTaskStatus.inProgress:
      return const Color(0xFF5B21B6);
    case MobileTaskStatus.completed:
      return AppColors.success;
    case MobileTaskStatus.cancelled:
      return AppColors.danger;
  }
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
