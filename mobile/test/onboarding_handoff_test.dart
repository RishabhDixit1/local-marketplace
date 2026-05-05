import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/app/router/post_auth_route_resolver.dart';
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
      expect(store.readLastRoute(), isNull);
      expect(controller.hasStoredHandoff, isFalse);
      expect(controller.resolvePostAuthDestination(), AppRoutes.home);
      expect(controller.postAuthDestination, AppRoutes.providerLaunchpad);
    },
  );

  test('captured app routes survive auth preparation until success', () async {
    final store = MemoryOnboardingHandoffStore();
    final controller = OnboardingHandoffController(store);
    const focusedTaskRoute = '/app/tasks?focus=task-1&source=push';

    await controller.rememberRoute(focusedTaskRoute);
    await controller.prepareForAuth(MobileAuthMethod.magicLink);

    expect(controller.postAuthDestination, focusedTaskRoute);
    expect(store.readLastRoute(), focusedTaskRoute);

    await controller.completeAuthHandoff(startedRoute: focusedTaskRoute);

    expect(controller.pendingAuthMethod, isNull);
    expect(controller.lastRoute, isNull);
    expect(store.readLastRoute(), isNull);
  });

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

  test('route resolver covers setup, signed-out, and handoff states', () {
    expect(
      resolveMobileAppRedirect(
        location: AppRoutes.root,
        setupRequired: true,
        signedIn: false,
        selectedIntent: MobileOnboardingIntent.findHelp,
        hasPendingHandoff: false,
        hasStoredHandoff: false,
      ),
      AppRoutes.setup,
    );

    expect(
      resolveMobileAppRedirect(
        location: AppRoutes.people,
        setupRequired: false,
        signedIn: false,
        selectedIntent: MobileOnboardingIntent.findHelp,
        hasPendingHandoff: false,
        hasStoredHandoff: false,
      ),
      AppRoutes.signIn,
    );

    expect(
      resolveMobileAppRedirect(
        location: AppRoutes.signIn,
        setupRequired: false,
        signedIn: true,
        selectedIntent: MobileOnboardingIntent.findHelp,
        hasPendingHandoff: true,
        hasStoredHandoff: true,
        storedHandoffRoute: AppRoutes.createNeed,
      ),
      AppRoutes.createNeed,
    );
  });

  test('route resolver upgrades ready providers to launchpad', () {
    const providerReady = MobileProfileReadiness(
      roleFamily: 'provider',
      completionPercent: 78,
      serviceCount: 1,
      productCount: 0,
      hasName: true,
      hasLocation: true,
      hasContact: true,
    );

    expect(
      resolveSignedInLandingRoute(
        selectedIntent: MobileOnboardingIntent.earnNearby,
        hasPendingHandoff: true,
        hasStoredHandoff: true,
        storedHandoffRoute: AppRoutes.providerOnboarding,
        profileReadiness: providerReady,
      ),
      AppRoutes.providerLaunchpad,
    );

    expect(
      resolveReturningLandingRoute(providerReady),
      AppRoutes.providerLaunchpad,
    );
  });

  test('captured protected routes beat default onboarding destinations', () {
    const focusedTaskRoute = '/app/tasks?focus=task-1&source=push';

    expect(
      resolveSignedInLandingRoute(
        selectedIntent: MobileOnboardingIntent.findHelp,
        hasPendingHandoff: true,
        hasStoredHandoff: true,
        storedHandoffRoute: focusedTaskRoute,
      ),
      focusedTaskRoute,
    );
  });
}
