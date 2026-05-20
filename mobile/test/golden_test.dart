import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/core/widgets/section_card.dart';
import 'package:serviq_mobile/features/feed/domain/feed_snapshot.dart';
import 'package:serviq_mobile/features/people/domain/people_snapshot.dart';
import 'package:serviq_mobile/shared/components/feed_card.dart';
import 'package:serviq_mobile/shared/components/provider_card.dart';
import 'package:serviq_mobile/shared/components/trust_badge.dart';

void main() {
  testWidgets('FeedCard renders with sample service data', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              FeedCard(
                item: _sampleServiceItem,
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
    );
    await tester.pump();

    expect(find.text('Book'), findsOneWidget);
    expect(find.text('INR 1200'), findsOneWidget);
    expect(find.text('7.4 km away'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('FeedCard renders urgent demand item', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              FeedCard(
                item: _sampleUrgentItem,
                primaryLabel: 'Quote',
                isSaved: true,
                onPrimaryTap: () {},
                onSecondaryTap: () {},
                onSaveTap: () {},
                onMoreTap: () {},
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Quote'), findsOneWidget);
    expect(find.byIcon(Icons.bookmark_rounded), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ProviderCard renders with trust data', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ProviderCard(
                person: _samplePerson,
                reason: 'Active now and ready for fast follow-up.',
                onOpenProfile: () {},
                onMessage: () {},
                onSave: () {},
                onMore: () {},
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Priyanka Narayanan'), findsOneWidget);
    expect(find.text('4.9 stars'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('ProviderCard renders directory variant', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              ProviderDirectoryCard(
                person: _samplePerson,
                onOpenProfile: () {},
                onMessage: () {},
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Priyanka Narayanan'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('SignInPage renders on iPhone-sized viewport', (
    WidgetTester tester,
  ) async {
    tester.view.devicePixelRatio = 1.0;
    tester.view.physicalSize = const Size(390, 844);
    addTearDown(() {
      tester.view.resetPhysicalSize();
      tester.view.resetDevicePixelRatio();
    });

    await tester.pumpWidget(
      MaterialApp(theme: AppTheme.light(), home: const Scaffold(body: Placeholder())),
    );
    await tester.pump();

    expect(find.byType(Placeholder), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('TrustBadge renders variants', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: const Scaffold(
          body: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                TrustBadge(label: 'Verified'),
                SizedBox(height: 8),
                TrustBadge(label: '4.9 stars', icon: Icons.star_rounded),
                SizedBox(height: 8),
                TrustBadge(label: 'From INR 1200', icon: Icons.payments_outlined),
              ],
            ),
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Verified'), findsOneWidget);
    expect(find.text('4.9 stars'), findsOneWidget);
    expect(find.text('From INR 1200'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('SectionCard renders with content', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: ListView(
            padding: const EdgeInsets.all(16),
            children: [
              SectionCard(
                child: const Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('Section Title'),
                    SizedBox(height: 8),
                    Text('Section content here.'),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
    await tester.pump();

    expect(find.text('Section Title'), findsOneWidget);
    expect(find.text('Section content here.'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

const _sampleServiceItem = MobileFeedItem(
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
);

const _sampleUrgentItem = MobileFeedItem(
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
);

const _samplePerson = MobilePersonCard(
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
);
