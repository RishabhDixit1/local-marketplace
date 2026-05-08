import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'app/app.dart';
import 'core/config/app_config.dart';
import 'core/firebase/app_firebase.dart';
import 'core/firebase/mobile_push_notifications.dart';
import 'core/supabase/app_bootstrap.dart';
import 'core/theme/app_theme.dart';
import 'features/auth/data/onboarding_handoff.dart';

Future<void> main() async {
  await runZonedGuarded(
    () async {
      WidgetsFlutterBinding.ensureInitialized();
      final firebaseState = await AppFirebase.initialize();
      final onboardingStore = SharedPreferencesOnboardingHandoffStore(
        await SharedPreferences.getInstance(),
      );
      if (firebaseState.initialized) {
        MobilePushNotificationService.registerBackgroundHandler();
      }

      runApp(
        _BootstrapHost(
          firebaseState: firebaseState,
          onboardingStore: onboardingStore,
        ),
      );
    },
    (error, stackTrace) {
      unawaited(AppFirebase.recordError(error, stackTrace, fatal: true));
    },
  );
}

class _BootstrapHost extends StatefulWidget {
  const _BootstrapHost({
    required this.firebaseState,
    required this.onboardingStore,
  });

  final AppFirebaseState firebaseState;
  final OnboardingHandoffStore onboardingStore;

  @override
  State<_BootstrapHost> createState() => _BootstrapHostState();
}

class _BootstrapHostState extends State<_BootstrapHost> {
  late final Future<AppBootstrap> _bootstrapFuture;

  @override
  void initState() {
    super.initState();
    _bootstrapFuture = AppBootstrap.initialize();
  }

  @override
  Widget build(BuildContext context) {
    return FutureBuilder<AppBootstrap>(
      future: _bootstrapFuture,
      builder: (context, snapshot) {
        if (snapshot.connectionState != ConnectionState.done) {
          return const _BootstrapLoadingApp();
        }

        final bootstrap =
            snapshot.data ??
            AppBootstrap(
              config: AppConfig.fromEnvironment(),
              client: null,
              supabaseReady: false,
              initializationError:
                  'App bootstrap did not complete. Restart ServiQ mobile.',
            );

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
