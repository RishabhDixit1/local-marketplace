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

    expect(find.text('Local Help Marketplace for Everyday Needs.'), findsOneWidget);
    expect(find.textContaining('Marketplace feed'), findsOneWidget);
    expect(find.text('Post a Need'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('feed page stays stable on iPhone-sized widths', (
    WidgetTester tester,
  ) async {
    await _pumpFeedPage(tester, const Size(390, 844));

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
    const bootstrap = AppBootstrap(
      config: AppConfig(
        appName: 'ServiQ',
        environment: 'test',
        supabaseUrl: 'https://demo-project.supabase.co',
        supabaseAnonKey: 'demo-anon-key',
        apiBaseUrl: 'https://demo.serviq.app',
        authRedirectScheme: 'serviq',
        authRedirectHost: 'auth-callback',
      ),
      client: null,
      supabaseReady: false,
      initializationError: null,
    );

    await tester.pumpWidget(
      ProviderScope(
        overrides: [appBootstrapProvider.overrideWithValue(bootstrap)],
        child: MaterialApp(theme: AppTheme.light(), home: const SignInPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Continue with email code'), findsOneWidget);
    await tester.drag(find.byType(ListView), const Offset(0, -500));
    await tester.pumpAndSettle();
    expect(find.text('Continue with Google'), findsAtLeastNWidgets(1));
    expect(find.text('Email + password'), findsOneWidget);
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
