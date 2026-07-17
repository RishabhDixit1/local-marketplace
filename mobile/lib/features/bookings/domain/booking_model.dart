import 'package:flutter/material.dart';

import '../../../core/theme/design_tokens.dart';

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

  Color statusColor({Brightness brightness = Brightness.light, Color? mutedColor}) {
    final isDark = brightness == Brightness.dark;
    switch (status) {
      case 'confirmed':
        return isDark ? AppColors.primary : AppColors.primary;
      case 'completed':
        return isDark ? AppColors.success : AppColors.success;
      case 'cancelled':
        return isDark ? AppColors.danger : AppColors.danger;
      case 'rescheduled':
        return isDark ? AppColors.warning : AppColors.warning;
      default:
        return isDark ? AppColors.darkInkSubtle : (mutedColor ?? AppColors.surfaceMuted);
    }
  }

  Color statusBgColor({Brightness brightness = Brightness.light}) {
    final isDark = brightness == Brightness.dark;
    switch (status) {
      case 'confirmed':
        return isDark ? AppColors.darkConfirmed : AppColors.primarySoft;
      case 'completed':
        return isDark ? AppColors.darkCompleted : AppColors.successSoft;
      case 'cancelled':
        return isDark ? AppColors.darkCancelled : AppColors.dangerSoft;
      case 'rescheduled':
        return isDark ? AppColors.darkRescheduled : AppColors.warningSoft;
      default:
        return isDark ? AppColors.darkSurfaceAlt : AppColors.surfaceAlt;
    }
  }
}

String _readString(Object? value, {String fallback = ''}) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? fallback : text;
}
