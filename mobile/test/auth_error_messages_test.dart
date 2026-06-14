import 'dart:io';

import 'package:flutter_test/flutter_test.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import 'package:serviq_mobile/core/supabase/app_bootstrap.dart';
import 'package:serviq_mobile/core/config/app_config.dart';
import 'package:serviq_mobile/core/auth/mobile_auth_service.dart';

AppConfig _config({bool placeholder = false}) {
  return AppConfig(
    appName: 'ServiQ',
    environment: 'test',
    supabaseUrl: placeholder ? 'https://example.supabase.co' : 'https://real.supabase.co',
    supabaseAnonKey: 'test-anon-key',
    apiBaseUrl: 'https://api.test.local',
    authRedirectScheme: 'serviq',
    authRedirectHost: 'auth-callback',
    allowBadCertificates: false,
  );
}

AppBootstrap _bootstrap({bool placeholder = false}) {
  return AppBootstrap(
    config: _config(placeholder: placeholder),
    client: null,
    supabaseReady: false,
    initializationError: null,
  );
}

class _ThrowingAuthService extends MobileAuthService {
  _ThrowingAuthService(super.bootstrap);

  String callFriendly(Object error, {String prefix = 'Unable to sign in'}) {
    return friendlyErrorMessage(error, fallbackPrefix: prefix);
  }
}

void main() {
  group('MobileAuthService.friendlyErrorMessage', () {
    test('returns placeholder message for placeholder config', () {
      final service = _ThrowingAuthService(_bootstrap(placeholder: true));
      final msg = service.callFriendly(AuthException('some error'));
      expect(msg, contains('placeholder'));
    });

    test('detects placeholder URL in error message', () {
      final service = _ThrowingAuthService(_bootstrap());
      final msg = service.callFriendly(
        AuthException('https://your-project.supabase.co error'),
      );
      expect(msg, contains('placeholder'));
    });

    test('returns network error message for SocketException', () {
      final service = _ThrowingAuthService(_bootstrap());
      final msg = service.callFriendly(
        const SocketException('Failed host lookup: supabase.co'),
      );
      expect(msg, contains('could not reach Supabase'));
    });

    test('returns provider not enabled message', () {
      final service = _ThrowingAuthService(_bootstrap());
      final msg = service.callFriendly(
        AuthException('Provider is not enabled'),
      );
      expect(msg, contains('Google sign-in is not enabled'));
    });

    test('returns redirect URL message', () {
      final service = _ThrowingAuthService(_bootstrap());
      final msg = service.callFriendly(
        AuthException('Redirect URL mismatch'),
      );
      expect(msg.toLowerCase(), contains('redirect'));
      expect(msg, contains('serviq://auth-callback'));
    });

    test('returns invalid credentials message', () {
      final service = _ThrowingAuthService(_bootstrap());
      final msg = service.callFriendly(
        AuthException('Invalid login credentials'),
      );
      expect(msg, contains('email and password'));
    });

    test('returns email not confirmed message', () {
      final service = _ThrowingAuthService(_bootstrap());
      final msg = service.callFriendly(
        AuthException('Email not confirmed'),
      );
      expect(msg, contains('confirm your account'));
    });

    test('returns raw AuthException message as-is', () {
      final service = _ThrowingAuthService(_bootstrap());
      final msg = service.callFriendly(
        AuthException('Some other auth error'),
      );
      expect(msg, 'Some other auth error');
    });

    test('returns fallback for unrecognized errors', () {
      final service = _ThrowingAuthService(_bootstrap());
      final msg = service.callFriendly(
        FormatException('weird'),
        prefix: 'Unable to sign in',
      );
      expect(msg, contains('Unable to sign in'));
    });
  });
}
