class AvailabilitySlot {
  const AvailabilitySlot({
    this.id,
    required this.dayOfWeek,
    required this.startTime,
    required this.endTime,
    this.isActive = true,
  });

  factory AvailabilitySlot.fromJson(Map<String, dynamic> json) {
    return AvailabilitySlot(
      id: json['id'] as String?,
      dayOfWeek: _toInt(json['day_of_week'], fallback: 0),
      startTime: _readString(json['start_time']),
      endTime: _readString(json['end_time']),
      isActive: json['is_active'] != false,
    );
  }

  final String? id;
  final int dayOfWeek;
  final String startTime;
  final String endTime;
  final bool isActive;

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
  }) {
    return AvailabilitySlot(
      id: id,
      dayOfWeek: dayOfWeek,
      startTime: startTime ?? this.startTime,
      endTime: endTime ?? this.endTime,
      isActive: isActive ?? this.isActive,
    );
  }
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
