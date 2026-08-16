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
      AppRoutes.providerLaunchpad,
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

    expect(controller.postAuthDestination, AppRoutes.providerLaunchpad);
    expect(
      controller.resolvePostAuthDestination(),
      AppRoutes.providerLaunchpad,
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
        storedHandoffRoute: AppRoutes.providerLaunchpad,
        profileReadiness: providerReady,
      ),
      AppRoutes.providerLaunchpad,
    );

    expect(
      resolveReturningLandingRoute(providerReady),
      AppRoutes.providerLaunchpad,
    );
  });

  test('rememberRoute is idempotent for the same route', () async {
    final store = MemoryOnboardingHandoffStore();
    final controller = OnboardingHandoffController(store);
    var notifications = 0;
    controller.addListener(() => notifications++);

    const route = '/app/tasks?focus=task-1&source=push';
    await controller.rememberRoute(route);
    expect(notifications, 1);

    await controller.rememberRoute(route);
    await controller.rememberRoute(' $route ');
    expect(notifications, 1, reason: 'repeat rememberRoute must not notify');

    await controller.rememberRoute('/app/create-need');
    expect(notifications, 2, reason: 'a different route should still notify');
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

  test('intent is only chosen when the user explicitly selects it', () async {
    final store = MemoryOnboardingHandoffStore();
    final controller = OnboardingHandoffController(store);

    expect(controller.hasChosenIntent, isFalse);
    expect(controller.intentPromptDismissed, isFalse);

    await controller.selectIntent(MobileOnboardingIntent.earnNearby);
    expect(controller.hasChosenIntent, isTrue);
    expect(store.readIntentChosen(), isTrue);
    expect(controller.selectedIntent, MobileOnboardingIntent.earnNearby);
    expect(controller.postAuthDestination, AppRoutes.providerLaunchpad);
  });

  test('intent prompt dismissal persists and resets on choice', () async {
    final store = MemoryOnboardingHandoffStore();
    final controller = OnboardingHandoffController(store);

    await controller.dismissIntentPrompt();
    expect(controller.intentPromptDismissed, isTrue);
    expect(store.readIntentPromptDismissed(), isTrue);

    await controller.selectIntent(MobileOnboardingIntent.findHelp);
    expect(controller.intentPromptDismissed, isFalse);
    expect(store.readIntentPromptDismissed(), isFalse);
    expect(controller.hasChosenIntent, isTrue);
  });

  test('pre-stored explicit choice surfaces from the store', () {
    final store = MemoryOnboardingHandoffStore(
      initialIntent: MobileOnboardingIntent.businessSetup,
      initialIntentChosen: true,
    );
    final controller = OnboardingHandoffController(store);

    expect(controller.hasChosenIntent, isTrue);
    expect(controller.selectedIntent, MobileOnboardingIntent.businessSetup);
  });

  test('consumeStoredHandoff clears the persisted landing route', () async {
    final store = MemoryOnboardingHandoffStore(
      initialIntent: MobileOnboardingIntent.findHelp,
    );
    final controller = OnboardingHandoffController(store);
    await controller.rememberRoute(AppRoutes.createNeed);

    expect(controller.hasStoredHandoff, isTrue);
    expect(store.readLastRoute(), AppRoutes.createNeed);

    var notifications = 0;
    controller.addListener(() => notifications++);
    await controller.consumeStoredHandoff();

    expect(controller.hasStoredHandoff, isFalse);
    expect(controller.lastRoute, isNull);
    expect(store.readLastRoute(), isNull);
    expect(notifications, 1);
  });

  test(
    'stored landing route serves the intent funnel once, not every launch',
    () {
      final pending = resolveSignedInLandingRoute(
        selectedIntent: MobileOnboardingIntent.findHelp,
        hasPendingHandoff: true,
        hasStoredHandoff: true,
        storedHandoffRoute: AppRoutes.createNeed,
      );
      expect(pending, AppRoutes.createNeed);

      // After the redirect is consumed, the same signed-in user with no
      // stored route must fall through to their returning home.
      final returning = resolveSignedInLandingRoute(
        selectedIntent: MobileOnboardingIntent.findHelp,
        hasPendingHandoff: false,
        hasStoredHandoff: false,
        storedHandoffRoute: null,
      );
      expect(returning, AppRoutes.home);
    },
  );
}
