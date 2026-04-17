import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../domain/chat_models.dart';

final chatRepositoryProvider = Provider<ChatRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return ChatRepository(
    supabaseClient: bootstrap.client,
    apiClient: ref.watch(mobileApiClientProvider),
  );
});

final conversationListProvider =
    FutureProvider.autoDispose<List<MobileConversationSummary>>((ref) {
      return ref.watch(chatRepositoryProvider).fetchConversations();
    });

final conversationMessagesProvider = FutureProvider.autoDispose
    .family<List<MobileChatMessage>, String>((ref, conversationId) {
      return ref
          .watch(chatRepositoryProvider)
          .fetchMessages(conversationId: conversationId);
    });

class ChatRepository {
  const ChatRepository({
    required SupabaseClient? supabaseClient,
    required MobileApiClient apiClient,
  }) : _supabaseClient = supabaseClient,
       _apiClient = apiClient;

  final SupabaseClient? _supabaseClient;
  final MobileApiClient _apiClient;

  SupabaseClient get _client {
    final client = _supabaseClient;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      throw const ApiException(
        'Sign in is required before opening chat.',
        statusCode: 401,
      );
    }

    return client;
  }

  String get currentUserId => _client.auth.currentUser!.id;

  Future<List<MobileConversationSummary>> fetchConversations() async {
    final client = _client;
    final userId = currentUserId;

    bool supportsReadReceipts = true;
    List<Map<String, dynamic>> myParticipantRows = [];

    try {
      final rows = await client
          .from('conversation_participants')
          .select('conversation_id,user_id,last_read_at')
          .eq('user_id', userId);
      myParticipantRows = _rowsFromResult(rows);
    } on PostgrestException catch (error) {
      if (_isMissingColumnError(error.message)) {
        supportsReadReceipts = false;
        try {
          final rows = await client
              .from('conversation_participants')
              .select('conversation_id,user_id')
              .eq('user_id', userId);
          myParticipantRows = _rowsFromResult(rows);
        } on PostgrestException catch (fallbackError) {
          throw ApiException(
            'Unable to load conversation list: ${fallbackError.message}',
          );
        }
      } else {
        throw ApiException(
          'Unable to load conversation list: ${error.message}',
        );
      }
    }

    if (myParticipantRows.isEmpty) {
      return const [];
    }

    final conversationIds = myParticipantRows
        .map((row) => _readString(row['conversation_id']))
        .where((id) => id.isNotEmpty)
        .toList();
    if (conversationIds.isEmpty) {
      return const [];
    }

    late final List<Map<String, dynamic>> participantRows;
    late final List<Map<String, dynamic>> messageRows;
    try {
      final participantResult = await client
          .from('conversation_participants')
          .select('conversation_id,user_id')
          .inFilter('conversation_id', conversationIds);
      final messageResult = await client
          .from('messages')
          .select('id,conversation_id,content,created_at,sender_id')
          .inFilter('conversation_id', conversationIds)
          .order('created_at', ascending: false)
          .limit(_conversationMessageScanLimit(conversationIds.length));

      participantRows = _rowsFromResult(participantResult);
      messageRows = _rowsFromResult(messageResult);
    } on PostgrestException catch (error) {
      throw ApiException('Unable to load chat data: ${error.message}');
    }

    final uniqueUserIds = participantRows
        .map((row) => _readString(row['user_id']))
        .where((id) => id.isNotEmpty)
        .toSet()
        .toList();

    final profilesById = <String, Map<String, dynamic>>{};
    if (uniqueUserIds.isNotEmpty) {
      try {
        final profileRows = await client
            .from('profiles')
            .select('id,name,avatar_url')
            .inFilter('id', uniqueUserIds);
        for (final row in _rowsFromResult(profileRows)) {
          final id = _readString(row['id']);
          if (id.isNotEmpty) {
            profilesById[id] = row;
          }
        }
      } on PostgrestException catch (error) {
        throw ApiException('Unable to load chat profiles: ${error.message}');
      }
    }

    final lastMessageByConversation = <String, Map<String, dynamic>>{};
    final messagesByConversation = <String, List<Map<String, dynamic>>>{};
    for (final message in messageRows) {
      final conversationId = _readString(message['conversation_id']);
      if (conversationId.isEmpty) {
        continue;
      }
      messagesByConversation.putIfAbsent(conversationId, () => []).add(message);
      lastMessageByConversation.putIfAbsent(conversationId, () => message);
    }

    final lastReadAtByConversation = <String, String?>{};
    for (final row in myParticipantRows) {
      final conversationId = _readString(row['conversation_id']);
      if (conversationId.isNotEmpty) {
        lastReadAtByConversation[conversationId] = _nullableString(
          row['last_read_at'],
        );
      }
    }

    final conversations =
        conversationIds.map((conversationId) {
          final users = participantRows
              .where(
                (row) => _readString(row['conversation_id']) == conversationId,
              )
              .toList();
          final otherUser = users.firstWhere(
            (row) => _readString(row['user_id']) != userId,
            orElse: () => const <String, dynamic>{},
          );
          final otherUserId = _nullableString(otherUser['user_id']);
          final profile = otherUserId == null
              ? null
              : profilesById[otherUserId];
          final lastMessage = lastMessageByConversation[conversationId];
          final lastReadAt = lastReadAtByConversation[conversationId];
          final conversationMessages =
              messagesByConversation[conversationId] ?? const [];
          final unreadCount = !supportsReadReceipts
              ? 0
              : conversationMessages.fold<int>(0, (count, message) {
                  final senderId = _readString(message['sender_id']);
                  final createdAt = _readString(message['created_at']);
                  if (senderId == userId) {
                    return count;
                  }
                  if (lastReadAt == null || lastReadAt.isEmpty) {
                    return count + 1;
                  }
                  return createdAt.compareTo(lastReadAt) > 0
                      ? count + 1
                      : count;
                });

          return MobileConversationSummary(
            id: conversationId,
            name: _readString(profile?['name'], fallback: 'User'),
            avatarUrl: _readString(profile?['avatar_url']),
            otherUserId: otherUserId,
            lastMessage: _readString(
              lastMessage?['content'],
              fallback: 'Start chat',
            ),
            lastMessageAt: _parseDate(lastMessage?['created_at']),
            unreadCount: unreadCount,
          );
        }).toList()..sort((left, right) {
          final leftTime = left.lastMessageAt?.millisecondsSinceEpoch ?? 0;
          final rightTime = right.lastMessageAt?.millisecondsSinceEpoch ?? 0;
          return rightTime.compareTo(leftTime);
        });

    return conversations;
  }

  Future<List<MobileChatMessage>> fetchMessages({
    required String conversationId,
  }) async {
    final client = _client;
    try {
      final rows = await client
          .from('messages')
          .select('id,conversation_id,content,sender_id,created_at')
          .eq('conversation_id', conversationId)
          .order('created_at', ascending: false)
          .limit(120);

      return _rowsFromResult(rows)
          .map(
            (row) => MobileChatMessage(
              id: _readString(row['id']),
              conversationId: _readString(row['conversation_id']),
              content: _readString(row['content']),
              senderId: _readString(row['sender_id']),
              createdAt: _parseDate(row['created_at']),
            ),
          )
          .toList()
          .reversed
          .toList();
    } on PostgrestException catch (error) {
      throw ApiException('Unable to load messages: ${error.message}');
    }
  }

  Future<void> sendMessage({
    required String conversationId,
    required String content,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/chat/messages',
      body: {'conversationId': conversationId, 'content': content.trim()},
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to send message.',
      );
    }
  }

  Future<String> getOrCreateDirectConversation({
    required String recipientId,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/chat/direct',
      body: {'recipientId': recipientId},
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ??
            'Unable to open a conversation right now.',
      );
    }

    return _readString(payload['conversationId']);
  }

  Future<void> markConversationRead(String conversationId) async {
    try {
      await _client
          .from('conversation_participants')
          .update({'last_read_at': DateTime.now().toUtc().toIso8601String()})
          .eq('conversation_id', conversationId)
          .eq('user_id', currentUserId);
    } on PostgrestException catch (error) {
      if (_isMissingColumnError(error.message)) {
        return;
      }
      throw ApiException('Unable to update read state: ${error.message}');
    }
  }
}

const int _conversationMessageScanMin = 200;
const int _conversationMessageScanMax = 1000;
const int _conversationMessageScanPerChat = 40;

int _conversationMessageScanLimit(int conversationCount) {
  final scaled = conversationCount * _conversationMessageScanPerChat;
  if (scaled < _conversationMessageScanMin) {
    return _conversationMessageScanMin;
  }
  if (scaled > _conversationMessageScanMax) {
    return _conversationMessageScanMax;
  }
  return scaled;
}

List<Map<String, dynamic>> _rowsFromResult(dynamic result) {
  return ((result as List?) ?? const [])
      .whereType<Map>()
      .map((row) => Map<String, dynamic>.from(row))
      .toList();
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _nullableString(Object? value) {
  final text = _readString(value);
  return text.isEmpty ? null : text;
}

DateTime? _parseDate(Object? value) {
  final text = _readString(value);
  return text.isEmpty ? null : DateTime.tryParse(text);
}

bool _isMissingColumnError(String message) => RegExp(
  r"column .* does not exist|could not find the '.*' column",
  caseSensitive: false,
).hasMatch(message);
