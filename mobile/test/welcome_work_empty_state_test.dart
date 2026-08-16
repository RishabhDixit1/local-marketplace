import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/feed/domain/feed_snapshot.dart';
import 'package:serviq_mobile/features/people/domain/people_snapshot.dart';
import 'package:serviq_mobile/features/tasks/data/task_repository.dart';
import 'package:serviq_mobile/features/tasks/domain/task_snapshot.dart';
import 'package:serviq_mobile/features/welcome/presentation/welcome_page.dart';

import 'helpers/serviq_test_app.dart';

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

const _emptyFeed = MobileFeedSnapshot(
  currentUserId: '',
  stats: MobileFeedStats(
    total: 0,
    urgent: 0,
    demand: 0,
    service: 0,
    product: 0,
  ),
  items: [],
);

const _emptyPeople = MobilePeopleSnapshot(currentUserId: '', people: []);

const _emptyTasks = MobileTaskSnapshot(currentUserId: 'viewer-1', items: []);

const _oneActiveNeed = MobileTaskSnapshot(currentUserId: 'viewer-1', items: [
  MobileTaskItem(
    id: 'need-1',
    source: MobileTaskSource.helpRequest,
    role: MobileTaskRole.posted,
    status: MobileTaskStatus.active,
    rawStatus: 'open',
    progressStage: MobileTaskProgressStage.pendingAcceptance,
    title: 'Fix bathroom tap',
    description: 'Tap is leaking.',
    budgetLabel: 'Price on request',
    locationLabel: 'Ghaziabad',
    listingTypeLabel: 'Plumbing',
    createdAt: null,
  ),
]);

Widget _build({
  required MobileTaskSnapshot tasks,
}) {
  return ProviderScope(
    overrides: [
      appBootstrapProvider.overrideWithValue(_bootstrap),
      taskSnapshotProvider.overrideWith((ref) async => tasks),
    ],
    child: MaterialApp(
      theme: AppTheme.light(),
      localizationsDelegates: kServiqTestLocalizationsDelegates,
      supportedLocales: kServiqTestSupportedLocales,
      home: const WelcomePage(
        snapshotOverride: AsyncData(_emptyFeed),
        trustedSnapshotOverride: AsyncData(_emptyFeed),
        peopleOverride: AsyncData(_emptyPeople),
      ),
    ),
  );
}

void main() {
  testWidgets(
    'work section shows the zero-state card when loaded with no needs and no work',
    (tester) async {
      await tester.pumpWidget(_build(tasks: _emptyTasks));
      await tester.pumpAndSettle();

      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(
        find.text('Nothing in motion yet'),
        300,
        scrollable: scrollable,
      );

      expect(find.text('Nothing in motion yet'), findsOneWidget);
      expect(find.text('Post your first need'), findsOneWidget);
      expect(find.text('Browse my tasks'), findsOneWidget);
      expect(tester.takeException(), isNull);
    },
  );

  testWidgets(
    'work section shows count tiles, not the empty card, when a need is active',
    (tester) async {
      await tester.pumpWidget(_build(tasks: _oneActiveNeed));
      await tester.pumpAndSettle();

      final scrollable = find.byType(Scrollable).first;
      await tester.scrollUntilVisible(
        find.text('My needs'),
        300,
        scrollable: scrollable,
      );

      expect(find.text('My needs'), findsOneWidget);
      expect(find.text('Nothing in motion yet'), findsNothing);
      expect(find.text('Post your first need'), findsNothing);
      expect(tester.takeException(), isNull);
    },
  );
}
