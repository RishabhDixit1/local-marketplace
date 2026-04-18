import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../domain/people_snapshot.dart';

final peopleRepositoryProvider = Provider<PeopleRepository>((ref) {
  return PeopleRepository(ref.watch(mobileApiClientProvider));
});

final peopleSnapshotProvider = FutureProvider<MobilePeopleSnapshot>((ref) {
  return ref.watch(peopleRepositoryProvider).fetchPeople();
});

class PeopleRepository {
  const PeopleRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<MobilePeopleSnapshot> fetchPeople() async {
    final payload = await _apiClient.getJson('/api/community/people');
    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ??
            'Unable to load the people directory right now.',
      );
    }

    return MobilePeopleSnapshot.fromJson(payload);
  }
}
