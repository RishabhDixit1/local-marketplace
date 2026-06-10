import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/feed/data/feed_repository.dart';
import 'package:serviq_mobile/features/feed/domain/feed_snapshot.dart';
import 'package:serviq_mobile/features/feed/presentation/feed_page.dart';
import 'package:serviq_mobile/features/people/data/people_repository.dart';
import 'package:serviq_mobile/features/people/domain/people_snapshot.dart';
import 'package:serviq_mobile/features/profile/data/profile_repository.dart';
import 'package:serviq_mobile/features/profile/domain/mobile_profile_snapshot.dart';
import 'package:serviq_mobile/features/profile/presentation/profile_page.dart';
import 'package:serviq_mobile/features/provider/presentation/provider_profile_page.dart';
import 'package:serviq_mobile/features/welcome/presentation/welcome_page.dart';
import 'package:serviq_mobile/shared/components/feed_card.dart';

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
  testWidgets('auth → browse feed flow: welcome page renders and scrolls', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [appBootstrapProvider.overrideWithValue(_bootstrap)],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const WelcomePage(
            snapshotOverride: AsyncData(_sampleSnapshot),
            trustedSnapshotOverride: AsyncData(_sampleSnapshot),
            peopleOverride: AsyncData(_samplePeopleSnapshot),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('What should I do now?'), findsOneWidget);
    expect(find.text('Post Need'), findsAtLeastNWidgets(1));
    expect(find.text('Find People'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Recommended'),
      280,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();
    expect(find.text('Recommended'), findsOneWidget);

    expect(tester.takeException(), isNull);
  });

  testWidgets('browse → message flow: people page to provider profile', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          peopleSnapshotProvider.overrideWith(
            (ref) async => _samplePeopleSnapshot,
          ),
          feedSnapshotProvider(
            MobileFeedScope.all,
          ).overrideWith((ref) async => _sampleSnapshot),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const ProviderProfilePage(providerId: 'provider-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Provider profile'), findsOneWidget);
    expect(find.text('Priyanka Narayanan'), findsAtLeastNWidgets(1));

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Services and signals'),
      220,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();
    expect(find.text('Services and signals'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('browse → order flow: feed card listing shows booking CTA', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [appBootstrapProvider.overrideWithValue(_bootstrap)],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: Scaffold(
            body: ListView(
              padding: const EdgeInsets.all(16),
              children: [
                FeedCard(
                  item: _sampleSnapshot.items[1],
                  primaryLabel: 'Book',
                  onPrimaryTap: () {},
                  onSecondaryTap: () {},
                  onSaveTap: () {},
                  onMoreTap: () {},
                ),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Service'), findsOneWidget);
    expect(find.text('INR 1200'), findsOneWidget);
    expect(find.text('7.4 km away'), findsOneWidget);

    await tester.tap(find.text('Book'));
    await tester.tap(find.byIcon(Icons.chat_bubble_outline_rounded).last);
    await tester.tap(find.byIcon(Icons.bookmark_border_rounded));
    await tester.tap(find.byIcon(Icons.more_horiz_rounded));
    expect(tester.takeException(), isNull);
  });

  testWidgets('profile → settings flow: sections render with user data', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          profileSnapshotProvider.overrideWith((ref) async => _sampleProfile),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const ProfilePage(snapshotOverride: AsyncData(_sampleProfile)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Profile Hub'), findsOneWidget);
    expect(find.text('Business Control'), findsOneWidget);
    expect(find.text('Public Profile'), findsAtLeastNWidgets(1));
    expect(find.text('Edit Profile'), findsAtLeastNWidgets(1));
    expect(find.text('Listings'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('dark theme: feed page renders without errors', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [appBootstrapProvider.overrideWithValue(_bootstrap)],
        child: MaterialApp(
          theme: AppTheme.dark(),
          home: const FeedPage(
            snapshotOverride: AsyncData(_sampleSnapshot),
            peopleOverride: AsyncData(_samplePeopleSnapshot),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Find Help'), findsOneWidget);
    expect(find.text('Search services, requests, or areas'), findsOneWidget);
    expect(find.text('Find local help nearby.'), findsOneWidget);
    expect(find.text('Post Need'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Urgent nearby'),
      220,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();
    expect(find.text('Urgent nearby'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
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
      providerId: 'provider-1',
      source: MobileFeedSource.helpRequest,
      type: MobileFeedItemType.demand,
      title: 'Emergency multi-room electrical rewiring support',
      description:
          'Need a verified electrician who can inspect, rewire, and document a repair plan for an older flat before tenants move in this weekend.',
      category: 'Electrical and safety inspection',
      creatorName: 'Priyanka Narayanan',
      avatarUrl: '',
      locationLabel: 'Koramangala 6th Block, Bengaluru',
      statusLabel: 'Awaiting Provider Confirmation',
      priceLabel: 'Budget shared in chat',
      price: 0,
      timeLabel: 'Recently posted',
      distanceLabel: '14.2 km away',
      publicProfilePath: '/profile/priyanka-narayanan',
      verificationStatus: 'verified',
      profileCompletion: 92,
      responseMinutes: 18,
      averageRating: 4.8,
      reviewCount: 21,
      completedJobs: 37,
      listingCount: 4,
      urgent: true,
      mediaCount: 3,
    ),
    MobileFeedItem(
      id: 'service-1',
      providerId: 'provider-2',
      source: MobileFeedSource.serviceListing,
      type: MobileFeedItemType.service,
      title: 'On-site appliance repair and preventive service',
      description:
          'Same-day visits for washing machines, microwaves, and refrigerators with spare-part pickup if needed.',
      category: 'Appliance repair and maintenance',
      creatorName: 'Northside Repair Collective',
      avatarUrl: '',
      locationLabel: 'HSR Layout, Bengaluru',
      statusLabel: 'Open',
      priceLabel: 'INR 1200',
      price: 1200,
      timeLabel: '2h ago',
      distanceLabel: '7.4 km away',
      publicProfilePath: '/profile/northside-repair',
      verificationStatus: 'pending',
      profileCompletion: 76,
      responseMinutes: 34,
      averageRating: 4.6,
      reviewCount: 9,
      completedJobs: 12,
      listingCount: 2,
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

const _samplePeopleSnapshot = MobilePeopleSnapshot(
  currentUserId: 'viewer-1',
  people: [
    MobilePersonCard(
      id: 'provider-1',
      name: 'Priyanka Narayanan',
      avatarUrl: '',
      headline: 'Trusted home services across Bengaluru',
      locationLabel: 'Koramangala 6th Block, Bengaluru',
      isOnline: true,
      activityLabel: 'Online now',
      verificationLabel: 'Verified',
      completionPercent: 92,
      primaryTags: ['Electrical', 'Emergency repairs'],
      openNeedsCount: 2,
      postCount: 5,
      completedJobs: 37,
      openLeads: 3,
      averageRating: 4.9,
      reviewCount: 18,
      priceLabel: 'From INR 1200',
    ),
  ],
);
