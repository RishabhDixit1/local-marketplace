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

  final String appName;
  final String environment;
  final String supabaseUrl;
  final String supabaseAnonKey;
  final String apiBaseUrl;
  final String authRedirectScheme;
  final String authRedirectHost;

  bool get hasSupabaseConfig =>
      supabaseUrl.trim().isNotEmpty && supabaseAnonKey.trim().isNotEmpty;

  bool get hasApiConfig => apiBaseUrl.trim().isNotEmpty;

  bool get hasNativeAuthRedirectConfig =>
      authRedirectScheme.trim().isNotEmpty &&
      authRedirectHost.trim().isNotEmpty;

  bool get hasMinimumClientConfig => hasSupabaseConfig && hasApiConfig;

  String get magicLinkRedirectUrl =>
      '${authRedirectScheme.trim()}://${authRedirectHost.trim()}';
}
