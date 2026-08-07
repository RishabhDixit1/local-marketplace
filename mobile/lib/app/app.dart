import 'dart:async';

import 'package:flutter/material.dart';
import 'package:url_launcher/url_launcher.dart';

import '../../features/settings/data/theme_mode_provider.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_localizations/flutter_localizations.dart';

import '../core/auth/auth_state_controller.dart';
import '../core/firebase/app_firebase.dart';
import '../core/firebase/mobile_push_notifications.dart';
import '../core/network/offline_banner.dart';
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
      unawaited(_trackAppOpen());
    });
  }

  Future<void> _trackAppOpen() async {
    try {
      final bootstrap = ref.read(appBootstrapProvider);
      // Await the real Firebase initialization. appFirebaseProvider is a
      // FutureProvider backed by a memoized initialize() call that uses the
      // merged bootstrap config, so this reflects actual readiness rather
      // than a hardcoded disabled default.
      final firebase = await ref
          .read(appFirebaseProvider.future)
          .timeout(
            const Duration(seconds: 10),
            onTimeout: () => const AppFirebaseState.disabled(),
          );
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
    } catch (e) {
      debugPrint('ServiQ app._ServiQAppState analytics tracking failed: $e');
    }
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
          unawaited(handoff.completeAuthHandoff(startedRoute: destination).catchError((e, st) => debugPrint('ServiQ app.handoff failed: $e\n$st')));
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

    final locale = ref.watch(localeProvider);

    return MaterialApp.router(
      title: bootstrap.config.appName,
      debugShowCheckedModeBanner: false,
      theme: AppTheme.light(),
      darkTheme: AppTheme.dark(),
      themeMode: ref.watch(themeModeProvider),
      locale: locale,
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
        return _UpdateCheckGate(
          updateService: ref.read(appUpdateServiceProvider),
          child: Column(
            children: [
              const OfflineBanner(),
              Expanded(child: child!),
            ],
          ),
        );
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
    } catch (e) {
      debugPrint('ServiQ app._performUpdateCheck failed: $e');
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
    }).catchError((e, st) {
      debugPrint('ServiQ app._showUpdateGateDialog navigation result failed: $e\n$st');
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
    } catch (e) {
      debugPrint('ServiQ app._launchUpdateUrl failed: $e');
    }
  }

  @override
  Widget build(BuildContext context) => widget.child;
}

class _UpdateGatePage extends StatelessWidget {
  const _UpdateGatePage({required this.info});

  final AppUpdateInfo info;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    return PopScope(
      canPop: !info.isCritical,
      child: Scaffold(
        body: SafeArea(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.xl),
            child: Center(
              child: Column(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(
                    Icons.system_update_alt_rounded,
                    size: 64,
                    color: info.isCritical ? AppColors.danger : AppColors.primary,
                  ),
                  const SizedBox(height: AppSpacing.xl),
                  Text(
                    info.isCritical ? l10n.updateRequired : l10n.updateAvailable,
                    style: Theme.of(context).textTheme.headlineSmall,
                  ),
                  const SizedBox(height: AppSpacing.md),
                  Text(l10n.newVersionAvailable(info.latestVersion)),
                  if (info.releaseNotes != null && info.releaseNotes!.isNotEmpty) ...[
                    const SizedBox(height: AppSpacing.md),
                    Text(l10n.whatsNew, style: Theme.of(context).textTheme.labelLarge),
                    const SizedBox(height: AppSpacing.xxs),
                    Text(info.releaseNotes!),
                  ],
                  const SizedBox(height: AppSpacing.xxl),
                  FilledButton.icon(
                    onPressed: () => Navigator.pop(context, true),
                    icon: const Icon(Icons.download_rounded),
                    label: Text(l10n.update),
                  ),
                  if (!info.isCritical) ...[
                    const SizedBox(height: AppSpacing.sm),
                    TextButton(
                      onPressed: () => Navigator.pop(context, false),
                      child: Text(l10n.later),
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
