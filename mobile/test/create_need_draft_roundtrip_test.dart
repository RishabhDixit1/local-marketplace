import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/theme/app_theme.dart';
import 'package:serviq_mobile/features/post_create/presentation/create_need_page.dart';

void main() {
  testWidgets('draft title and category survive a create-need round trip', (
    WidgetTester tester,
  ) async {
    Future<void> pumpCreateNeed() async {
      await tester.pumpWidget(
        ProviderScope(
          child: MaterialApp(
            theme: AppTheme.light(),
            home: const CreateNeedPage(),
          ),
        ),
      );
      await tester.pumpAndSettle();
    }

    await pumpCreateNeed();

    expect(find.text('Post Need'), findsOneWidget);

    final electricianChip = find.widgetWithText(ChoiceChip, 'Electrician');
    await tester.ensureVisible(electricianChip);
    await tester.pumpAndSettle();
    await tester.tap(electricianChip);
    await tester.pumpAndSettle();

    final titleField = find.byType(TextFormField);
    expect(titleField, findsOneWidget);
    await tester.enterText(titleField, 'Fix the bathroom tap today');
    await tester.pumpAndSettle();

    bool electricianSelected() => tester
        .widget<ChoiceChip>(find.widgetWithText(ChoiceChip, 'Electrician'))
        .selected;
    expect(electricianSelected(), isTrue);

    await tester.pumpWidget(
      ProviderScope(
        child: MaterialApp(
          theme: AppTheme.light(),
          home: const Scaffold(body: Center(child: Text('left'))),
        ),
      ),
    );
    await tester.pumpAndSettle();

    await pumpCreateNeed();

    expect(
      tester
          .widget<TextFormField>(find.byType(TextFormField))
          .controller
          ?.text,
      'Fix the bathroom tap today',
    );
    expect(electricianSelected(), isTrue);
    expect(tester.takeException(), isNull);
  });
}
