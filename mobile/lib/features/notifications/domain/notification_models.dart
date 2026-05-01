import '../../../core/constants/app_routes.dart';

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

  String get location {
    if (queryParameters.isEmpty) {
      return route;
    }
    return Uri(path: route, queryParameters: queryParameters).toString();
  }
}

MobileNotificationAction resolveMobileNotificationAction(
  MobileNotificationItem item,
) {
  return resolveMobileNotificationActionFromData(
    kind: item.kind.name,
    entityType: item.entityType,
    entityId: item.entityId,
    metadata: item.metadata,
  );
}

MobileNotificationAction resolveMobileNotificationActionFromData({
  String? kind,
  String? entityType,
  String? entityId,
  Map<String, dynamic> metadata = const <String, dynamic>{},
}) {
  final normalizedEntityType = (entityType ?? '')
      .trim()
      .toLowerCase()
      .replaceAll('-', '_');
  final explicitHref = _readMetadataString(metadata, [
    'href',
    'path',
    'action_path',
    'deep_link',
    'deepLink',
    'route',
  ]);
  final conversationId =
      _entityIdFor(entityId, normalizedEntityType, _conversationEntityTypes) ??
      _readMetadataString(metadata, ['conversation_id', 'conversationId']);
  final contextTitle = _readMetadataString(metadata, [
    'request_title',
    'requestTitle',
    'task_title',
    'taskTitle',
    'context_title',
    'contextTitle',
    'title',
  ]);
  final contextStatus = _readMetadataString(metadata, [
    'status_label',
    'statusLabel',
    'status',
  ]);
  final metadataOrderId = _readMetadataString(metadata, [
    'order_id',
    'orderId',
    'task_id',
    'taskId',
  ]);
  final metadataHelpRequestId = _readMetadataString(metadata, [
    'help_request_id',
    'helpRequestId',
    'target_help_request_id',
    'targetHelpRequestId',
  ]);
  final orderId =
      _entityIdFor(entityId, normalizedEntityType, _orderEntityTypes) ??
      metadataOrderId;
  final helpRequestId =
      _entityIdFor(entityId, normalizedEntityType, _helpRequestEntityTypes) ??
      metadataHelpRequestId;
  final quoteId = _readMetadataString(metadata, [
    'quote_draft_id',
    'quoteDraftId',
    'quote_id',
    'quoteId',
  ]);
  final normalizedKind = (kind ?? '').trim().toLowerCase().replaceAll('-', '_');

  final explicitAction = _actionFromExplicitHref(explicitHref);
  if (explicitAction != null) {
    return explicitAction;
  }

  if (_conversationEntityTypes.contains(normalizedEntityType) ||
      (normalizedKind == 'message' && conversationId.isNotEmpty)) {
    return MobileNotificationAction(
      label: 'Open chat',
      route: AppRoutes.chatThread(conversationId),
      queryParameters: {
        if (contextTitle.isNotEmpty) 'title': contextTitle,
        if (helpRequestId.isNotEmpty || orderId.isNotEmpty)
          'taskId': helpRequestId.isNotEmpty ? helpRequestId : orderId,
        if (contextStatus.isNotEmpty) 'status': contextStatus,
        'source': 'notification',
      },
    );
  }

  if (_quoteEntityTypes.contains(normalizedEntityType) || quoteId.isNotEmpty) {
    final quoteTargetId = orderId.isNotEmpty ? orderId : helpRequestId;
    if (quoteTargetId.isNotEmpty) {
      return MobileNotificationAction(
        label: 'Open quote',
        route: AppRoutes.quote,
        queryParameters: {
          'mode': orderId.isNotEmpty ? 'order' : 'help_request',
          'targetId': quoteTargetId,
          if (conversationId.isNotEmpty) 'conversationId': conversationId,
          'source': 'notification',
        },
      );
    }
  }

  if (_orderEntityTypes.contains(normalizedEntityType) ||
      normalizedKind == 'order') {
    if (orderId.isNotEmpty) {
      return MobileNotificationAction(
        label: 'Open order',
        route: AppRoutes.orderDetail(orderId),
        queryParameters: {'source': 'notification'},
      );
    }

    return MobileNotificationAction(
      label: 'Open task',
      route: AppRoutes.tasks,
      queryParameters: {'source': 'notification'},
    );
  }

  if (_taskEntityTypes.contains(normalizedEntityType) ||
      _helpRequestEntityTypes.contains(normalizedEntityType)) {
    return MobileNotificationAction(
      label: 'View request',
      route: AppRoutes.tasks,
      queryParameters: {
        if (helpRequestId.isNotEmpty) 'focus': helpRequestId,
        'source': 'notification',
      },
    );
  }

  if (normalizedKind == 'review') {
    return const MobileNotificationAction(
      label: 'View profile',
      route: AppRoutes.profile,
    );
  }

  return const MobileNotificationAction(
    label: 'View feed',
    route: AppRoutes.welcome,
  );
}

const _conversationEntityTypes = {
  'conversation',
  'message',
  'chat',
  'conversation_message',
  'direct_message',
};
const _orderEntityTypes = {'order', 'order_update', 'checkout', 'payment'};
const _quoteEntityTypes = {'quote', 'quote_draft', 'quote_update'};
const _taskEntityTypes = {'task', 'task_update'};
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

String _readMetadataString(Map<String, dynamic> metadata, List<String> keys) {
  for (final key in keys) {
    final value = metadata[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
}

String? _entityIdFor(
  String? entityId,
  String entityType,
  Set<String> matchingTypes,
) {
  final normalized = _readString(entityId);
  if (normalized.isEmpty || !matchingTypes.contains(entityType)) {
    return null;
  }
  return normalized;
}

MobileNotificationAction? _actionFromExplicitHref(String href) {
  if (href.isEmpty) {
    return null;
  }

  final uri = Uri.tryParse(href);
  if (uri == null) {
    return null;
  }

  final path = uri.scheme == 'serviq' && uri.host == 'app'
      ? '/app${uri.path}'
      : uri.path;
  if (!path.startsWith('/app/')) {
    return null;
  }

  return MobileNotificationAction(
    label: 'Open',
    route: path,
    queryParameters: uri.queryParameters,
  );
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
