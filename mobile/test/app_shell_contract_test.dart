import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/app/presentation/app_shell.dart';
import 'package:serviq_mobile/app/presentation/main_bottom_nav.dart';
import 'package:serviq_mobile/core/constants/app_routes.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';

void main() {
  test('home route points at the welcome surface', () {
    expect(AppRoutes.home, AppRoutes.welcome);
  });

  test('marketplace engine routes carry native workflow context', () {
    expect(AppRoutes.providerLaunchpad, '/app/provider-launchpad');
    expect(AppRoutes.providerListings, '/app/provider-listings');
    expect(AppRoutes.listings, '/app/listings');
    expect(AppRoutes.control, '/app/control');
    expect(AppRoutes.profilePublic, '/app/profile/public');
    expect(AppRoutes.profileEdit, '/app/profile/edit');
    expect(AppRoutes.profileTrust, '/app/profile/trust');
    expect(AppRoutes.profileSettings, '/app/profile/settings');
    expect(AppRoutes.orders, '/app/orders');
    expect(AppRoutes.orderDetail('order-1'), '/app/orders/order-1');
    expect(
      AppRoutes.quoteRoom(
        mode: 'help_request',
        targetId: 'need-1',
        conversationId: 'chat-1',
      ),
      '/app/quote?mode=help_request&targetId=need-1&conversationId=chat-1',
    );
    expect(
      AppRoutes.listingDetail('service-1', source: 'service_listing'),
      '/app/listings/service-1?source=service_listing',
    );
    expect(
      AppRoutes.checkoutItem(
        providerId: 'provider-1',
        itemType: 'product',
        itemId: 'product-1',
        title: 'Water filter',
        price: 2400,
      ),
      '/app/checkout?providerId=provider-1&itemType=product&itemId=product-1&title=Water+filter&price=2400.0&quantity=1',
    );
  });

  test('post action stays contextual and off dense workflow branches', () {
    expect(shouldShowPostActionForBranch(0), isFalse);
    expect(shouldShowPostActionForBranch(1), isTrue);
    expect(shouldShowPostActionForBranch(2), isFalse);
    expect(shouldShowPostActionForBranch(3), isFalse);
    expect(shouldShowPostActionForBranch(4), isFalse);
  });

  test('navigation adapts at tablet width', () {
    expect(shouldUseRailNavigation(430), isFalse);
    expect(shouldUseRailNavigation(699), isFalse);
    expect(shouldUseRailNavigation(700), isTrue);
    expect(shouldUseRailNavigation(1024), isTrue);
  });

  testWidgets('main bottom nav keeps the home-first mobile IA visible', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          bottomNavigationBar: MainBottomNav(currentIndex: 0, onTap: (_) {}),
        ),
      ),
    );

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('People'), findsOneWidget);
    expect(find.text('Work'), findsOneWidget);
    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('You'), findsOneWidget);
  });

  testWidgets('main rail keeps the same IA for wider layouts', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        theme: AppTheme.light(),
        home: Scaffold(
          body: MainNavigationRail(
            currentIndex: 2,
            chatCount: 3,
            taskCount: 2,
            onTap: (_) {},
          ),
        ),
      ),
    );

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('People'), findsOneWidget);
    expect(find.text('Work'), findsOneWidget);
    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('You'), findsOneWidget);
    expect(find.text('2'), findsOneWidget);
    expect(find.text('3'), findsOneWidget);
  });
}
