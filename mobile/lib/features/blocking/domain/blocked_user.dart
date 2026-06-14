class BlockedUser {
  const BlockedUser({
    required this.blockedId,
    required this.createdAt,
  });

  factory BlockedUser.fromJson(Map<String, dynamic> json) {
    return BlockedUser(
      blockedId: json['blocked_id'] as String,
      createdAt: DateTime.parse(json['created_at'] as String),
    );
  }

  final String blockedId;
  final DateTime createdAt;
}
