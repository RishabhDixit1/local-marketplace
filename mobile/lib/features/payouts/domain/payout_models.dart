class PayoutAccount {
  const PayoutAccount({
    required this.id,
    required this.accountType,
    this.accountHolderName,
    this.bankName,
    this.accountNumber,
    this.ifscCode,
    this.upiHandle,
    this.isDefault = false,
    this.isVerified = false,
  });

  factory PayoutAccount.fromJson(Map<String, dynamic> json) {
    return PayoutAccount(
      id: _readString(json['id']),
      accountType: _readString(json['account_type'], fallback: 'bank'),
      accountHolderName: _readString(json['account_holder_name']),
      bankName: _readString(json['bank_name']),
      accountNumber: _readString(json['account_number']),
      ifscCode: _readString(json['ifsc_code']),
      upiHandle: _readString(json['upi_handle']),
      isDefault: json['is_default'] == true,
      isVerified: json['is_verified'] == true,
    );
  }

  final String id;
  final String accountType;
  final String? accountHolderName;
  final String? bankName;
  final String? accountNumber;
  final String? ifscCode;
  final String? upiHandle;
  final bool isDefault;
  final bool isVerified;

  String get displayName {
    if (accountType == 'upi') {
      return upiHandle ?? 'UPI';
    }
    final number = accountNumber ?? '';
    final masked = number.length > 4 ? 'XXXX${number.substring(number.length - 4)}' : number;
    final ifsc = ifscCode ?? '';
    return '$masked / $ifsc';
  }
}

class PayoutTransaction {
  const PayoutTransaction({
    required this.id,
    required this.amountPaise,
    this.feePaise = 0,
    this.netAmountPaise = 0,
    required this.status,
    this.payoutMethod = 'bank',
    this.payoutDetail,
    this.notes,
    this.processedAt,
    required this.createdAt,
  });

  factory PayoutTransaction.fromJson(Map<String, dynamic> json) {
    return PayoutTransaction(
      id: _readString(json['id']),
      amountPaise: _toInt(json['amount_paise']),
      feePaise: _toInt(json['fee_paise']),
      netAmountPaise: _toInt(json['net_amount_paise']),
      status: _readString(json['status'], fallback: 'pending'),
      payoutMethod: _readString(json['payout_method'], fallback: 'bank'),
      payoutDetail: _readString(json['payout_detail']),
      notes: _readString(json['notes']),
      processedAt: _parseDate(json['processed_at']),
      createdAt: _parseDate(json['created_at']) ?? DateTime.now(),
    );
  }

  final String id;
  final int amountPaise;
  final int feePaise;
  final int netAmountPaise;
  final String status;
  final String payoutMethod;
  final String? payoutDetail;
  final String? notes;
  final DateTime? processedAt;
  final DateTime createdAt;
}

class PayoutSummary {
  const PayoutSummary({
    this.totalEarnedPaise = 0,
    this.totalPaidOutPaise = 0,
    this.totalPendingPaise = 0,
    this.availablePaise = 0,
  });

  factory PayoutSummary.fromJson(Map<String, dynamic> json) {
    return PayoutSummary(
      totalEarnedPaise: _toInt(json['totalEarnedPaise']),
      totalPaidOutPaise: _toInt(json['totalPaidOutPaise']),
      totalPendingPaise: _toInt(json['totalPendingPaise']),
      availablePaise: _toInt(json['availablePaise']),
    );
  }

  final int totalEarnedPaise;
  final int totalPaidOutPaise;
  final int totalPendingPaise;
  final int availablePaise;
}

class PayoutsBundle {
  const PayoutsBundle({
    required this.payouts,
    required this.summary,
  });

  factory PayoutsBundle.fromJson(Map<String, dynamic> json) {
    final payoutsList = (json['payouts'] as List?) ?? [];
    return PayoutsBundle(
      payouts: payoutsList
          .whereType<Map<String, dynamic>>()
          .map(PayoutTransaction.fromJson)
          .toList(),
      summary: PayoutSummary.fromJson(
        (json['summary'] as Map<String, dynamic>?) ?? {},
      ),
    );
  }

  final List<PayoutTransaction> payouts;
  final PayoutSummary summary;
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
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
