import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/core/widgets/section_card.dart';
import 'package:serviq_mobile/features/auth/presentation/sign_in_page.dart';
import 'package:serviq_mobile/features/feed/domain/feed_snapshot.dart';
import 'package:serviq_mobile/features/feed/presentation/feed_page.dart';
import 'package:serviq_mobile/features/post_create/presentation/create_need_page.dart';
import 'package:serviq_mobile/features/profile/domain/mobile_profile_snapshot.dart';
import 'package:serviq_mobile/features/profile/presentation/profile_page.dart';

void main() {
  const bootstrap = AppBootstrap(
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

  testWidgets('section card renders child content', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      const MaterialApp(
        home: Scaffold(body: SectionCard(child: Text('ServiQ mobile'))),
      ),
    );

    expect(find.text('ServiQ mobile'), findsOneWidget);
  });

  testWidgets('feed page stays stable on narrow handset widths', (
    WidgetTester tester,
  ) async {
    await _pumpFeedPage(tester, const Size(320, 640));

    expect(find.text('Explore'), findsOneWidget);
    expect(
      find.text('Nearby demand, trusted providers, faster response.'),
      findsOneWidget,
    );
    expect(find.text('Connected'), findsOneWidget);
    expect(find.text('Local Help Marketplace for Everyday Needs.'), findsOneWidget);
    expect(find.textContaining('Marketplace feed'), findsOneWidget);
    expect(find.text('Post a Need'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('feed page stays stable on iPhone-sized widths', (
    WidgetTester tester,
  ) async {
    await _pumpFeedPage(tester, const Size(390, 844));

    expect(find.text('Explore'), findsOneWidget);
    expect(find.text('Local Help Marketplace for Everyday Needs.'), findsOneWidget);
    expect(
      find.text('Emergency multi-room electrical rewiring support'),
      findsAtLeastNWidgets(1),
    );
    expect(find.text('Electrical and safety inspection'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('sign in page shows the three mobile auth paths', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [appBootstrapProvider.overrideWithValue(bootstrap)],
        child: MaterialApp(theme: AppTheme.light(), home: const SignInPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Continue with email code'), findsOneWidget);
    expect(find.text('Send magic link'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -900));
    await tester.pumpAndSettle();
    expect(find.text('Continue with Google'), findsAtLeastNWidgets(1));
    expect(find.text('Email + password'), findsOneWidget);
  });

  testWidgets('profile page renders synced storefront data', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [appBootstrapProvider.overrideWithValue(bootstrap)],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const ProfilePage(snapshotOverride: AsyncData(_sampleProfile)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Profile summary'), findsOneWidget);
    expect(find.text('Services'), findsAtLeastNWidgets(1));
    expect(find.text('Products'), findsAtLeastNWidgets(1));
    expect(find.text('Link Google to this account'), findsOneWidget);
    expect(find.text('Emergency electrical repair'), findsOneWidget);
  });

  testWidgets('create request page validates before step two', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const CreateNeedPage(),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Create request'), findsOneWidget);
    expect(find.text('Request basics'), findsOneWidget);

    await tester.ensureVisible(find.text('Continue'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Continue'));
    await tester.pumpAndSettle();

    expect(find.text('Add a clear request title.'), findsOneWidget);
    expect(find.text('Location and budget'), findsNothing);
  });
}

Future<void> _pumpFeedPage(WidgetTester tester, Size size) async {
  tester.view.devicePixelRatio = 1.0;
  tester.view.physicalSize = size;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
  });

  await tester.pumpWidget(
    ProviderScope(
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const FeedPage(snapshotOverride: AsyncData(_sampleSnapshot)),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

const _sampleSnapshot = MobileFeedSnapshot(
  currentUserId: 'viewer-1',
  stats: MobileFeedStats(
    total: 12,
    urgent: 4,
    demand: 7,
    service: 3,
    product: 2,
  ),
  items: [
    MobileFeedItem(
      id: 'need-1',
      type: MobileFeedItemType.demand,
      title: 'Emergency multi-room electrical rewiring support',
      description:
          'Need a verified electrician who can inspect, rewire, and document a repair plan for an older flat before tenants move in this weekend.',
      category: 'Electrical and safety inspection',
      creatorName: 'Priyanka Narayanan',
      locationLabel: 'Koramangala 6th Block, Bengaluru',
      statusLabel: 'Awaiting Provider Confirmation',
      priceLabel: 'Budget shared in chat',
      timeLabel: 'Recently posted',
      distanceLabel: '14.2 km away',
      urgent: true,
      mediaCount: 3,
    ),
    MobileFeedItem(
      id: 'service-1',
      type: MobileFeedItemType.service,
      title: 'On-site appliance repair and preventive service',
      description:
          'Same-day visits for washing machines, microwaves, and refrigerators with spare-part pickup if needed.',
      category: 'Appliance repair and maintenance',
      creatorName: 'Northside Repair Collective',
      locationLabel: 'HSR Layout, Bengaluru',
      statusLabel: 'Open',
      priceLabel: 'INR 1200',
      timeLabel: '2h ago',
      distanceLabel: '7.4 km away',
      urgent: false,
      mediaCount: 0,
    ),
  ],
);

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
    MobileProfileReview(
      rating: 4.9,
      comment: 'Fast and careful work.',
    ),
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
