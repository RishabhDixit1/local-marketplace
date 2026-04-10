enum MobileTaskSource {
  order,
  helpRequest;

  String get label => this == MobileTaskSource.order ? 'Order' : 'Request';
}

enum MobileTaskRole {
  posted,
  accepted;

  String get summary =>
      this == MobileTaskRole.posted ? 'Created by you' : 'Assigned to you';
}

enum MobileTaskStatus {
  active,
  inProgress,
  completed,
  cancelled;

  String get label {
    switch (this) {
      case MobileTaskStatus.active:
        return 'Active';
      case MobileTaskStatus.inProgress:
        return 'In progress';
      case MobileTaskStatus.completed:
        return 'Completed';
      case MobileTaskStatus.cancelled:
        return 'Cancelled';
    }
  }
}

enum MobileTaskProgressStage {
  pendingAcceptance,
  accepted,
  travelStarted,
  workStarted,
  completed;

  String get label {
    switch (this) {
      case MobileTaskProgressStage.pendingAcceptance:
        return 'Pending acceptance';
      case MobileTaskProgressStage.accepted:
        return 'Task accepted';
      case MobileTaskProgressStage.travelStarted:
        return 'Travel started';
      case MobileTaskProgressStage.workStarted:
        return 'Work started';
      case MobileTaskProgressStage.completed:
        return 'Work completed';
    }
  }
}

enum MobileTaskPrimaryActionKind {
  acceptOrder,
  confirmAccepted,
  startTravel,
  startWork,
  completeTask,
}

enum MobileTaskTrackerStepState { done, active, upcoming }

class MobileTaskTrackerStep {
  const MobileTaskTrackerStep({required this.label, required this.state});

  final String label;
  final MobileTaskTrackerStepState state;
}

class MobileTaskPrimaryAction {
  const MobileTaskPrimaryAction({
    required this.kind,
    required this.label,
    required this.successMessage,
  });

  final MobileTaskPrimaryActionKind kind;
  final String label;
  final String successMessage;
}

class MobileTaskSnapshot {
  const MobileTaskSnapshot({required this.currentUserId, required this.items});

  final String currentUserId;
  final List<MobileTaskItem> items;

  int countFor(MobileTaskStatus status) {
    return items.where((item) => item.status == status).length;
  }

  List<MobileTaskItem> itemsFor(MobileTaskStatus status) {
    return items.where((item) => item.status == status).toList();
  }
}

class MobileTaskItem {
  const MobileTaskItem({
    required this.id,
    required this.source,
    required this.role,
    required this.status,
    required this.rawStatus,
    required this.progressStage,
    required this.title,
    required this.description,
    required this.budgetLabel,
    required this.locationLabel,
    required this.listingTypeLabel,
    required this.createdAt,
  });

  final String id;
  final MobileTaskSource source;
  final MobileTaskRole role;
  final MobileTaskStatus status;
  final String rawStatus;
  final MobileTaskProgressStage progressStage;
  final String title;
  final String description;
  final String budgetLabel;
  final String locationLabel;
  final String listingTypeLabel;
  final DateTime? createdAt;

  String get createdLabel => _formatTimeAgo(createdAt);

  String get statusLabel => _humanizeStatus(rawStatus);

  bool get isProviderTask => role == MobileTaskRole.accepted;

  List<MobileTaskTrackerStep> get trackerSteps {
    final progress = progressStage;

    return [
      MobileTaskTrackerStep(
        label: 'Task accepted',
        state: progress == MobileTaskProgressStage.pendingAcceptance
            ? MobileTaskTrackerStepState.active
            : _isStageReached(progress, MobileTaskProgressStage.accepted)
            ? MobileTaskTrackerStepState.done
            : MobileTaskTrackerStepState.upcoming,
      ),
      MobileTaskTrackerStep(
        label: 'Travel started',
        state: progress == MobileTaskProgressStage.accepted
            ? MobileTaskTrackerStepState.active
            : _isStageReached(progress, MobileTaskProgressStage.travelStarted)
            ? MobileTaskTrackerStepState.done
            : MobileTaskTrackerStepState.upcoming,
      ),
      MobileTaskTrackerStep(
        label: 'Work started',
        state: progress == MobileTaskProgressStage.travelStarted
            ? MobileTaskTrackerStepState.active
            : _isStageReached(progress, MobileTaskProgressStage.workStarted)
            ? MobileTaskTrackerStepState.done
            : MobileTaskTrackerStepState.upcoming,
      ),
      MobileTaskTrackerStep(
        label: 'Work completed',
        state: progress == MobileTaskProgressStage.workStarted
            ? MobileTaskTrackerStepState.active
            : progress == MobileTaskProgressStage.completed
            ? MobileTaskTrackerStepState.done
            : MobileTaskTrackerStepState.upcoming,
      ),
    ];
  }

  MobileTaskPrimaryAction? get primaryAction {
    if (!isProviderTask ||
        status == MobileTaskStatus.completed ||
        status == MobileTaskStatus.cancelled) {
      return null;
    }

    final normalizedStatus = _normalizeRawStatus(rawStatus);
    if (source == MobileTaskSource.order &&
        (normalizedStatus == 'new_lead' || normalizedStatus == 'quoted')) {
      return const MobileTaskPrimaryAction(
        kind: MobileTaskPrimaryActionKind.acceptOrder,
        label: 'Mark accepted',
        successMessage: 'Order accepted. The live tracker is ready.',
      );
    }

    if (progressStage == MobileTaskProgressStage.pendingAcceptance) {
      return const MobileTaskPrimaryAction(
        kind: MobileTaskPrimaryActionKind.confirmAccepted,
        label: 'Confirm accepted',
        successMessage:
            'Task accepted. The tracker is ready for travel updates.',
      );
    }

    if (progressStage == MobileTaskProgressStage.accepted) {
      return const MobileTaskPrimaryAction(
        kind: MobileTaskPrimaryActionKind.startTravel,
        label: 'Start travel',
        successMessage: 'Travel started. The requester can now see the update.',
      );
    }

    if (progressStage == MobileTaskProgressStage.travelStarted) {
      return const MobileTaskPrimaryAction(
        kind: MobileTaskPrimaryActionKind.startWork,
        label: 'Start work',
        successMessage: 'Work started. Both sides are now synced.',
      );
    }

    if (progressStage == MobileTaskProgressStage.workStarted) {
      return const MobileTaskPrimaryAction(
        kind: MobileTaskPrimaryActionKind.completeTask,
        label: 'Mark completed',
        successMessage: 'Task completed and moved to history.',
      );
    }

    return null;
  }
}

bool _isStageReached(
  MobileTaskProgressStage current,
  MobileTaskProgressStage target,
) {
  return current.index >= target.index;
}

String _normalizeRawStatus(String value) {
  final normalized = value.trim().toLowerCase();
  if (normalized.isEmpty) {
    return 'new_lead';
  }
  if (normalized == 'in-progress') {
    return 'in_progress';
  }
  if (normalized == 'canceled') {
    return 'cancelled';
  }
  return normalized;
}

String _humanizeStatus(String rawStatus) {
  final normalized = _normalizeRawStatus(rawStatus);
  return normalized
      .split('_')
      .map(
        (segment) => segment.isEmpty
            ? segment
            : '${segment[0].toUpperCase()}${segment.substring(1)}',
      )
      .join(' ');
}

String _formatTimeAgo(DateTime? createdAt) {
  if (createdAt == null) {
    return 'Recently';
  }

  final diff = DateTime.now().difference(createdAt.toLocal());
  if (diff.inMinutes < 1) {
    return 'Just now';
  }
  if (diff.inHours < 1) {
    return '${diff.inMinutes}m ago';
  }
  if (diff.inDays < 1) {
    return '${diff.inHours}h ago';
  }
  if (diff.inDays < 7) {
    return '${diff.inDays}d ago';
  }
  return '${createdAt.day}/${createdAt.month}/${createdAt.year}';
}
