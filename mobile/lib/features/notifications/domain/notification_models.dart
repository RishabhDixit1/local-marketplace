enum MobileNotificationKind { order, message, review, system, connection }

class MobileNotificationItem {
  const MobileNotificationItem({
    required this.id,
    required this.userId,
    required this.kind,
    required this.title,
    required this.message,
    required this.entityType,
    required this.entityId,
    required this.metadata,
    required this.readAt,
    required this.clearedAt,
    required this.createdAt,
  });

  factory MobileNotificationItem.fromJson(Map<String, dynamic> json) {
    return MobileNotificationItem(
      id: _readString(json['id']),
      userId: _readString(json['user_id']),
      kind: _parseKind(json['kind']),
      title: _readString(json['title'], fallback: 'Notification'),
      message: _readString(json['message']),
      entityType: _nullableString(json['entity_type']),
      entityId: _nullableString(json['entity_id']),
      metadata: _readMap(json['metadata']),
      readAt: _parseDate(json['read_at']),
      clearedAt: _parseDate(json['cleared_at']),
      createdAt: _parseDate(json['created_at']),
    );
  }

  final String id;
  final String userId;
  final MobileNotificationKind kind;
  final String title;
  final String message;
  final String? entityType;
  final String? entityId;
  final Map<String, dynamic> metadata;
  final DateTime? readAt;
  final DateTime? clearedAt;
  final DateTime? createdAt;

  bool get unread => readAt == null;
  String get timeLabel => _formatTimeAgo(createdAt);
}

class MobileNotificationAction {
  const MobileNotificationAction({
    required this.label,
    required this.route,
    this.queryParameters = const <String, String>{},
  });

  final String label;
  final String route;
  final Map<String, String> queryParameters;
}

MobileNotificationAction resolveMobileNotificationAction(
  MobileNotificationItem item,
) {
  final entityType = (item.entityType ?? '').trim().toLowerCase().replaceAll(
    '-',
    '_',
  );
  final explicitHref = _readMetadataString(item, [
    'href',
    'path',
    'action_path',
  ]);
  final conversationId =
      item.entityId ??
      _readMetadataString(item, ['conversation_id', 'conversationId']);
  final orderId =
      item.entityId ??
      _readMetadataString(item, ['order_id', 'orderId', 'task_id']);
  final helpRequestId =
      item.entityId ??
      _readMetadataString(item, [
        'help_request_id',
        'helpRequestId',
        'target_help_request_id',
        'targetHelpRequestId',
      ]);

  if (explicitHref.startsWith('/app/')) {
    return MobileNotificationAction(label: 'Open', route: explicitHref);
  }

  if (_conversationEntityTypes.contains(entityType) ||
      (item.kind == MobileNotificationKind.message &&
          conversationId.isNotEmpty)) {
    return MobileNotificationAction(
      label: 'Open chat',
      route: '/app/inbox/$conversationId',
    );
  }

  if (_orderEntityTypes.contains(entityType) ||
      item.kind == MobileNotificationKind.order) {
    return MobileNotificationAction(
      label: 'Open task',
      route: '/app/tasks',
      queryParameters: {
        if (orderId.isNotEmpty) 'focus': orderId,
        'source': 'notification',
      },
    );
  }

  if (_helpRequestEntityTypes.contains(entityType)) {
    return MobileNotificationAction(
      label: 'View request',
      route: '/app/tasks',
      queryParameters: {
        if (helpRequestId.isNotEmpty) 'focus': helpRequestId,
        'source': 'notification',
      },
    );
  }

  if (item.kind == MobileNotificationKind.review) {
    return const MobileNotificationAction(
      label: 'View profile',
      route: '/app/profile',
    );
  }

  return const MobileNotificationAction(
    label: 'View feed',
    route: '/app/welcome',
  );
}

const _conversationEntityTypes = {
  'conversation',
  'message',
  'chat',
  'conversation_message',
  'direct_message',
};
const _orderEntityTypes = {
  'order',
  'task',
  'order_update',
  'quote',
  'quote_draft',
};
const _helpRequestEntityTypes = {'help_request', 'need', 'request'};

Map<String, dynamic> _readMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, value) => MapEntry(key.toString(), value));
  }
  return const <String, dynamic>{};
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(Object? value) {
  final text = _readString(value);
  return text.isEmpty ? null : text;
}

String _readMetadataString(MobileNotificationItem item, List<String> keys) {
  for (final key in keys) {
    final value = item.metadata[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
}

MobileNotificationKind _parseKind(Object? value) {
  final normalized = _readString(value).toLowerCase();
  switch (normalized) {
    case 'order':
      return MobileNotificationKind.order;
    case 'message':
      return MobileNotificationKind.message;
    case 'review':
      return MobileNotificationKind.review;
    case 'connection':
    case 'connection_request':
      return MobileNotificationKind.connection;
    default:
      return MobileNotificationKind.system;
  }
}

DateTime? _parseDate(Object? value) {
  final text = _readString(value);
  return text.isEmpty ? null : DateTime.tryParse(text);
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
  return '${diff.inDays}d ago';
}
