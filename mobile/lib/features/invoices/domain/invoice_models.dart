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

class InvoiceDetail {
  const InvoiceDetail({
    required this.id,
    required this.invoiceNumber,
    required this.subtotalPaise,
    required this.commissionPaise,
    required this.taxPaise,
    required this.totalPaise,
    required this.status,
    required this.invoiceDate,
    required this.gstRate,
    required this.gstCgstPaise,
    required this.gstSgstPaise,
    required this.gstIgstPaise,
    this.serviceLabel,
  });

  factory InvoiceDetail.fromJson(Map<String, dynamic> json) {
    final ordersData = json['orders'];
    String? serviceLabel;
    if (ordersData is Map) {
      serviceLabel = _readStringOrNull(ordersData['service_label']);
    }

    return InvoiceDetail(
      id: _readString(json['id']),
      invoiceNumber: _readString(json['invoice_number']),
      subtotalPaise: _toInt(json['subtotal_paise']),
      commissionPaise: _toInt(json['commission_paise']),
      taxPaise: _toInt(json['tax_paise']),
      totalPaise: _toInt(json['total_paise']),
      status: _readString(json['status'], fallback: 'issued'),
      invoiceDate: _parseDate(json['invoice_date']) ?? DateTime.now(),
      gstRate: (json['gst_rate'] as num?)?.toDouble() ?? 18.0,
      gstCgstPaise: _toInt(json['gst_cgst_paise']),
      gstSgstPaise: _toInt(json['gst_sgst_paise']),
      gstIgstPaise: _toInt(json['gst_igst_paise']),
      serviceLabel: serviceLabel,
    );
  }

  final String id;
  final String invoiceNumber;
  final int subtotalPaise;
  final int commissionPaise;
  final int taxPaise;
  final int totalPaise;
  final String status;
  final DateTime invoiceDate;
  final double gstRate;
  final int gstCgstPaise;
  final int gstSgstPaise;
  final int gstIgstPaise;
  final String? serviceLabel;

  String _formatPaise(int paise) =>
      '₹${(paise / 100).toStringAsFixed(2)}';

  String get subtotalLabel => _formatPaise(subtotalPaise);
  String get commissionLabel => _formatPaise(commissionPaise);
  String get taxLabel => _formatPaise(taxPaise);
  String get totalLabel => _formatPaise(totalPaise);
  String get gstCgstLabel => _formatPaise(gstCgstPaise);
  String get gstSgstLabel => _formatPaise(gstSgstPaise);
  String get gstIgstLabel => _formatPaise(gstIgstPaise);
  String get gstRateLabel => '${gstRate.toStringAsFixed(0)}%';
}

class InvoiceGenerateResult {
  const InvoiceGenerateResult({
    required this.invoiceId,
    required this.invoiceNumber,
  });

  final String invoiceId;
  final String invoiceNumber;
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
