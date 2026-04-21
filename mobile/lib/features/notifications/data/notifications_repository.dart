import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../domain/notification_item.dart';

final notificationsRepositoryProvider = Provider<NotificationsRepository>((
  ref,
) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return NotificationsRepository(client: bootstrap.client);
});

final notificationsSnapshotProvider =
    FutureProvider<MobileNotificationsSnapshot>((ref) {
      return ref.watch(notificationsRepositoryProvider).fetchNotifications();
    });

class NotificationsRepository {
  const NotificationsRepository({required SupabaseClient? client})
    : _client = client;

  final SupabaseClient? _client;

  Future<MobileNotificationsSnapshot> fetchNotifications() async {
    final client = _client;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      throw const ApiException(
        'Sign in is required before loading notifications.',
        statusCode: 401,
      );
    }

    try {
      final result = await client
          .from('notifications')
          .select(
            'id,user_id,kind,title,message,entity_type,entity_id,metadata,read_at,cleared_at,created_at',
          )
          .eq('user_id', userId)
          .filter('cleared_at', 'is', null)
          .order('created_at', ascending: false)
          .limit(60);

      final rows = (result as List)
          .whereType<Map>()
          .map((row) => Map<String, dynamic>.from(row))
          .map(_mapNotification)
          .toList();

      return MobileNotificationsSnapshot(items: rows);
    } on PostgrestException catch (error) {
      final message = error.message.toLowerCase();
      if (_isMissingTableError(message)) {
        return MobileNotificationsSnapshot(
          items: _demoNotifications(userId),
          demoMode: true,
          notice:
              'Notifications are running in demo mode until the canonical Supabase notification tables are available.',
        );
      }

      throw ApiException(error.message);
    }
  }

  Future<void> markRead(String notificationId) async {
    final client = _client;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      return;
    }

    final result = await client
        .from('notifications')
        .update({'read_at': DateTime.now().toIso8601String()})
        .eq('id', notificationId)
        .eq('user_id', userId);

    if (result.error != null && !_isMissingTableError(result.error!.message)) {
      throw ApiException(result.error!.message);
    }
  }

  Future<void> markAllRead() async {
    final client = _client;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      return;
    }

    final result = await client.rpc('mark_all_notifications_read');
    if (result.error != null &&
        !_isMissingFunctionError(result.error!.message)) {
      final fallback = await client
          .from('notifications')
          .update({'read_at': DateTime.now().toIso8601String()})
          .eq('user_id', userId)
          .filter('read_at', 'is', null)
          .filter('cleared_at', 'is', null);

      if (fallback.error != null &&
          !_isMissingTableError(fallback.error!.message)) {
        throw ApiException(fallback.error!.message);
      }
    }
  }

  MobileNotificationItem _mapNotification(Map<String, dynamic> row) {
    return MobileNotificationItem(
      id: _readString(row['id']),
      kind: _parseKind(row['kind'] as String?),
      title: _readString(row['title'], fallback: 'New notification'),
      message: _readString(row['message']),
      entityType: _readString(row['entity_type']),
      entityId: _readNullableString(row['entity_id']),
      metadata: _readObject(row['metadata']),
      readAt: _parseDate(row['read_at']),
      createdAt: _parseDate(row['created_at']) ?? DateTime.now(),
    );
  }

  static bool _isMissingTableError(String message) {
    return message.contains('notifications') &&
        (message.contains('does not exist') ||
            message.contains('schema cache'));
  }

  static bool _isMissingFunctionError(String message) {
    return message.contains('mark_all_notifications_read') &&
        message.contains('does not exist');
  }

  static Map<String, dynamic> _readObject(Object? value) {
    if (value is Map<String, dynamic>) {
      return value;
    }
    if (value is Map) {
      return value.map((key, data) => MapEntry(key.toString(), data));
    }
    return const <String, dynamic>{};
  }

  static String _readString(Object? value, {String fallback = ''}) {
    final text = value is String ? value.trim() : '';
    return text.isEmpty ? fallback : text;
  }

  static String? _readNullableString(Object? value) {
    final text = value is String ? value.trim() : '';
    return text.isEmpty ? null : text;
  }

  static DateTime? _parseDate(Object? value) {
    if (value is! String || value.trim().isEmpty) {
      return null;
    }
    return DateTime.tryParse(value.trim());
  }

  static MobileNotificationKind _parseKind(String? value) {
    switch ((value ?? '').trim().toLowerCase()) {
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

  static List<MobileNotificationItem> _demoNotifications(String userId) {
    final now = DateTime.now();
    return [
      MobileNotificationItem(
        id: 'demo-order',
        kind: MobileNotificationKind.order,
        title: 'Order accepted',
        message:
            'A nearby provider accepted your request and started preparing.',
        entityType: 'order',
        entityId: null,
        metadata: const {},
        readAt: null,
        createdAt: now.subtract(const Duration(minutes: 3)),
      ),
      MobileNotificationItem(
        id: 'demo-message',
        kind: MobileNotificationKind.message,
        title: 'New reply in chat',
        message: 'A provider sent a new message. Open chat to continue.',
        entityType: 'conversation',
        entityId: 'demo-conversation',
        metadata: const {'conversation_id': 'demo-conversation'},
        readAt: null,
        createdAt: now.subtract(const Duration(minutes: 8)),
      ),
      MobileNotificationItem(
        id: 'demo-review',
        kind: MobileNotificationKind.review,
        title: 'New trust signal',
        message: 'One of your recent jobs received a positive review.',
        entityType: 'review',
        entityId: userId,
        metadata: const {},
        readAt: now.subtract(const Duration(minutes: 20)),
        createdAt: now.subtract(const Duration(minutes: 24)),
      ),
    ];
  }
}
