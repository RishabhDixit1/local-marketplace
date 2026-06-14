import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import 'firebase_runtime_options.dart';

final appFirebaseProvider = Provider<AppFirebaseState>((ref) {
  return const AppFirebaseState.disabled();
});

class AppFirebaseState {
  const AppFirebaseState({
    required this.initialized,
    required this.analyticsEnabled,
    required this.crashlyticsEnabled,
    required this.performanceEnabled,
    this.error,
  });

  const AppFirebaseState.disabled({String? error})
    : this(
        initialized: false,
        analyticsEnabled: false,
        crashlyticsEnabled: false,
        performanceEnabled: false,
        error: error,
      );

  final bool initialized;
  final bool analyticsEnabled;
  final bool crashlyticsEnabled;
  final bool performanceEnabled;
  final String? error;
}

class AppFirebase {
  const AppFirebase._();

  static Future<AppFirebaseState> initialize({AppConfig? config}) async {
    try {
      FirebaseOptions? options = config?.buildFirebaseOptions();

      options ??= FirebaseRuntimeOptions.currentPlatform;

      if (options == null) {
        debugPrint(
          'ServiQ mobile: Firebase runtime options not configured. '
          'Set dart-define flags or add Firebase keys to local.json.',
        );
        return const AppFirebaseState.disabled(
          error: 'Firebase runtime options are not configured.',
        );
      }

      await Firebase.initializeApp(options: options);

      if (kDebugMode) {
        await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(
          false,
        );
        await FirebasePerformance.instance.setPerformanceCollectionEnabled(
          false,
        );
      } else {
        FlutterError.onError = (details) {
          FirebaseCrashlytics.instance.recordFlutterFatalError(details);
        };
        PlatformDispatcher.instance.onError = (error, stack) {
          FirebaseCrashlytics.instance.recordError(error, stack, fatal: true);
          return true;
        };
        await FirebasePerformance.instance.setPerformanceCollectionEnabled(
          true,
        );
      }

      return AppFirebaseState(
        initialized: true,
        analyticsEnabled: true,
        crashlyticsEnabled: !kDebugMode,
        performanceEnabled: !kDebugMode,
      );
    } catch (error) {
      debugPrint('ServiQ mobile: Firebase disabled: $error');
      return AppFirebaseState.disabled(error: error.toString());
    }
  }

  static Future<void> recordError(
    Object error,
    StackTrace stackTrace, {
    bool fatal = false,
  }) async {
    try {
      await FirebaseCrashlytics.instance.recordError(error, stackTrace,
        fatal: fatal,
      );
    } catch (_) {
      debugPrint('ServiQ mobile: Crashlytics unavailable (Firebase not initialized).');
    }
  }
}
