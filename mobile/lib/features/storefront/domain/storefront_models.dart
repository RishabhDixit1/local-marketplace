class Storefront {
  const Storefront({
    required this.id,
    required this.ownerId,
    required this.name,
    this.category,
    this.description,
    this.coverUrl,
    this.galleryUrls = const [],
    this.address,
    this.latitude,
    this.longitude,
    this.operatingHours = const {},
    this.isVerified = false,
    this.isActive = true,
    this.localityId,
    this.ownerName,
    this.ownerAvatarUrl,
    this.ownerTrustScore,
    this.productCount,
    this.owner,
    required this.createdAt,
  });

  final String id;
  final String ownerId;
  final String name;
  final String? category;
  final String? description;
  final String? coverUrl;
  final List<String> galleryUrls;
  final String? address;
  final double? latitude;
  final double? longitude;
  final Map<String, dynamic> operatingHours;
  final bool isVerified;
  final bool isActive;
  final String? localityId;
  final String? ownerName;
  final String? ownerAvatarUrl;
  final double? ownerTrustScore;
  final int? productCount;
  final StorefrontOwner? owner;
  final DateTime createdAt;

  factory Storefront.fromJson(Map<String, dynamic> json) {
    return Storefront(
      id: json['id'] as String,
      ownerId: json['ownerId'] as String,
      name: json['name'] as String,
      category: json['category'] as String?,
      description: json['description'] as String?,
      coverUrl: json['coverUrl'] as String?,
      galleryUrls: (json['galleryUrls'] as List<dynamic>?)
              ?.map((e) => e as String)
              .toList() ??
          const [],
      address: json['address'] as String?,
      latitude: (json['latitude'] as num?)?.toDouble(),
      longitude: (json['longitude'] as num?)?.toDouble(),
      operatingHours: (json['operatingHours'] as Map<String, dynamic>?) ?? {},
      isVerified: json['isVerified'] as bool? ?? false,
      isActive: json['isActive'] as bool? ?? true,
      localityId: json['localityId'] as String?,
      ownerName: json['ownerName'] as String?,
      ownerAvatarUrl: json['ownerAvatarUrl'] as String?,
      ownerTrustScore: (json['ownerTrustScore'] as num?)?.toDouble(),
      productCount: json['productCount'] as int?,
      owner: json['owner'] != null
          ? StorefrontOwner.fromJson(json['owner'] as Map<String, dynamic>)
          : null,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}

class StorefrontOwner {
  const StorefrontOwner({
    required this.id,
    this.fullName,
    this.avatarUrl,
    this.trustScore,
    this.verificationStatus,
    this.bio,
    this.phone,
  });

  final String id;
  final String? fullName;
  final String? avatarUrl;
  final double? trustScore;
  final String? verificationStatus;
  final String? bio;
  final String? phone;

  factory StorefrontOwner.fromJson(Map<String, dynamic> json) {
    return StorefrontOwner(
      id: json['id'] as String,
      fullName: json['fullName'] as String?,
      avatarUrl: json['avatarUrl'] as String?,
      trustScore: (json['trustScore'] as num?)?.toDouble(),
      verificationStatus: json['verificationStatus'] as String?,
      bio: json['bio'] as String?,
      phone: json['phone'] as String?,
    );
  }
}

class StorefrontProduct {
  const StorefrontProduct({
    required this.id,
    required this.providerId,
    this.storefrontId,
    required this.title,
    this.description,
    this.category,
    this.price,
    this.stock = 0,
    this.deliveryMethod,
    this.imageUrl,
    this.storefrontName,
    this.storefrontVerified,
    required this.createdAt,
  });

  final String id;
  final String providerId;
  final String? storefrontId;
  final String title;
  final String? description;
  final String? category;
  final double? price;
  final int stock;
  final String? deliveryMethod;
  final String? imageUrl;
  final String? storefrontName;
  final bool? storefrontVerified;
  final DateTime createdAt;

  bool get isActive => stock > 0;

  String get priceLabel {
    if (price == null) return '';
    if (price == price!.roundToDouble()) {
      return '\u20B9${price!.toInt()}';
    }
    return '\u20B9${price!.toStringAsFixed(0)}';
  }

  factory StorefrontProduct.fromJson(Map<String, dynamic> json) {
    return StorefrontProduct(
      id: json['id'] as String,
      providerId: json['providerId'] as String,
      storefrontId: json['storefrontId'] as String?,
      title: json['title'] as String,
      description: json['description'] as String?,
      category: json['category'] as String?,
      price: (json['price'] as num?)?.toDouble(),
      stock: json['stock'] as int? ?? 0,
      deliveryMethod: json['deliveryMethod'] as String?,
      imageUrl: json['imageUrl'] as String?,
      storefrontName: json['storefrontName'] as String?,
      storefrontVerified: json['storefrontVerified'] as bool?,
      createdAt: DateTime.tryParse(json['createdAt'] as String? ?? '') ??
          DateTime.now(),
    );
  }
}
