import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/search_models.dart';

final searchRepositoryProvider = Provider<SearchRepository>((ref) {
  return SearchRepository(ref.watch(mobileApiClientProvider));
});

class SearchRepository {
  const SearchRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<SearchResponse> search({
    String? category,
    String? query,
    double? lat,
    double? lng,
    int limit = 50,
    int offset = 0,
    double? minRating,
    bool onlineOnly = false,
    String sortBy = 'distance',
  }) async {
    final payload = await _apiClient.searchProviders(
      category: category,
      search: query,
      lat: lat,
      lng: lng,
      limit: limit,
      offset: offset,
      minRating: minRating,
      onlineOnly: onlineOnly,
      sortBy: sortBy,
    );

    return SearchResponse.fromJson(payload);
  }
}
