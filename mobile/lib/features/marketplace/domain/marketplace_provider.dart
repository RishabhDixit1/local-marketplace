class MarketplaceProviderListing {
  final String id;
  final String title;
  final int? price;

  const MarketplaceProviderListing({
    required this.id,
    required this.title,
    this.price,
  });

  factory MarketplaceProviderListing.fromJson(Map<String, dynamic> json) {
    return MarketplaceProviderListing(
      id: (json['id'] as String?) ?? '',
      title: (json['title'] as String?) ?? '',
      price: json['price'] != null
          ? (json['price'] as num).toInt()
          : null,
    );
  }
}

class MarketplaceProvider {
  final String id;
  final String name;
  final String location;
  final double? lat;
  final double? lng;
  final String avatarUrl;
  final String bio;
  final String role;
  final List<String> services;
  final double? avgRating;
  final int reviewCount;
  final int serviceCount;
  final int completedJobs;
  final int? responseMinutes;
  final bool isOnline;
  final int? priceMin;
  final int? priceMax;
  final double? distanceKm;
  final bool verified;
  final List<MarketplaceProviderListing> listings;

  const MarketplaceProvider({
    required this.id,
    required this.name,
    this.location = '',
    this.lat,
    this.lng,
    this.avatarUrl = '',
    this.bio = '',
    this.role = '',
    this.services = const [],
    this.avgRating,
    this.reviewCount = 0,
    this.serviceCount = 0,
    this.completedJobs = 0,
    this.responseMinutes,
    this.isOnline = false,
    this.priceMin,
    this.priceMax,
    this.distanceKm,
    this.verified = false,
    this.listings = const [],
  });

  factory MarketplaceProvider.fromJson(Map<String, dynamic> json) {
    return MarketplaceProvider(
      id: (json['id'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      location: (json['location'] as String?) ?? '',
      lat: json['lat'] != null ? (json['lat'] as num).toDouble() : null,
      lng: json['lng'] != null ? (json['lng'] as num).toDouble() : null,
      avatarUrl: (json['avatarUrl'] as String?) ?? '',
      bio: (json['bio'] as String?) ?? '',
      role: (json['role'] as String?) ?? '',
      services: ((json['services'] as List?) ?? [])
          .whereType<String>()
          .toList(),
      avgRating: json['avgRating'] != null
          ? (json['avgRating'] as num).toDouble()
          : null,
      reviewCount: json['reviewCount'] is int
          ? json['reviewCount'] as int
          : 0,
      serviceCount: json['serviceCount'] is int
          ? json['serviceCount'] as int
          : 0,
      completedJobs: json['completedJobs'] is int
          ? json['completedJobs'] as int
          : 0,
      responseMinutes: json['responseMinutes'] != null
          ? json['responseMinutes'] as int
          : null,
      isOnline: json['isOnline'] is bool ? json['isOnline'] as bool : false,
      priceMin: json['priceMin'] != null
          ? (json['priceMin'] as num).toInt()
          : null,
      priceMax: json['priceMax'] != null
          ? (json['priceMax'] as num).toInt()
          : null,
      distanceKm: json['distanceKm'] != null
          ? (json['distanceKm'] as num).toDouble()
          : null,
      verified: json['verified'] is bool ? json['verified'] as bool : false,
      listings: ((json['listings'] as List?) ?? [])
          .whereType<Map>()
          .map((row) => MarketplaceProviderListing.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
    );
  }
}
