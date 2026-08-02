import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/provider_profile_bundle.dart';

final providerProfileRepositoryProvider = Provider<ProviderProfileRepository>((ref) {
  return ProviderProfileRepository(ref.watch(mobileApiClientProvider));
});

final providerProfileBundleProvider = FutureProvider.family<ProviderProfileBundle, String>((ref, providerId) {
  return ref.watch(providerProfileRepositoryProvider).fetchProviderProfile(providerId);
});

class ProviderProfileRepository {
  const ProviderProfileRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<ProviderProfileBundle> fetchProviderProfile(String providerId) async {
    final payload = await _apiClient.getJson(
      '/api/providers/$providerId/profile',
    );
    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to load provider profile.',
      );
    }
    return ProviderProfileBundle.fromJson(payload);
  }
}
