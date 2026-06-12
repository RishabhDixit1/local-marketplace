class SearchResult {
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
  final bool featured;
  final List<SearchListing> listings;

  const SearchResult({
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
    this.featured = false,
    this.listings = const [],
  });

  factory SearchResult.fromJson(Map<String, dynamic> json) {
    return SearchResult(
      id: (json['id'] as String?) ?? '',
      name: (json['name'] as String?) ?? '',
      location: (json['location'] as String?) ?? '',
      lat: json['lat'] != null ? (json['lat'] as num).toDouble() : null,
      lng: json['lng'] != null ? (json['lng'] as num).toDouble() : null,
      avatarUrl: (json['avatarUrl'] as String?) ?? '',
      bio: (json['bio'] as String?) ?? '',
      role: (json['role'] as String?) ?? '',
      services: ((json['services'] as List?) ?? []).whereType<String>().toList(),
      avgRating: json['avgRating'] != null ? (json['avgRating'] as num).toDouble() : null,
      reviewCount: json['reviewCount'] is int ? json['reviewCount'] as int : 0,
      serviceCount: json['serviceCount'] is int ? json['serviceCount'] as int : 0,
      completedJobs: json['completedJobs'] is int ? json['completedJobs'] as int : 0,
      responseMinutes: json['responseMinutes'] != null ? json['responseMinutes'] as int : null,
      isOnline: json['isOnline'] is bool ? json['isOnline'] as bool : false,
      priceMin: json['priceMin'] != null ? (json['priceMin'] as num).toInt() : null,
      priceMax: json['priceMax'] != null ? (json['priceMax'] as num).toInt() : null,
      distanceKm: json['distanceKm'] != null ? (json['distanceKm'] as num).toDouble() : null,
      verified: json['verified'] is bool ? json['verified'] as bool : false,
      featured: json['featured'] is bool ? json['featured'] as bool : false,
      listings: ((json['listings'] as List?) ?? [])
          .whereType<Map>()
          .map((row) => SearchListing.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
    );
  }

  String get ratingLabel {
    if (avgRating == null || reviewCount == 0) return 'New';
    return '${avgRating!.toStringAsFixed(1)} ($reviewCount)';
  }

  String get priceLabel {
    if (priceMin == null) return '';
    if (priceMax != null && priceMax != priceMin) {
      return '₹$priceMin - ₹$priceMax';
    }
    return 'From ₹$priceMin';
  }
}

class SearchListing {
  final String id;
  final String title;
  final String category;
  final int? price;

  const SearchListing({
    required this.id,
    required this.title,
    this.category = '',
    this.price,
  });

  factory SearchListing.fromJson(Map<String, dynamic> json) {
    return SearchListing(
      id: (json['id'] as String?) ?? '',
      title: (json['title'] as String?) ?? '',
      category: (json['category'] as String?) ?? '',
      price: json['price'] != null ? (json['price'] as num).toInt() : null,
    );
  }
}

class SearchFacets {
  final List<CategoryFacet> categories;
  final int? minPrice;
  final int? maxPrice;
  final double avgRatingMin;
  final double avgRatingMax;
  final int totalProviders;
  final int onlineCount;

  const SearchFacets({
    this.categories = const [],
    this.minPrice,
    this.maxPrice,
    this.avgRatingMin = 0,
    this.avgRatingMax = 0,
    this.totalProviders = 0,
    this.onlineCount = 0,
  });

  factory SearchFacets.fromJson(Map<String, dynamic> json) {
    return SearchFacets(
      categories: ((json['categories'] as List?) ?? [])
          .whereType<Map>()
          .map((row) => CategoryFacet.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      minPrice: json['minPrice'] != null ? (json['minPrice'] as num).toInt() : null,
      maxPrice: json['maxPrice'] != null ? (json['maxPrice'] as num).toInt() : null,
      avgRatingMin: json['avgRatingRange']?['min'] != null
          ? (json['avgRatingRange']['min'] as num).toDouble()
          : 0,
      avgRatingMax: json['avgRatingRange']?['max'] != null
          ? (json['avgRatingRange']['max'] as num).toDouble()
          : 0,
      totalProviders: json['totalProviders'] is int ? json['totalProviders'] as int : 0,
      onlineCount: json['onlineCount'] is int ? json['onlineCount'] as int : 0,
    );
  }
}

class CategoryFacet {
  final String category;
  final int count;

  const CategoryFacet({required this.category, required this.count});

  factory CategoryFacet.fromJson(Map<String, dynamic> json) {
    return CategoryFacet(
      category: (json['category'] as String?) ?? '',
      count: json['count'] is int ? json['count'] as int : 0,
    );
  }
}

class SearchResponse {
  final List<SearchResult> providers;
  final SearchFacets facets;
  final int total;
  final int offset;
  final int limit;
  final bool hasMore;

  const SearchResponse({
    this.providers = const [],
    this.facets = const SearchFacets(),
    this.total = 0,
    this.offset = 0,
    this.limit = 50,
    this.hasMore = false,
  });

  factory SearchResponse.fromJson(Map<String, dynamic> json) {
    return SearchResponse(
      providers: ((json['providers'] as List?) ?? [])
          .whereType<Map>()
          .map((row) => SearchResult.fromJson(Map<String, dynamic>.from(row)))
          .toList(),
      facets: SearchFacets.fromJson(Map<String, dynamic>.from(json['facets'] as Map? ?? {})),
      total: json['pagination']?['total'] is int ? json['pagination']['total'] as int : 0,
      offset: json['pagination']?['offset'] is int ? json['pagination']['offset'] as int : 0,
      limit: json['pagination']?['limit'] is int ? json['pagination']['limit'] as int : 50,
      hasMore: json['pagination']?['hasMore'] is bool ? json['pagination']['hasMore'] as bool : false,
    );
  }
}
