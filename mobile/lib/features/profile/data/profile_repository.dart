import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
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

  /// Persists the current profile fields using the same contract as the web profile editor.
  Future<void> saveProfileFromSnapshot(MobileProfileSnapshot snapshot) async {
    final payload = await _apiClient.postJson(
      '/api/profile/save',
      body: _profileSavePayload(snapshot),
    );
    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to save profile.',
      );
    }
  }

  Map<String, dynamic> _profileSavePayload(MobileProfileSnapshot snapshot) {
    final p = snapshot.profile;
    final role = snapshot.roleFamily == 'provider' ? 'provider' : 'seeker';
    final storedRole = role == 'provider' ? 'provider' : 'seeker';
    final availability = p.availability.trim().toLowerCase();
    final resolvedAvailability =
        availability == 'busy' || availability == 'offline'
            ? availability
            : 'available';

    return {
      'values': {
        'fullName': p.fullName.isNotEmpty ? p.fullName : snapshot.displayName,
        'location': p.location,
        'latitude': null,
        'longitude': null,
        'role': role,
        'bio': p.bio,
        'interests': <String>[],
        'email': snapshot.email,
        'phone': p.phone,
        'website': p.website,
        'avatarUrl': p.avatarUrl,
        'backgroundImageUrl': '',
        'availability': resolvedAvailability,
      },
      'storedRole': storedRole,
    };
  }
}
