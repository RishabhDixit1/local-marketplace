import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';
import '../network/debug_http_overrides.dart';
import '../secure_storage/local_storage.dart';

final appBootstrapProvider = Provider<AppBootstrap>((ref) {
  throw UnimplementedError('AppBootstrap must be overridden in main().');
});

class AppBootstrap {
  static const Duration _initializationTimeout = Duration(seconds: 15);

  const AppBootstrap({
    required this.config,
    required this.client,
    required this.supabaseReady,
    required this.initializationError,
  });

  final AppConfig config;
  final SupabaseClient? client;
  final bool supabaseReady;
  final String? initializationError;

  bool get needsSetup =>
      !config.hasMinimumClientConfig || initializationError != null;

  static Future<AppBootstrap> initialize({AppConfig? config}) async {
    config ??= await AppConfig.load();

    // Android emulator: 10.0.2.2 routes to host loopback
    if (defaultTargetPlatform == TargetPlatform.android) {
      config = config.rewriteLoopbackForEmulator();
    }

    DebugNetworkTrust.installIfNeeded(config);
    final httpClient = DebugNetworkTrust.createHttpClient(config);

    if (!config.hasSupabaseConfig) {
      return AppBootstrap(
        config: config,
        client: null,
        supabaseReady: false,
        initializationError:
            'Missing SUPABASE_URL or SUPABASE_ANON_KEY. Add dart defines or create mobile/config/local.json.',
      );
    }

    try {
      debugPrint(
        'ServiQ mobile: starting Supabase bootstrap for ${config.supabaseHost}',
      );

      // Pre-warm the FlutterSecureStorage platform channel so the 3
      // sequential reads inside Supabase.initialize() are not cold-starts.
      // Each cold read takes 100-500ms on Android; a single warm-up read
      // brings subsequent reads down to <10ms each.
      try {
        const warmupStorage = FlutterSecureStorage();
        await warmupStorage.containsKey(key: 'warmup');
      } catch (_) {
        // Pre-warm failed — Supabase will still work, just slower.
      }

      final instance = await Supabase.initialize(
        url: config.supabaseUrl,
        publishableKey: config.supabaseAnonKey,
        httpClient: httpClient,
        debug: kDebugMode,
        authOptions: FlutterAuthClientOptions(
          localStorage: SecureLocalStorage(
            persistSessionKey: 'serviq_supabase_session',
          ),
          pkceAsyncStorage: SecureGotrueAsyncStorage(),
        ),
      ).timeout(_initializationTimeout);

      debugPrint('ServiQ mobile: Supabase bootstrap completed.');

      return AppBootstrap(
        config: config,
        client: instance.client,
        supabaseReady: true,
        initializationError: null,
      );
    } on TimeoutException {
      debugPrint('ServiQ mobile: Supabase bootstrap timed out.');

      return AppBootstrap(
        config: config,
        client: null,
        supabaseReady: false,
        initializationError:
            'Supabase initialization timed out after '
            '${_initializationTimeout.inSeconds} seconds. '
            'Check emulator internet/DNS and restart the app.',
      );
    } catch (error) {
      debugPrint('ServiQ mobile: Supabase bootstrap failed: $error');

      return AppBootstrap(
        config: config,
        client: null,
        supabaseReady: false,
        initializationError: 'Supabase initialization failed: $error',
      );
    }
  }
}
