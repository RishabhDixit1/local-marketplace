enum MobileOrderPaymentMethod {
  cod,
  razorpay;

  String get apiValue => name;

  String get label => this == cod ? 'Cash on delivery' : 'Razorpay';
}

enum MobileOrderFulfillmentMethod {
  pickup,
  delivery,
  onsite;

  String get apiValue {
    switch (this) {
      case MobileOrderFulfillmentMethod.pickup:
        return 'self';
      case MobileOrderFulfillmentMethod.delivery:
      case MobileOrderFulfillmentMethod.onsite:
        return 'provider';
    }
  }

  String get label {
    switch (this) {
      case MobileOrderFulfillmentMethod.pickup:
        return 'Pickup';
      case MobileOrderFulfillmentMethod.delivery:
        return 'Delivery';
      case MobileOrderFulfillmentMethod.onsite:
        return 'On-site';
    }
  }
}

class MobileOrderRecord {
  const MobileOrderRecord({
    required this.id,
    required this.status,
    required this.price,
    required this.listingType,
    required this.consumerId,
    required this.providerId,
    required this.metadata,
    required this.createdAt,
    required this.updatedAt,
  });

  factory MobileOrderRecord.fromJson(Map<String, dynamic> json) {
    return MobileOrderRecord(
      id: _readString(json['id']),
      status: _readString(json['status'], fallback: 'new_lead'),
      price: _toDouble(json['price']),
      listingType: _readString(json['listing_type'], fallback: 'order'),
      consumerId: _readString(json['consumer_id']),
      providerId: _readString(json['provider_id']),
      metadata: _readMap(json['metadata']),
      createdAt: _parseDate(json['created_at']),
      updatedAt: _parseDate(json['updated_at']),
    );
  }

  final String id;
  final String status;
  final double price;
  final String listingType;
  final String consumerId;
  final String providerId;
  final Map<String, dynamic> metadata;
  final DateTime? createdAt;
  final DateTime? updatedAt;

  String get title => _readString(metadata['title'], fallback: 'Order');

  String get notes => _readString(metadata['notes']);

  String get address => _readString(metadata['address']);

  String get paymentMethod => _readString(metadata['payment_method']);

  String get paymentStatus =>
      _readString(metadata['payment_status'], fallback: 'unpaid');

  String get fulfillmentMethod => _readString(metadata['fulfillment_method']);

  String get fulfillmentStatus => _readString(metadata['fulfillment_status']);

  String get fulfillmentStatusLabel =>
      _readString(metadata['fulfillment_status_label']);

  int get quantity => _toInt(metadata['quantity'], fallback: 1);
}

class MobileCheckoutItem {
  const MobileCheckoutItem({
    required this.providerId,
    required this.itemType,
    required this.itemId,
    required this.title,
    required this.price,
    this.quantity = 1,
  });

  final String providerId;
  final String itemType;
  final String itemId;
  final String title;
  final double price;
  final int quantity;
}

class MobileCheckoutRequest {
  const MobileCheckoutRequest({
    required this.item,
    required this.address,
    required this.notes,
    required this.paymentMethod,
    required this.fulfillmentMethod,
    this.razorpayOrderId,
  });

  final MobileCheckoutItem item;
  final String address;
  final String notes;
  final MobileOrderPaymentMethod paymentMethod;
  final MobileOrderFulfillmentMethod fulfillmentMethod;
  final String? razorpayOrderId;

  Map<String, dynamic> toJson() {
    return {
      'providerId': item.providerId,
      'itemType': item.itemType,
      'itemId': item.itemId,
      'title': item.title,
      'price': item.price,
      'quantity': item.quantity,
      'address': address,
      'notes': notes,
      'payment_method': paymentMethod.apiValue,
      'payment_status': paymentMethod == MobileOrderPaymentMethod.cod
          ? 'cod_due'
          : 'pending',
      'fulfillment_method': fulfillmentMethod.apiValue,
      if ((razorpayOrderId ?? '').trim().isNotEmpty)
        'razorpay_order_id': razorpayOrderId!.trim(),
    };
  }
}

class MobileCheckoutResult {
  const MobileCheckoutResult({required this.orderIds, required this.count});

  factory MobileCheckoutResult.fromJson(Map<String, dynamic> json) {
    return MobileCheckoutResult(
      orderIds: ((json['orderIds'] as List?) ?? const [])
          .whereType<String>()
          .map((value) => value.trim())
          .where((value) => value.isNotEmpty)
          .toList(),
      count: _toInt(json['count']),
    );
  }

  final List<String> orderIds;
  final int count;
}

class MobileRazorpayOrder {
  const MobileRazorpayOrder({
    required this.orderId,
    required this.amount,
    required this.currency,
    required this.keyId,
  });

  factory MobileRazorpayOrder.fromJson(Map<String, dynamic> json) {
    return MobileRazorpayOrder(
      orderId: _readString(json['orderId']),
      amount: _toInt(json['amount']),
      currency: _readString(json['currency'], fallback: 'INR'),
      keyId: _readString(json['keyId']),
    );
  }

  final String orderId;
  final int amount;
  final String currency;
  final String keyId;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}

Map<String, dynamic> _readMap(Object? value) {
  if (value is Map<String, dynamic>) {
    return value;
  }
  if (value is Map) {
    return value.map((key, value) => MapEntry(key.toString(), value));
  }
  return const <String, dynamic>{};
}

int _toInt(Object? value, {int fallback = 0}) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? fallback;
  }
  return fallback;
}

double _toDouble(Object? value) {
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
