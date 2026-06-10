import 'dart:convert';

import 'package:firebase_core/firebase_core.dart';
import 'package:flutter/foundation.dart';
import 'package:flutter/services.dart';

class AppConfig {
  const AppConfig({
    required this.appName,
    required this.environment,
    required this.supabaseUrl,
    required this.supabaseAnonKey,
    required this.apiBaseUrl,
    required this.authRedirectScheme,
    required this.authRedirectHost,
    required this.allowBadCertificates,
    this.firebaseApiKey,
    this.firebaseProjectId,
    this.firebaseMessagingSenderId,
    this.firebaseAndroidAppId,
    this.firebaseIosAppId,
  });

  factory AppConfig.fromEnvironment() {
    return const AppConfig(
      appName: 'ServiQ',
      environment: String.fromEnvironment(
        'APP_ENV',
        defaultValue: 'development',
      ),
      supabaseUrl: String.fromEnvironment('SUPABASE_URL'),
      supabaseAnonKey: String.fromEnvironment('SUPABASE_ANON_KEY'),
      apiBaseUrl: String.fromEnvironment('API_BASE_URL'),
      authRedirectScheme: String.fromEnvironment(
        'AUTH_REDIRECT_SCHEME',
        defaultValue: 'serviq',
      ),
      authRedirectHost: String.fromEnvironment(
        'AUTH_REDIRECT_HOST',
        defaultValue: 'auth-callback',
      ),
      allowBadCertificates: bool.fromEnvironment('ALLOW_BAD_CERTIFICATES'),
      firebaseApiKey: String.fromEnvironment('FIREBASE_API_KEY'),
      firebaseProjectId: String.fromEnvironment('FIREBASE_PROJECT_ID'),
      firebaseMessagingSenderId: String.fromEnvironment(
        'FIREBASE_MESSAGING_SENDER_ID',
      ),
      firebaseAndroidAppId: String.fromEnvironment('FIREBASE_ANDROID_APP_ID'),
      firebaseIosAppId: String.fromEnvironment('FIREBASE_IOS_APP_ID'),
    );
  }

  static Future<AppConfig> load() async {
    final environmentConfig = AppConfig.fromEnvironment();

    if (environmentConfig.environment == 'production') {
      _assertProductionConfig(environmentConfig);
      return environmentConfig;
    }

    if (environmentConfig.hasSupabaseConfig) {
      return environmentConfig;
    }

    final localConfig = await _loadLocalConfig();
    if (localConfig == null) {
      return environmentConfig;
    }

    return environmentConfig.mergeWith(localConfig);
  }

  static void _assertProductionConfig(AppConfig config) {
    assert(
      config.supabaseUrl.trim().isNotEmpty &&
          config.supabaseAnonKey.trim().isNotEmpty &&
          config.apiBaseUrl.trim().isNotEmpty,
      'Production build requires SUPABASE_URL, SUPABASE_ANON_KEY, and '
      'API_BASE_URL to be set via --dart-define.\n'
      'Run: flutter build apk --release '
      '--dart-define=APP_ENV=production '
      '--dart-define=SUPABASE_URL="..." '
      '--dart-define=SUPABASE_ANON_KEY="..." '
      '--dart-define=API_BASE_URL="https://www.serviqapp.com"',
    );

    final url = config.apiBaseUrl.trim().toLowerCase();
    final localAliases = ['localhost', '127.0.0.1', '10.0.2.2', '0.0.0.0'];
    final isLocal = localAliases.any((alias) => url.contains(alias));
    if (isLocal) {
      throw ArgumentError(
        'API_BASE_URL resolves to a localhost variant ($url) in a production build.\n'
        'Set API_BASE_URL to your production server URL via --dart-define.\n'
        'Example: --dart-define=API_BASE_URL=https://www.serviqapp.com',
      );
    }
  }

  final String appName;
  final String environment;
  final String supabaseUrl;
  final String supabaseAnonKey;
  final String apiBaseUrl;
  final String authRedirectScheme;
  final String authRedirectHost;
  final bool allowBadCertificates;
  final String? firebaseApiKey;
  final String? firebaseProjectId;
  final String? firebaseMessagingSenderId;
  final String? firebaseAndroidAppId;
  final String? firebaseIosAppId;

  AppConfig mergeWith(AppConfig fallback) {
    return AppConfig(
      appName: _pickNonEmpty(appName, fallback.appName),
      environment: _pickNonEmpty(environment, fallback.environment),
      supabaseUrl: _pickNonEmpty(supabaseUrl, fallback.supabaseUrl),
      supabaseAnonKey: _pickNonEmpty(supabaseAnonKey, fallback.supabaseAnonKey),
      apiBaseUrl: _pickNonEmpty(apiBaseUrl, fallback.apiBaseUrl),
      authRedirectScheme: _pickNonEmpty(
        authRedirectScheme,
        fallback.authRedirectScheme,
      ),
      authRedirectHost: _pickNonEmpty(
        authRedirectHost,
        fallback.authRedirectHost,
      ),
      allowBadCertificates:
          allowBadCertificates || fallback.allowBadCertificates,
      firebaseApiKey: _pickNonNull(firebaseApiKey, fallback.firebaseApiKey),
      firebaseProjectId: _pickNonNull(
        firebaseProjectId, fallback.firebaseProjectId,
      ),
      firebaseMessagingSenderId: _pickNonNull(
        firebaseMessagingSenderId, fallback.firebaseMessagingSenderId,
      ),
      firebaseAndroidAppId: _pickNonNull(
        firebaseAndroidAppId, fallback.firebaseAndroidAppId,
      ),
      firebaseIosAppId: _pickNonNull(
        firebaseIosAppId, fallback.firebaseIosAppId,
      ),
    );
  }

  bool get hasSupabaseConfig =>
      supabaseUrl.trim().isNotEmpty && supabaseAnonKey.trim().isNotEmpty;

  bool get hasApiConfig => apiBaseUrl.trim().isNotEmpty;

  bool get hasNativeAuthRedirectConfig =>
      authRedirectScheme.trim().isNotEmpty &&
      authRedirectHost.trim().isNotEmpty;

  bool get hasMinimumClientConfig => hasSupabaseConfig && hasApiConfig;

  String get magicLinkRedirectUrl =>
      '${authRedirectScheme.trim()}://${authRedirectHost.trim()}';

  Uri? get supabaseUri => Uri.tryParse(supabaseUrl.trim());

  String get supabaseHost => supabaseUri?.host.toLowerCase() ?? '';

  bool get usesPlaceholderSupabaseConfig =>
      supabaseHost.contains('example.supabase.co') ||
      supabaseHost.contains('your-project.supabase.co');

  static Future<AppConfig?> _loadLocalConfig() async {
    try {
      final rawJson = await rootBundle.loadString('config/local.json');
      final decoded = jsonDecode(rawJson);
      if (decoded is! Map) {
        return null;
      }

      return AppConfig(
        appName: 'ServiQ',
        environment: _readString(
          decoded,
          'APP_ENV',
          defaultValue: 'development',
        ),
        supabaseUrl: _readString(decoded, 'SUPABASE_URL'),
        supabaseAnonKey: _readString(decoded, 'SUPABASE_ANON_KEY'),
        apiBaseUrl: _readString(decoded, 'API_BASE_URL'),
        authRedirectScheme: _readString(
          decoded,
          'AUTH_REDIRECT_SCHEME',
          defaultValue: 'serviq',
        ),
        authRedirectHost: _readString(
          decoded,
          'AUTH_REDIRECT_HOST',
          defaultValue: 'auth-callback',
        ),
        allowBadCertificates: _readBool(decoded, 'ALLOW_BAD_CERTIFICATES'),
        firebaseApiKey: _readStringOrNull(decoded, 'FIREBASE_API_KEY'),
        firebaseProjectId: _readStringOrNull(decoded, 'FIREBASE_PROJECT_ID'),
        firebaseMessagingSenderId: _readStringOrNull(
          decoded, 'FIREBASE_MESSAGING_SENDER_ID',
        ),
        firebaseAndroidAppId: _readStringOrNull(
          decoded, 'FIREBASE_ANDROID_APP_ID',
        ),
        firebaseIosAppId: _readStringOrNull(decoded, 'FIREBASE_IOS_APP_ID'),
      );
    } on FlutterError {
      return null;
    } on FormatException {
      return null;
    } catch (_) {
      return null;
    }
  }

  static String? _readStringOrNull(
    Map<dynamic, dynamic> values,
    String key,
  ) {
    final value = values[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }
    return null;
  }

  static String _readString(
    Map<dynamic, dynamic> values,
    String key, {
    String defaultValue = '',
  }) {
    final value = values[key];
    if (value is String && value.trim().isNotEmpty) {
      return value.trim();
    }

    return defaultValue;
  }

  static bool _readBool(Map<dynamic, dynamic> values, String key) {
    final value = values[key];

    if (value is bool) {
      return value;
    }

    if (value is String) {
      final normalized = value.trim().toLowerCase();
      return normalized == 'true' || normalized == '1' || normalized == 'yes';
    }

    if (value is num) {
      return value != 0;
    }

    return false;
  }

  FirebaseOptions? buildFirebaseOptions() {
    final apiKey = firebaseApiKey;
    final projectId = firebaseProjectId;
    final senderId = firebaseMessagingSenderId;
    if (apiKey == null || projectId == null || senderId == null) {
      return null;
    }

    final appId = switch (defaultTargetPlatform) {
      TargetPlatform.android => firebaseAndroidAppId,
      TargetPlatform.iOS => firebaseIosAppId,
      _ => null,
    };
    if (appId == null) return null;

    return FirebaseOptions(
      apiKey: apiKey,
      appId: appId,
      messagingSenderId: senderId,
      projectId: projectId,
    );
  }

  static String _pickNonEmpty(String primary, String fallback) {
    if (primary.trim().isNotEmpty) {
      return primary.trim();
    }

    return fallback.trim();
  }

  static String? _pickNonNull(String? primary, String? fallback) {
    if (primary != null && primary.trim().isNotEmpty) {
      return primary.trim();
    }

    return fallback?.trim();
  }
}
