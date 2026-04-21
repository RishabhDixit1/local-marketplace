class MobileConversationSummary {
  const MobileConversationSummary({
    required this.id,
    required this.name,
    required this.avatarUrl,
    required this.otherUserId,
    required this.lastMessage,
    required this.lastMessageAt,
    required this.unreadCount,
  });

  final String id;
  final String name;
  final String avatarUrl;
  final String? otherUserId;
  final String lastMessage;
  final DateTime? lastMessageAt;
  final int unreadCount;

  String get timeLabel => _formatConversationTime(lastMessageAt);
}

class MobileChatMessage {
  const MobileChatMessage({
    required this.id,
    required this.conversationId,
    required this.content,
    required this.senderId,
    required this.createdAt,
  });

  final String id;
  final String conversationId;
  final String content;
  final String senderId;
  final DateTime? createdAt;

  String get timeLabel => _formatMessageTime(createdAt);
}

String _formatConversationTime(DateTime? timestamp) {
  if (timestamp == null) {
    return 'Now';
  }

  final local = timestamp.toLocal();
  final now = DateTime.now();
  final startOfToday = DateTime(now.year, now.month, now.day);
  final startOfTimestampDay = DateTime(local.year, local.month, local.day);

  if (startOfTimestampDay == startOfToday) {
    final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
    final minute = local.minute.toString().padLeft(2, '0');
    final suffix = local.hour >= 12 ? 'PM' : 'AM';
    return '$hour:$minute $suffix';
  }

  if (startOfToday.difference(startOfTimestampDay).inDays == 1) {
    return 'Yesterday';
  }

  return '${local.day}/${local.month}/${local.year}';
}

String _formatMessageTime(DateTime? timestamp) {
  if (timestamp == null) {
    return '';
  }

  final local = timestamp.toLocal();
  final hour = local.hour % 12 == 0 ? 12 : local.hour % 12;
  final minute = local.minute.toString().padLeft(2, '0');
  final suffix = local.hour >= 12 ? 'PM' : 'AM';
  return '$hour:$minute $suffix';
}
