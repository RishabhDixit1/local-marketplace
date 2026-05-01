import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/app/presentation/app_shell.dart';
import 'package:serviq_mobile/app/presentation/main_bottom_nav.dart';
import 'package:serviq_mobile/core/constants/app_routes.dart';

void main() {
  test('home route points at the welcome surface', () {
    expect(AppRoutes.home, AppRoutes.welcome);
  });

  test('marketplace engine routes carry native workflow context', () {
    expect(AppRoutes.providerLaunchpad, '/app/provider-launchpad');
    expect(AppRoutes.providerListings, '/app/provider-listings');
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

  test('post action stays off workflow branches', () {
    expect(shouldShowPostActionForBranch(0), isTrue);
    expect(shouldShowPostActionForBranch(1), isTrue);
    expect(shouldShowPostActionForBranch(2), isFalse);
    expect(shouldShowPostActionForBranch(3), isFalse);
    expect(shouldShowPostActionForBranch(4), isFalse);
  });

  testWidgets('main bottom nav keeps the home-first mobile IA visible', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(
      MaterialApp(
        home: Scaffold(
          bottomNavigationBar: MainBottomNav(currentIndex: 0, onTap: (_) {}),
        ),
      ),
    );

    expect(find.text('Home'), findsOneWidget);
    expect(find.text('People'), findsOneWidget);
    expect(find.text('Tasks'), findsOneWidget);
    expect(find.text('Inbox'), findsOneWidget);
    expect(find.text('You'), findsOneWidget);
  });
}
