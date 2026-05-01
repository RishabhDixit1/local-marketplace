import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/provider_listing_models.dart';

final providerListingRepositoryProvider = Provider<ProviderListingRepository>((
  ref,
) {
  return ProviderListingRepository(ref.watch(mobileApiClientProvider));
});

final providerListingsProvider = FutureProvider<MobileProviderListingsSnapshot>(
  (ref) {
    return ref.watch(providerListingRepositoryProvider).fetchListings();
  },
);

class ProviderListingRepository {
  const ProviderListingRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<MobileProviderListingsSnapshot> fetchListings() async {
    final payload = await _apiClient.getJson('/api/provider/listings');
    _expectOk(payload, 'Unable to load provider listings.');
    return MobileProviderListingsSnapshot.fromJson(payload);
  }

  Future<void> createService(Map<String, dynamic> values) async {
    final payload = await _apiClient.postJson(
      '/api/provider/listings',
      body: {'listingType': 'service', 'values': values},
    );
    _expectOk(payload, 'Unable to create the service listing.');
  }

  Future<void> updateService({
    required String listingId,
    required Map<String, dynamic> values,
  }) async {
    final payload = await _apiClient.patchJson(
      '/api/provider/listings',
      body: {
        'listingType': 'service',
        'listingId': listingId,
        'values': values,
      },
    );
    _expectOk(payload, 'Unable to update the service listing.');
  }

  Future<void> createProduct(Map<String, dynamic> values) async {
    final payload = await _apiClient.postJson(
      '/api/provider/listings',
      body: {'listingType': 'product', 'values': values},
    );
    _expectOk(payload, 'Unable to create the product listing.');
  }

  Future<void> updateProduct({
    required String listingId,
    required Map<String, dynamic> values,
  }) async {
    final payload = await _apiClient.patchJson(
      '/api/provider/listings',
      body: {
        'listingType': 'product',
        'listingId': listingId,
        'values': values,
      },
    );
    _expectOk(payload, 'Unable to update the product listing.');
  }

  Future<void> deleteListing({
    required MobileProviderListingType listingType,
    required String listingId,
  }) async {
    final payload = await _apiClient.deleteJson(
      '/api/provider/listings',
      body: {'listingType': listingType.apiValue, 'listingId': listingId},
    );
    _expectOk(payload, 'Unable to delete the listing.');
  }

  Future<String> uploadListingImage({
    required String filePath,
    required String fileName,
    required String mediaType,
  }) async {
    final payload = await _apiClient.uploadFile(
      '/api/upload/listing-image',
      filePath: filePath,
      fileName: fileName,
      mediaType: mediaType,
    );
    _expectOk(payload, 'Unable to upload listing image.');

    final path = (payload['path'] as String?)?.trim() ?? '';
    final url = (payload['url'] as String?)?.trim() ?? '';
    return path.isNotEmpty ? path : url;
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) {
      return;
    }
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
