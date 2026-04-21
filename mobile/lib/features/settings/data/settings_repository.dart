import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mock/serviq_mock_store.dart';
import '../../../core/models/serviq_models.dart';

final settingsRepositoryProvider = Provider<SettingsRepository>((ref) {
  return SettingsRepository(ref);
});

final settingsProvider = FutureProvider<AppSettingsModel>((ref) async {
  return ref.read(settingsRepositoryProvider).fetchSettings();
});

class SettingsRepository {
  SettingsRepository(this._ref);

  final Ref _ref;

  Future<AppSettingsModel> fetchSettings() async {
    await Future<void>.delayed(const Duration(milliseconds: 120));
    return _ref.read(serviqMockStoreProvider).settings;
  }

  Future<void> saveSettings(AppSettingsModel settings) async {
    _ref.read(serviqMockStoreProvider.notifier).updateSettings(settings);
  }
}
