import 'dart:convert';

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
    );
  }

  static Future<AppConfig> load() async {
    final environmentConfig = AppConfig.fromEnvironment();
    if (environmentConfig.hasMinimumClientConfig || !kDebugMode) {
      return environmentConfig;
    }

    final localConfig = await _loadLocalConfig();
    if (localConfig == null) {
      return environmentConfig;
    }

    return environmentConfig.mergeWith(localConfig);
  }

  final String appName;
  final String environment;
  final String supabaseUrl;
  final String supabaseAnonKey;
  final String apiBaseUrl;
  final String authRedirectScheme;
  final String authRedirectHost;

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
      );
    } on FlutterError {
      return null;
    } on FormatException {
      return null;
    } catch (_) {
      return null;
    }
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

  static String _pickNonEmpty(String primary, String fallback) {
    if (primary.trim().isNotEmpty) {
      return primary.trim();
    }

    return fallback.trim();
  }
}
