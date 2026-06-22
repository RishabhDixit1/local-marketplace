import 'dart:async';

import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:shared_preferences/shared_preferences.dart';

import '../../../core/constants/app_routes.dart';

enum MobileOnboardingIntent { findHelp, earnNearby, businessSetup }

enum MobileAuthMethod { emailCode, magicLink, google, apple, password, passwordSignUp, phoneSms }

extension MobileOnboardingIntentDetails on MobileOnboardingIntent {
  String get storageValue {
    return switch (this) {
      MobileOnboardingIntent.findHelp => 'find_help',
      MobileOnboardingIntent.earnNearby => 'earn_nearby',
      MobileOnboardingIntent.businessSetup => 'business_setup',
    };
  }

  String get analyticsValue => storageValue;

  String get title {
    return switch (this) {
      MobileOnboardingIntent.findHelp => 'Find help',
      MobileOnboardingIntent.earnNearby => 'Earn nearby',
      MobileOnboardingIntent.businessSetup => 'Set up my business',
    };
  }

  String get destinationRoute {
    return switch (this) {
      MobileOnboardingIntent.findHelp => AppRoutes.createNeed,
      MobileOnboardingIntent.earnNearby => AppRoutes.providerLaunchpad,
      MobileOnboardingIntent.businessSetup => AppRoutes.providerLaunchpad,
    };
  }

  String get destinationLabel {
    return switch (this) {
      MobileOnboardingIntent.findHelp => 'Need-posting readiness',
      MobileOnboardingIntent.earnNearby => 'Provider trust setup',
      MobileOnboardingIntent.businessSetup => 'Business AI Launchpad',
    };
  }

  static MobileOnboardingIntent? fromStorageValue(String? value) {
    final normalized = value?.trim();
    if (normalized == null || normalized.isEmpty) {
      return null;
    }
    for (final intent in MobileOnboardingIntent.values) {
      if (intent.storageValue == normalized) {
        return intent;
      }
    }
    return null;
  }
}

extension MobileAuthMethodDetails on MobileAuthMethod {
  String get storageValue {
    return switch (this) {
      MobileAuthMethod.emailCode => 'email_code',
      MobileAuthMethod.magicLink => 'magic_link',
      MobileAuthMethod.google => 'google',
      MobileAuthMethod.apple => 'apple',
      MobileAuthMethod.password => 'password',
      MobileAuthMethod.passwordSignUp => 'password_sign_up',
      MobileAuthMethod.phoneSms => 'phone_sms',
    };
  }

  String get analyticsValue => storageValue;

  static MobileAuthMethod? fromStorageValue(String? value) {
    final normalized = value?.trim();
    if (normalized == null || normalized.isEmpty) {
      return null;
    }
    for (final method in MobileAuthMethod.values) {
      if (method.storageValue == normalized) {
        return method;
      }
    }
    return null;
  }
}

final onboardingHandoffStoreProvider = Provider<OnboardingHandoffStore>((ref) {
  return MemoryOnboardingHandoffStore();
});

final onboardingHandoffControllerProvider =
    Provider<OnboardingHandoffController>((ref) {
      final controller = OnboardingHandoffController(
        ref.watch(onboardingHandoffStoreProvider),
      );
      ref.onDispose(controller.dispose);
      return controller;
    });

abstract class OnboardingHandoffStore extends ChangeNotifier {
  bool isReady = false;

  MobileOnboardingIntent? readIntent();
  MobileAuthMethod? readPendingAuthMethod();
  String? readLastRoute();

  Future<void> writeIntent(MobileOnboardingIntent intent);
  Future<void> writePendingAuthMethod(MobileAuthMethod method);
  Future<void> clearPendingAuthMethod();
  Future<void> writeLastRoute(String route);
  Future<void> clearLastRoute();
}

class MemoryOnboardingHandoffStore extends OnboardingHandoffStore {
  MemoryOnboardingHandoffStore({
    MobileOnboardingIntent? initialIntent,
    MobileAuthMethod? initialPendingAuthMethod,
    String? initialLastRoute,
  }) : _intent = initialIntent,
       _pendingAuthMethod = initialPendingAuthMethod,
       _lastRoute = _sanitizeRoute(initialLastRoute) {
    isReady = true;
  }

  MobileOnboardingIntent? _intent;
  MobileAuthMethod? _pendingAuthMethod;
  String? _lastRoute;

  @override
  MobileOnboardingIntent? readIntent() => _intent;

  @override
  MobileAuthMethod? readPendingAuthMethod() => _pendingAuthMethod;

  @override
  String? readLastRoute() => _lastRoute;

  @override
  Future<void> writeIntent(MobileOnboardingIntent intent) async {
    _intent = intent;
  }

  @override
  Future<void> writePendingAuthMethod(MobileAuthMethod method) async {
    _pendingAuthMethod = method;
  }

  @override
  Future<void> clearPendingAuthMethod() async {
    _pendingAuthMethod = null;
  }

  @override
  Future<void> writeLastRoute(String route) async {
    _lastRoute = _sanitizeRoute(route);
  }

  @override
  Future<void> clearLastRoute() async {
    _lastRoute = null;
  }
}

class SharedPreferencesOnboardingHandoffStore
    extends OnboardingHandoffStore {
  SharedPreferencesOnboardingHandoffStore(this._preferences) {
    isReady = true;
    _readyCompleter.complete();
  }

  SharedPreferencesOnboardingHandoffStore.uninitialized() {
    _init();
  }

  static const _intentKey = 'serviq.mobile.onboarding.intent';
  static const _pendingAuthMethodKey =
      'serviq.mobile.onboarding.pendingAuthMethod';
  static const _lastRouteKey = 'serviq.mobile.onboarding.lastRoute';

  SharedPreferences? _preferences;
  final _readyCompleter = Completer<void>();

  Future<void> _init() async {
    _preferences = await SharedPreferences.getInstance();
    isReady = true;
    _readyCompleter.complete();
    notifyListeners();
  }

  Future<void> _ensureReady() async {
    if (!isReady) await _readyCompleter.future;
  }

  @override
  MobileOnboardingIntent? readIntent() {
    if (!isReady) return null;
    return MobileOnboardingIntentDetails.fromStorageValue(
      _preferences!.getString(_intentKey),
    );
  }

  @override
  MobileAuthMethod? readPendingAuthMethod() {
    if (!isReady) return null;
    return MobileAuthMethodDetails.fromStorageValue(
      _preferences!.getString(_pendingAuthMethodKey),
    );
  }

  @override
  String? readLastRoute() {
    if (!isReady) return null;
    return _sanitizeRoute(_preferences!.getString(_lastRouteKey));
  }

  @override
  Future<void> writeIntent(MobileOnboardingIntent intent) async {
    await _ensureReady();
    await _preferences!.setString(_intentKey, intent.storageValue);
  }

  @override
  Future<void> writePendingAuthMethod(MobileAuthMethod method) async {
    await _ensureReady();
    await _preferences!.setString(_pendingAuthMethodKey, method.storageValue);
  }

  @override
  Future<void> clearPendingAuthMethod() async {
    await _ensureReady();
    await _preferences!.remove(_pendingAuthMethodKey);
  }

  @override
  Future<void> writeLastRoute(String route) async {
    await _ensureReady();
    final sanitized = _sanitizeRoute(route) ?? AppRoutes.home;
    await _preferences!.setString(_lastRouteKey, sanitized);
  }

  @override
  Future<void> clearLastRoute() async {
    await _ensureReady();
    await _preferences!.remove(_lastRouteKey);
  }
}

class OnboardingHandoffController extends ChangeNotifier {
  OnboardingHandoffController(this._store)
    : _selectedIntent = MobileOnboardingIntent.findHelp,
      _pendingAuthMethod = null,
      _lastRoute = null {
    _initFromStore();
  }

  final OnboardingHandoffStore _store;
  MobileOnboardingIntent _selectedIntent;
  MobileAuthMethod? _pendingAuthMethod;
  String? _lastRoute;
  bool _disposed = false;

  void _initFromStore() {
    if (_store.isReady) {
      _selectedIntent = _store.readIntent() ?? MobileOnboardingIntent.findHelp;
      _pendingAuthMethod = _store.readPendingAuthMethod();
      _lastRoute = _store.readLastRoute();
    } else {
      _store.addListener(_onStoreReady);
    }
  }

  void _onStoreReady() {
    if (_disposed || !_store.isReady) return;
    _store.removeListener(_onStoreReady);
    _selectedIntent = _store.readIntent() ?? MobileOnboardingIntent.findHelp;
    _pendingAuthMethod = _store.readPendingAuthMethod();
    _lastRoute = _store.readLastRoute();
    notifyListeners();
  }

  MobileOnboardingIntent get selectedIntent => _selectedIntent;
  MobileAuthMethod? get pendingAuthMethod => _pendingAuthMethod;
  String? get lastRoute => _lastRoute;
  bool get hasStoredHandoff => _lastRoute != null || _pendingAuthMethod != null;

  bool _isAllowedPostAuthRoute(String route) {
    return route.startsWith('/app/');
  }

  String get postAuthDestination {
    if (_lastRoute != null && _isAllowedPostAuthRoute(_lastRoute!)) {
      return _lastRoute!;
    }
    return _selectedIntent.destinationRoute;
  }

  String resolvePostAuthDestination({String fallback = AppRoutes.home}) {
    return _pendingAuthMethod == null ? fallback : postAuthDestination;
  }

  Future<void> selectIntent(MobileOnboardingIntent intent) async {
    _selectedIntent = intent;
    _lastRoute = intent.destinationRoute;
    notifyListeners();

    await _store.writeIntent(intent);
    await _store.writeLastRoute(intent.destinationRoute);
  }

  Future<void> prepareForAuth(MobileAuthMethod method) async {
    _pendingAuthMethod = method;
    _lastRoute ??= _selectedIntent.destinationRoute;
    notifyListeners();

    await _store.writeIntent(_selectedIntent);
    await _store.writeLastRoute(_lastRoute ?? _selectedIntent.destinationRoute);
    await _store.writePendingAuthMethod(method);
  }

  Future<void> rememberRoute(String route) async {
    final sanitizedRoute = _sanitizeRoute(route);
    if (sanitizedRoute == null) {
      return;
    }

    _lastRoute = sanitizedRoute;
    notifyListeners();
    await _store.writeLastRoute(sanitizedRoute);
  }

  Future<void> completeAuthHandoff({
    String? startedRoute,
    bool clearStoredRoute = true,
  }) async {
    _pendingAuthMethod = null;
    final sanitizedRoute = _sanitizeRoute(startedRoute);
    if (clearStoredRoute) {
      _lastRoute = null;
      await _store.clearLastRoute();
    } else if (sanitizedRoute != null) {
      _lastRoute = sanitizedRoute;
      await _store.writeLastRoute(sanitizedRoute);
    }
    notifyListeners();
    await _store.clearPendingAuthMethod();
  }

  @override
  void dispose() {
    _disposed = true;
    _store.removeListener(_onStoreReady);
    super.dispose();
  }

  Map<String, Object> analyticsExtras({MobileAuthMethod? method}) {
    return {
      'intent': _selectedIntent.analyticsValue,
      'destination': postAuthDestination,
      'destination_label': _selectedIntent.destinationLabel,
      if (method != null) 'method': method.analyticsValue,
    };
  }
}

String? _sanitizeRoute(String? route) {
  final normalized = route?.trim();
  if (normalized == null || normalized.isEmpty) {
    return null;
  }
  if (!normalized.startsWith('/app')) {
    return null;
  }
  return normalized;
}
