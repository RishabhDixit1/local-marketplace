import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/auth/data/onboarding_handoff.dart';
import 'package:serviq_mobile/features/auth/presentation/sign_in_page.dart';

const _bootstrap = AppBootstrap(
  config: AppConfig(
    appName: 'ServiQ',
    environment: 'test',
    supabaseUrl: 'https://demo-project.supabase.co',
    supabaseAnonKey: 'demo-anon-key',
    apiBaseUrl: 'https://demo.serviq.app',
    authRedirectScheme: 'serviq',
    authRedirectHost: 'auth-callback',
    allowBadCertificates: false,
  ),
  client: null,
  supabaseReady: false,
  initializationError: null,
);

void main() {
  for (final width in <double>[320, 390, 430]) {
    testWidgets('sign in first page is stable at ${width.toInt()} width', (
      tester,
    ) async {
      await _pumpSignInPage(tester, Size(width, 844));

      expect(find.text('ServiQ'), findsOneWidget);
      expect(find.text('Find help'), findsOneWidget);
      expect(find.text('Earn nearby'), findsOneWidget);
      expect(find.text('Set up my business'), findsOneWidget);
      expect(find.text('Sign in with email'), findsOneWidget);
      expect(find.text('Send magic link instead'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('sign in remains scrollable at 160 percent text scale', (
    tester,
  ) async {
    await _pumpSignInPage(tester, const Size(390, 844), textScaleFactor: 1.6);

    expect(find.text('Your local marketplace'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Send magic link instead'),
      400,
      scrollable: scrollable,
    );
    await tester.pump(const Duration(milliseconds: 100));

    expect(find.text('Send magic link instead'), findsOneWidget);
  });

  testWidgets('intent selection updates without losing auth controls', (
    tester,
  ) async {
    final store = MemoryOnboardingHandoffStore();
    await _pumpSignInPage(tester, const Size(390, 844), store: store);

    await tester.tap(find.text('Earn nearby'));
    await tester.pump(const Duration(milliseconds: 200));

    expect(find.text('Sign in with email'), findsOneWidget);
    expect(find.text('Send magic link instead'), findsOneWidget);
    expect(store.readIntent(), MobileOnboardingIntent.earnNearby);
    expect(store.readLastRoute(), '/app/provider-onboarding');
    expect(tester.takeException(), isNull);
  });

  testWidgets('sign in restores a previous onboarding path', (tester) async {
    await _pumpSignInPage(
      tester,
      const Size(390, 844),
      store: MemoryOnboardingHandoffStore(
        initialIntent: MobileOnboardingIntent.businessSetup,
        initialLastRoute: '/app/provider-launchpad',
      ),
    );

    expect(find.text('Continue where you left off'), findsOneWidget);
    expect(
      find.text('Set up my business -> Business AI Launchpad'),
      findsOneWidget,
    );
    expect(find.text('Sign in with email'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _pumpSignInPage(
  WidgetTester tester,
  Size size, {
  double textScaleFactor = 1.0,
  OnboardingHandoffStore? store,
}) async {
  _setTestSurface(tester, size, textScaleFactor: textScaleFactor);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        appBootstrapProvider.overrideWithValue(_bootstrap),
        if (store != null)
          onboardingHandoffStoreProvider.overrideWithValue(store),
      ],
      child: MaterialApp(theme: AppTheme.light(), home: const SignInPage()),
    ),
  );
  await tester.pump(const Duration(milliseconds: 200));
}

void _setTestSurface(
  WidgetTester tester,
  Size size, {
  double textScaleFactor = 1.0,
}) {
  tester.view.devicePixelRatio = 1.0;
  tester.view.physicalSize = size;
  tester.binding.platformDispatcher.textScaleFactorTestValue = textScaleFactor;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.binding.platformDispatcher.clearTextScaleFactorTestValue();
  });
}
