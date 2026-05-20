import 'package:flutter/foundation.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import '../api/mobile_api_client.dart';
import '../api/mobile_api_provider.dart';

final appUpdateServiceProvider = Provider<AppUpdateService>((ref) {
  return AppUpdateService(apiClient: ref.watch(mobileApiClientProvider));
});

class AppUpdateInfo {
  final bool updateAvailable;
  final bool isCritical;
  final String latestVersion;
  final String? updateUrl;
  final String? releaseNotes;

  const AppUpdateInfo({
    required this.updateAvailable,
    required this.isCritical,
    required this.latestVersion,
    this.updateUrl,
    this.releaseNotes,
  });

  factory AppUpdateInfo.noUpdate() => const AppUpdateInfo(
    updateAvailable: false,
    isCritical: false,
    latestVersion: '',
  );

  factory AppUpdateInfo.fromJson(Map<String, dynamic> json) {
    return AppUpdateInfo(
      updateAvailable: json['updateAvailable'] == true,
      isCritical: json['isCritical'] == true,
      latestVersion: json['latestVersion'] as String? ?? '',
      updateUrl: json['updateUrl'] as String?,
      releaseNotes: json['releaseNotes'] as String?,
    );
  }
}

class AppUpdateService {
  const AppUpdateService({required MobileApiClient apiClient})
    : _apiClient = apiClient;

  final MobileApiClient _apiClient;

  Future<AppUpdateInfo> checkForUpdate() async {
    try {
      final payload = await _apiClient.getJson('/api/app/version-check');
      return AppUpdateInfo.fromJson(payload);
    } catch (e) {
      debugPrint('ServiQ: Update check failed: $e');
      return AppUpdateInfo.noUpdate();
    }
  }
}
