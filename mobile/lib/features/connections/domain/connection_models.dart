class ConnectionRequestRow {
  const ConnectionRequestRow({
    required this.id,
    required this.requesterId,
    required this.recipientId,
    required this.status,
    this.respondedAt,
    required this.createdAt,
    this.updatedAt,
  });

  factory ConnectionRequestRow.fromJson(Map<String, dynamic> json) {
    return ConnectionRequestRow(
      id: _readString(json['id']),
      requesterId: _readString(json['requester_id']),
      recipientId: _readString(json['recipient_id']),
      status: _readString(json['status'], fallback: 'pending'),
      respondedAt: _parseDate(json['responded_at']),
      createdAt: _parseDate(json['created_at']) ?? DateTime.now(),
      updatedAt: _parseDate(json['updated_at']),
    );
  }

  final String id;
  final String requesterId;
  final String recipientId;
  final String status;
  final DateTime? respondedAt;
  final DateTime createdAt;
  final DateTime? updatedAt;

  bool get isPending => status == 'pending';
  bool get isAccepted => status == 'accepted';
  bool get isRejected => status == 'rejected';
  bool get isCancelled => status == 'cancelled';

  String get statusLabel => status.replaceAll('_', ' ');
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return DateTime.tryParse(value.trim())?.toLocal();
}
