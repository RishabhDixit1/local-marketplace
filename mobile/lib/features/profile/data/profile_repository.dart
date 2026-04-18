import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../domain/mobile_profile_snapshot.dart';

final mobileProfileApiClientProvider = Provider<MobileApiClient>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final client = MobileApiClient(
    config: bootstrap.config,
    supabaseClient: bootstrap.client,
  );
  ref.onDispose(client.dispose);
  return client;
});

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.watch(mobileProfileApiClientProvider));
});

final profileSnapshotProvider = FutureProvider<MobileProfileSnapshot>((ref) {
  return ref.watch(profileRepositoryProvider).fetchProfile();
});

class ProfileRepository {
  const ProfileRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<MobileProfileSnapshot> fetchProfile() async {
    final payload = await _apiClient.getJson('/api/mobile/account');
    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ??
            'Unable to load the mobile profile bundle.',
      );
    }

    return MobileProfileSnapshot.fromJson(payload);
  }
}
