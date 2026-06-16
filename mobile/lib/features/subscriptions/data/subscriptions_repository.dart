import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/subscription_models.dart';

final subscriptionsRepositoryProvider = Provider<SubscriptionsRepository>((ref) {
  return SubscriptionsRepository(ref.watch(mobileApiClientProvider));
});

final subscriptionPlansProvider = FutureProvider<List<SubscriptionPlan>>((ref) {
  return ref.watch(subscriptionsRepositoryProvider).fetchPlans();
});

final currentSubscriptionProvider = FutureProvider<ProviderSubRecord?>((ref) {
  return ref.watch(subscriptionsRepositoryProvider).fetchCurrentSubscription();
});

class SubscriptionsRepository {
  const SubscriptionsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<SubscriptionPlan>> fetchPlans() async {
    final payload = await _apiClient.getJson('/api/subscriptions/plans');
    _expectOk(payload, 'Unable to load plans.');

    final list = (payload['plans'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(SubscriptionPlan.fromJson)
        .toList();
  }

  Future<ProviderSubRecord?> fetchCurrentSubscription() async {
    final payload = await _apiClient.getJson('/api/subscriptions/current');
    _expectOk(payload, 'Unable to load subscription.');
    if (payload['subscription'] == null) return null;
    return ProviderSubRecord.fromJson(
      Map<String, dynamic>.from(payload['subscription'] as Map),
    );
  }

  Future<SubscriptionPurchaseOrder> createSubscriptionOrder(String planId) async {
    final payload = await _apiClient.postJson(
      '/api/subscriptions/create-order',
      body: {'planId': planId},
    );
    _expectOk(payload, 'Unable to create subscription order.');
    return SubscriptionPurchaseOrder.fromJson(payload);
  }

  Future<void> verifySubscriptionPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
    required String planId,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/subscriptions/verify',
      body: {
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
        'planId': planId,
      },
    );
    _expectOk(payload, 'Unable to verify subscription payment.');
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
