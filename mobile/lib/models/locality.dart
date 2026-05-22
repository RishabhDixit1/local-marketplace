class Locality {
  const Locality({
    required this.id,
    required this.name,
    required this.slug,
    required this.zoneType,
    required this.phase,
    this.lat,
    this.lng,
    this.radiusKm = 1.0,
    this.city = 'Ghaziabad',
    this.state = 'Uttar Pradesh',
    this.providerCount,
  });

  factory Locality.fromJson(Map<String, dynamic> json) {
    return Locality(
      id: _readString(json['id']),
      name: _readString(json['name']),
      slug: _readString(json['slug']),
      zoneType: _readString(json['zone_type'], fallback: 'society'),
      phase: _toInt(json['phase'], fallback: 1),
      lat: _toDouble(json['lat']),
      lng: _toDouble(json['lng']),
      radiusKm: _toDouble(json['radius_km'], fallback: 1.0),
      city: _readString(json['city'], fallback: 'Ghaziabad'),
      state: _readString(json['state'], fallback: 'Uttar Pradesh'),
      providerCount: _toInt(json['provider_count']),
    );
  }

  final String id;
  final String name;
  final String slug;
  final String zoneType;
  final int phase;
  final double? lat;
  final double? lng;
  final double radiusKm;
  final String city;
  final String state;
  final int? providerCount;

  ZoneType get zoneTypeEnum {
    switch (zoneType) {
      case 'society':
        return ZoneType.society;
      case 'market':
        return ZoneType.market;
      case 'supply_area':
        return ZoneType.supplyArea;
      case 'expansion':
        return ZoneType.expansion;
      default:
        return ZoneType.society;
    }
  }

  Map<String, dynamic> toJson() => {
    'id': id,
    'name': name,
    'slug': slug,
    'zone_type': zoneType,
    'phase': phase,
    'lat': lat,
    'lng': lng,
    'radius_km': radiusKm,
    'city': city,
    'state': state,
  };
}

enum ZoneType { society, market, supplyArea, expansion }

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

double _toDouble(dynamic value, {double? fallback}) {
  if (value is double) return value;
  if (value is int) return value.toDouble();
  if (value is String) return double.tryParse(value) ?? (fallback ?? 0.0);
  return fallback ?? 0.0;
}
