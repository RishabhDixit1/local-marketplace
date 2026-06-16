class InvoiceRecord {
  const InvoiceRecord({
    required this.id,
    required this.invoiceNumber,
    required this.totalPaise,
    required this.status,
    required this.invoiceDate,
    this.serviceLabel,
  });

  factory InvoiceRecord.fromJson(Map<String, dynamic> json) {
    final ordersData = json['orders'];
    String? serviceLabel;
    if (ordersData is Map) {
      serviceLabel = _readStringOrNull(ordersData['service_label']);
    }

    return InvoiceRecord(
      id: _readString(json['id']),
      invoiceNumber: _readString(json['invoice_number']),
      totalPaise: _toInt(json['total_paise']),
      status: _readString(json['status'], fallback: 'issued'),
      invoiceDate: _parseDate(json['invoice_date']) ?? DateTime.now(),
      serviceLabel: serviceLabel,
    );
  }

  final String id;
  final String invoiceNumber;
  final int totalPaise;
  final String status;
  final DateTime invoiceDate;
  final String? serviceLabel;

  String get amountLabel => '₹${(totalPaise / 100).toStringAsFixed(0)}';
  String get statusLabel => status.replaceAll('_', ' ');

  bool get isPaid => status == 'paid';
  bool get isCancelled => status == 'cancelled';
  bool get isRefunded => status == 'refunded';
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
