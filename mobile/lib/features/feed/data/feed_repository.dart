import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../domain/feed_snapshot.dart';

final feedRepositoryProvider = Provider<FeedRepository>((ref) {
  return FeedRepository(ref.watch(mobileApiClientProvider));
});

final feedSnapshotProvider =
    FutureProvider.family<MobileFeedSnapshot, MobileFeedScope>((ref, scope) {
      return ref.watch(feedRepositoryProvider).fetchFeed(scope: scope);
    });

class FeedRepository {
  const FeedRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<MobileFeedSnapshot> fetchFeed({required MobileFeedScope scope}) async {
    final payload = await _apiClient.getJson(
      '/api/community/feed',
      queryParameters: {'scope': scope.queryValue},
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to load the community feed.',
      );
    }

    return MobileFeedSnapshot.fromJson(payload);
  }
}
