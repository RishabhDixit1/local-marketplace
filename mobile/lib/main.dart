import 'dart:async';

import 'package:flutter/material.dart';
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
    debugPrint('ServiQ mobile: FlutterError: ${details.exception}');
    unawaited(AppFirebase.recordError(
      details.exception,
      details.stack ?? StackTrace.current,
      fatal: true,
    ));
  };

  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();

      // Use the synchronous compile-time config so runApp() is not blocked
      // by the asset-bundle platform channel in AppConfig.load() (which reads
      // config/local.json via rootBundle.loadString).  The full config
      // (including local.json overlay) is loaded inside _startBootstrap().
      final appConfig = AppConfig.fromEnvironment();
      final firebaseFuture = AppFirebase.initialize(config: appConfig);
      MobilePushNotificationService.registerBackgroundHandler();

      runApp(
        _BootstrapHost(
          appConfig: appConfig,
          firebaseFuture: firebaseFuture,
        ),
      );

      // Deferred until after first frame: notification plugin init makes a
      // platform channel call that competes with the first frame for the main
      // thread. Not needed for first paint.
      WidgetsBinding.instance.addPostFrameCallback((_) {
        initializeLocalNotifications();
      });
    },
    (error, stackTrace) {
      debugPrint('ServiQ mobile: Uncaught error: $error');
      unawaited(AppFirebase.recordError(error, stackTrace, fatal: true));
    },
  );
}

class _BootstrapHost extends StatefulWidget {
  const _BootstrapHost({
    required this.appConfig,
    required this.firebaseFuture,
  });

  final AppConfig appConfig;
  final Future<AppFirebaseState> firebaseFuture;

  @override
  State<_BootstrapHost> createState() => _BootstrapHostState();
}

class _BootstrapHostState extends State<_BootstrapHost> {
  AppBootstrap? _bootstrap;
  AppFirebaseState? _firebaseState;
  String? _bootstrapError;
  bool _timedOut = false;
  Timer? _timeoutTimer;

  @override
  void initState() {
    super.initState();
    // Deferred until after first frame: Supabase.initialize() does 3
    // sequential FlutterSecureStorage platform-channel reads (Keystore init
    // on cold Android start, 100-500 ms each) and Firebase.initializeApp()
    // makes a heavy platform-channel call (200-800 ms). Running these in
    // Future.wait after the first frame paints keeps the loading screen
    // responsive while the heavy init happens in the background.
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
      _firebaseState = null;
      _bootstrapError = null;
      _timedOut = false;
    });
    _startBootstrap();
    _scheduleTimeout();
  }

  Future<void> _startBootstrap() async {
    // Load the full config (including local.json overlay) now that the first
    // frame has already painted.  This replaces the earlier await that blocked
    // runApp().
    AppConfig config;
    try {
      config = await AppConfig.load();
    } catch (e) {
      if (!mounted) return;
      _bootstrapError = 'Failed to load config: $e';
      setState(() {});
      return;
    }

    if (!mounted) return;

    try {
      final results = await Future.wait([
        AppBootstrap.initialize(config: config),
        widget.firebaseFuture.catchError(
          (_) => const AppFirebaseState.disabled(),
        ),
      ]);

      if (!mounted) return;
      final bootstrap = results[0] as AppBootstrap;
      _firebaseState = results[1] as AppFirebaseState;
      if (bootstrap.initializationError != null) {
        _bootstrapError = bootstrap.initializationError;
      } else {
        _bootstrap = bootstrap;
      }
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
        if (_firebaseState != null)
          appFirebaseProvider.overrideWithValue(_firebaseState!),
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
                  padding: const EdgeInsets.all(24),
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
                        const SizedBox(height: 16),
                        Text('Could not connect', style: Theme.of(context).textTheme.titleLarge),
                        const SizedBox(height: 8),
                        Text(message, style: Theme.of(context).textTheme.bodyMedium, textAlign: TextAlign.center),
                        const SizedBox(height: 24),
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
                  padding: const EdgeInsets.all(24),
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
                                borderRadius: BorderRadius.circular(16),
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
                                  const SizedBox(height: 2),
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
                        const SizedBox(height: 8),
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
