import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/promotion_models.dart';

final promotionsRepositoryProvider = Provider<PromotionsRepository>((ref) {
  return PromotionsRepository(ref.watch(mobileApiClientProvider));
});

final boostDataProvider = FutureProvider<BoostData>((ref) {
  return ref.watch(promotionsRepositoryProvider).fetchBoosts();
});

class PromotionsRepository {
  const PromotionsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<BoostData> fetchBoosts() async {
    final payload = await _apiClient.getJson('/api/provider/boosts');
    _expectOk(payload, 'Unable to load boosts.');
    return BoostData.fromJson(payload);
  }

  Future<BoostPurchaseOrder> createBoostOrder(String duration) async {
    final payload = await _apiClient.postJson(
      '/api/provider/boosts',
      body: {'duration': duration},
    );
    _expectOk(payload, 'Unable to create boost order.');
    return BoostPurchaseOrder.fromJson(payload);
  }

  Future<void> verifyBoostPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/provider/boosts/verify',
      body: {
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
      },
    );
    _expectOk(payload, 'Unable to verify boost payment.');
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
