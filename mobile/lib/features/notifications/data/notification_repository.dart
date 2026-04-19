import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../domain/notification_models.dart';

final notificationRepositoryProvider = Provider<NotificationRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return NotificationRepository(supabaseClient: bootstrap.client);
});

final notificationListProvider =
    FutureProvider.autoDispose<List<MobileNotificationItem>>((ref) {
      return ref.watch(notificationRepositoryProvider).fetchNotifications();
    });

final unreadNotificationCountProvider = Provider<int>((ref) {
  final data = ref.watch(notificationListProvider).asData?.value ?? const [];
  return data.where((item) => item.unread).length;
});

class NotificationRepository {
  const NotificationRepository({required SupabaseClient? supabaseClient})
    : _supabaseClient = supabaseClient;

  final SupabaseClient? _supabaseClient;

  SupabaseClient get _client {
    final client = _supabaseClient;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      throw const ApiException(
        'Sign in is required before loading notifications.',
        statusCode: 401,
      );
    }

    return client;
  }

  String get currentUserId => _client.auth.currentUser!.id;

  Future<List<MobileNotificationItem>> fetchNotifications() async {
    try {
      final rows = await _client
          .from('notifications')
          .select(
            'id,user_id,kind,title,message,entity_type,entity_id,metadata,read_at,cleared_at,created_at',
          )
          .eq('user_id', currentUserId)
          .isFilter('cleared_at', null)
          .order('created_at', ascending: false)
          .limit(60);

      return _rowsFromResult(
        rows,
      ).map(MobileNotificationItem.fromJson).toList();
    } on PostgrestException catch (error) {
      throw ApiException('Unable to load notifications: ${error.message}');
    }
  }

  Future<void> markAsRead(String notificationId) async {
    try {
      await _client
          .from('notifications')
          .update({'read_at': DateTime.now().toUtc().toIso8601String()})
          .eq('id', notificationId)
          .eq('user_id', currentUserId)
          .isFilter('read_at', null);
    } on PostgrestException catch (error) {
      throw ApiException(
        'Unable to mark notification as read: ${error.message}',
      );
    }
  }

  Future<void> markAllAsRead() async {
    try {
      await _client.rpc('mark_all_notifications_read');
      return;
    } on PostgrestException {
      try {
        await _client
            .from('notifications')
            .update({'read_at': DateTime.now().toUtc().toIso8601String()})
            .eq('user_id', currentUserId)
            .isFilter('read_at', null)
            .isFilter('cleared_at', null);
      } on PostgrestException catch (error) {
        throw ApiException(
          'Unable to mark notifications as read: ${error.message}',
        );
      }
    }
  }

  Future<void> clearNotification(String notificationId) async {
    try {
      await _client
          .from('notifications')
          .update({'cleared_at': DateTime.now().toUtc().toIso8601String()})
          .eq('id', notificationId)
          .eq('user_id', currentUserId)
          .isFilter('cleared_at', null);
    } on PostgrestException catch (error) {
      throw ApiException('Unable to clear notification: ${error.message}');
    }
  }

  Future<void> clearAll() async {
    try {
      await _client.rpc('clear_all_notifications');
      return;
    } on PostgrestException {
      try {
        await _client
            .from('notifications')
            .update({'cleared_at': DateTime.now().toUtc().toIso8601String()})
            .eq('user_id', currentUserId)
            .isFilter('cleared_at', null);
      } on PostgrestException catch (error) {
        throw ApiException('Unable to clear notifications: ${error.message}');
      }
    }
  }
}

List<Map<String, dynamic>> _rowsFromResult(dynamic result) {
  return ((result as List?) ?? const [])
      .whereType<Map>()
      .map((row) => Map<String, dynamic>.from(row))
      .toList();
}
