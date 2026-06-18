import '../../orders/domain/order_models.dart';

/// Aligns with web [CartItem] in [app/components/store/CartContext.tsx].
class MobileCartItem {
  const MobileCartItem({
    required this.key,
    required this.itemType,
    required this.itemId,
    required this.providerId,
    required this.providerName,
    required this.title,
    required this.price,
    required this.quantity,
  });

  final String key;
  final String itemType;
  final String itemId;
  final String providerId;
  final String providerName;
  final String title;
  final double price;
  final int quantity;

  MobileCheckoutItem toCheckoutItem() {
    return MobileCheckoutItem(
      providerId: providerId,
      itemType: itemType,
      itemId: itemId,
      title: title,
      price: price,
      quantity: quantity,
      providerName: providerName,
    );
  }

  factory MobileCartItem.fromCheckout(
    MobileCheckoutItem item, {
    required String providerName,
  }) {
    final name = providerName.trim();
    return MobileCartItem(
      key: item.cartKey,
      itemType: item.itemType,
      itemId: item.itemId,
      providerId: item.providerId,
      providerName: name.isEmpty ? 'Local provider' : name,
      title: item.title,
      price: item.price,
      quantity: item.quantity,
    );
  }

  factory MobileCartItem.fromJson(Map<String, dynamic> json) {
    return MobileCartItem(
      key: _readString(json['key']),
      itemType: _readString(json['itemType']),
      itemId: _readString(json['itemId']),
      providerId: _readString(json['providerId']),
      providerName: _readString(
        json['providerName'],
        fallback: 'Local provider',
      ),
      title: _readString(json['title'], fallback: 'Item'),
      price: _toDouble(json['price']),
      quantity: _toInt(json['quantity'], fallback: 1),
    );
  }

  factory MobileCartItem.fromServerJson(Map<String, dynamic> json) {
    final itemType = _readString(json['itemType']);
    final itemId = _readString(json['itemId']);
    return MobileCartItem(
      key: '$itemType:$itemId',
      itemType: itemType,
      itemId: itemId,
      providerId: _readString(json['providerId']),
      providerName: _readString(
        json['providerName'],
        fallback: 'Local provider',
      ),
      title: _readString(json['title'], fallback: 'Item'),
      price: _toDouble(json['price']),
      quantity: _toInt(json['quantity'], fallback: 1),
    );
  }

  Map<String, dynamic> toJson() {
    return {
      'key': key,
      'itemType': itemType,
      'itemId': itemId,
      'providerId': providerId,
      'providerName': providerName,
      'title': title,
      'price': price,
      'quantity': quantity,
    };
  }
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
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
