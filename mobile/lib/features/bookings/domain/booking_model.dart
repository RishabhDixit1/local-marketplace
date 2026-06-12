import 'package:flutter/material.dart';

class Booking {
  const Booking({
    required this.id,
    required this.orderId,
    required this.providerId,
    required this.consumerId,
    required this.scheduledDate,
    required this.startTime,
    required this.endTime,
    required this.status,
    this.notes,
    required this.createdAt,
    required this.updatedAt,
    this.orderTitle,
    this.orderStatus,
    required this.consumerName,
    this.consumerAvatar,
    required this.providerName,
    this.providerAvatar,
  });

  factory Booking.fromJson(Map<String, dynamic> json) {
    return Booking(
      id: _readString(json['id']),
      orderId: _readString(json['order_id']),
      providerId: _readString(json['provider_id']),
      consumerId: _readString(json['consumer_id']),
      scheduledDate: _readString(json['scheduled_date']),
      startTime: _readString(json['start_time']),
      endTime: _readString(json['end_time']),
      status: _readString(json['status']),
      notes: json['notes'] as String?,
      createdAt: _readString(json['created_at']),
      updatedAt: _readString(json['updated_at']),
      orderTitle: json['order_title'] as String?,
      orderStatus: json['order_status'] as String?,
      consumerName: _readString(json['consumer_name']),
      consumerAvatar: json['consumer_avatar'] as String?,
      providerName: _readString(json['provider_name']),
      providerAvatar: json['provider_avatar'] as String?,
    );
  }

  final String id;
  final String orderId;
  final String providerId;
  final String consumerId;
  final String scheduledDate;
  final String startTime;
  final String endTime;
  final String status;
  final String? notes;
  final String createdAt;
  final String updatedAt;
  final String? orderTitle;
  final String? orderStatus;
  final String consumerName;
  final String? consumerAvatar;
  final String providerName;
  final String? providerAvatar;

  DateTime? get scheduledDateTime {
    final dt = DateTime.tryParse('${scheduledDate}T$startTime');
    return dt?.toLocal();
  }

  bool get isUpcoming =>
      status == 'confirmed' &&
      (scheduledDateTime == null || scheduledDateTime!.isAfter(DateTime.now()));

  bool get isPast =>
      status != 'confirmed' ||
      (scheduledDateTime != null && !scheduledDateTime!.isAfter(DateTime.now()));

  String get displayTitle => (orderTitle ?? 'Booking').trim().isEmpty
      ? 'Order #${orderId.length > 8 ? orderId.substring(0, 8) : orderId}'
      : orderTitle!;

  Color get statusColor {
    switch (status) {
      case 'confirmed':
        return const Color(0xFF0F766E);
      case 'completed':
        return const Color(0xFF158463);
      case 'cancelled':
        return const Color(0xFFC2415A);
      case 'rescheduled':
        return const Color(0xFFAD6B00);
      default:
        return const Color(0xFF55616B);
    }
  }

  Color get statusBgColor {
    switch (status) {
      case 'confirmed':
        return const Color(0xFFCCFBF1);
      case 'completed':
        return const Color(0xFFE2F6EE);
      case 'cancelled':
        return const Color(0xFFFFE6EC);
      case 'rescheduled':
        return const Color(0xFFFFF4D8);
      default:
        return const Color(0xFFF0F3F7);
    }
  }
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}
