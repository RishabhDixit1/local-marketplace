import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_secure_storage/flutter_secure_storage.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'app/app.dart';
import 'core/config/app_config.dart';
import 'core/firebase/app_firebase.dart';
import 'core/firebase/local_notification_service.dart';
import 'core/firebase/mobile_push_notifications.dart';
import 'core/supabase/app_bootstrap.dart';
import 'core/theme/app_theme.dart';

Future<void> main() async {
  FlutterError.onError = (details) {
    debugPrint('ServiQ mobile: FlutterError: $details');
    unawaited(AppFirebase.recordError(
      details.exception,
      details.stack ?? StackTrace.current,
      fatal: true,
    ));
  };

  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      final appConfig = AppConfig.fromEnvironment();

      // Pre-warm the FlutterSecureStorage platform channel BEFORE runApp().
      // On cold Android start, the first FlutterSecureStorage read triggers
      // Keystore init (100-500ms blocking). By doing a dummy read here, the
      // platform channel is warm by the time Supabase.initialize() runs
      // inside _startBootstrap(). This overlaps with the first-frame rendering
      // so the main thread is not idle during the warm-up.
      unawaited(_prewarmSecureStorage());

      runApp(
        _BootstrapHost(
          appConfig: appConfig,
        ),
      );

      WidgetsBinding.instance.addPostFrameCallback((_) {
        initializeLocalNotifications();
        MobilePushNotificationService.registerBackgroundHandler();
        // Firebase is initialized lazily via appFirebaseProvider, which reads
        // the merged bootstrap config (dart-defines + local.json overlay) so
        // every consumer observes the real initialized state. Kicking it off
        // here with the raw compile-time config would cache a disabled state
        // when dart-defines are incomplete.
      });
    },
    (error, stackTrace) {
      debugPrint('ServiQ mobile: Uncaught error: $error');
      unawaited(AppFirebase.recordError(error, stackTrace, fatal: true));
    },
  );
}

Future<void> _prewarmSecureStorage() async {
  try {
    const warmupStorage = FlutterSecureStorage();
    await warmupStorage.containsKey(key: 'warmup');
  } catch (_) {
    // Pre-warm is best-effort. If it fails, Supabase will still work
    // but the first SecureStorage read inside Supabase.initialize() will
    // be slower on cold Android start.
  }
}

class _BootstrapHost extends StatefulWidget {
  const _BootstrapHost({
    required this.appConfig,
  });

  final AppConfig appConfig;

  @override
  State<_BootstrapHost> createState() => _BootstrapHostState();
}

class _BootstrapHostState extends State<_BootstrapHost> {
  AppBootstrap? _bootstrap;
  String? _bootstrapError;
  bool _timedOut = false;
  Timer? _timeoutTimer;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _startBootstrap();
      _scheduleTimeout();
    });
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    super.dispose();
  }

  void _retry() {
    _timeoutTimer?.cancel();
    setState(() {
      _bootstrap = null;
      _bootstrapError = null;
      _timedOut = false;
    });
    _startBootstrap();
    _scheduleTimeout();
  }

  Future<void> _startBootstrap() async {
    // Reuse the compile-time config. AppConfig.load() adds local.json
    // overlay but when dart-defines provide all values (the common case
    // with flutter run / CI), load() short-circuits. Calling it here
    // only for the edge case where dart-defines are incomplete.
    final envConfig = widget.appConfig;
    final config = envConfig.hasSupabaseConfig
        ? envConfig
        : await AppConfig.load().catchError((_) => envConfig);

    if (!mounted) return;

    try {
      final bootstrap = await AppBootstrap.initialize(config: config);

      if (!mounted) return;
      _timeoutTimer?.cancel();
      if (bootstrap.initializationError != null) {
        _bootstrapError = bootstrap.initializationError;
      } else {
        _bootstrap = bootstrap;
      }
      _timedOut = false;
      setState(() {});
    } catch (e) {
      if (!mounted) return;
      _bootstrapError = e.toString();
      setState(() {});
    }
  }

  void _scheduleTimeout() {
    _timeoutTimer?.cancel();
    _timeoutTimer = Timer(const Duration(seconds: 8), () {
      if (mounted && _bootstrap == null && _bootstrapError == null) {
        _timedOut = true;
        setState(() {});
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_timedOut) {
      return _BootstrapErrorApp(
        message: 'Taking longer than expected. Check your connection and restart.',
        onRetry: _retry,
      );
    }

    if (_bootstrapError != null) {
      return _BootstrapErrorApp(
        message: _bootstrapError!,
        onRetry: _retry,
      );
    }

    if (_bootstrap == null) {
      return const _BootstrapLoadingApp();
    }

    return ProviderScope(
      overrides: [
        appBootstrapProvider.overrideWithValue(_bootstrap!),
      ],
      child: const ServiQApp(),
    );
  }
}

class _BootstrapErrorApp extends StatelessWidget {
  const _BootstrapErrorApp({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: Scaffold(
        body: DecoratedBox(
          decoration: BoxDecoration(
            gradient: ServiqThemeTokens.light.authGradient,
          ),
          child: SafeArea(
            child: SingleChildScrollView(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Container(
                    width: double.infinity,
                    constraints: const BoxConstraints(maxWidth: 420),
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: AppColors.surface.withValues(alpha: 0.94),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(color: AppColors.danger),
                      boxShadow: AppShadows.floating,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        Icon(Icons.cloud_off_rounded, color: AppColors.danger, size: 48),
                        const SizedBox(height: AppSpacing.md),
                        Text('Could not connect', style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: AppSpacing.xs),
                        Text(message, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
                        const SizedBox(height: AppSpacing.xl),
                        FilledButton.icon(
                          onPressed: onRetry,
                          icon: const Icon(Icons.refresh_rounded),
                          label: const Text('Retry'),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _BootstrapLoadingApp extends StatelessWidget {
  const _BootstrapLoadingApp();

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      home: Scaffold(
        body: DecoratedBox(
          decoration: BoxDecoration(
            gradient: ServiqThemeTokens.light.authGradient,
          ),
          child: SafeArea(
            child: SingleChildScrollView(
              child: Center(
                child: Padding(
                  padding: const EdgeInsets.all(AppSpacing.xl),
                  child: Container(
                    width: double.infinity,
                    constraints: const BoxConstraints(maxWidth: 420),
                    padding: const EdgeInsets.all(22),
                    decoration: BoxDecoration(
                      color: AppColors.surface.withValues(alpha: 0.94),
                      borderRadius: BorderRadius.circular(24),
                      border: Border.all(
                        color: ServiqThemeTokens.light.glassBorder,
                      ),
                      boxShadow: AppShadows.floating,
                    ),
                    child: Column(
                      mainAxisSize: MainAxisSize.min,
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Row(
                          children: [
                            Container(
                              width: 48,
                              height: 48,
                              decoration: BoxDecoration(
                                color: AppColors.primary,
                                borderRadius: BorderRadius.circular(AppRadii.xl),
                              ),
                              child: const Icon(
                                Icons.bolt_rounded,
                                color: Colors.white,
                              ),
                            ),
                            const SizedBox(width: 14),
                            Expanded(
                              child: Column(
                                crossAxisAlignment: CrossAxisAlignment.start,
                                children: [
                                  Text(
                                    'ServiQ',
                                    style: Theme.of(context).textTheme.titleLarge,
                                  ),
                                  const SizedBox(height: AppSpacing.xxxs),
                                  Text(
                                    'Preparing your local marketplace',
                                    style: Theme.of(context).textTheme.bodySmall,
                                  ),
                                ],
                              ),
                            ),
                          ],
                        ),
                        const SizedBox(height: 22),
                        Text(
                          'Starting ServiQ mobile',
                          style: Theme.of(context).textTheme.headlineMedium,
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Text(
                          'Checking your session, syncing live trust signals, and getting Home ready.',
                          style: Theme.of(context).textTheme.bodyMedium,
                        ),
                        const SizedBox(height: 22),
                        const ClipRRect(
                          borderRadius: BorderRadius.all(
                            Radius.circular(AppRadii.pill),
                          ),
                          child: LinearProgressIndicator(
                            minHeight: 6,
                            backgroundColor: AppColors.surfaceMuted,
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
