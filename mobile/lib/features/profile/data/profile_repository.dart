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

  Future<void> saveProfileFields(
    MobileProfileSnapshot snapshot, {
    required String fullName,
    required String location,
    required String bio,
    required String phone,
    required String website,
    required String avatarUrl,
    required String availability,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/profile/save',
      body: _profileSavePayload(
        snapshot,
        fullName: fullName,
        location: location,
        bio: bio,
        phone: phone,
        website: website,
        avatarUrl: avatarUrl,
        availability: availability,
      ),
    );
    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to save profile.',
      );
    }
  }

  Future<void> submitReview({
    required String providerId,
    required int rating,
    String? comment,
  }) async {
    await _apiClient.postJson('/api/profile/review', body: {
      'providerId': providerId,
      'rating': rating.clamp(1, 5),
      if (comment != null && comment.trim().isNotEmpty) 'comment': comment.trim(),
    });
  }

  Map<String, dynamic> _profileSavePayload(
    MobileProfileSnapshot snapshot, {
    String? fullName,
    String? location,
    String? bio,
    String? phone,
    String? website,
    String? avatarUrl,
    String? availability,
  }) {
    final p = snapshot.profile;
    final role = snapshot.roleFamily == 'provider' ? 'provider' : 'seeker';
    final storedRole = role == 'provider' ? 'provider' : 'seeker';
    final nextAvailability = (availability ?? p.availability)
        .trim()
        .toLowerCase();
    final resolvedAvailability =
        nextAvailability == 'busy' || nextAvailability == 'offline'
        ? nextAvailability
        : 'available';
    final nextFullName = fullName ?? p.fullName;

    return {
      'values': {
        'fullName': nextFullName.isNotEmpty
            ? nextFullName
            : snapshot.displayName,
        'location': location ?? p.location,
        'latitude': null,
        'longitude': null,
        'role': role,
        'bio': bio ?? p.bio,
        'interests': <String>[],
        'email': snapshot.email,
        'phone': phone ?? p.phone,
        'website': website ?? p.website,
        'avatarUrl': avatarUrl ?? p.avatarUrl,
        'backgroundImageUrl': '',
        'availability': resolvedAvailability,
      },
      'storedRole': storedRole,
    };
  }
}
