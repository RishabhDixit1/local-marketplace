import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'core/config/app_config.dart';
import 'core/firebase/app_firebase.dart';
import 'core/firebase/local_notification_service.dart';
import 'core/firebase/mobile_push_notifications.dart';
import 'core/supabase/app_bootstrap.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/data/onboarding_handoff.dart';

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

      final appConfig = await AppConfig.load();
      final firebaseState = await AppFirebase.initialize(config: appConfig);
      final onboardingStore = SharedPreferencesOnboardingHandoffStore(
        await SharedPreferences.getInstance(),
      );
      await initializeLocalNotifications();
      if (firebaseState.initialized) {
        MobilePushNotificationService.registerBackgroundHandler();
      }

      runApp(
        _BootstrapHost(
          appConfig: appConfig,
          firebaseState: firebaseState,
          onboardingStore: onboardingStore,
        ),
      );
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
    required this.firebaseState,
    required this.onboardingStore,
  });

  final AppConfig appConfig;
  final AppFirebaseState firebaseState;
  final OnboardingHandoffStore onboardingStore;

  @override
  State<_BootstrapHost> createState() => _BootstrapHostState();
}

class _BootstrapHostState extends State<_BootstrapHost> {
  late Future<AppBootstrap> _bootstrapFuture;
  bool _timedOut = false;
  bool _bootstrapDone = false;
  Timer? _timeoutTimer;

  @override
  void initState() {
    super.initState();
    _startBootstrap();
  }

  @override
  void dispose() {
    _timeoutTimer?.cancel();
    super.dispose();
  }

  void _startBootstrap() {
    _bootstrapFuture = AppBootstrap.initialize(config: widget.appConfig);
    _bootstrapFuture.then((_) {
      if (mounted) setState(() => _bootstrapDone = true);
    });
    _scheduleTimeout();
  }

  void _scheduleTimeout() {
    _timeoutTimer?.cancel();
    _timeoutTimer = Timer(const Duration(seconds: 8), () {
      if (mounted && !_timedOut && !_bootstrapDone) {
        setState(() => _timedOut = true);
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    if (_timedOut) {
      return _BootstrapErrorApp(
        message: 'Taking longer than expected. Check your connection and restart.',
        onRetry: () {
          _timeoutTimer?.cancel();
          setState(() {
            _timedOut = false;
            _bootstrapDone = false;
          });
          _startBootstrap();
        },
      );
    }

    return FutureBuilder<AppBootstrap>(
      future: _bootstrapFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const _BootstrapLoadingApp();
        }

        final hasError = snapshot.hasError || snapshot.data?.initializationError != null;
        if (hasError) {
          final msg = snapshot.error?.toString() ??
              snapshot.data?.initializationError ??
              'Could not start ServiQ.';
          return _BootstrapErrorApp(message: msg, onRetry: () {
            _timeoutTimer?.cancel();
            setState(() {
              _bootstrapDone = false;
            });
            _startBootstrap();
          });
        }

        final bootstrap = snapshot.data!;

        return ProviderScope(
          overrides: [
            appBootstrapProvider.overrideWithValue(bootstrap),
            appFirebaseProvider.overrideWithValue(widget.firebaseState),
            onboardingHandoffStoreProvider.overrideWithValue(
              widget.onboardingStore,
            ),
          ],
          child: const ServiQApp(),
        );
      },
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
    );
  }
}
