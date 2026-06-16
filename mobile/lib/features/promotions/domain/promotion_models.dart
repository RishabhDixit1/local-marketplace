class BoostPlacement {
  const BoostPlacement({
    required this.id,
    this.listingId,
    required this.startsAt,
    required this.endsAt,
    required this.active,
    this.pricePaise,
    required this.createdAt,
    required this.placementType,
  });

  factory BoostPlacement.fromJson(Map<String, dynamic> json) {
    return BoostPlacement(
      id: _readString(json['id']),
      listingId: _readStringOrNull(json['listing_id']),
      startsAt: DateTime.parse(json['starts_at'] as String).toLocal(),
      endsAt: DateTime.parse(json['ends_at'] as String).toLocal(),
      active: json['active'] == true,
      pricePaise: _toIntOrNull(json['price_paise']),
      createdAt: DateTime.parse(json['created_at'] as String).toLocal(),
      placementType: _readString(json['placement_type'], fallback: 'feed_boost'),
    );
  }

  final String id;
  final String? listingId;
  final DateTime startsAt;
  final DateTime endsAt;
  final bool active;
  final int? pricePaise;
  final DateTime createdAt;
  final String placementType;

  bool get isExpired => endsAt.isBefore(DateTime.now());
  bool get isUpcoming => startsAt.isAfter(DateTime.now());
}

class BoostPlanOption {
  const BoostPlanOption({
    required this.duration,
    required this.label,
    required this.days,
    required this.pricePaise,
  });

  factory BoostPlanOption.fromEntry(String duration, Map<String, dynamic> json) {
    return BoostPlanOption(
      duration: duration,
      label: _readString(json['label']),
      days: _toInt(json['days']),
      pricePaise: _toInt(json['pricePaise']),
    );
  }

  final String duration;
  final String label;
  final int days;
  final int pricePaise;

  String get priceLabel => '₹${(pricePaise / 100).toStringAsFixed(0)}';
}

class BoostData {
  const BoostData({
    required this.active,
    required this.upcoming,
    required this.expired,
    required this.remainingBoosts,
    required this.plans,
  });

  factory BoostData.fromJson(Map<String, dynamic> json) {
    final plansMap = (json['plans'] as Map<String, dynamic>?) ?? {};
    return BoostData(
      active: _parsePlacements(json['active']),
      upcoming: _parsePlacements(json['upcoming']),
      expired: _parsePlacements(json['expired']),
      remainingBoosts: _toInt(json['remainingBoosts']),
      plans: plansMap.entries
          .map((e) => BoostPlanOption.fromEntry(e.key, Map<String, dynamic>.from(e.value)))
          .toList(),
    );
  }

  final List<BoostPlacement> active;
  final List<BoostPlacement> upcoming;
  final List<BoostPlacement> expired;
  final int remainingBoosts;
  final List<BoostPlanOption> plans;

  static List<BoostPlacement> _parsePlacements(Object? raw) {
    final list = raw as List? ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(BoostPlacement.fromJson)
        .toList();
  }
}

class BoostPurchaseOrder {
  final String orderId;
  final int amount;
  final String currency;
  final String keyId;
  final String duration;
  final int days;

  const BoostPurchaseOrder({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
    required this.duration,
    required this.days,
  });

  factory BoostPurchaseOrder.fromJson(Map<String, dynamic> json) {
    return BoostPurchaseOrder(
      orderId: _readString(json['orderId']),
      amount: _toInt(json['amount']),
      currency: _readString(json['currency']),
      keyId: _readString(json['keyId']),
      duration: _readString(json['duration']),
      days: _toInt(json['days']),
    );
  }
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

int? _toIntOrNull(Object? value) {
  if (value is int) return value;
  if (value is num) return value.toInt();
  if (value is String) return int.tryParse(value);
  return null;
}
