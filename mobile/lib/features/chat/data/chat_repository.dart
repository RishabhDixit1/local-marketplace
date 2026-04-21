import 'dart:math';

import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../domain/chat_models.dart';

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return ChatRepository(
    client: bootstrap.client,
    apiClient: ref.watch(mobileApiClientProvider),
  );
});

final chatConversationsProvider = FutureProvider<List<ChatConversation>>((ref) {
  return ref.watch(chatRepositoryProvider).fetchConversations();
});

final chatMessagesProvider =
    FutureProvider.family<List<ChatMessageItem>, String>((ref, conversationId) {
      return ref.watch(chatRepositoryProvider).fetchMessages(conversationId);
    });

class ChatRepository {
  const ChatRepository({
    required SupabaseClient? client,
    required MobileApiClient apiClient,
  }) : _client = client,
       _apiClient = apiClient;

  final SupabaseClient? _client;
  final MobileApiClient _apiClient;

  Future<List<ChatConversation>> fetchConversations() async {
    final client = _requireClient();
    final userId = _currentUserId(client);

    var supportsReadReceipts = true;
    List<Map<String, dynamic>> myParticipantRows;

    try {
      final rows = await client
          .from('conversation_participants')
          .select('conversation_id,user_id,last_read_at')
          .eq('user_id', userId);
      myParticipantRows = _rows(rows);
    } on PostgrestException catch (error) {
      if (!_isMissingColumnError(error.message)) {
        throw ApiException(error.message);
      }

      supportsReadReceipts = false;
      final rows = await client
          .from('conversation_participants')
          .select('conversation_id,user_id')
          .eq('user_id', userId);
      myParticipantRows = _rows(
        rows,
      ).map((row) => {...row, 'last_read_at': null}).toList();
    }

    if (myParticipantRows.isEmpty) {
      return const [];
    }

    final conversationIds = myParticipantRows
        .map((row) => _readString(row['conversation_id']))
        .where((id) => id.isNotEmpty)
        .toList();

    final messageScanLimit = min(1000, max(200, conversationIds.length * 40));

    final results = await Future.wait<Object?>([
      client
          .from('conversation_participants')
          .select('conversation_id,user_id')
          .inFilter('conversation_id', conversationIds),
      client
          .from('messages')
          .select('id,conversation_id,content,created_at,sender_id')
          .inFilter('conversation_id', conversationIds)
          .order('created_at', ascending: false)
          .limit(messageScanLimit),
    ]);

    final participantRows = _rows(results[0]);
    final messageRows = _rows(results[1]);
    final uniqueUserIds = participantRows
        .map((row) => _readString(row['user_id']))
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();

    final profilesRows = uniqueUserIds.isEmpty
        ? const <Map<String, dynamic>>[]
        : _rows(
            await client
                .from('profiles')
                .select('id,name,avatar_url,bio,location')
                .inFilter('id', uniqueUserIds),
          );

    List<Map<String, dynamic>> presenceRows = const [];
    try {
      if (uniqueUserIds.isNotEmpty) {
        presenceRows = _rows(
          await client
              .from('provider_presence')
              .select(
                'provider_id,is_online,availability,rolling_response_minutes',
              )
              .inFilter('provider_id', uniqueUserIds),
        );
      }
    } on PostgrestException {
      presenceRows = const [];
    }

    final profilesById = {
      for (final row in profilesRows) _readString(row['id']): row,
    };
    final presenceById = {
      for (final row in presenceRows) _readString(row['provider_id']): row,
    };
    final lastReadAtByConversation = {
      for (final row in myParticipantRows)
        _readString(row['conversation_id']): _parseDate(row['last_read_at']),
    };
    final messagesByConversation = <String, List<Map<String, dynamic>>>{};
    final lastMessageByConversation = <String, Map<String, dynamic>>{};

    for (final row in messageRows) {
      final conversationId = _readString(row['conversation_id']);
      messagesByConversation.putIfAbsent(conversationId, () => []).add(row);
      lastMessageByConversation.putIfAbsent(conversationId, () => row);
    }

    final conversations =
        conversationIds.map((conversationId) {
          final members = participantRows
              .where(
                (row) => _readString(row['conversation_id']) == conversationId,
              )
              .toList();
          final otherUser = members.firstWhere(
            (row) => _readString(row['user_id']) != userId,
            orElse: () => const <String, dynamic>{},
          );
          final otherUserId = _readString(otherUser['user_id']);
          final profile =
              profilesById[otherUserId] ?? const <String, dynamic>{};
          final presence =
              presenceById[otherUserId] ?? const <String, dynamic>{};
          final lastMessage = lastMessageByConversation[conversationId];
          final lastReadAt = lastReadAtByConversation[conversationId];
          final conversationMessages =
              messagesByConversation[conversationId] ?? const [];

          final unreadCount = supportsReadReceipts
              ? conversationMessages.fold<int>(0, (count, message) {
                  final senderId = _readString(message['sender_id']);
                  if (senderId == userId) {
                    return count;
                  }
                  final createdAt = _parseDate(message['created_at']);
                  if (lastReadAt == null || createdAt == null) {
                    return count + 1;
                  }
                  return createdAt.isAfter(lastReadAt) ? count + 1 : count;
                })
              : 0;

          return ChatConversation(
            id: conversationId,
            name: _readString(profile['name'], fallback: 'Local member'),
            avatarUrl: _readString(profile['avatar_url']),
            otherUserId: otherUserId.isEmpty ? null : otherUserId,
            lastMessage: _readString(
              lastMessage?['content'],
              fallback: 'Start the conversation',
            ),
            lastMessageAt: _parseDate(lastMessage?['created_at']),
            unreadCount: unreadCount,
            isOnline: presence['is_online'] == true,
            subtitle: _readString(
              profile['bio'],
              fallback: _readString(
                presence['availability'],
                fallback: _readString(profile['location'], fallback: 'Nearby'),
              ),
            ),
          );
        }).toList()..sort((left, right) {
          final leftTime = left.lastMessageAt?.millisecondsSinceEpoch ?? 0;
          final rightTime = right.lastMessageAt?.millisecondsSinceEpoch ?? 0;
          return rightTime.compareTo(leftTime);
        });

    return conversations;
  }

  Future<List<ChatMessageItem>> fetchMessages(String conversationId) async {
    final client = _requireClient();
    final rows = await client
        .from('messages')
        .select('id,conversation_id,content,sender_id,created_at')
        .eq('conversation_id', conversationId)
        .order('created_at', ascending: true)
        .limit(120);

    return _rows(rows)
        .map(
          (row) => ChatMessageItem(
            id: _readString(row['id']),
            conversationId: _readString(row['conversation_id']),
            senderId: _readString(row['sender_id']),
            content: _readString(row['content']),
            createdAt: _parseDate(row['created_at']) ?? DateTime.now(),
          ),
        )
        .toList();
  }

  Future<String> ensureConversation(String recipientId) async {
    final payload = await _apiClient.postJson(
      '/api/chat/direct',
      body: {'recipientId': recipientId},
    );
    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ??
            'Unable to open a direct conversation.',
      );
    }

    return _readString(payload['conversationId']);
  }

  Future<ChatMessageItem> sendMessage({
    required String conversationId,
    required String content,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/chat/messages',
      body: {'conversationId': conversationId, 'content': content.trim()},
    );
    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to send the message.',
      );
    }

    final message = Map<String, dynamic>.from(
      (payload['message'] as Map?) ?? const <String, dynamic>{},
    );

    return ChatMessageItem(
      id: _readString(message['id']),
      conversationId: _readString(message['conversation_id']),
      senderId: _readString(message['sender_id']),
      content: _readString(message['content']),
      createdAt: _parseDate(message['created_at']) ?? DateTime.now(),
    );
  }

  Future<void> markConversationRead(String conversationId) async {
    final client = _requireClient();
    final userId = _currentUserId(client);
    try {
      await client
          .from('conversation_participants')
          .update({'last_read_at': DateTime.now().toIso8601String()})
          .eq('conversation_id', conversationId)
          .eq('user_id', userId);
    } on PostgrestException catch (error) {
      if (!_isMissingColumnError(error.message)) {
        rethrow;
      }
    }
  }

  SupabaseClient _requireClient() {
    final client = _client;
    if (client == null) {
      throw const ApiException(
        'Supabase is not ready yet. Try again in a moment.',
      );
    }
    return client;
  }

  String _currentUserId(SupabaseClient client) {
    final userId = client.auth.currentUser?.id ?? '';
    if (userId.isEmpty) {
      throw const ApiException(
        'Sign in is required before using chat.',
        statusCode: 401,
      );
    }
    return userId;
  }

  static bool _isMissingColumnError(String message) {
    return message.contains('does not exist') && message.contains('column');
  }

  static List<Map<String, dynamic>> _rows(Object? value) {
    final list = value as List? ?? const [];
    return list
        .whereType<Map>()
        .map((row) => Map<String, dynamic>.from(row))
        .toList();
  }

  static String _readString(Object? value, {String fallback = ''}) {
    final text = value is String ? value.trim() : '';
    return text.isEmpty ? fallback : text;
  }

  static DateTime? _parseDate(Object? value) {
    if (value is! String || value.trim().isEmpty) {
      return null;
    }
    return DateTime.tryParse(value.trim())?.toLocal();
  }
}
