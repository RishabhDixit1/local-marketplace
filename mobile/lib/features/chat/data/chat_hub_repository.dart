import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mock/serviq_mock_store.dart';
import '../../../core/models/serviq_models.dart';

final chatHubRepositoryProvider = Provider<ChatHubRepository>((ref) {
  return ChatHubRepository(ref);
});

final chatThreadsProvider = FutureProvider<List<ChatThread>>((ref) async {
  return ref.read(chatHubRepositoryProvider).fetchThreads();
});

final chatMessagesProvider = FutureProvider.family<List<ChatMessage>, String>((
  ref,
  threadId,
) async {
  return ref.read(chatHubRepositoryProvider).fetchMessages(threadId);
});

class ChatHubRepository {
  ChatHubRepository(this._ref);

  final Ref _ref;

  Future<List<ChatThread>> fetchThreads() async {
    await Future<void>.delayed(const Duration(milliseconds: 180));
    final threads = [..._ref.read(serviqMockStoreProvider).threads]
      ..sort((a, b) {
        if (a.pinned != b.pinned) {
          return a.pinned ? -1 : 1;
        }
        return b.lastMessageAt.compareTo(a.lastMessageAt);
      });
    return threads;
  }

  Future<List<ChatMessage>> fetchMessages(String threadId) async {
    await Future<void>.delayed(const Duration(milliseconds: 160));
    final messages = _ref
        .read(serviqMockStoreProvider)
        .messagesByThreadId[threadId];
    return messages ?? const [];
  }

  Future<void> sendMessage(String threadId, String text) async {
    _ref.read(serviqMockStoreProvider.notifier).sendMessage(threadId, text);
  }

  Future<void> markRead(String threadId) async {
    _ref.read(serviqMockStoreProvider.notifier).markThreadRead(threadId);
  }

  Future<void> togglePin(String threadId) async {
    _ref.read(serviqMockStoreProvider.notifier).toggleThreadPin(threadId);
  }
}
