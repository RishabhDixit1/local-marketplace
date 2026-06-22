import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/cache/people_cache.dart';
import '../domain/people_snapshot.dart';

final peopleRepositoryProvider = Provider<PeopleRepository>((ref) {
  return PeopleRepository(
    ref.watch(mobileApiClientProvider),
    ref.watch(peopleCacheProvider),
  );
});

final peopleSnapshotProvider = FutureProvider<MobilePeopleSnapshot>((ref) {
  return ref.watch(peopleRepositoryProvider).fetchPeople();
});

class PeopleRepository {
  const PeopleRepository(this._apiClient, this._cache);

  final MobileApiClient _apiClient;
  final PeopleCache _cache;

  Future<MobilePeopleSnapshot> fetchPeople({int limit = 50, int offset = 0}) async {
    try {
      final payload = await _apiClient.getJson(
        '/api/community/people',
        queryParameters: {
          'limit': limit.toString(),
          'offset': offset.toString(),
        },
      );
      if (payload['ok'] != true) {
        throw ApiException(
          (payload['message'] as String?) ??
              'Unable to load the people directory right now.',
        );
      }

      final snapshot = MobilePeopleSnapshot.fromJson(payload);
      await _cache.cachePeople(snapshot);
      return snapshot;
    } catch (e) {
      final cached = await _cache.getCachedPeople();
      if (cached != null) {
        return cached;
      }
      rethrow;
    }
  }
}
