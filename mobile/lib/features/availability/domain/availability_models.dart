class AvailabilitySlot {
  const AvailabilitySlot({
    this.id,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.isActive = true,
    this.timezone = 'Asia/Kolkata',
  });

  factory AvailabilitySlot.fromJson(Map<String, dynamic> json) {
    return AvailabilitySlot(
      id: json['id'] as String?,
      dayOfWeek: _toInt(json['day_of_week'], fallback: 0),
      startTime: _readString(json['start_time']),
      endTime: _readString(json['end_time']),
      isActive: json['is_active'] != false,
      timezone: _readString(json['timezone'], fallback: 'Asia/Kolkata'),
    );
  }

  final String? id;
  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final bool isActive;
  final String timezone;

  Map<String, dynamic> toPayload() => {
    'day_of_week': dayOfWeek,
    'start_time': startTime,
    'end_time': endTime,
  };

  static const dayLabels = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  String get dayLabel => dayLabels[dayOfWeek.clamp(0, 6)];

  AvailabilitySlot copyWith({
    String? startTime,
    String? endTime,
    bool? isActive,
    String? timezone,
  }) {
    return AvailabilitySlot(
      id: id,
      dayOfWeek: dayOfWeek,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      isActive: isActive ?? this.isActive,
      timezone: timezone ?? this.timezone,
    );
  }
}

class AvailabilityException {
  const AvailabilityException({
    required this.exceptionDate,
    this.isAvailable = false,
    this.reason,
  });

  factory AvailabilityException.fromJson(Map<String, dynamic> json) {
    return AvailabilityException(
      exceptionDate: _readString(json['exception_date']),
      isAvailable: json['is_available'] != false,
      reason: json['reason'] as String?,
    );
  }

  final String exceptionDate;
  final bool isAvailable;
  final String? reason;

  Map<String, dynamic> toPayload() => {
    'exception_date': exceptionDate,
    'is_available': isAvailable,
    'reason': reason,
  };
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
