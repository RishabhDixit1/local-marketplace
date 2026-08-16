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

  /// Returns [singular] for a count of 1, otherwise the plural form
  /// (defaulting to `singular + 's'`).
  static String pluralize(int count, String singular, {String? plural}) {
    if (count == 1) {
      return singular;
    }
    return plural ?? '${singular}s';
  }

  /// Defensive display-name sanitizer. Rewrites only values with hard
  /// concatenation evidence (camelCase boundary + tokens repeating with
  /// different casing, or case-insensitive cross-casing substrings). Genuine
  /// names and business titles pass through unchanged.
  static String cleanPersonName(String? value) {
    final raw = (value ?? '').replaceAll(RegExp(r'\s+'), ' ').trim();
    if (raw.isEmpty || raw.length > 80) {
      return raw;
    }

    final splitTokens = raw
        .replaceAllMapped(
          RegExp(r'([a-z])([A-Z])'),
          (match) => '${match.group(1)} ${match.group(2)}',
        )
        .split(RegExp(r'[^A-Za-z0-9]+'))
        .where((token) => token.contains(RegExp(r'[A-Za-z]')))
        .toList();
    if (splitTokens.length < 2) {
      return raw;
    }

    final lowered = splitTokens.map((t) => t.toLowerCase()).toList();
    bool caseVariantDuplicate = false;
    for (var i = 0; i < lowered.length; i++) {
      final firstIndex = lowered.indexOf(lowered[i]);
      if (firstIndex != i && splitTokens[firstIndex] != splitTokens[i]) {
        caseVariantDuplicate = true;
        break;
      }
    }

    bool substringAcrossCasing = false;
    for (var i = 0; i < lowered.length && !substringAcrossCasing; i++) {
      final token = lowered[i];
      if (token.length < 3) {
        continue;
      }
      for (var j = 0; j < lowered.length; j++) {
        if (i == j) {
          continue;
        }
        final other = lowered[j];
        if (other.length > token.length &&
            other.contains(token) &&
            splitTokens[j] != splitTokens[i]) {
          substringAcrossCasing = true;
          break;
        }
      }
    }

    if (!RegExp(r'[a-z][A-Z]').hasMatch(raw) ||
        (!caseVariantDuplicate && !substringAcrossCasing)) {
      return raw;
    }

    final candidates = <({String token, String low, int index})>[];
    for (var i = 0; i < splitTokens.length; i++) {
      final low = lowered[i];
      if (low.length >= 2) {
        candidates.add((token: splitTokens[i], low: low, index: i));
      }
    }

    final kept = candidates
        .where(
          (candidate) =>
              !candidates.any(
                (other) =>
                    other.index != candidate.index &&
                    other.low != candidate.low &&
                    candidate.low.contains(other.low),
              ),
        )
        .toList();

    final deduped = <({String token, String low, int index})>[];
    for (final candidate in kept) {
      if (!deduped.any((existing) => existing.low == candidate.low)) {
        deduped.add(candidate);
      }
    }
    deduped.sort((a, b) => a.index.compareTo(b.index));

    final result = deduped
        .map(
          (k) =>
              k.token.isEmpty
                  ? k.token
                  : '${k.token[0].toUpperCase()}${k.token.substring(1)}',
        )
        .join(' ');

    return result.length >= 2 ? result : raw;
  }
}
