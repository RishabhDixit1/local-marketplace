class ChatConversation {
  const ChatConversation({
    required this.id,
    required this.name,
    required this.avatarUrl,
    required this.otherUserId,
    required this.lastMessage,
    required this.lastMessageAt,
    required this.unreadCount,
    required this.isOnline,
    required this.subtitle,
  });

  final String id;
  final String name;
  final String avatarUrl;
  final String? otherUserId;
  final String lastMessage;
  final DateTime? lastMessageAt;
  final int unreadCount;
  final bool isOnline;
  final String subtitle;
}

class ChatMessageItem {
  const ChatMessageItem({
    required this.id,
    required this.conversationId,
    required this.senderId,
    required this.content,
    required this.createdAt,
  });

  final String id;
  final String conversationId;
  final String senderId;
  final String content;
  final DateTime createdAt;
}
