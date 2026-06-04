import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/profile/domain/mobile_profile_snapshot.dart';
import 'package:serviq_mobile/features/profile/presentation/profile_page.dart';

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
    testWidgets('profile hub is stable at ${width.toInt()} width', (
      tester,
    ) async {
      await _pumpProfile(tester, Size(width, 844));

      expect(find.text('Profile Hub'), findsOneWidget);
      expect(find.text('Business Control'), findsOneWidget);
      expect(find.text('Public Profile'), findsAtLeastNWidgets(1));
      expect(find.text('Edit Profile'), findsAtLeastNWidgets(1));
      expect(find.text('Listings'), findsOneWidget);
      expect(find.text('Leads and Inbox'), findsOneWidget);
      expect(find.text('Payments and Orders'), findsOneWidget);
      expect(find.text('Trust'), findsOneWidget);
      expect(find.text('Verification'), findsOneWidget);
      expect(find.text('Saved'), findsOneWidget);
      expect(find.text('Notifications'), findsOneWidget);
      expect(find.text('Settings'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('profile hub exposes setup, listings, trust, and settings', (
    tester,
  ) async {
    await _pumpProfile(
      tester,
      const Size(390, 844),
      initialSection: 'businessSetup',
      showCommandHub: false,
    );

    expect(find.text('Launchpad output destination'), findsOneWidget);
    expect(find.text('Continue Business AI setup'), findsOneWidget);

    await _pumpProfile(
      tester,
      const Size(390, 844),
      initialSection: 'listings',
      showCommandHub: false,
    );
    expect(find.text('Published listings'), findsOneWidget);
    expect(find.text('Emergency electrical repair'), findsOneWidget);

    await _pumpProfile(
      tester,
      const Size(390, 844),
      initialSection: 'trust',
      showCommandHub: false,
    );
    expect(find.text('Verification meaning'), findsOneWidget);
    expect(find.text('Payment trust'), findsOneWidget);

    await _pumpProfile(
      tester,
      const Size(390, 844),
      initialSection: 'settings',
      showCommandHub: false,
    );
    expect(find.text('Payment methods'), findsOneWidget);
    expect(find.text('Account'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile hub tolerates 160 percent text scale', (tester) async {
    await _pumpProfile(
      tester,
      const Size(390, 844),
      textScaleFactor: 1.6,
      initialSection: 'businessSetup',
      showCommandHub: false,
    );
    await _show(tester, find.text('Business Setup'));
    await _show(tester, find.text('Launchpad output destination'));

    await _pumpProfile(
      tester,
      const Size(390, 844),
      textScaleFactor: 1.6,
      initialSection: 'listings',
      showCommandHub: false,
    );
    await _show(tester, find.text('Published listings'));
    await _show(tester, find.text('Emergency electrical repair'));

    expect(tester.takeException(), isNull);
  });
}

Future<void> _show(WidgetTester tester, Finder finder) async {
  await tester.ensureVisible(finder.first);
  await tester.pumpAndSettle();
}

Future<void> _pumpProfile(
  WidgetTester tester,
  Size size, {
  double textScaleFactor = 1.0,
  String initialSection = 'hub',
  bool showCommandHub = true,
}) async {
  _setTestSurface(tester, size, textScaleFactor: textScaleFactor);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [appBootstrapProvider.overrideWithValue(_bootstrap)],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: ProfilePage(
          snapshotOverride: const AsyncData(_sampleProfile),
          initialSection: initialSection,
          showCommandHub: showCommandHub,
        ),
      ),
    ),
  );
  await tester.pumpAndSettle();
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

const _sampleProfile = MobileProfileSnapshot(
  userId: 'viewer-1',
  email: 'priyanka@serviq.dev',
  displayName: 'Priyanka Narayanan',
  publicPath: '/profile/priyanka-narayanan-viewer-1',
  linkedProviders: ['email'],
  roleFamily: 'provider',
  profile: MobileProfileRecord(
    fullName: 'Priyanka Narayanan',
    headline: 'Trusted home services across Bengaluru',
    location: 'Koramangala 6th Block, Bengaluru',
    bio:
        'Electrician and small-team operator focused on urgent repairs, scheduled maintenance, and transparent follow-through.',
    avatarUrl: '',
    phone: '9876543210',
    website: 'https://serviq.example/priyanka',
    availability: 'available',
    verificationLevel: 'email_verified',
  ),
  services: [
    MobileProfileService(
      title: 'Emergency electrical repair',
      price: 1200,
      pricingType: 'fixed',
      availability: 'available',
    ),
  ],
  products: [
    MobileProfileProduct(
      title: 'Smart switch installation kit',
      price: 799,
      stock: 14,
      deliveryMode: 'delivery',
    ),
  ],
  portfolio: [
    MobileProfilePortfolioItem(
      title: 'Office lighting retrofit',
      category: 'Electrical',
    ),
  ],
  workHistory: [
    MobileProfileWorkHistoryItem(
      roleTitle: 'Lead technician',
      companyName: 'Bright Circuit Collective',
      isCurrent: true,
    ),
  ],
  availability: [
    MobileProfileAvailabilityItem(
      label: 'Weekday mornings',
      availability: 'available',
      daysOfWeek: ['Mon', 'Tue', 'Wed'],
      startTime: '09:00',
      endTime: '13:00',
    ),
  ],
  paymentMethods: [
    MobileProfilePaymentMethod(
      methodType: 'bank_transfer',
      providerName: 'HDFC',
      accountLabel: 'Primary business account',
      isDefault: true,
      isVerified: true,
    ),
  ],
  reviews: [
    MobileProfileReview(rating: 4.9, comment: 'Fast and careful work.'),
  ],
  averageRating: 4.9,
  reviewCount: 18,
  serviceCount: 6,
  productCount: 2,
  portfolioCount: 4,
  workHistoryCount: 2,
  availabilityCount: 3,
  paymentMethodCount: 1,
  completionPercent: 92,
  trustScore: 88,
);
