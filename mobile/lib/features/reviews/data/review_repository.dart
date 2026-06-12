import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/review_models.dart';

final reviewRepositoryProvider = Provider<ReviewRepository>((ref) {
  return ReviewRepository(ref.watch(mobileApiClientProvider));
});

final providerReviewsProvider = FutureProvider.family<List<ProviderReviewItem>, String>((ref, providerId) {
  return ref.watch(reviewRepositoryProvider).fetchByProvider(providerId);
});

class ReviewRepository {
  const ReviewRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<ProviderReviewItem>> fetchByProvider(String providerId) async {
    final payload = await _apiClient.getJson(
      '/api/reviews/by-provider',
      queryParameters: {'providerId': providerId},
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to load reviews.',
      );
    }

    final items = (payload['reviews'] as List?) ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(ProviderReviewItem.fromJson)
        .toList();
  }

  Future<Map<String, dynamic>> getVoteStatus(String reviewId) async {
    return _apiClient.getJson('/api/reviews/$reviewId/vote/status');
  }

  Future<Map<String, dynamic>> toggleVote(String reviewId, String vote) async {
    return _apiClient.postJson(
      '/api/reviews/$reviewId/vote',
      body: {'vote': vote},
    );
  }

  Future<Map<String, dynamic>> uploadPhoto(String reviewId, String base64Image) async {
    final formData = <String, dynamic>{
      'photo': base64Image,
    };
    return _apiClient.postJson(
      '/api/reviews/$reviewId/photos',
      body: formData,
    );
  }

  Future<Map<String, dynamic>> deletePhoto(String reviewId, String url) async {
    return _apiClient.postJson(
      '/api/reviews/$reviewId/photos',
      body: {'delete_url': url},
    );
  }
}
