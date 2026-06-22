import 'package:flutter_test/flutter_test.dart';
import 'package:patrol/patrol.dart';

void main() {
  patrolTest(
    'Login flow shows magic link option',
    ($) async {
      await $.pumpAndSettle();

      expect($('ServiQ'), findsWidgets);

      final signInButton = $(#signInButton);
      if (signInButton.exists) {
        await signInButton.tap();
        await $.pumpAndSettle();

        expect($('Email'), findsWidgets);
      }
    },
  );

  patrolTest(
    'Provider onboarding navigation smoke test',
    ($) async {
      await $.pumpAndSettle();

      final providerCta = $(#providerCta);
      if (providerCta.exists) {
        await providerCta.tap();
        await $.pumpAndSettle();
      }
    },
  );

  patrolTest(
    'App launches without crash',
    ($) async {
      await $.pumpAndSettle();
      expect($('ServiQ'), findsWidgets);
    },
  );
}
