class AdminStats {
  const AdminStats({
    this.totalUsers = 0,
    this.totalProviders = 0,
    this.totalSeekers = 0,
    this.totalOrders = 0,
    this.completedOrders = 0,
    this.cancelledOrders = 0,
    this.totalReviews = 0,
    this.averageRating = 0,
    this.totalHelpRequests = 0,
    this.averageTrustScore = 0,
  });

  factory AdminStats.fromJson(Map<String, dynamic> json) {
    return AdminStats(
      totalUsers: _toInt(json['totalUsers']),
      totalProviders: _toInt(json['totalProviders']),
      totalSeekers: _toInt(json['totalSeekers']),
      totalOrders: _toInt(json['totalOrders']),
      completedOrders: _toInt(json['completedOrders']),
      cancelledOrders: _toInt(json['cancelledOrders']),
      totalReviews: _toInt(json['totalReviews']),
      averageRating: _toDouble(json['averageRating']),
      totalHelpRequests: _toInt(json['totalHelpRequests']),
      averageTrustScore: _toDouble(json['averageTrustScore']),
    );
  }

  final int totalUsers;
  final int totalProviders;
  final int totalSeekers;
  final int totalOrders;
  final int completedOrders;
  final int cancelledOrders;
  final int totalReviews;
  final double averageRating;
  final int totalHelpRequests;
  final double averageTrustScore;
}

class AdminUser {
  const AdminUser({
    required this.id,
    this.name,
    this.email,
    this.role,
    this.location,
    this.onboardingCompleted = false,
    this.trustScore = 0,
    this.abuseReports = 0,
    this.createdAt,
  });

  factory AdminUser.fromJson(Map<String, dynamic> json) {
    return AdminUser(
      id: _readString(json['id']),
      name: _readStringOrNull(json['full_name']) ?? _readStringOrNull(json['name']),
      email: _readStringOrNull(json['email']),
      role: _readStringOrNull(json['role']),
      location: _readStringOrNull(json['location']),
      onboardingCompleted: json['onboarding_completed'] == true,
      trustScore: _toDouble(json['trust_score']),
      abuseReports: _toInt(json['abuse_reports']),
      createdAt: _parseDate(json['created_at']),
    );
  }

  final String id;
  final String? name;
  final String? email;
  final String? role;
  final String? location;
  final bool onboardingCompleted;
  final double trustScore;
  final int abuseReports;
  final DateTime? createdAt;
}

class AdminReport {
  const AdminReport({
    required this.id,
    this.userId,
    this.cardType,
    this.feedbackType,
    this.reason,
    this.createdAt,
  });

  factory AdminReport.fromJson(Map<String, dynamic> json) {
    return AdminReport(
      id: _readString(json['id']),
      userId: _readStringOrNull(json['user_id']),
      cardType: _readStringOrNull(json['card_type']),
      feedbackType: _readStringOrNull(json['feedback_type']),
      reason: _readStringOrNull(json['reason']),
      createdAt: _parseDate(json['created_at']),
    );
  }

  final String id;
  final String? userId;
  final String? cardType;
  final String? feedbackType;
  final String? reason;
  final DateTime? createdAt;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String? _readStringOrNull(Object? value) {
  if (value is! String) return null;
  final text = value.trim();
  return text.isEmpty ? null : text;
}

int _toInt(Object? value, {int fallback = 0}) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value) ?? fallback;
  return fallback;
}

double _toDouble(Object? value, {double fallback = 0}) {
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is num) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? fallback;
  return fallback;
}

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return DateTime.tryParse(value.trim())?.toLocal();
}
