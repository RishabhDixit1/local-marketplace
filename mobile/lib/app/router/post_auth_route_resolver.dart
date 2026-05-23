import '../../core/constants/app_routes.dart';
import '../../features/auth/data/onboarding_handoff.dart';
import '../../features/profile/domain/mobile_profile_snapshot.dart';

class MobileProfileReadiness {
  const MobileProfileReadiness({
    required this.roleFamily,
    required this.completionPercent,
    required this.serviceCount,
    required this.productCount,
    required this.hasName,
    required this.hasLocation,
    required this.hasContact,
  });

  factory MobileProfileReadiness.fromSnapshot(MobileProfileSnapshot snapshot) {
    return MobileProfileReadiness(
      roleFamily: snapshot.roleFamily.trim().toLowerCase(),
      completionPercent: snapshot.completionPercent,
      serviceCount: snapshot.serviceCount,
      productCount: snapshot.productCount,
      hasName:
          snapshot.profile.fullName.trim().isNotEmpty ||
          snapshot.displayName.trim().isNotEmpty,
      hasLocation: snapshot.profile.location.trim().isNotEmpty,
      hasContact:
          snapshot.profile.phone.trim().isNotEmpty ||
          snapshot.email.trim().isNotEmpty,
    );
  }

  final String roleFamily;
  final int completionPercent;
  final int serviceCount;
  final int productCount;
  final bool hasName;
  final bool hasLocation;
  final bool hasContact;

  bool get isProviderFamily =>
      roleFamily == 'provider' ||
      roleFamily == 'business' ||
      roleFamily == 'seller';

  bool get isBusinessFamily => roleFamily == 'business';

  bool get hasPublishedOfferings => serviceCount + productCount > 0;

  bool get hasProviderBasics =>
      completionPercent >= 60 || hasPublishedOfferings || hasContact;

  bool get hasSeekerBasics => hasName && hasLocation;
}

String? resolveMobileAppRedirect({
  required String location,
  required bool setupRequired,
  required bool signedIn,
  required MobileOnboardingIntent selectedIntent,
  required bool hasPendingHandoff,
  required bool hasStoredHandoff,
  String? storedHandoffRoute,
  MobileProfileReadiness? profileReadiness,
}) {
  final visitingApp = location.startsWith('/app');

  if (setupRequired && location != AppRoutes.setup) {
    return AppRoutes.setup;
  }

  if (!setupRequired && location == AppRoutes.setup) {
    return signedIn
        ? resolveSignedInLandingRoute(
            selectedIntent: selectedIntent,
            hasPendingHandoff: hasPendingHandoff,
            hasStoredHandoff: hasStoredHandoff,
            storedHandoffRoute: storedHandoffRoute,
            profileReadiness: profileReadiness,
          )
        : AppRoutes.signIn;
  }

  if (!setupRequired && !signedIn && visitingApp) {
    return AppRoutes.signIn;
  }

  if (!setupRequired && signedIn && hasPendingHandoff) {
    final destination = resolveSignedInLandingRoute(
      selectedIntent: selectedIntent,
      hasPendingHandoff: hasPendingHandoff,
      hasStoredHandoff: hasStoredHandoff,
      storedHandoffRoute: storedHandoffRoute,
      profileReadiness: profileReadiness,
    );
    if (_canApplyPostAuthRedirect(location) && destination != location) {
      return destination;
    }
  }

  if (!setupRequired &&
      signedIn &&
      (location == AppRoutes.root || location == AppRoutes.signIn)) {
    return resolveSignedInLandingRoute(
      selectedIntent: selectedIntent,
      hasPendingHandoff: hasPendingHandoff,
      hasStoredHandoff: hasStoredHandoff,
      storedHandoffRoute: storedHandoffRoute,
      profileReadiness: profileReadiness,
    );
  }

  if (!setupRequired && !signedIn && location == AppRoutes.root) {
    // Show public landing page instead of redirecting to sign-in
    return null;
  }

  return null;
}

String resolveSignedInLandingRoute({
  required MobileOnboardingIntent selectedIntent,
  required bool hasPendingHandoff,
  required bool hasStoredHandoff,
  String? storedHandoffRoute,
  MobileProfileReadiness? profileReadiness,
}) {
  final explicitRoute = _sanitizeAppRoute(storedHandoffRoute);
  if ((hasPendingHandoff || hasStoredHandoff) &&
      explicitRoute != null &&
      explicitRoute != selectedIntent.destinationRoute) {
    return explicitRoute;
  }

  if (hasPendingHandoff || hasStoredHandoff) {
    return resolveIntentLandingRoute(
      selectedIntent,
      profileReadiness: profileReadiness,
      fromAuthHandoff: true,
    );
  }

  return resolveReturningLandingRoute(profileReadiness);
}

String resolveIntentLandingRoute(
  MobileOnboardingIntent intent, {
  required MobileProfileReadiness? profileReadiness,
  bool fromAuthHandoff = false,
}) {
  switch (intent) {
    case MobileOnboardingIntent.findHelp:
      if (fromAuthHandoff) {
        return AppRoutes.createNeed;
      }
      if (profileReadiness?.hasSeekerBasics == false) {
        return AppRoutes.seekerOnboarding;
      }
      return AppRoutes.home;
    case MobileOnboardingIntent.earnNearby:
      if (profileReadiness?.hasProviderBasics == true) {
        return AppRoutes.providerLaunchpad;
      }
      return AppRoutes.providerOnboarding;
    case MobileOnboardingIntent.businessSetup:
      return AppRoutes.providerLaunchpad;
  }
}

String resolveReturningLandingRoute(MobileProfileReadiness? profileReadiness) {
  final readiness = profileReadiness;
  if (readiness == null) {
    return AppRoutes.home;
  }
  if (readiness.isBusinessFamily) {
    return AppRoutes.providerLaunchpad;
  }
  if (readiness.isProviderFamily) {
    return readiness.hasProviderBasics
        ? AppRoutes.providerLaunchpad
        : AppRoutes.providerOnboarding;
  }
  if (!readiness.hasSeekerBasics) {
    return AppRoutes.seekerOnboarding;
  }
  return AppRoutes.home;
}

bool _canApplyPostAuthRedirect(String location) {
  return location == AppRoutes.root ||
      location == AppRoutes.signIn ||
      location == AppRoutes.home;
}

String? _sanitizeAppRoute(String? route) {
  final normalized = route?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }
  if (!normalized.startsWith('/app')) {
    return null;
  }
  return normalized;
}
