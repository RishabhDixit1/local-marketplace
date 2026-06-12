class TransactionRecord {
  final String orderId;
  final String title;
  final double amount;
  final String paymentMethod;
  final String paymentStatus;
  final String orderStatus;
  final DateTime? createdAt;
  final String? providerName;

  const TransactionRecord({
    required this.orderId,
    required this.title,
    required this.amount,
    required this.paymentMethod,
    required this.paymentStatus,
    required this.orderStatus,
    this.createdAt,
    this.providerName,
  });

  factory TransactionRecord.fromOrderJson(Map<String, dynamic> json) {
    final meta = (json['metadata'] as Map<String, dynamic>?) ?? {};
    return TransactionRecord(
      orderId: (json['id'] as String?) ?? '',
      title: (meta['title'] as String?) ?? 'Order',
      amount: (json['price'] as num?)?.toDouble() ?? 0,
      paymentMethod: (meta['payment_method'] as String?) ?? '—',
      paymentStatus: (meta['payment_status'] as String?) ?? 'pending',
      orderStatus: (json['status'] as String?) ?? 'new_lead',
      createdAt: json['created_at'] != null ? DateTime.tryParse(json['created_at'] as String) : null,
      providerName: (meta['provider_name'] as String?) ?? (meta['title'] as String?) ?? 'Provider',
    );
  }

  String get statusLabel {
    switch (paymentStatus) {
      case 'paid': return 'Paid';
      case 'refunded': return 'Refunded';
      case 'failed': return 'Failed';
      default: return orderStatus.replaceAll('_', ' ');
    }
  }

  bool get isPaid => paymentStatus == 'paid';
  bool get isRefunded => paymentStatus == 'refunded';
}

class PaymentMethod {
  final String id;
  final String type; // 'razorpay', 'cod', 'stripe'
  final String label;
  final bool isDefault;

  const PaymentMethod({
    required this.id,
    required this.type,
    required this.label,
    this.isDefault = false,
  });
}
