import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return AnalyticsService();
});

class AnalyticsService {
  FirebaseAnalytics? _analytics;

  FirebaseAnalytics? get _firebase {
    if (_analytics == null) {
      try {
        _analytics = FirebaseAnalytics.instance;
      } catch (_) {
        // Firebase not initialized — analytics will no-op.
      }
    }
    return _analytics;
  }

  /// Converts bool values to strings so Firebase Analytics doesn't reject them.
  Map<String, Object> _normalise(Map<String, Object?> extras) {
    return extras.map((key, value) {
      if (value is bool) return MapEntry(key, value.toString());
      if (value == null) return MapEntry(key, 'null');
      return MapEntry(key, value);
    });
  }

  void trackScreen(String name, {Map<String, Object?> extras = const {}}) {
    if (kDebugMode) {
      debugPrint('ServiQ analytics screen=$name extras=$extras');
    }
    _firebase?.logScreenView(
      screenName: name,
      screenClass: name,
      parameters: extras.isEmpty ? null : _normalise(extras),
    );
  }

  void trackEvent(String name, {Map<String, Object?> extras = const {}}) {
    if (kDebugMode) {
      debugPrint('ServiQ analytics event=$name extras=$extras');
    }
    _firebase?.logEvent(name: name, parameters: extras.isEmpty ? null : _normalise(extras));
  }
}
