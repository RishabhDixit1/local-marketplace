enum LiveTalkRequestStatus {
  pending,
  accepted,
  declined,
  ended,
  cancelled;

  static LiveTalkRequestStatus fromString(String s) {
    return LiveTalkRequestStatus.values.firstWhere(
      (e) => e.name == s,
      orElse: () => LiveTalkRequestStatus.ended,
    );
  }
}

class LiveTalkRequest {
  final String id;
  final String conversationId;
  final String callerId;
  final String recipientId;
  final LiveTalkRequestStatus status;
  final DateTime createdAt;
  final DateTime? respondedAt;

  const LiveTalkRequest({
    required this.id,
    required this.conversationId,
    required this.callerId,
    required this.recipientId,
    required this.status,
    required this.createdAt,
    this.respondedAt,
  });

  factory LiveTalkRequest.fromJson(Map<String, dynamic> json) {
    return LiveTalkRequest(
      id: json['id'] as String,
      conversationId: json['conversation_id'] as String,
      callerId: json['caller_id'] as String,
      recipientId: json['recipient_id'] as String,
      status: LiveTalkRequestStatus.fromString(json['status'] as String),
      createdAt: DateTime.parse(json['created_at'] as String),
      respondedAt: json['responded_at'] != null
          ? DateTime.parse(json['responded_at'] as String)
          : null,
    );
  }

  bool get isActive => status == LiveTalkRequestStatus.pending || status == LiveTalkRequestStatus.accepted;
}
