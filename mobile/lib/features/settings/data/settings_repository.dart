import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/settings_models.dart';

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  return SettingsRepository(ref.watch(mobileApiClientProvider));
});

final notificationSettingsProvider = FutureProvider<NotificationSettings>((ref) {
  return ref.watch(settingsRepositoryProvider).fetch();
});

class SettingsRepository {
  const SettingsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<NotificationSettings> fetch() async {
    final payload = await _apiClient.getJson('/api/user-settings');

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to load settings.',
      );
    }

    return NotificationSettings.fromJson(
      (payload['settings'] as Map<String, dynamic>?) ?? {},
    );
  }

  Future<NotificationSettings> update(NotificationSettings settings) async {
    final payload = await _apiClient.patchJson(
      '/api/user-settings',
      body: settings.toJson(),
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to save settings.',
      );
    }

    return NotificationSettings.fromJson(
      (payload['settings'] as Map<String, dynamic>?) ?? {},
    );
  }
}
