import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final analyticsServiceProvider = Provider<AnalyticsService>((ref) {
  return const AnalyticsService();
});

class AnalyticsService {
  const AnalyticsService();

  void trackScreen(String name, {Map<String, Object?> extras = const {}}) {
    if (kDebugMode) {
      debugPrint('ServiQ analytics screen=$name extras=$extras');
    }
  }

  void trackEvent(String name, {Map<String, Object?> extras = const {}}) {
    if (kDebugMode) {
      debugPrint('ServiQ analytics event=$name extras=$extras');
    }
  }
}
