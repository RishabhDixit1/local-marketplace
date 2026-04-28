import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/app/presentation/app_shell.dart';
import 'package:serviq_mobile/app/presentation/main_bottom_nav.dart';
import 'package:serviq_mobile/core/constants/app_routes.dart';

void main() {
  test('home route points at the welcome surface', () {
    expect(AppRoutes.home, AppRoutes.welcome);
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
