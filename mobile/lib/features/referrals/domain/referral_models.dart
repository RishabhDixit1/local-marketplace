class ReferralCode {
  const ReferralCode({
    required this.id,
    required this.code,
    this.timesUsed = 0,
    this.rewardPoints = 0,
    this.isActive = true,
    required this.createdAt,
  });

  factory ReferralCode.fromJson(Map<String, dynamic> json) {
    return ReferralCode(
      id: _readString(json['id']),
      code: _readString(json['code']),
      timesUsed: _toInt(json['times_used']),
      rewardPoints: _toInt(json['reward_points']),
      isActive: json['is_active'] != false,
      createdAt: _parseDate(json['created_at']) ?? DateTime.now(),
    );
  }

  final String id;
  final String code;
  final int timesUsed;
  final int rewardPoints;
  final bool isActive;
  final DateTime createdAt;
}

class ReferralEvent {
  const ReferralEvent({
    required this.id,
    required this.referredId,
    this.rewardPoints = 0,
    this.status = 'completed',
    required this.createdAt,
    this.referredName,
  });

  factory ReferralEvent.fromJson(Map<String, dynamic> json) {
    return ReferralEvent(
      id: _readString(json['id']),
      referredId: _readString(json['referred_id']),
      rewardPoints: _toInt(json['reward_points']),
      status: _readString(json['status'], fallback: 'completed'),
      createdAt: _parseDate(json['created_at']) ?? DateTime.now(),
      referredName: (json['profiles'] as Map<String, dynamic>?) != null
          ? _readString((json['profiles'] as Map<String, dynamic>)['full_name'])
          : null,
    );
  }

  final String id;
  final String referredId;
  final int rewardPoints;
  final String status;
  final DateTime createdAt;
  final String? referredName;
}

class ReferralPayout {
  const ReferralPayout({
    required this.id,
    this.amountPaise = 0,
    this.pointsRedeemed = 0,
    this.status = 'pending',
    required this.createdAt,
  });

  factory ReferralPayout.fromJson(Map<String, dynamic> json) {
    return ReferralPayout(
      id: _readString(json['id']),
      amountPaise: _toInt(json['amount_paise']),
      pointsRedeemed: _toInt(json['points_redeemed']),
      status: _readString(json['status'], fallback: 'pending'),
      createdAt: _parseDate(json['created_at']) ?? DateTime.now(),
    );
  }

  final String id;
  final int amountPaise;
  final int pointsRedeemed;
  final String status;
  final DateTime createdAt;
}

class ReferralBundle {
  const ReferralBundle({
    required this.codes,
    required this.referrals,
    this.totalRewards = 0,
    this.payouts = const [],
    this.totalPoints = 0,
    this.availablePoints = 0,
  });

  factory ReferralBundle.fromJson(Map<String, dynamic> refJson, Map<String, dynamic> payoutJson) {
    final codesList = (refJson['codes'] as List?) ?? [];
    final eventsList = (refJson['referrals'] as List?) ?? [];
    final payoutsList = (payoutJson['payouts'] as List?) ?? [];

    return ReferralBundle(
      codes: codesList.whereType<Map<String, dynamic>>().map(ReferralCode.fromJson).toList(),
      referrals: eventsList.whereType<Map<String, dynamic>>().map(ReferralEvent.fromJson).toList(),
      totalRewards: _toInt(refJson['totalRewards']),
      payouts: payoutsList.whereType<Map<String, dynamic>>().map(ReferralPayout.fromJson).toList(),
      totalPoints: _toInt(payoutJson['totalPoints']),
      availablePoints: _toInt(payoutJson['availablePoints']),
    );
  }

  final List<ReferralCode> codes;
  final List<ReferralEvent> referrals;
  final int totalRewards;
  final List<ReferralPayout> payouts;
  final int totalPoints;
  final int availablePoints;
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
