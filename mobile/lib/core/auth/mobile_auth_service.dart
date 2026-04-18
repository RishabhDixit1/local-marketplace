import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../api/mobile_api_client.dart';
import '../supabase/app_bootstrap.dart';

final mobileAuthServiceProvider = Provider<MobileAuthService>((ref) {
  return MobileAuthService(ref.watch(appBootstrapProvider));
});

class MobileAuthService {
  const MobileAuthService(this._bootstrap);

  final AppBootstrap _bootstrap;

  SupabaseClient get _client {
    if (_bootstrap.config.usesPlaceholderSupabaseConfig) {
      throw StateError(
        'This mobile app is still using placeholder Supabase values. '
        'Restart it with the real SUPABASE_URL and SUPABASE_ANON_KEY.',
      );
    }

    final client = _bootstrap.client;
    if (client == null) {
      throw StateError(
        'Supabase is not ready yet. Finish setup before trying to sign in.',
      );
    }

    return client;
  }

  String friendlyErrorMessage(Object error, {required String fallbackPrefix}) {
    final rawMessage = error is AuthException
        ? error.message
        : error.toString();
    final normalizedMessage = rawMessage.toLowerCase();

    if (_bootstrap.config.usesPlaceholderSupabaseConfig ||
        normalizedMessage.contains('example.supabase.co') ||
        normalizedMessage.contains('your-project.supabase.co')) {
      return 'This mobile app is still using placeholder Supabase values. '
          'Restart it with the real SUPABASE_URL and SUPABASE_ANON_KEY.';
    }

    if (normalizedMessage.contains('failed host lookup') ||
        normalizedMessage.contains('socketexception')) {
      return 'The phone could not reach Supabase. Double-check the mobile '
          'SUPABASE_URL value and confirm the device has internet access.';
    }

    if (normalizedMessage.contains('provider is not enabled') ||
        normalizedMessage.contains('unsupported provider')) {
      return 'Google sign-in is not enabled yet in Supabase. Turn it on in '
          'Authentication -> Providers -> Google.';
    }

    if (normalizedMessage.contains('redirect') &&
        normalizedMessage.contains('url')) {
      return 'The auth callback does not match Supabase Additional Redirect '
          'URLs. Check ${_bootstrap.config.magicLinkRedirectUrl}.';
    }

    if (normalizedMessage.contains('invalid login credentials')) {
      return 'That email and password combination did not match an existing '
          'account.';
    }

    if (normalizedMessage.contains('email not confirmed')) {
      return 'Check your email and confirm your account before signing in '
          'with password.';
    }

    if (error is AuthException || error is StateError) {
      return rawMessage;
    }

    return '$fallbackPrefix: $rawMessage';
  }

  Future<void> sendEmailCode(String email) async {
    await _client.auth.signInWithOtp(
      email: email.trim(),
      shouldCreateUser: true,
    );
  }

  Future<String> sendMagicLink(String email) async {
    final apiClient = MobileApiClient(
      config: _bootstrap.config,
      supabaseClient: _bootstrap.client,
    );

    try {
      final payload = await apiClient.postJson(
        '/api/auth/send-link',
        body: {
          'email': email.trim(),
          'redirectTo': _bootstrap.config.magicLinkRedirectUrl,
        },
        authenticated: false,
      );

      if (payload['ok'] != true) {
        throw ApiException(
          (payload['message'] as String?) ??
              (payload['error'] as String?) ??
              'Unable to send the magic link.',
        );
      }

      final resolvedRedirect = payload['redirectTo'];
      if (resolvedRedirect is String && resolvedRedirect.trim().isNotEmpty) {
        return resolvedRedirect.trim();
      }

      return _bootstrap.config.magicLinkRedirectUrl;
    } finally {
      apiClient.dispose();
    }
  }

  Future<AuthResponse> verifyEmailCode({
    required String email,
    required String code,
  }) async {
    return _client.auth.verifyOTP(
      email: email.trim(),
      token: code.trim(),
      type: OtpType.email,
    );
  }

  Future<AuthResponse> signInWithPassword({
    required String email,
    required String password,
  }) async {
    return _client.auth.signInWithPassword(
      email: email.trim(),
      password: password,
    );
  }

  Future<AuthResponse> signUpWithPassword({
    required String email,
    required String password,
  }) async {
    return _client.auth.signUp(
      email: email.trim(),
      password: password,
      emailRedirectTo: _bootstrap.config.magicLinkRedirectUrl,
    );
  }

  Future<void> signInWithGoogle() async {
    final launched = await _client.auth.signInWithOAuth(
      OAuthProvider.google,
      redirectTo: _bootstrap.config.magicLinkRedirectUrl,
    );

    if (!launched) {
      throw StateError('Could not open Google sign-in.');
    }
  }

  Future<void> linkGoogle() async {
    final launched = await _client.auth.linkIdentity(
      OAuthProvider.google,
      redirectTo: _bootstrap.config.magicLinkRedirectUrl,
    );

    if (!launched) {
      throw StateError('Could not open Google account linking.');
    }
  }

  Future<void> updatePassword(String password) async {
    await _client.auth.updateUser(UserAttributes(password: password));
  }
}
