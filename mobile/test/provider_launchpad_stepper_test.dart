import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/provider/data/launchpad_repository.dart';
import 'package:serviq_mobile/features/provider/domain/launchpad_models.dart';
import 'package:serviq_mobile/features/provider/presentation/provider_launchpad_page.dart';

void main() {
  for (final width in <double>[320, 390, 430]) {
    testWidgets('business AI launchpad is stable at ${width.toInt()} width', (
      tester,
    ) async {
      await _pumpLaunchpad(tester, Size(width, 844));

      expect(find.text('Business AI setup'), findsOneWidget);
      expect(find.text('Guided Business AI'), findsOneWidget);
      expect(find.text('Basics'), findsAtLeastNWidgets(1));
      expect(find.text('Offers'), findsAtLeastNWidgets(1));
      expect(find.text('AI Draft'), findsAtLeastNWidgets(1));
      expect(find.text('Publish'), findsAtLeastNWidgets(1));

      await _show(tester, find.text('Business or provider name'));

      expect(find.text('Business or provider name'), findsOneWidget);
      expect(tester.takeException(), isNull);
    });
  }

  testWidgets('launchpad walks through offers, AI draft, and publish preview', (
    tester,
  ) async {
    await _pumpLaunchpad(tester, const Size(390, 844));

    await _tapPrimaryAction(tester);
    await tester.pumpAndSettle();
    expect(find.text('Core offerings'), findsOneWidget);

    await _tapPrimaryAction(tester);
    await tester.pumpAndSettle();
    expect(find.text('Review AI draft'), findsOneWidget);
    expect(find.text('Generated listings'), findsOneWidget);

    await _tapPrimaryAction(tester);
    await tester.pumpAndSettle();
    await _show(tester, find.text('Publish Readiness'));
    await _show(tester, find.text('What will go public'));
    await _show(tester, find.text('Publish profile'));

    expect(find.text('Publish Readiness'), findsOneWidget);
    expect(find.text('What will go public'), findsOneWidget);
    expect(find.text('Publish profile'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });

  testWidgets('launchpad publish preview tolerates 160 percent text scale', (
    tester,
  ) async {
    await _pumpLaunchpad(tester, const Size(390, 844), textScaleFactor: 1.6);

    final publishStep = find.byKey(
      const ValueKey('launchpad-step-publish_readiness'),
    );
    await _show(tester, publishStep);
    await tester.tap(publishStep);
    await tester.pumpAndSettle();
    await _show(tester, find.text('Publish Readiness'));
    await _show(tester, find.text('What will go public'));

    expect(find.text('Publish Readiness'), findsOneWidget);
    expect(find.text('What will go public'), findsOneWidget);
    expect(tester.takeException(), isNull);
  });
}

Future<void> _tapPrimaryAction(WidgetTester tester) async {
  final action = find.byKey(const ValueKey('launchpad-primary-action'));
  await _show(tester, action);
  await tester.tap(action);
}

Future<void> _show(WidgetTester tester, Finder finder) async {
  final scrollable = find.byType(Scrollable).first;
  final state = tester.state<ScrollableState>(scrollable);
  state.position.jumpTo(state.position.minScrollExtent);
  await tester.pump();

  for (var attempt = 0; attempt < 18; attempt += 1) {
    if (finder.evaluate().isNotEmpty) {
      await tester.ensureVisible(finder);
      await tester.pumpAndSettle();
      return;
    }
    await tester.drag(scrollable, const Offset(0, -260));
    await tester.pump();
  }

  await tester.pumpAndSettle();
}

Future<void> _pumpLaunchpad(
  WidgetTester tester,
  Size size, {
  double textScaleFactor = 1.0,
}) async {
  _setTestSurface(tester, size, textScaleFactor: textScaleFactor);

  await tester.pumpWidget(
    ProviderScope(
      overrides: [
        launchpadWorkspaceProvider.overrideWith((ref) async => _workspace),
      ],
      child: MaterialApp(
        theme: AppTheme.light(),
        home: const ProviderLaunchpadPage(),
      ),
    ),
  );
  await tester.pumpAndSettle();
}

void _setTestSurface(
  WidgetTester tester,
  Size size, {
  double textScaleFactor = 1.0,
}) {
  tester.view.devicePixelRatio = 1.0;
  tester.view.physicalSize = size;
  tester.binding.platformDispatcher.textScaleFactorTestValue = textScaleFactor;
  addTearDown(() {
    tester.view.resetPhysicalSize();
    tester.view.resetDevicePixelRatio();
    tester.binding.platformDispatcher.clearTextScaleFactorTestValue();
  });
}

const _answers = MobileLaunchpadAnswers(
  businessName: 'Bright Circuit Care',
  businessType: 'local_service',
  offeringType: 'services',
  primaryCategory: 'Electrical repair',
  location: 'Koramangala, Bengaluru',
  serviceArea: 'South Bengaluru',
  serviceRadiusKm: 8,
  shortDescription:
      'Emergency electrical checks, repairs, and tidy installation work.',
  coreOfferings: 'Emergency wiring repair\nSwitchboard inspection',
  catalogText: 'Home repair visit, safety inspection, lighting retrofit',
  pricingNotes: 'Inspection from INR 500, repair quote after visit',
  hours: 'Mon-Sat, 9 AM-7 PM',
  phone: '9876543210',
  website: 'https://serviq.example/bright-circuit',
  brandTone: 'friendly',
);

const _workspace = MobileLaunchpadWorkspace(
  draft: MobileLaunchpadDraft(
    id: 'draft-1',
    status: 'draft',
    answers: _answers,
    generatedServices: [
      MobileLaunchpadGeneratedOffering(
        title: 'Emergency wiring repair',
        description: 'Same-day inspection and repair planning for home wiring.',
        category: 'Electrical repair',
        price: 1200,
      ),
    ],
    generatedProducts: [],
    updatedAt: null,
  ),
  summary: MobileLaunchpadSummary(
    profileExists: true,
    profilePath: '/profile/bright-circuit-care',
    businessPath: '/business/bright-circuit-care',
    totalServices: 1,
    totalProducts: 0,
    lastPublishedAt: null,
  ),
);
