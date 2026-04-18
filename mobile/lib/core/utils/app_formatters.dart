import 'package:flutter/material.dart';

class AppFormatters {
  const AppFormatters._();

  static String currency(num? value, {String fallback = 'Price on request'}) {
    if (value == null || value <= 0) {
      return fallback;
    }

    return 'INR ${value.round()}';
  }

  static String relativeTime(DateTime? value) {
    if (value == null) {
      return 'Recently';
    }

    final diff = DateTime.now().difference(value.toLocal());
    if (diff.inMinutes < 1) {
      return 'Just now';
    }
    if (diff.inHours < 1) {
      return '${diff.inMinutes}m ago';
    }
    if (diff.inDays < 1) {
      return '${diff.inHours}h ago';
    }
    if (diff.inDays < 7) {
      return '${diff.inDays}d ago';
    }
    return '${value.day}/${value.month}/${value.year}';
  }

  static String titleize(String raw, {String fallback = ''}) {
    final normalized = raw.trim().toLowerCase();
    if (normalized.isEmpty) {
      return fallback;
    }

    return normalized
        .split('_')
        .map(
          (segment) => segment.isEmpty
              ? segment
              : '${segment[0].toUpperCase()}${segment.substring(1)}',
        )
        .join(' ');
  }

  static String initials(String raw, {String fallback = 'S'}) {
    final parts = raw
        .split(' ')
        .map((part) => part.trim())
        .where((part) => part.isNotEmpty)
        .toList();

    if (parts.isEmpty) {
      return fallback;
    }
    if (parts.length == 1) {
      return parts.first.characters.first.toUpperCase();
    }

    return '${parts.first.characters.first}${parts[1].characters.first}'
        .toUpperCase();
  }
}
