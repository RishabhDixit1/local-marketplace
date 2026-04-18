import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../domain/people_snapshot.dart';

final peopleRepositoryProvider = Provider<PeopleRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  final apiClient = MobileApiClient(
    config: bootstrap.config,
    supabaseClient: bootstrap.client,
  );
  ref.onDispose(apiClient.dispose);

  return PeopleRepository(apiClient);
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
