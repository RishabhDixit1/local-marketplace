import '../../../core/constants/app_routes.dart';

enum MobileNotificationKind {
  order,
  message,
  review,
  system,
  connection;

  String get label {
    switch (this) {
      case MobileNotificationKind.order:
        return 'Orders';
      case MobileNotificationKind.message:
        return 'Messages';
      case MobileNotificationKind.review:
        return 'Trust';
      case MobileNotificationKind.system:
        return 'System';
      case MobileNotificationKind.connection:
        return 'Connections';
    }
  }
}

class MobileNotificationItem {
  const MobileNotificationItem({
    required this.id,
    required this.kind,
    required this.title,
    required this.message,
    required this.entityType,
    required this.entityId,
    required this.metadata,
    required this.readAt,
    required this.createdAt,
  });

  final String id;
  final MobileNotificationKind kind;
  final String title;
  final String message;
  final String entityType;
  final String? entityId;
  final Map<String, dynamic> metadata;
  final DateTime? readAt;
  final DateTime createdAt;

  bool get unread => readAt == null;

  String get actionLabel {
    final normalized = entityType.toLowerCase();
    if (normalized.contains('conversation') || normalized.contains('message')) {
      return 'Open chat';
    }
    if (normalized.contains('order') || normalized.contains('task')) {
      return 'Open task';
    }
    if (normalized.contains('review')) {
      return 'View profile';
    }
    if (normalized.contains('connection')) {
      return 'Open people';
    }
    return 'Open';
  }

  String get actionRoute {
    final normalized = entityType.toLowerCase().replaceAll('-', '_');
    final conversationId =
        entityId ?? _readMetadataString(['conversation_id', 'conversationId']);

    if (normalized.contains('conversation') ||
        normalized.contains('message') ||
        kind == MobileNotificationKind.message) {
      final query = conversationId == null || conversationId.isEmpty
          ? ''
          : '?conversationId=$conversationId';
      return '${AppRoutes.chat}$query';
    }

    if (normalized.contains('order') ||
        normalized.contains('task') ||
        kind == MobileNotificationKind.order) {
      return AppRoutes.tasks;
    }

    if (normalized.contains('review')) {
      return AppRoutes.profile;
    }

    if (normalized.contains('connection') ||
        kind == MobileNotificationKind.connection) {
      return AppRoutes.people;
    }

    return AppRoutes.home;
  }

  String? _readMetadataString(List<String> keys) {
    for (final key in keys) {
      final value = metadata[key];
      if (value is String && value.trim().isNotEmpty) {
        return value.trim();
      }
    }
    return null;
  }
}

class MobileNotificationsSnapshot {
  const MobileNotificationsSnapshot({
    required this.items,
    this.demoMode = false,
    this.notice,
  });

  final List<MobileNotificationItem> items;
  final bool demoMode;
  final String? notice;

  int get unreadCount => items.where((item) => item.unread).length;
}
