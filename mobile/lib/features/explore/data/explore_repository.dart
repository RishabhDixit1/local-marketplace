import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mock/serviq_mock_store.dart';
import '../../../core/models/serviq_models.dart';

final exploreRepositoryProvider = Provider<ExploreRepository>((ref) {
  return ExploreRepository(ref);
});

final exploreDashboardProvider = FutureProvider<ExploreDashboard>((ref) async {
  return ref.read(exploreRepositoryProvider).fetchDashboard();
});

class ExploreRepository {
  ExploreRepository(this._ref);

  final Ref _ref;

  Future<ExploreDashboard> fetchDashboard() async {
    await Future<void>.delayed(const Duration(milliseconds: 220));
    final state = _ref.read(serviqMockStoreProvider);

    // TODO(api): Replace mock store reads with paginated network requests.
    return ExploreDashboard(
      locationTitle: state.locationTitle,
      categories: state.categories,
      trendingRequests: state.listings
          .where((item) => item.type == ExploreItemType.request)
          .toList(),
      recommendedProviders: state.people
          .where(
            (item) => item.connectionState != PeopleConnectionState.blocked,
          )
          .toList(),
      featuredOpportunities: state.listings
          .where((item) => item.type != ExploreItemType.request)
          .toList(),
      savedCount: state.listings.where((item) => item.saved).length,
    );
  }

  Future<void> toggleSaved(String listingId) async {
    _ref.read(serviqMockStoreProvider.notifier).toggleSavedListing(listingId);
  }
}
