import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mock/serviq_mock_store.dart';
import '../../../core/models/serviq_models.dart';

final profileHubRepositoryProvider = Provider<ProfileHubRepository>((ref) {
  return ProfileHubRepository(ref);
});

final profileHubProvider = FutureProvider<ProfileHub>((ref) async {
  return ref.read(profileHubRepositoryProvider).fetchProfileHub();
});

class ProfileHubRepository {
  ProfileHubRepository(this._ref);

  final Ref _ref;

  Future<ProfileHub> fetchProfileHub() async {
    await Future<void>.delayed(const Duration(milliseconds: 180));
    final state = _ref.read(serviqMockStoreProvider);
    return ProfileHub(
      profile: state.profile,
      savedListings: state.listings.where((item) => item.saved).toList(),
      savedPeople: state.people.where((item) => item.saved).toList(),
      recentSearches: state.recentSearches,
    );
  }

  Future<void> updateProfile({
    required String name,
    required String headline,
    required String bio,
    required String locality,
    required List<String> serviceCategories,
  }) async {
    _ref
        .read(serviqMockStoreProvider.notifier)
        .updateProfile(
          name: name,
          headline: headline,
          bio: bio,
          locality: locality,
          serviceCategories: serviceCategories,
        );
  }
}
