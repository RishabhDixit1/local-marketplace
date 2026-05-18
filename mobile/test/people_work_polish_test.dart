import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/people/data/people_repository.dart';
import 'package:serviq_mobile/features/people/domain/people_snapshot.dart';
import 'package:serviq_mobile/features/people/presentation/people_page.dart';
import 'package:serviq_mobile/features/tasks/data/task_repository.dart';
import 'package:serviq_mobile/features/tasks/domain/task_snapshot.dart';
import 'package:serviq_mobile/features/tasks/presentation/tasks_page.dart';

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
  testWidgets('people filters move into a focused bottom sheet', (
    tester,
  ) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          peopleSnapshotProvider.overrideWith((ref) async => _peopleSnapshot),
        ],
        child: MaterialApp(theme: AppTheme.light(), home: const PeoplePage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Find nearby help'), findsOneWidget);
    expect(find.text('Best matches'), findsOneWidget);
    expect(find.text('All categories'), findsOneWidget);
    expect(find.text('Online'), findsNothing);

    await tester.tap(find.text('Filters'));
    await tester.pumpAndSettle();

    expect(find.text('Discovery filters'), findsOneWidget);
    expect(find.text('Category'), findsOneWidget);
    expect(find.text('Plumbing'), findsOneWidget);
    expect(find.text('Online'), findsOneWidget);

    await tester.tap(find.text('Online'));
    await tester.pumpAndSettle();
    await tester.tap(find.text('Show providers'));
    await tester.pumpAndSettle();

    expect(find.text('Online'), findsOneWidget);
    expect(find.text('Asha Plumbing Co.'), findsOneWidget);
    expect(find.text('Mira Clean Homes'), findsNothing);
  });

  testWidgets('work tab keeps lane controls behind filters', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          taskSnapshotProvider.overrideWith((ref) async => _taskSnapshot),
        ],
        child: MaterialApp(theme: AppTheme.light(), home: const TasksPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(find.text('Next-action queue'), findsOneWidget);
    expect(find.text('1 task ready for a one-tap update.'), findsOneWidget);
    expect(find.text('Back to next actions'), findsNothing);

    await tester.tap(find.text('Filters'));
    await tester.pumpAndSettle();

    expect(find.text('Filter Work'), findsOneWidget);
    expect(find.text('Status lane'), findsOneWidget);

    await tester.tap(find.text('Active').last);
    await tester.pumpAndSettle();
    await tester.tap(find.text('Show work'));
    await tester.pumpAndSettle();

    expect(find.text('Active work'), findsOneWidget);
    expect(find.text('Back to next actions'), findsOneWidget);

    await tester.tap(find.text('Back to next actions'));
    await tester.pumpAndSettle();

    expect(find.text('Next-action queue'), findsOneWidget);
  });

  testWidgets('work tab shows partial-load recovery warnings', (tester) async {
    await tester.pumpWidget(
      ProviderScope(
        overrides: [
          appBootstrapProvider.overrideWithValue(_bootstrap),
          taskSnapshotProvider.overrideWith(
            (ref) async => _partialTaskSnapshot,
          ),
        ],
        child: MaterialApp(theme: AppTheme.light(), home: const TasksPage()),
      ),
    );
    await tester.pumpAndSettle();

    expect(
      find.text('Requests could not load. Pull to refresh and try again.'),
      findsOneWidget,
    );
    expect(find.text('Retry'), findsOneWidget);
    expect(find.text('Repair kitchen sink leak'), findsOneWidget);
  });
}

const _peopleSnapshot = MobilePeopleSnapshot(
  currentUserId: 'viewer-1',
  people: [
    MobilePersonCard(
      id: 'provider-1',
      name: 'Asha Plumbing Co.',
      avatarUrl: '',
      headline: 'Emergency plumbing and leak repair',
      locationLabel: 'Indiranagar',
      isOnline: true,
      activityLabel: 'Active now',
      verificationLabel: 'Verified',
      completionPercent: 92,
      primaryTags: ['Plumbing', 'Repairs'],
      openNeedsCount: 0,
      postCount: 2,
      completedJobs: 12,
      openLeads: 1,
      averageRating: 4.8,
      reviewCount: 9,
      priceLabel: 'From Rs 600',
    ),
    MobilePersonCard(
      id: 'provider-2',
      name: 'Mira Clean Homes',
      avatarUrl: '',
      headline: 'Deep cleaning and move-in support',
      locationLabel: 'Koramangala',
      isOnline: false,
      activityLabel: 'Recently active',
      verificationLabel: 'Growing profile',
      completionPercent: 70,
      primaryTags: ['Cleaning'],
      openNeedsCount: 0,
      postCount: 1,
      completedJobs: 2,
      openLeads: 0,
      averageRating: 4.4,
      reviewCount: 2,
      priceLabel: 'From Rs 1200',
    ),
  ],
);

final _taskSnapshot = MobileTaskSnapshot(
  currentUserId: 'viewer-1',
  items: [
    MobileTaskItem(
      id: 'task-1',
      source: MobileTaskSource.helpRequest,
      role: MobileTaskRole.accepted,
      status: MobileTaskStatus.active,
      rawStatus: 'new_lead',
      progressStage: MobileTaskProgressStage.pendingAcceptance,
      title: 'Repair kitchen sink leak',
      description: 'Water leaking below the sink cabinet.',
      budgetLabel: 'Rs 900',
      locationLabel: 'Indiranagar',
      listingTypeLabel: 'Plumbing',
      createdAt: DateTime(2026, 5, 9, 9),
    ),
    MobileTaskItem(
      id: 'task-2',
      source: MobileTaskSource.order,
      role: MobileTaskRole.posted,
      status: MobileTaskStatus.completed,
      rawStatus: 'completed',
      progressStage: MobileTaskProgressStage.completed,
      title: 'Install water purifier',
      description: 'Completed installation order.',
      budgetLabel: 'Rs 2400',
      locationLabel: 'Koramangala',
      listingTypeLabel: 'Installation',
      createdAt: DateTime(2026, 5, 8, 11),
    ),
  ],
);

final _partialTaskSnapshot = MobileTaskSnapshot(
  currentUserId: _taskSnapshot.currentUserId,
  warnings: const ['Requests could not load. Pull to refresh and try again.'],
  items: _taskSnapshot.items,
);
