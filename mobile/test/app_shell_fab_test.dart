import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:go_router/go_router.dart';

import 'package:serviq_mobile/app/presentation/app_shell.dart';
import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/constants/app_routes.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/l10n/l10n.dart';

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

class _LongListBranch extends StatelessWidget {
  const _LongListBranch();

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: ListView.builder(
        itemCount: 80,
        itemBuilder: (context, index) => ListTile(
          title: Text('Row $index'),
        ),
      ),
    );
  }
}

void main() {
  Widget buildShell(WidgetTester tester) {
    final router = GoRouter(
      initialLocation: AppRoutes.home,
      routes: [
        StatefulShellRoute.indexedStack(
          builder: (context, state, navigationShell) {
            return AppShell(navigationShell: navigationShell);
          },
          branches: [
            StatefulShellBranch(
              routes: [
                GoRoute(
                  path: AppRoutes.home,
                  builder: (context, state) => const _LongListBranch(),
                ),
              ],
            ),
          ],
        ),
      ],
    );

    return ProviderScope(
      overrides: [appBootstrapProvider.overrideWithValue(_bootstrap)],
      child: MaterialApp.router(
        theme: AppTheme.light(),
        routerConfig: router,
        localizationsDelegates: const [AppLocalizations.delegate],
        supportedLocales: const [Locale('en', 'US')],
      ),
    );
  }

  testWidgets('app shell renders no floating post-need FAB', (
    WidgetTester tester,
  ) async {
    await tester.pumpWidget(buildShell(tester));
    await tester.pumpAndSettle();

    expect(find.byKey(const Key('post-need-fab-gate')), findsNothing);
    expect(find.byType(FloatingActionButton), findsNothing);

    await tester.drag(find.byType(ListView), const Offset(0, -400));
    await tester.pump();

    expect(find.byKey(const Key('post-need-fab-gate')), findsNothing);
    expect(find.byType(FloatingActionButton), findsNothing);
    expect(tester.takeException(), isNull);
  });
}
