import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/marketplace_provider.dart';

final marketplaceRepositoryProvider = Provider<MarketplaceRepository>((ref) {
  return MarketplaceRepository(ref.watch(mobileApiClientProvider));
});

final marketplaceProvidersProvider =
    FutureProvider.family<List<MarketplaceProvider>, String?>(
        (ref, category) {
  return ref
      .watch(marketplaceRepositoryProvider)
      .fetchProviders(category: category);
});

class MarketplaceRepository {
  const MarketplaceRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<MarketplaceProvider>> fetchProviders({String? category}) async {
    final query = <String, String>{};
    if (category != null && category.isNotEmpty) {
      query['category'] = category;
    }

    final payload = await _apiClient.getJson(
      '/api/community/providers-by-category',
      queryParameters: query.isNotEmpty ? query : null,
      authenticated: false,
    );

    final providersJson = (payload['providers'] as List?) ?? [];
    return providersJson
        .whereType<Map>()
        .map((row) => MarketplaceProvider.fromJson(Map<String, dynamic>.from(row)))
        .toList();
  }
}
