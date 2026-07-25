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

class AdminListing {
  const AdminListing({
    required this.id,
    required this.title,
    this.type = 'post',
    this.ownerName,
    this.ownerId,
    this.category,
    this.status = 'active',
    this.isFlagged = false,
    this.isRemoved = false,
    this.createdAt,
  });

  factory AdminListing.fromJson(Map<String, dynamic> json) {
    return AdminListing(
      id: _readString(json['id']),
      title: _readString(json['title'], fallback: 'Untitled'),
      type: _readString(json['type'], fallback: 'post'),
      ownerName: _readStringOrNull(json['owner_name']),
      ownerId: _readStringOrNull(json['owner_id']),
      category: _readStringOrNull(json['category']),
      status: _readString(json['status'], fallback: 'active'),
      isFlagged: json['is_flagged'] == true,
      isRemoved: json['is_removed'] == true,
      createdAt: _parseDate(json['created_at']),
    );
  }

  final String id;
  final String title;
  final String type;
  final String? ownerName;
  final String? ownerId;
  final String? category;
  final String status;
  final bool isFlagged;
  final bool isRemoved;
  final DateTime? createdAt;
}

class AdminOrder {
  const AdminOrder({
    required this.id,
    this.status = 'new_lead',
    this.deliveryStatus,
    this.price = 0,
    this.fee = 0,
    this.paymentStatus,
    this.providerName,
    this.consumerName,
    this.createdAt,
  });

  factory AdminOrder.fromJson(Map<String, dynamic> json) {
    return AdminOrder(
      id: _readString(json['id']),
      status: _readString(json['status'], fallback: 'new_lead'),
      deliveryStatus: _readStringOrNull(json['delivery_status']),
      price: _toDouble(json['price']),
      fee: _toDouble(json['fee']),
      paymentStatus: _readStringOrNull(json['payment_status']),
      providerName: _readStringOrNull(json['provider_name']),
      consumerName: _readStringOrNull(json['consumer_name']),
      createdAt: _parseDate(json['created_at']),
    );
  }

  final String id;
  final String status;
  final String? deliveryStatus;
  final double price;
  final double fee;
  final String? paymentStatus;
  final String? providerName;
  final String? consumerName;
  final DateTime? createdAt;
}

class AdminDispute {
  const AdminDispute({
    required this.id,
    this.orderId,
    this.reason,
    this.description,
    this.filedBy,
    this.status = 'open',
    this.orderValue = 0,
    this.createdAt,
  });

  factory AdminDispute.fromJson(Map<String, dynamic> json) {
    return AdminDispute(
      id: _readString(json['id']),
      orderId: _readStringOrNull(json['order_id']),
      reason: _readStringOrNull(json['reason']),
      description: _readStringOrNull(json['description']),
      filedBy: _readStringOrNull(json['filed_by']),
      status: _readString(json['status'], fallback: 'open'),
      orderValue: _toDouble(json['order_value']),
      createdAt: _parseDate(json['created_at']),
    );
  }

  final String id;
  final String? orderId;
  final String? reason;
  final String? description;
  final String? filedBy;
  final String status;
  final double orderValue;
  final DateTime? createdAt;
}

class AdminVerification {
  const AdminVerification({
    required this.id,
    this.applicantName,
    this.documentType,
    this.email,
    this.phone,
    this.documentUrl,
    this.createdAt,
  });

  factory AdminVerification.fromJson(Map<String, dynamic> json) {
    return AdminVerification(
      id: _readString(json['id']),
      applicantName: _readStringOrNull(json['applicant_name']),
      documentType: _readStringOrNull(json['document_type']),
      email: _readStringOrNull(json['email']),
      phone: _readStringOrNull(json['phone']),
      documentUrl: _readStringOrNull(json['document_url']),
      createdAt: _parseDate(json['created_at']),
    );
  }

  final String id;
  final String? applicantName;
  final String? documentType;
  final String? email;
  final String? phone;
  final String? documentUrl;
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
