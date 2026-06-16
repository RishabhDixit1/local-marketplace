class SubscriptionPlan {
  const SubscriptionPlan({
    required this.id,
    required this.name,
    required this.description,
    required this.pricePaise,
    required this.interval,
    required this.features,
    required this.highlighted,
    required this.sortOrder,
    required this.active,
  });

  factory SubscriptionPlan.fromJson(Map<String, dynamic> json) {
    final featuresRaw = json['features'];
    return SubscriptionPlan(
      id: _readString(json['id']),
      name: _readString(json['name']),
      description: _readString(json['description']),
      pricePaise: _toInt(json['price_paise']),
      interval: _readString(json['interval'], fallback: 'month'),
      features: featuresRaw is List ? featuresRaw.whereType<String>().toList() : [],
      highlighted: json['highlighted'] == true,
      sortOrder: _toInt(json['sort_order']),
      active: json['active'] != false,
    );
  }

  final String id;
  final String name;
  final String description;
  final int pricePaise;
  final String interval;
  final List<String> features;
  final bool highlighted;
  final int sortOrder;
  final bool active;

  String get priceLabel {
    if (pricePaise <= 0) return 'Free';
    return '₹${(pricePaise / 100).toStringAsFixed(0)}';
  }

  String get intervalLabel {
    if (pricePaise <= 0) return '';
    return interval == 'year' ? '/yr' : '/mo';
  }

  bool get isFree => pricePaise <= 0;
}

class ProviderSubRecord {
  const ProviderSubRecord({
    required this.id,
    required this.providerId,
    required this.planId,
    required this.status,
    this.razorpayOrderId,
    this.currentPeriodStart,
    this.currentPeriodEnd,
    this.cancelledAt,
    this.plan,
  });

  factory ProviderSubRecord.fromJson(Map<String, dynamic> json) {
    return ProviderSubRecord(
      id: _readString(json['id']),
      providerId: _readString(json['provider_id']),
      planId: _readString(json['plan_id']),
      status: _readString(json['status'], fallback: 'active'),
      razorpayOrderId: _readStringOrNull(json['razorpay_order_id']),
      currentPeriodStart: _parseDate(json['current_period_start']),
      currentPeriodEnd: _parseDate(json['current_period_end']),
      cancelledAt: _parseDate(json['cancelled_at']),
      plan: json['plan'] != null
          ? SubscriptionPlan.fromJson(Map<String, dynamic>.from(json['plan']))
          : null,
    );
  }

  final String id;
  final String providerId;
  final String planId;
  final String status;
  final String? razorpayOrderId;
  final DateTime? currentPeriodStart;
  final DateTime? currentPeriodEnd;
  final DateTime? cancelledAt;
  final SubscriptionPlan? plan;

  bool get isActive => status == 'active';
  bool get isPastDue => status == 'past_due';
  String get statusLabel => status.replaceAll('_', ' ');
}

class SubscriptionPurchaseOrder {
  final String orderId;
  final int amount;
  final String currency;
  final String keyId;
  final SubscriptionPlan plan;

  const SubscriptionPurchaseOrder({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
    required this.plan,
  });

  factory SubscriptionPurchaseOrder.fromJson(Map<String, dynamic> json) {
    return SubscriptionPurchaseOrder(
      orderId: _readString(json['orderId']),
      amount: _toInt(json['amount']),
      currency: _readString(json['currency']),
      keyId: _readString(json['keyId']),
      plan: SubscriptionPlan.fromJson(
        Map<String, dynamic>.from(json['plan'] as Map? ?? {}),
      ),
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

DateTime? _parseDate(Object? value) {
  if (value is! String || value.trim().isEmpty) return null;
  return DateTime.tryParse(value.trim())?.toLocal();
}
