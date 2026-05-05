import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/core/widgets/section_card.dart';
import 'package:serviq_mobile/features/auth/presentation/sign_in_page.dart';
import 'package:serviq_mobile/features/chat/data/chat_repository.dart';
import 'package:serviq_mobile/features/chat/domain/chat_models.dart';
import 'package:serviq_mobile/features/chat/presentation/chat_page.dart';
import 'package:serviq_mobile/features/feed/data/feed_repository.dart';
import 'package:serviq_mobile/features/feed/domain/feed_snapshot.dart';
import 'package:serviq_mobile/features/feed/presentation/feed_page.dart';
import 'package:serviq_mobile/features/people/data/people_repository.dart';
import 'package:serviq_mobile/features/people/domain/people_snapshot.dart';
import 'package:serviq_mobile/features/people/presentation/people_page.dart';
import 'package:serviq_mobile/features/post_create/presentation/create_need_page.dart';
import 'package:serviq_mobile/features/provider/presentation/provider_profile_page.dart';
import 'package:serviq_mobile/features/profile/domain/mobile_profile_snapshot.dart';
import 'package:serviq_mobile/features/profile/presentation/profile_page.dart';
import 'package:serviq_mobile/features/search/presentation/search_page.dart';
import 'package:serviq_mobile/features/welcome/presentation/welcome_page.dart';
import 'package:serviq_mobile/shared/components/feed_card.dart';
import 'package:serviq_mobile/shared/components/provider_card.dart';

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

    expect(find.text('Find Help'), findsOneWidget);
    expect(find.text('Search services, requests, or areas'), findsOneWidget);
    expect(find.text('Find local help nearby.'), findsOneWidget);
    expect(find.text('Post Need'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Search and filters'),
      180,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();

    expect(find.text('Search and filters'), findsOneWidget);
    expect(find.text('Verified'), findsAtLeastNWidgets(1));

    await tester.scrollUntilVisible(
      find.text('Requests you can act on'),
      220,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();

    expect(find.text('Requests you can act on'), findsAtLeastNWidgets(1));
    expect(find.text('Trusted providers'), findsAtLeastNWidgets(1));
    expect(tester.takeException(), isNull);
  });

  testWidgets('feed page stays stable on iPhone-sized widths', (
    WidgetTester tester,
  ) async {
    await _pumpFeedPage(tester, const Size(390, 844));

    expect(find.text('Find Help'), findsOneWidget);
    expect(find.text('Find local help nearby.'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Urgent nearby'),
      220,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Emergency multi-room electrical rewiring support'),
      findsAtLeastNWidgets(1),
    );
    expect(find.text('Urgent nearby'), findsOneWidget);
    expect(find.text('Electrical and safety inspection'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('feed page tolerates larger mobile text scaling', (
    WidgetTester tester,
  ) async {
    await _pumpFeedPage(tester, const Size(390, 844), textScaleFactor: 1.3);

    expect(find.text('Find Help'), findsOneWidget);
    expect(find.text('Search and filters'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Urgent nearby'),
      240,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();

    expect(find.text('Urgent nearby'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('welcome page renders the trust-first mobile home structure', (
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

    expect(find.textContaining('Start with one clear action'), findsOneWidget);
    expect(find.text('Post a Need'), findsAtLeastNWidgets(1));
    expect(find.text('Earn Nearby'), findsOneWidget);
    expect(find.text('People'), findsAtLeastNWidgets(1));
    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Trusted activity'),
      240,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();
    expect(find.text('Trusted activity'), findsOneWidget);
    await tester.scrollUntilVisible(
      find.text('Live for today'),
      220,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();
    expect(find.text('Live for today'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('sign in page shows the three mobile auth paths', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [appBootstrapProvider.overrideWithValue(_bootstrap)],
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
        overrides: [appBootstrapProvider.overrideWithValue(_bootstrap)],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const ProfilePage(snapshotOverride: AsyncData(_sampleProfile)),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Public profile preview'), findsOneWidget);
    expect(find.text('View Profile'), findsOneWidget);
    expect(find.text('Business Setup'), findsOneWidget);
    expect(find.text('Listings'), findsOneWidget);

    await tester.tap(find.text('Listings'));
    await tester.pumpAndSettle();

    expect(find.text('Services'), findsAtLeastNWidgets(1));
    expect(find.text('Products'), findsAtLeastNWidgets(1));
    expect(find.text('Emergency electrical repair'), findsOneWidget);

    await tester.tap(find.text('Trust'));
    await tester.pumpAndSettle();

    expect(find.text('Link Google to this account'), findsOneWidget);
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

  testWidgets('search page shows nearby provider matches', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          feedSnapshotProvider(
            MobileFeedScope.all,
          ).overrideWith((ref) async => _sampleSnapshot),
          peopleSnapshotProvider.overrideWith(
            (ref) async => _samplePeopleSnapshot,
          ),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const SearchPage(initialQuery: 'electric'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Search nearby'), findsOneWidget);
    expect(find.text('Priyanka Narayanan'), findsAtLeastNWidgets(1));
  });

  testWidgets('provider cards clamp long profile intros on narrow widths', (
    WidgetTester tester,
  ) async {
    const longIntro =
        'As a Marketing Executive at 1X Sportz, I manage campaigns, '
        'partner coordination, performance reporting, and every operational '
        'detail needed to keep the local provider workflow moving.';

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: Center(
            child: SizedBox(
              width: 360,
              child: ProviderCard(
                person: MobilePersonCard(
                  id: 'provider-long-bio',
                  name: 'Vivek Singh',
                  avatarUrl: '',
                  headline: longIntro,
                  locationLabel: 'Crossing Republik, Ghaziabad',
                  isOnline: false,
                  activityLabel: 'Recently active',
                  verificationLabel: 'Growing profile',
                  completionPercent: 64,
                  primaryTags: ['CCTV', 'Delivery', 'Electrician'],
                  openNeedsCount: 0,
                  postCount: 0,
                  completedJobs: 0,
                  openLeads: 0,
                  averageRating: null,
                  reviewCount: 0,
                  priceLabel: 'Pricing in chat',
                ),
                onOpenProfile: () {},
                onMessage: () {},
              ),
            ),
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    final intro = tester.widget<Text>(find.text(longIntro));
    expect(intro.maxLines, 2);
    expect(intro.overflow, TextOverflow.ellipsis);
    expect(tester.takeException(), isNull);
  });

  testWidgets('feed card exposes trust, save, more, and CTA actions', (
    WidgetTester tester,
  ) async {
    var opened = 0;
    var messaged = 0;
    var saved = 0;
    var more = 0;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              FeedCard(
                item: _sampleSnapshot.items[1],
                primaryLabel: 'Book',
                secondaryLabel: 'Message',
                isSaved: false,
                onPrimaryTap: () => opened += 1,
                onSecondaryTap: () => messaged += 1,
                onSaveTap: () => saved += 1,
                onMoreTap: () => more += 1,
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Service'), findsOneWidget);
    expect(find.text('INR 1200'), findsOneWidget);
    expect(find.text('7.4 km away'), findsOneWidget);
    expect(find.text('12 jobs completed'), findsOneWidget);
    expect(find.text('Replies in 34 min'), findsOneWidget);

    await tester.tap(find.text('Book'));
    await tester.tap(find.byIcon(Icons.chat_bubble_outline_rounded).last);
    await tester.tap(find.byIcon(Icons.bookmark_border_rounded));
    await tester.tap(find.byIcon(Icons.more_horiz_rounded));

    expect(opened, 1);
    expect(messaged, 1);
    expect(saved, 1);
    expect(more, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('provider card shows trust snapshot and compact actions', (
    WidgetTester tester,
  ) async {
    var opened = 0;
    var messaged = 0;
    var saved = 0;
    var more = 0;

    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ProviderCard(
                person: _samplePeopleSnapshot.people.first,
                isSaved: true,
                reason: 'Active now and ready for fast follow-up.',
                onOpenProfile: () => opened += 1,
                onMessage: () => messaged += 1,
                onSave: () => saved += 1,
                onMore: () => more += 1,
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Priyanka Narayanan'), findsOneWidget);
    expect(find.text('4.9 stars'), findsOneWidget);
    expect(find.text('37 jobs completed'), findsOneWidget);
    expect(find.text('Recommended nearby'), findsOneWidget);
    expect(
      find.text('Active now and ready for fast follow-up.'),
      findsOneWidget,
    );

    await tester.tap(find.text('Open profile'));
    await tester.tap(find.byIcon(Icons.chat_bubble_outline_rounded));
    await tester.tap(find.byIcon(Icons.bookmark_rounded));
    await tester.tap(find.byIcon(Icons.more_horiz_rounded));

    expect(opened, 1);
    expect(messaged, 1);
    expect(saved, 1);
    expect(more, 1);
    expect(tester.takeException(), isNull);
  });

  testWidgets('find cards hide noisy metadata on narrow widths', (
    WidgetTester tester,
  ) async {
    const longIntro =
        'As a Marketing Executive at 1X Sportz, I manage campaigns, '
        'partner coordination, performance reporting, and every operational '
        'detail needed to keep the local provider workflow moving.';
    const longName = 'Vivek Singh Local Services And Operations Partner';

    _setTestSurface(tester, const Size(320, 640));

    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          peopleSnapshotProvider.overrideWith(
            (ref) async => const MobilePeopleSnapshot(
              currentUserId: 'viewer-1',
              people: [
                MobilePersonCard(
                  id: 'provider-noisy',
                  name: longName,
                  avatarUrl: '',
                  headline: longIntro,
                  locationLabel:
                      'Crossing Republik Extension, Ghaziabad Sector 14',
                  isOnline: false,
                  activityLabel: 'Recently active',
                  verificationLabel: 'Growing profile',
                  completionPercent: 64,
                  primaryTags: [
                    'CCTV',
                    'Delivery',
                    'Electrician',
                    'Appliance repair',
                  ],
                  openNeedsCount: 0,
                  postCount: 0,
                  completedJobs: 0,
                  openLeads: 0,
                  averageRating: null,
                  reviewCount: 0,
                  priceLabel: 'Pricing in chat',
                ),
              ],
            ),
          ),
        ],
        child: MaterialApp(theme: AppTheme.light(), home: const PeoplePage()),
      ),
    );
    await tester.pumpAndSettle();

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text(longName),
      220,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();

    expect(find.byType(ProviderDirectoryCard), findsOneWidget);
    expect(find.text('Pricing in chat'), findsNothing);
    expect(find.text('New to reviews'), findsNothing);
    expect(find.text('Growing profile'), findsNothing);
    expect(find.text(longIntro), findsNothing);
    expect(find.text('CCTV, Delivery'), findsOneWidget);
    expect(find.text('CCTV'), findsOneWidget);
    expect(find.text('Delivery'), findsOneWidget);
    expect(find.text('Electrician'), findsNothing);

    final name = tester.widget<Text>(find.text(longName));
    final headline = tester.widget<Text>(find.text('CCTV, Delivery'));
    expect(name.maxLines, 1);
    expect(name.overflow, TextOverflow.ellipsis);
    expect(headline.maxLines, 2);
    expect(headline.overflow, TextOverflow.ellipsis);
    expect(tester.takeException(), isNull);
  });

  test('people snapshot prefers service headlines over long profile bios', () {
    const longBio =
        'As a Marketing Executive at 1X Sportz, I manage campaigns, '
        'partner coordination, performance reporting, and every operational '
        'detail needed to keep the local provider workflow moving.';

    final snapshot = MobilePeopleSnapshot.fromJson({
      'currentUserId': 'viewer-1',
      'profiles': [
        {
          'id': 'provider-1',
          'name': 'Vivek Singh',
          'headline': longBio,
          'role': 'provider',
          'profile_completion_percent': 64,
        },
      ],
      'services': [
        {
          'provider_id': 'provider-1',
          'title': 'CCTV installation and repair',
          'category': 'Security systems',
        },
      ],
    });

    expect(snapshot.people.single.headline, 'CCTV installation and repair');
  });

  test('people snapshot suppresses resume-style profile headlines', () {
    final snapshot = MobilePeopleSnapshot.fromJson({
      'currentUserId': 'viewer-1',
      'profiles': [
        {
          'id': 'provider-1',
          'name': 'Vivek Singh',
          'headline':
              'Business Development & Sponsorship Manager | Client Acquisition | LinkedIn',
          'role': 'provider',
          'profile_completion_percent': 64,
          'services': ['All accessories', 'Delivery'],
        },
      ],
    });

    expect(snapshot.people.single.headline, 'All accessories, Delivery');
  });

  testWidgets('provider profile opens with related local posts', (
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
  });

  testWidgets('chat page opens a conversation thread', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          chatConversationsProvider.overrideWith(
            (ref) async => _sampleConversations,
          ),
          chatMessagesProvider(
            'conv-1',
          ).overrideWith((ref) async => _sampleMessages),
        ],
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const ChatPage(initialConversationId: 'conv-1'),
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Conversation'), findsOneWidget);
    expect(find.text('I can reach within 20 minutes.'), findsOneWidget);
  });
}

Future<void> _pumpFeedPage(
  WidgetTester tester,
  Size size, {
  double textScaleFactor = 1.0,
}) async {
  _setTestSurface(tester, size, textScaleFactor: textScaleFactor);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [appBootstrapProvider.overrideWithValue(_bootstrap)],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const FeedPage(
          snapshotOverride: AsyncData(_sampleSnapshot),
          peopleOverride: AsyncData(_samplePeopleSnapshot),
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

const _sampleConversations = [
  ChatConversation(
    id: 'conv-1',
    name: 'Priyanka Narayanan',
    avatarUrl: '',
    otherUserId: 'provider-1',
    lastMessage: 'I can reach within 20 minutes.',
    lastMessageAt: null,
    unreadCount: 1,
    isOnline: true,
    subtitle: 'Trusted home services across Bengaluru',
  ),
];

final _sampleMessages = [
  ChatMessageItem(
    id: 'msg-1',
    conversationId: 'conv-1',
    senderId: 'provider-1',
    content: 'I can reach within 20 minutes.',
    createdAt: DateTime(2026, 4, 18, 10, 30),
  ),
];
