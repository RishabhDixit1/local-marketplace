import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appLoggerProvider = Provider<AppLogger>((ref) {
  return AppLogger();
});

class AppLogger {
  void info(String message) {
    debugPrint('ServiQ info: $message');
  }

  void error(String message, [Object? error, StackTrace? stackTrace]) {
    debugPrint('ServiQ error: $message ${error ?? ''}'.trim());
    _recordNonFatal(message, error, stackTrace);
  }

  void _recordNonFatal(String message, Object? error, StackTrace? stackTrace) {
    try {
      final crashlytics = FirebaseCrashlytics.instance;
      crashlytics.recordError(
        error ?? message,
        stackTrace ?? StackTrace.current,
        fatal: false,
      );
    } catch (_) {
      // Firebase not initialized — non-fatal is best-effort only.
    }
  }
}
