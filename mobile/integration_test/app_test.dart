import 'package:flutter_test/flutter_test.dart';
import 'package:integration_test/integration_test.dart';

import 'package:serviq_mobile/main.dart' as app;

void main() {
  IntegrationTestWidgetsFlutterBinding.ensureInitialized();

  group('App smoke tests', () {
    testWidgets('Landing page loads and shows ServiQ', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      expect(find.text('ServiQ'), findsWidgets);
    });

    testWidgets('Category pill navigation works', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      expect(find.text('Electrician'), findsOneWidget);

      await tester.tap(find.text('Electrician'));
      await tester.pumpAndSettle();

      expect(find.text('Electrician'), findsOneWidget);
    });

    testWidgets('Search field is present on landing page', (tester) async {
      app.main();
      await tester.pumpAndSettle();

      expect(find.byType(TextField), findsOneWidget);
    });
  });
}
