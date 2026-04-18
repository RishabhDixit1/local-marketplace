import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../domain/mobile_profile_snapshot.dart';

final profileRepositoryProvider = Provider<ProfileRepository>((ref) {
  return ProfileRepository(ref.watch(mobileApiClientProvider));
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
