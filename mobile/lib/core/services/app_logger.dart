import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

final appLoggerProvider = Provider<AppLogger>((ref) {
  return const AppLogger();
});

class AppLogger {
  const AppLogger();

  void info(String message) {
    debugPrint('ServiQ info: $message');
  }

  void error(String message, [Object? error]) {
    debugPrint('ServiQ error: $message ${error ?? ''}'.trim());
  }
}
