enum MobileProviderListingType {
  service,
  product;

  String get apiValue => name;

  String get label => this == service ? 'Service' : 'Product';
}

class MobileProviderListingsSnapshot {
  const MobileProviderListingsSnapshot({
    required this.services,
    required this.products,
    required this.stats,
    required this.compatibilityMode,
    required this.strippedColumns,
  });

  factory MobileProviderListingsSnapshot.fromJson(Map<String, dynamic> json) {
    return MobileProviderListingsSnapshot(
      services: ((json['services'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (row) => MobileProviderServiceListing.fromJson(
              Map<String, dynamic>.from(row),
            ),
          )
          .toList(),
      products: ((json['products'] as List?) ?? const [])
          .whereType<Map>()
          .map(
            (row) => MobileProviderProductListing.fromJson(
              Map<String, dynamic>.from(row),
            ),
          )
          .toList(),
      stats: MobileProviderListingsStats.fromJson(
        Map<String, dynamic>.from(
          (json['stats'] as Map?) ?? const <String, dynamic>{},
        ),
      ),
      compatibilityMode: json['compatibilityMode'] == true,
      strippedColumns: ((json['strippedColumns'] as List?) ?? const [])
          .whereType<String>()
          .map((value) => value.trim())
          .where((value) => value.isNotEmpty)
          .toList(),
    );
  }

  final List<MobileProviderServiceListing> services;
  final List<MobileProviderProductListing> products;
  final MobileProviderListingsStats stats;
  final bool compatibilityMode;
  final List<String> strippedColumns;

  int get totalCount => services.length + products.length;
}

class MobileProviderListingsStats {
  const MobileProviderListingsStats({
    required this.totalServices,
    required this.activeServices,
    required this.totalProducts,
    required this.activeProducts,
  });

  factory MobileProviderListingsStats.fromJson(Map<String, dynamic> json) {
    return MobileProviderListingsStats(
      totalServices: _toInt(json['totalServices']),
      activeServices: _toInt(json['activeServices']),
      totalProducts: _toInt(json['totalProducts']),
      activeProducts: _toInt(json['activeProducts']),
    );
  }

  final int totalServices;
  final int activeServices;
  final int totalProducts;
  final int activeProducts;
}

class MobileProviderServiceListing {
  const MobileProviderServiceListing({
    required this.id,
    required this.providerId,
    required this.title,
    required this.description,
    required this.category,
    required this.price,
    required this.availability,
    required this.pricingType,
    required this.createdAt,
    required this.updatedAt,
  });

  factory MobileProviderServiceListing.fromJson(Map<String, dynamic> json) {
    return MobileProviderServiceListing(
      id: _readString(json['id']),
      providerId: _readString(json['providerId']),
      title: _readString(json['title'], fallback: 'Untitled service'),
      description: _readString(json['description']),
      category: _readString(json['category'], fallback: 'Service'),
      price: _toDouble(json['price']),
      availability: _readString(json['availability'], fallback: 'available'),
      pricingType: _readString(json['pricingType'], fallback: 'fixed'),
      createdAt: _parseDate(json['createdAt']),
      updatedAt: _parseDate(json['updatedAt']),
    );
  }

  final String id;
  final String providerId;
  final String title;
  final String description;
  final String category;
  final double price;
  final String availability;
  final String pricingType;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get isActive => availability.trim().toLowerCase() != 'offline';

  String get priceLabel => _formatPrice(price);

  Map<String, dynamic> toDraft({String? availabilityOverride}) {
    return {
      'title': title,
      'description': description,
      'category': category,
      'price': price,
      'availability': availabilityOverride ?? availability,
      'pricingType': pricingType,
    };
  }
}

class MobileProviderProductListing {
  const MobileProviderProductListing({
    required this.id,
    required this.providerId,
    required this.title,
    required this.description,
    required this.category,
    required this.price,
    required this.stock,
    required this.deliveryMethod,
    required this.imageUrl,
    required this.createdAt,
    required this.updatedAt,
  });

  factory MobileProviderProductListing.fromJson(Map<String, dynamic> json) {
    return MobileProviderProductListing(
      id: _readString(json['id']),
      providerId: _readString(json['providerId']),
      title: _readString(json['title'], fallback: 'Untitled product'),
      description: _readString(json['description']),
      category: _readString(json['category'], fallback: 'Product'),
      price: _toDouble(json['price']),
      stock: _toInt(json['stock']),
      deliveryMethod: _readString(json['deliveryMethod'], fallback: 'pickup'),
      imageUrl: _readString(json['imageUrl']),
      createdAt: _parseDate(json['createdAt']),
      updatedAt: _parseDate(json['updatedAt']),
    );
  }

  final String id;
  final String providerId;
  final String title;
  final String description;
  final String category;
  final double price;
  final int stock;
  final String deliveryMethod;
  final String imageUrl;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  bool get isActive => stock > 0;

  String get priceLabel => _formatPrice(price);

  Map<String, dynamic> toDraft({int? stockOverride, String? imageOverride}) {
    return {
      'title': title,
      'description': description,
      'category': category,
      'price': price,
      'stock': stockOverride ?? stock,
      'deliveryMethod': deliveryMethod,
      'imageUrl': imageOverride ?? imageUrl,
    };
  }
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
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

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) {
    return null;
  }
  return DateTime.tryParse(value.trim())?.toLocal();
}

String _formatPrice(double value) {
  if (value <= 0) {
    return 'Price on request';
  }
  return 'INR ${value.round()}';
}
