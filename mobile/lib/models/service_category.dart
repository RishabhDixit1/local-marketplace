class ServiceCategory {
  const ServiceCategory({
    required this.id,
    required this.name,
    required this.slug,
    this.iconSlug,
    this.description,
    this.basePriceMin,
    this.basePriceMax,
    this.estimatedDurationMins,
    this.sortOrder = 0,
    this.providerCount,
  });

  factory ServiceCategory.fromJson(Map<String, dynamic> json) {
    return ServiceCategory(
      id: _readString(json['id']),
      name: _readString(json['name']),
      slug: _readString(json['slug']),
      iconSlug: _readString(json['icon_slug']),
      description: _readString(json['description']),
      basePriceMin: _toInt(json['base_price_min']),
      basePriceMax: _toInt(json['base_price_max']),
      estimatedDurationMins: _toInt(json['estimated_duration_mins']),
      sortOrder: _toInt(json['sort_order'], fallback: 0),
      providerCount: _toInt(json['provider_count']),
    );
  }

  final String id;
  final String name;
  final String slug;
  final String? iconSlug;
  final String? description;
  final int? basePriceMin;
  final int? basePriceMax;
  final int? estimatedDurationMins;
  final int sortOrder;
  final int? providerCount;

  String get priceRangeLabel {
    if (basePriceMin != null && basePriceMax != null) {
      if (basePriceMax! > basePriceMin!) {
        return '₹$basePriceMin–$basePriceMax';
      }
      return 'From ₹$basePriceMin';
    }
    if (basePriceMin != null) return 'From ₹$basePriceMin';
    if (basePriceMax != null) return 'Upto ₹$basePriceMax';
    return '';
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'slug': slug,
    'icon_slug': iconSlug,
    'description': description,
    'base_price_min': basePriceMin,
    'base_price_max': basePriceMax,
    'estimated_duration_mins': estimatedDurationMins,
    'sort_order': sortOrder,
  };
}

String _readString(dynamic value, {String fallback = ''}) {
  if (value is String && value.trim().isNotEmpty) return value.trim();
  return fallback;
}

int _toInt(dynamic value, {int? fallback}) {
  if (value is int) return value;
  if (value is double) return value.round();
  if (value is String) return int.tryParse(value) ?? (fallback ?? 0);
  return fallback ?? 0;
}
