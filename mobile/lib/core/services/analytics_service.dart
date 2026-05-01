import 'dart:async';

import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../firebase/app_firebase.dart';

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService(firebaseState: ref.watch(appFirebaseProvider));
});

class AnalyticsService {
  const AnalyticsService({required AppFirebaseState firebaseState})
    : _firebaseState = firebaseState;

  final AppFirebaseState _firebaseState;

  void trackScreen(String name, {Map<String, Object?> extras = const {}}) {
    if (kDebugMode) {
      debugPrint('ServiQ analytics screen=$name extras=$extras');
    }
    if (!_firebaseState.analyticsEnabled) {
      return;
    }
    unawaited(
      FirebaseAnalytics.instance.logScreenView(
        screenName: name,
        parameters: _safeAnalyticsParameters(extras),
      ),
    );
  }

  void trackEvent(String name, {Map<String, Object?> extras = const {}}) {
    if (kDebugMode) {
      debugPrint('ServiQ analytics event=$name extras=$extras');
    }
    if (!_firebaseState.analyticsEnabled) {
      return;
    }
    unawaited(
      FirebaseAnalytics.instance.logEvent(
        name: _safeAnalyticsName(name),
        parameters: _safeAnalyticsParameters(extras),
      ),
    );
  }
}

String _safeAnalyticsName(String name) {
  final normalized = name
      .trim()
      .replaceAll(RegExp(r'[^A-Za-z0-9_]'), '_')
      .replaceAll(RegExp(r'_+'), '_');
  if (normalized.isEmpty) {
    return 'app_event';
  }
  return normalized.length <= 40 ? normalized : normalized.substring(0, 40);
}

Map<String, Object> _safeAnalyticsParameters(Map<String, Object?> extras) {
  final safe = <String, Object>{};
  for (final entry in extras.entries) {
    final key = _safeAnalyticsName(entry.key);
    final value = entry.value;
    if (value == null) {
      continue;
    }
    if (value is String || value is num || value is bool) {
      safe[key] = value;
    } else {
      safe[key] = value.toString();
    }
  }
  return safe;
}
