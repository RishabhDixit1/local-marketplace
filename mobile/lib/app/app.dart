import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../features/settings/data/theme_mode_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/auth/auth_state_controller.dart';
import '../core/firebase/app_firebase.dart';
import '../core/firebase/mobile_push_notifications.dart';
import '../core/services/analytics_service.dart';
import '../core/services/app_update_service.dart';
import '../core/supabase/app_bootstrap.dart';
import '../core/theme/app_theme.dart';
import '../features/auth/data/onboarding_handoff.dart';
import '../l10n/l10n.dart';
import 'router/app_router.dart';

class ServiQApp extends ConsumerStatefulWidget {
  const ServiQApp({super.key});

  @override
  ConsumerState<ServiQApp> createState() => _ServiQAppState();
}

class _ServiQAppState extends ConsumerState<ServiQApp> {
  bool _trackedAppOpen = false;
  String? _trackedAuthHandoffKey;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted || _trackedAppOpen) {
        return;
      }
      _trackedAppOpen = true;
      try {
        final bootstrap = ref.read(appBootstrapProvider);
        final firebase = ref.read(appFirebaseProvider);
        ref
            .read(analyticsServiceProvider)
            .trackEvent(
              'app_open_mobile',
              extras: {
                'environment': bootstrap.config.environment,
                'supabase_ready': bootstrap.supabaseReady,
                'firebase_ready': firebase.initialized,
              },
            );
      } catch (_) {
        // Analytics must never block or crash startup
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final bootstrap = ref.watch(appBootstrapProvider);
    final router = ref.watch(appRouterProvider);
    ref.listen(currentSessionProvider, (previous, next) {
      next.whenData((session) {
        final pendingMethod = ref
            .read(onboardingHandoffControllerProvider)
            .pendingAuthMethod;
        if (session == null || pendingMethod == null) {
          if (session == null) {
            _trackedAuthHandoffKey = null;
          }
          return;
        }

        final handoff = ref.read(onboardingHandoffControllerProvider);
        final destination = handoff.postAuthDestination;
        final trackingKey =
            '${session.user.id}:${pendingMethod.storageValue}:$destination';
        if (_trackedAuthHandoffKey == trackingKey) {
          return;
        }
        _trackedAuthHandoffKey = trackingKey;

        final extras = handoff.analyticsExtras(method: pendingMethod);
        ref
            .read(analyticsServiceProvider)
            .trackEvent('mobile_auth_success', extras: extras);
        ref
            .read(analyticsServiceProvider)
            .trackEvent('mobile_onboarding_started', extras: extras);
        WidgetsBinding.instance.addPostFrameCallback((_) {
          unawaited(handoff.completeAuthHandoff(startedRoute: destination));
        });
      });
    });
    ref.listen(notificationTapRouteStreamProvider, (previous, next) {
      next.whenData((location) {
        WidgetsBinding.instance.addPostFrameCallback((_) {
          ref
              .read(analyticsServiceProvider)
              .trackEvent(
                'notification_tap_route',
                extras: {'route': location},
              );
          router.push(location);
        });
      });
    });

    return MaterialApp.router(
      title: bootstrap.config.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ref.watch(themeModeProvider),
      localizationsDelegates: const [
        GlobalMaterialLocalizations.delegate,
        GlobalWidgetsLocalizations.delegate,
        GlobalCupertinoLocalizations.delegate,
        AppLocalizations.delegate,
      ],
      localeResolutionCallback: (locale, supportedLocales) {
        if (locale == null) return supportedLocales.first;
        for (final supported in supportedLocales) {
          if (supported.languageCode == locale.languageCode &&
              (supported.countryCode == null ||
                  supported.countryCode == locale.countryCode)) {
            return supported;
          }
        }
        for (final supported in supportedLocales) {
          if (supported.languageCode == locale.languageCode) {
            return supported;
          }
        }
        return supportedLocales.first;
      },
      supportedLocales: const [
        Locale('en', 'US'),
        Locale('hi', 'IN'),
        Locale('bn', 'BD'),
        Locale('ta', 'IN'),
        Locale('te', 'IN'),
        Locale('mr', 'IN'),
      ],
      routerConfig: router,
      builder: (context, child) {
        return _UpdateCheckGate(updateService: ref.read(appUpdateServiceProvider), child: child!);
      },
    );
  }
}

class _UpdateCheckGate extends StatefulWidget {
  const _UpdateCheckGate({required this.child, required this.updateService});

  final Widget child;
  final AppUpdateService updateService;

  @override
  State<_UpdateCheckGate> createState() => _UpdateCheckGateState();
}

class _UpdateCheckGateState extends State<_UpdateCheckGate> {
  bool _updateChecked = false;

  @override
  void didChangeDependencies() {
    super.didChangeDependencies();
    if (_updateChecked) return;
    _updateChecked = true;
    _performUpdateCheck();
  }

  Future<void> _performUpdateCheck() async {
    try {
      final info = await widget.updateService
          .checkForUpdate()
          .timeout(const Duration(seconds: 10));
      if (!mounted || !info.updateAvailable) return;
      _showUpdateGateDialog(info);
    } catch (_) {
      // Update check failed silently — non-blocking
    }
  }

  void _showUpdateGateDialog(AppUpdateInfo info) {
    final navigator = appNavigatorKey.currentState;
    if (navigator == null) return;

    navigator.push<bool>(
      MaterialPageRoute(
        fullscreenDialog: true,
        builder: (_) => _UpdateGatePage(info: info),
      ),
    ).then((shouldUpdate) {
      if (shouldUpdate != true || !mounted) return;
      _launchUpdateUrl(info.updateUrl);
    });
  }

  Future<void> _launchUpdateUrl(String? url) async {
    if (url == null || url.isEmpty) return;
    final uri = Uri.tryParse(url);
    if (uri == null) return;
    try {
      if (await canLaunchUrl(uri).timeout(const Duration(seconds: 3))) {
        await launchUrl(uri, mode: LaunchMode.externalApplication)
            .timeout(const Duration(seconds: 5));
      }
    } catch (_) {}
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _UpdateGatePage extends StatelessWidget {
  const _UpdateGatePage({required this.info});

  final AppUpdateInfo info;

  @override
  Widget build(BuildContext context) {
    return PopScope(
      canPop: !info.isCritical,
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(24),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.system_update_alt_rounded,
                    size: 64,
                    color: info.isCritical ? AppColors.danger : AppColors.primary,
                  ),
                  const SizedBox(height: 24),
                  Text(
                    info.isCritical ? 'Update required' : 'Update available',
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: 16),
                  Text('Version ${info.latestVersion} is now available.'),
                  if (info.releaseNotes != null && info.releaseNotes!.isNotEmpty) ...[
                    const SizedBox(height: 16),
                    Text('What\'s new:', style: Theme.of(context).textTheme.labelLarge),
                    const SizedBox(height: 4),
                    Text(info.releaseNotes!),
                  ],
                  const SizedBox(height: 32),
                  FilledButton.icon(
                    onPressed: () => Navigator.pop(context, true),
                    icon: const Icon(Icons.download_rounded),
                    label: const Text('Update'),
                  ),
                  if (!info.isCritical) ...[
                    const SizedBox(height: 12),
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: const Text('Later'),
                    ),
                  ],
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }
}
