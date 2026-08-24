import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/storefront_models.dart';

final storefrontRepositoryProvider = Provider<StorefrontRepository>((ref) {
  return StorefrontRepository(ref.watch(mobileApiClientProvider));
});

class StorefrontRepository {
  StorefrontRepository(this._api);

  final MobileApiClient _api;

  Future<StorefrontListResponse> fetchStorefronts({
    int limit = 20,
    int offset = 0,
    String? category,
    String? search,
    String? localityId,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (category != null && category.isNotEmpty) params['category'] = category;
    if (search != null && search.isNotEmpty) params['search'] = search;
    if (localityId != null && localityId.isNotEmpty) {
      params['localityId'] = localityId;
    }

    final json = await _api.getJson(
      '/api/storefronts',
      queryParameters: params,
      authenticated: false,
    );

    final storefronts = (json['storefronts'] as List<dynamic>?)
            ?.map((e) => Storefront.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? {};

    return StorefrontListResponse(
      storefronts: storefronts,
      total: pagination['total'] as int? ?? 0,
      hasMore: pagination['hasMore'] as bool? ?? false,
    );
  }

  Future<Storefront?> fetchStorefrontDetail(String id) async {
    final json = await _api.getJson(
      '/api/storefronts/$id',
      authenticated: false,
    );
    if (json['ok'] != true) return null;
    final sf = json['storefront'] as Map<String, dynamic>?;
    if (sf == null) return null;
    return Storefront.fromJson(sf);
  }

  Future<StorefrontProductListResponse> fetchStorefrontProducts(
    String storefrontId, {
    int limit = 30,
    int offset = 0,
  }) async {
    final json = await _api.getJson(
      '/api/storefronts/$storefrontId/products',
      queryParameters: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
      authenticated: false,
    );

    final products = (json['products'] as List<dynamic>?)
            ?.map((e) => StorefrontProduct.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? {};

    return StorefrontProductListResponse(
      products: products,
      total: pagination['total'] as int? ?? 0,
      hasMore: pagination['hasMore'] as bool? ?? false,
    );
  }

  Future<StorefrontProductListResponse> fetchAllProducts({
    int limit = 30,
    int offset = 0,
    String? category,
    String? search,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (category != null && category.isNotEmpty) params['category'] = category;
    if (search != null && search.isNotEmpty) params['search'] = search;

    final json = await _api.getJson(
      '/api/products',
      queryParameters: params,
      authenticated: false,
    );

    final products = (json['products'] as List<dynamic>?)
            ?.map((e) => StorefrontProduct.fromJson(e as Map<String, dynamic>))
            .toList() ??
        [];
    final pagination = json['pagination'] as Map<String, dynamic>? ?? {};

    return StorefrontProductListResponse(
      products: products,
      total: pagination['total'] as int? ?? 0,
      hasMore: pagination['hasMore'] as bool? ?? false,
    );
  }
}

class StorefrontListResponse {
  const StorefrontListResponse({
    required this.storefronts,
    required this.total,
    required this.hasMore,
  });

  final List<Storefront> storefronts;
  final int total;
  final bool hasMore;
}

class StorefrontProductListResponse {
  const StorefrontProductListResponse({
    required this.products,
    required this.total,
    required this.hasMore,
  });

  final List<StorefrontProduct> products;
  final int total;
  final bool hasMore;
}
