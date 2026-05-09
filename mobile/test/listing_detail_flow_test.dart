import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:serviq_mobile/core/constants/app_routes.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/feed/domain/feed_snapshot.dart';
import 'package:serviq_mobile/features/listings/presentation/listing_detail_page.dart';

void main() {
  testWidgets('listing detail connects offer chat and checkout actions', (
    tester,
  ) async {
    tester.view.devicePixelRatio = 1.0;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(() {
      tester.view.resetDevicePixelRatio();
      tester.view.resetPhysicalSize();
    });

    final router = GoRouter(
      initialLocation: '/',
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const ListingDetailPage(
            itemId: 'service-1',
            source: 'service_listing',
            snapshotOverride: AsyncData(_listingSnapshot),
          ),
        ),
        GoRoute(
          path: AppRoutes.chat,
          builder: (context, state) {
            final draft = state.uri.queryParameters['draft'] ?? '';
            final title = state.uri.queryParameters['title'] ?? '';
            return Scaffold(body: Text('Chat route: $title | $draft'));
          },
        ),
        GoRoute(
          path: AppRoutes.checkout,
          builder: (context, state) {
            final itemId = state.uri.queryParameters['itemId'] ?? '';
            final itemType = state.uri.queryParameters['itemType'] ?? '';
            return Scaffold(body: Text('Checkout route: $itemType $itemId'));
          },
        ),
      ],
    );

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp.router(
          theme: AppTheme.light(),
          routerConfig: router,
        ),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('On-site appliance repair'), findsOneWidget);
    expect(find.text('Chat'), findsOneWidget);
    expect(find.text('Make offer'), findsOneWidget);
    expect(find.text('Reserve'), findsOneWidget);

    final scrollable = find.byType(Scrollable).first;
    await tester.scrollUntilVisible(
      find.text('Northside Repair Collective'),
      180,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();
    expect(find.text('Northside Repair Collective'), findsOneWidget);
    expect(find.text('4.7 (11)'), findsOneWidget);

    await tester.scrollUntilVisible(
      find.text('Pickup and delivery'),
      180,
      scrollable: scrollable,
    );
    await tester.pumpAndSettle();
    expect(find.text('Pickup and delivery'), findsOneWidget);

    await tester.tap(find.text('Make offer'));
    await tester.pumpAndSettle();

    expect(find.textContaining('Chat route:'), findsOneWidget);
    expect(find.textContaining('make an offer'), findsOneWidget);

    router.go('/');
    await tester.pumpAndSettle();

    await tester.tap(find.text('Reserve'));
    await tester.pumpAndSettle();

    expect(find.text('Checkout route: service service-1'), findsOneWidget);
  });
}

const _listingSnapshot = MobileFeedSnapshot(
  currentUserId: 'viewer-1',
  stats: MobileFeedStats(
    total: 1,
    urgent: 0,
    demand: 0,
    service: 1,
    product: 0,
  ),
  items: [
    MobileFeedItem(
      id: 'service-1',
      providerId: 'provider-2',
      source: MobileFeedSource.serviceListing,
      type: MobileFeedItemType.service,
      title: 'On-site appliance repair',
      description:
          'Same-day diagnosis for washing machines, microwaves, and refrigerators.',
      category: 'Appliance repair',
      creatorName: 'Northside Repair Collective',
      avatarUrl: '',
      locationLabel: 'HSR Layout, Bengaluru',
      statusLabel: 'Open',
      priceLabel: 'INR 1200',
      price: 1200,
      timeLabel: '2h ago',
      distanceLabel: '7.4 km away',
      publicProfilePath: '/profile/northside-repair',
      verificationStatus: 'verified',
      profileCompletion: 88,
      responseMinutes: 18,
      averageRating: 4.7,
      reviewCount: 11,
      completedJobs: 24,
      listingCount: 3,
      urgent: false,
      mediaCount: 2,
    ),
  ],
);
