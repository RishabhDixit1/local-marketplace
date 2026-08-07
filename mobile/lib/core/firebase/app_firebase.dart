import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:firebase_performance/firebase_performance.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../config/app_config.dart';
import '../supabase/app_bootstrap.dart';
import 'firebase_runtime_options.dart';

/// When true, a manual Crashlytics test-crash button is surfaced. Debug
/// builds always show it; release/tester builds only when compiled with
/// --dart-define=ENABLE_TEST_CRASH=true, so production builds never ship it.
const bool enableTestCrashButton =
    kDebugMode || bool.fromEnvironment('ENABLE_TEST_CRASH');

Future<AppFirebaseState>? _firebaseInitFuture;

Future<AppFirebaseState> _initializeFirebase(AppConfig? config) {
  return _firebaseInitFuture ??= AppFirebase.initialize(config: config);
}

/// Exposes the Firebase initialization result. The underlying future is
/// shared and memoized, so every consumer (analytics, push, crash handling)
/// observes the real initialized state instead of a hardcoded disabled
/// default.
final appFirebaseProvider = FutureProvider<AppFirebaseState>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return _initializeFirebase(bootstrap.config);
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
      // Guard against duplicate initialization when a default app already exists
      try {
        Firebase.app();
        debugPrint('ServiQ mobile: Firebase already initialized, skipping.');
      } catch (_) {
        // No default app exists (or different exception type), proceed with initialization
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
      }

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

  /// Manual test-crash entry point for the debug/tester button. Re-enables
  /// Crashlytics collection (debug builds disable it) and crashes the app so
  /// the report is uploaded on next launch. Falls back to a deliberate Dart
  /// throw so the path is still observable if the plugin is unavailable.
  static Future<void> triggerTestCrash() async {
    try {
      await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(true);
      FirebaseCrashlytics.instance.crash();
    } catch (e) {
      debugPrint('ServiQ mobile: test crash unavailable ($e); forcing Dart throw.');
      throw StateError('ServiQ manual Crashlytics test crash');
    }
  }
}
