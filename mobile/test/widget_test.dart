import 'package:flutter/material.dart';
import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/widgets/section_card.dart';

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
}
