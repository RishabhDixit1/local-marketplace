import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:serviq_mobile/app/router/route_error_page.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';

import 'helpers/serviq_test_app.dart';

Widget _wrap(Widget child) {
  return MaterialApp(
    theme: AppTheme.light(),
    localizationsDelegates: kServiqTestLocalizationsDelegates,
    supportedLocales: kServiqTestSupportedLocales,
    home: child,
  );
}

void main() {
  testWidgets('route error page shows branded copy and a home action', (
    tester,
  ) async {
    await tester.pumpWidget(_wrap(const RouteErrorPage(error: 'oops')));
    await tester.pump();

    expect(find.text('Page not found'), findsOneWidget);
    expect(find.text('Back to home'), findsOneWidget);
    expect(find.text('oops'), findsNothing, reason: 'raw errors must not leak');
  });

  testWidgets('retry action reappears only for a concrete failed location', (
    tester,
  ) async {
    await tester.pumpWidget(
      _wrap(const RouteErrorPage(error: 'oops', location: '/app/ghost')),
    );
    await tester.pump();

    expect(find.textContaining('Retry · /app/ghost'), findsOneWidget);

    await tester.pumpWidget(
      _wrap(const RouteErrorPage(error: 'oops', location: '/')),
    );
    await tester.pump();
    expect(find.textContaining('Retry'), findsNothing);
  });

  testWidgets('retry navigates back to the failed location', (tester) async {
    final locations = <String>[];
    final router = GoRouter(
      initialLocation: '/app/ghost',
      errorBuilder:
          (context, state) =>
              RouteErrorPage(error: state.error, location: state.uri.toString()),
      routes: [
        GoRoute(
          path: '/',
          builder: (context, state) => const Scaffold(body: Text('home')),
        ),
        GoRoute(
          path: '/retryable',
          builder: (context, state) {
            locations.add(state.uri.toString());
            return const Scaffold(body: Text('retryable'));
          },
        ),
      ],
    );

    await tester.pumpWidget(
      MaterialApp.router(
        theme: AppTheme.light(),
        localizationsDelegates: kServiqTestLocalizationsDelegates,
        supportedLocales: kServiqTestSupportedLocales,
        routerConfig: router,
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Page not found'), findsOneWidget);

    // The failed location is not a real route, so a retry must not loop back
    // into the error page as a dead end.
    router.go('/retryable');
    await tester.pumpAndSettle();

    expect(find.text('retryable'), findsOneWidget);
    expect(locations, contains('/retryable'));
  });
}
