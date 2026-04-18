class MobileProfileSnapshot {
  const MobileProfileSnapshot({
    required this.userId,
    required this.email,
    required this.displayName,
    required this.publicPath,
    required this.linkedProviders,
    required this.roleFamily,
    required this.profile,
    required this.services,
    required this.products,
    required this.portfolio,
    required this.workHistory,
    required this.availability,
    required this.paymentMethods,
    required this.reviews,
    required this.averageRating,
    required this.reviewCount,
    required this.serviceCount,
    required this.productCount,
    required this.portfolioCount,
    required this.workHistoryCount,
    required this.availabilityCount,
    required this.paymentMethodCount,
    required this.completionPercent,
    required this.trustScore,
  });

  factory MobileProfileSnapshot.fromJson(Map<String, dynamic> json) {
    final account = Map<String, dynamic>.from(
      (json['account'] as Map?) ?? const <String, dynamic>{},
    );

    return MobileProfileSnapshot(
      userId: _readString(account['userId']),
      email: _readString(account['email']),
      displayName: _readString(account['displayName'], fallback: 'ServiQ member'),
      publicPath: _readString(account['publicPath']),
      linkedProviders: ((account['linkedProviders'] as List?) ?? const [])
          .whereType<String>()
          .map((entry) => entry.trim())
          .where((entry) => entry.isNotEmpty)
          .toList(),
      roleFamily: _readString(json['roleFamily'], fallback: 'seeker'),
      profile: MobileProfileRecord.fromJson(
        Map<String, dynamic>.from(
          (json['profile'] as Map?) ?? const <String, dynamic>{},
        ),
      ),
      services: ((json['services'] as List?) ?? const [])
          .whereType<Map>()
          .map((row) => MobileProfileService.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      products: ((json['products'] as List?) ?? const [])
          .whereType<Map>()
          .map((row) => MobileProfileProduct.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      portfolio: ((json['portfolio'] as List?) ?? const [])
          .whereType<Map>()
          .map((row) => MobileProfilePortfolioItem.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      workHistory: ((json['workHistory'] as List?) ?? const [])
          .whereType<Map>()
          .map((row) => MobileProfileWorkHistoryItem.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      availability: ((json['availability'] as List?) ?? const [])
          .whereType<Map>()
          .map((row) => MobileProfileAvailabilityItem.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      paymentMethods: ((json['paymentMethods'] as List?) ?? const [])
          .whereType<Map>()
          .map((row) => MobileProfilePaymentMethod.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      reviews: ((json['reviews'] as List?) ?? const [])
          .whereType<Map>()
          .map((row) => MobileProfileReview.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      averageRating: _toDouble(json['averageRating']),
      reviewCount: _toInt(json['reviewCount']),
      serviceCount: _toInt(json['serviceCount']),
      productCount: _toInt(json['productCount']),
      portfolioCount: _toInt(json['portfolioCount']),
      workHistoryCount: _toInt(json['workHistoryCount']),
      availabilityCount: _toInt(json['availabilityCount']),
      paymentMethodCount: _toInt(json['paymentMethodCount']),
      completionPercent: _toInt(json['completionPercent']),
      trustScore: _toInt(json['trustScore']),
    );
  }

  final String userId;
  final String email;
  final String displayName;
  final String publicPath;
  final List<String> linkedProviders;
  final String roleFamily;
  final MobileProfileRecord profile;
  final List<MobileProfileService> services;
  final List<MobileProfileProduct> products;
  final List<MobileProfilePortfolioItem> portfolio;
  final List<MobileProfileWorkHistoryItem> workHistory;
  final List<MobileProfileAvailabilityItem> availability;
  final List<MobileProfilePaymentMethod> paymentMethods;
  final List<MobileProfileReview> reviews;
  final double averageRating;
  final int reviewCount;
  final int serviceCount;
  final int productCount;
  final int portfolioCount;
  final int workHistoryCount;
  final int availabilityCount;
  final int paymentMethodCount;
  final int completionPercent;
  final int trustScore;

  String get roleLabel => roleFamily == 'provider'
      ? 'Marketplace provider'
      : 'Local member';
}

class MobileProfileRecord {
  const MobileProfileRecord({
    required this.fullName,
    required this.headline,
    required this.location,
    required this.bio,
    required this.avatarUrl,
    required this.phone,
    required this.website,
    required this.availability,
    required this.verificationLevel,
  });

  factory MobileProfileRecord.fromJson(Map<String, dynamic> json) {
    return MobileProfileRecord(
      fullName: _firstNonEmpty([
        _readString(json['full_name']),
        _readString(json['name']),
      ]),
      headline: _readString(json['headline']),
      location: _readString(json['location']),
      bio: _readString(json['bio']),
      avatarUrl: _readString(json['avatar_url']),
      phone: _readString(json['phone']),
      website: _readString(json['website']),
      availability: _readString(json['availability'], fallback: 'available'),
      verificationLevel: _readString(
        json['verification_level'],
        fallback: 'email',
      ),
    );
  }

  final String fullName;
  final String headline;
  final String location;
  final String bio;
  final String avatarUrl;
  final String phone;
  final String website;
  final String availability;
  final String verificationLevel;
}

class MobileProfileService {
  const MobileProfileService({
    required this.title,
    required this.price,
    required this.pricingType,
    required this.availability,
  });

  factory MobileProfileService.fromJson(Map<String, dynamic> json) {
    return MobileProfileService(
      title: _readString(json['title'], fallback: 'Untitled service'),
      price: _toDouble(json['price']),
      pricingType: _readString(json['pricing_type'], fallback: 'fixed'),
      availability: _readString(json['availability'], fallback: 'available'),
    );
  }

  final String title;
  final double price;
  final String pricingType;
  final String availability;
}

class MobileProfileProduct {
  const MobileProfileProduct({
    required this.title,
    required this.price,
    required this.stock,
    required this.deliveryMode,
  });

  factory MobileProfileProduct.fromJson(Map<String, dynamic> json) {
    return MobileProfileProduct(
      title: _readString(json['title'], fallback: 'Untitled product'),
      price: _toDouble(json['price']),
      stock: _toInt(json['stock']),
      deliveryMode: _readString(json['delivery_mode'], fallback: 'both'),
    );
  }

  final String title;
  final double price;
  final int stock;
  final String deliveryMode;
}

class MobileProfilePortfolioItem {
  const MobileProfilePortfolioItem({
    required this.title,
    required this.category,
  });

  factory MobileProfilePortfolioItem.fromJson(Map<String, dynamic> json) {
    return MobileProfilePortfolioItem(
      title: _readString(json['title'], fallback: 'Untitled project'),
      category: _readString(json['category'], fallback: 'Featured work'),
    );
  }

  final String title;
  final String category;
}

class MobileProfileWorkHistoryItem {
  const MobileProfileWorkHistoryItem({
    required this.roleTitle,
    required this.companyName,
    required this.isCurrent,
  });

  factory MobileProfileWorkHistoryItem.fromJson(Map<String, dynamic> json) {
    return MobileProfileWorkHistoryItem(
      roleTitle: _readString(json['role_title'], fallback: 'Independent work'),
      companyName: _readString(json['company_name'], fallback: 'ServiQ network'),
      isCurrent: json['is_current'] == true,
    );
  }

  final String roleTitle;
  final String companyName;
  final bool isCurrent;
}

class MobileProfileAvailabilityItem {
  const MobileProfileAvailabilityItem({
    required this.label,
    required this.availability,
    required this.daysOfWeek,
    required this.startTime,
    required this.endTime,
  });

  factory MobileProfileAvailabilityItem.fromJson(Map<String, dynamic> json) {
    return MobileProfileAvailabilityItem(
      label: _readString(json['label'], fallback: 'Availability'),
      availability: _readString(json['availability'], fallback: 'available'),
      daysOfWeek: ((json['days_of_week'] as List?) ?? const [])
          .whereType<String>()
          .map((entry) => entry.trim())
          .where((entry) => entry.isNotEmpty)
          .toList(),
      startTime: _readString(json['start_time']),
      endTime: _readString(json['end_time']),
    );
  }

  final String label;
  final String availability;
  final List<String> daysOfWeek;
  final String startTime;
  final String endTime;
}

class MobileProfilePaymentMethod {
  const MobileProfilePaymentMethod({
    required this.methodType,
    required this.providerName,
    required this.accountLabel,
    required this.isDefault,
    required this.isVerified,
  });

  factory MobileProfilePaymentMethod.fromJson(Map<String, dynamic> json) {
    return MobileProfilePaymentMethod(
      methodType: _readString(json['method_type'], fallback: 'bank_transfer'),
      providerName: _readString(json['provider_name']),
      accountLabel: _readString(json['account_label']),
      isDefault: json['is_default'] == true,
      isVerified: json['is_verified'] == true,
    );
  }

  final String methodType;
  final String providerName;
  final String accountLabel;
  final bool isDefault;
  final bool isVerified;
}

class MobileProfileReview {
  const MobileProfileReview({
    required this.rating,
    required this.comment,
  });

  factory MobileProfileReview.fromJson(Map<String, dynamic> json) {
    return MobileProfileReview(
      rating: _toDouble(json['rating']),
      comment: _readString(json['comment']),
    );
  }

  final double rating;
  final String comment;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

String _firstNonEmpty(List<String> values) {
  for (final value in values) {
    if (value.trim().isNotEmpty) {
      return value.trim();
    }
  }
  return '';
}

int _toInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}

double _toDouble(Object? value) {
  if (value is double) {
    return value;
  }
  if (value is int) {
    return value.toDouble();
  }
  if (value is num) {
    return value.toDouble();
  }
  if (value is String) {
    return double.tryParse(value) ?? 0;
  }
  return 0;
}
