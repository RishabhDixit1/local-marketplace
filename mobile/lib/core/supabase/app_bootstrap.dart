import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../config/app_config.dart';

final appBootstrapProvider = Provider<AppBootstrap>((ref) {
  throw UnimplementedError('AppBootstrap must be overridden in main().');
});

class AppBootstrap {
  static const Duration _initializationTimeout = Duration(seconds: 12);

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

  static Future<AppBootstrap> initialize() async {
    final config = await AppConfig.load();

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

      final instance = await Supabase.initialize(
        url: config.supabaseUrl,
        anonKey: config.supabaseAnonKey,
        debug: kDebugMode,
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
