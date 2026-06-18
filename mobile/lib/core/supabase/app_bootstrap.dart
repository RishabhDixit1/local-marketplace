import 'dart:async';
import 'dart:io';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:http/http.dart' as http;
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

    // Pre-flight connectivity checks — fail fast instead of waiting 15s for
    // Supabase.initialize() to time out on an unreachable host.
    final apiPing = await _checkUrlReachable('API server', config.apiBaseUrl);
    if (apiPing != null) {
      return AppBootstrap(
        config: config,
        client: null,
        supabaseReady: false,
        initializationError: apiPing,
      );
    }
    final supabasePing =
        await _checkUrlReachable('Supabase', config.supabaseUrl);
    if (supabasePing != null) {
      return AppBootstrap(
        config: config,
        client: null,
        supabaseReady: false,
        initializationError: supabasePing,
      );
    }

    try {
      debugPrint(
        'ServiQ mobile: starting Supabase bootstrap for ${config.supabaseHost}',
      );

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

  static Future<String?> _checkUrlReachable(
    String label,
    String url, {
    Duration timeout = const Duration(seconds: 3),
  }) async {
    final uri = Uri.tryParse(url);
    if (uri == null) {
      return 'Invalid URL for $label: $url.';
    }
    try {
      final client = http.Client();
      try {
        await client.head(uri).timeout(timeout);
        return null;
      } finally {
        client.close();
      }
    } on TimeoutException {
      return '$label ($url) is not reachable — '
          'connection timed out after ${timeout.inSeconds}s. '
          'Verify the URL and your internet connection.';
    } on SocketException catch (e) {
      return '$label ($url) is not reachable: ${e.message}. '
          'Check the URL and network connectivity.';
    } catch (e) {
      return '$label ($url) check failed: $e.';
    }
  }
}
