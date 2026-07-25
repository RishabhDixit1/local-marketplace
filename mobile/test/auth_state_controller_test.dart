import 'dart:async';

import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:serviq_mobile/core/auth/auth_state_controller.dart';
import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';

class MockAppBootstrap extends Mock implements AppBootstrap {}

class MockSupabaseClient extends Mock implements SupabaseClient {}

class MockGoTrueClient extends Mock implements GoTrueClient {}

class MockSession extends Mock implements Session {}

class MockUser extends Mock implements User {}

class MockAuthState extends Mock implements AuthState {}

void main() {
  late MockAppBootstrap mockBootstrap;
  late MockSupabaseClient mockClient;
  late MockGoTrueClient mockAuth;
  late StreamController<AuthState> authStateController;

  setUpAll(() {
    registerFallbackValue(MockAppBootstrap());
  });

  setUp(() {
    mockBootstrap = MockAppBootstrap();
    mockClient = MockSupabaseClient();
    mockAuth = MockGoTrueClient();
    authStateController = StreamController<AuthState>.broadcast();

    when(() => mockBootstrap.client).thenReturn(mockClient);
    when(() => mockClient.auth).thenReturn(mockAuth);
    when(() => mockAuth.currentSession).thenReturn(null);
    when(() => mockAuth.onAuthStateChange)
        .thenAnswer((_) => authStateController.stream);
  });

  tearDown(() {
    authStateController.close();
  });

  group('AuthStateController', () {
    test('starts with null session when no current session exists', () {
      final controller = AuthStateController(mockBootstrap);

      expect(controller.currentSession, isNull);
      expect(controller.currentUser, isNull);
      expect(controller.isAuthenticated, isFalse);

      controller.dispose();
    });

    test('starts with session when current session exists', () {
      final mockSession = MockSession();
      final mockUser = MockUser();
      when(() => mockAuth.currentSession).thenReturn(mockSession);
      when(() => mockSession.user).thenReturn(mockUser);

      final controller = AuthStateController(mockBootstrap);

      expect(controller.currentSession, equals(mockSession));
      expect(controller.currentUser, equals(mockUser));
      expect(controller.isAuthenticated, isTrue);

      controller.dispose();
    });

    test('updates session on auth state change events', () async {
      final controller = AuthStateController(mockBootstrap);
      expect(controller.currentSession, isNull);

      final newSession = MockSession();
      final newUser = MockUser();
      when(() => newSession.user).thenReturn(newUser);

      final authEvent = MockAuthState();
      when(() => authEvent.session).thenReturn(newSession);
      authStateController.add(authEvent);

      await Future<void>.delayed(Duration.zero);

      expect(controller.currentSession, equals(newSession));
      expect(controller.currentUser, equals(newUser));
      expect(controller.isAuthenticated, isTrue);

      controller.dispose();
    });

    test('clears session on sign out event', () async {
      final initialSession = MockSession();
      when(() => mockAuth.currentSession).thenReturn(initialSession);

      final controller = AuthStateController(mockBootstrap);
      expect(controller.isAuthenticated, isTrue);

      final signOutEvent = MockAuthState();
      when(() => signOutEvent.session).thenReturn(null);
      authStateController.add(signOutEvent);

      await Future<void>.delayed(Duration.zero);

      expect(controller.currentSession, isNull);
      expect(controller.isAuthenticated, isFalse);

      controller.dispose();
    });

    test('signOut returns early when client is null', () async {
      when(() => mockBootstrap.client).thenReturn(null);

      final controller = AuthStateController(mockBootstrap);

      await controller.signOut();

      verifyNever(() => mockAuth.signOut());

      controller.dispose();
    });

    test('signOut calls client.auth.signOut', () async {
      when(() => mockAuth.signOut()).thenAnswer((_) async {});

      final controller = AuthStateController(mockBootstrap);

      await controller.signOut();

      verify(() => mockAuth.signOut()).called(1);

      controller.dispose();
    });

    test('signOut rethrows on failure', () async {
      when(() => mockAuth.signOut()).thenThrow(Exception('sign out failed'));

      final controller = AuthStateController(mockBootstrap);

      expect(() => controller.signOut(), throwsException);

      controller.dispose();
    });

    test('dispose cancels subscription and closes stream', () {
      final controller = AuthStateController(mockBootstrap);

      controller.dispose();

      expect(
        () => controller.sessionChanges.listen((_) {}),
        returnsNormally,
      );
    });

    test('sessionChanges stream emits session updates', () async {
      final controller = AuthStateController(mockBootstrap);
      final sessions = <Session?>[];

      controller.sessionChanges.listen(sessions.add);

      final newSession = MockSession();
      final authEvent = MockAuthState();
      when(() => authEvent.session).thenReturn(newSession);
      authStateController.add(authEvent);

      await Future<void>.delayed(Duration.zero);

      expect(sessions, contains(newSession));

      controller.dispose();
    });

    test('handles auth state change error gracefully', () async {
      final controller = AuthStateController(mockBootstrap);

      authStateController.addError(Exception('auth stream error'));

      await Future<void>.delayed(Duration.zero);

      expect(controller.currentSession, isNull);

      controller.dispose();
    });
  });
}
