class ProviderReviewItem {
  const ProviderReviewItem({
    required this.id,
    required this.rating,
    this.comment,
    this.createdAt,
    this.reviewerId,
    this.isVerifiedPurchase = false,
    this.photos = const [],
    this.helpfulCount = 0,
    this.notHelpfulCount = 0,
  });

  factory ProviderReviewItem.fromJson(Map<String, dynamic> json) {
    return ProviderReviewItem(
      id: _readString(json['id']),
      rating: _toDouble(json['rating']),
      comment: json['comment'] as String?,
      createdAt: json['createdAt'] as String?,
      reviewerId: json['reviewerId'] as String?,
      isVerifiedPurchase: json['isVerifiedPurchase'] == true,
      photos: ((json['photos'] as List?) ?? []).whereType<String>().toList(),
      helpfulCount: _toInt(json['helpfulCount']),
      notHelpfulCount: _toInt(json['notHelpfulCount']),
    );
  }

  final String id;
  final double rating;
  final String? comment;
  final String? createdAt;
  final String? reviewerId;
  final bool isVerifiedPurchase;
  final List<String> photos;
  final int helpfulCount;
  final int notHelpfulCount;

  String get formattedDate {
    if (createdAt == null) return '';
    final dt = DateTime.tryParse(createdAt!);
    if (dt == null) return '';
    final months = [
      'Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun',
      'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'
    ];
    return '${dt.day} ${months[dt.month - 1]} ${dt.year}';
  }
}

int _toInt(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _toDouble(Object? value) {
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? 0;
  return 0;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}
