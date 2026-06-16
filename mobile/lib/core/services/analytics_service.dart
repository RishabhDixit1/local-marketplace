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

  void trackScreen(String name, {Map<String, Object?> extras = const {}}) {
    if (kDebugMode) {
      debugPrint('ServiQ analytics screen=$name extras=$extras');
    }
    _firebase?.logScreenView(
      screenName: name,
      screenClass: name,
      parameters: extras.isEmpty ? null : extras.cast<String, Object>(),
    );
  }

  void trackEvent(String name, {Map<String, Object?> extras = const {}}) {
    if (kDebugMode) {
      debugPrint('ServiQ analytics event=$name extras=$extras');
    }
    _firebase?.logEvent(name: name, parameters: extras as Map<String, Object>?);
  }
}
