import 'package:firebase_analytics/firebase_analytics.dart';
import 'package:firebase_core/firebase_core.dart';
import 'package:firebase_crashlytics/firebase_crashlytics.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'firebase_runtime_options.dart';

final appFirebaseProvider = Provider<AppFirebaseState>((ref) {
  return const AppFirebaseState.disabled();
});

class AppFirebaseState {
  const AppFirebaseState({
    required this.initialized,
    required this.analyticsEnabled,
    required this.crashlyticsEnabled,
    this.error,
  });

  const AppFirebaseState.disabled({String? error})
    : this(
        initialized: false,
        analyticsEnabled: false,
        crashlyticsEnabled: false,
        error: error,
      );

  final bool initialized;
  final bool analyticsEnabled;
  final bool crashlyticsEnabled;
  final String? error;
}

class AppFirebase {
  const AppFirebase._();

  static bool _errorHandlersBound = false;

  static Future<AppFirebaseState> initialize() async {
    try {
      if (Firebase.apps.isEmpty) {
        final options = FirebaseRuntimeOptions.currentPlatform;
        if (options == null) {
          await Firebase.initializeApp();
        } else {
          await Firebase.initializeApp(options: options);
        }
      }

      await FirebaseAnalytics.instance.setAnalyticsCollectionEnabled(
        !kDebugMode,
      );
      await FirebaseCrashlytics.instance.setCrashlyticsCollectionEnabled(
        !kDebugMode,
      );
      _bindErrorHandlers();

      return AppFirebaseState(
        initialized: true,
        analyticsEnabled: true,
        crashlyticsEnabled: true,
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
    if (Firebase.apps.isEmpty) {
      return;
    }
    await FirebaseCrashlytics.instance.recordError(
      error,
      stackTrace,
      fatal: fatal,
    );
  }

  static void _bindErrorHandlers() {
    if (_errorHandlersBound || Firebase.apps.isEmpty) {
      return;
    }

    FlutterError.onError = FirebaseCrashlytics.instance.recordFlutterFatalError;
    PlatformDispatcher.instance.onError = (error, stackTrace) {
      FirebaseCrashlytics.instance.recordError(error, stackTrace, fatal: true);
      return true;
    };
    _errorHandlersBound = true;
  }
}
