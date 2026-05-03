import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/constants/app_routes.dart';
import 'package:serviq_mobile/features/auth/data/onboarding_handoff.dart';

void main() {
  test('onboarding intents map to first-time mobile destinations', () {
    expect(
      MobileOnboardingIntent.findHelp.destinationRoute,
      AppRoutes.createNeed,
    );
    expect(
      MobileOnboardingIntent.earnNearby.destinationRoute,
      AppRoutes.providerOnboarding,
    );
    expect(
      MobileOnboardingIntent.businessSetup.destinationRoute,
      AppRoutes.providerLaunchpad,
    );
  });

  test(
    'handoff persists intent, pending method, and destination route',
    () async {
      final store = MemoryOnboardingHandoffStore();
      final controller = OnboardingHandoffController(store);

      expect(controller.selectedIntent, MobileOnboardingIntent.findHelp);
      expect(controller.postAuthDestination, AppRoutes.createNeed);

      await controller.selectIntent(MobileOnboardingIntent.businessSetup);
      expect(store.readIntent(), MobileOnboardingIntent.businessSetup);
      expect(store.readLastRoute(), AppRoutes.providerLaunchpad);

      await controller.prepareForAuth(MobileAuthMethod.google);
      expect(store.readPendingAuthMethod(), MobileAuthMethod.google);
      expect(
        controller.resolvePostAuthDestination(),
        AppRoutes.providerLaunchpad,
      );

      await controller.completeAuthHandoff(
        startedRoute: AppRoutes.providerLaunchpad,
      );
      expect(store.readPendingAuthMethod(), isNull);
      expect(controller.resolvePostAuthDestination(), AppRoutes.home);
      expect(controller.postAuthDestination, AppRoutes.providerLaunchpad);
    },
  );

  test('handoff ignores unsafe stored routes', () {
    final store = MemoryOnboardingHandoffStore(
      initialIntent: MobileOnboardingIntent.earnNearby,
      initialPendingAuthMethod: MobileAuthMethod.emailCode,
      initialLastRoute: 'https://example.com/not-local',
    );
    final controller = OnboardingHandoffController(store);

    expect(controller.postAuthDestination, AppRoutes.providerOnboarding);
    expect(
      controller.resolvePostAuthDestination(),
      AppRoutes.providerOnboarding,
    );
  });
}
