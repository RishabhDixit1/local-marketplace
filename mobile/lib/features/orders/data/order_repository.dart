import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/order_models.dart';

final orderRepositoryProvider = Provider<OrderRepository>((ref) {
  return OrderRepository(ref.watch(mobileApiClientProvider));
});

final orderDetailProvider = FutureProvider.family<MobileOrderRecord, String>((
  ref,
  orderId,
) {
  return ref.watch(orderRepositoryProvider).fetchOrder(orderId);
});

class OrderRepository {
  const OrderRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<MobileOrderRecord> fetchOrder(String orderId) async {
    final payload = await _apiClient.getJson('/api/orders/$orderId');
    _expectOk(payload, 'Unable to load order.');

    return MobileOrderRecord.fromJson(
      Map<String, dynamic>.from(
        (payload['order'] as Map?) ?? const <String, dynamic>{},
      ),
    );
  }

  Future<MobileCheckoutResult> createOrder(
    MobileCheckoutRequest request,
  ) async {
    final payload = await _apiClient.postJson(
      '/api/orders',
      body: request.toJson(),
    );
    _expectOk(payload, 'Unable to place order.');
    return MobileCheckoutResult.fromJson(payload);
  }

  Future<MobileCheckoutResult> createBulkOrder(
    MobileBulkCheckoutRequest request,
  ) async {
    if (request.items.isEmpty) {
      throw ApiException('Cart is empty.');
    }
    if (request.items.length == 1) {
      final only = request.items.first;
      return createOrder(
        MobileCheckoutRequest(
          item: only,
          address: request.address,
          notes: request.notes,
          paymentMethod: request.paymentMethod,
          fulfillmentMethod: request.fulfillmentMethod,
          razorpayOrderId: request.razorpayOrderId,
        ),
      );
    }
    final payload = await _apiClient.postJson(
      '/api/orders',
      body: request.toJson(),
    );
    _expectOk(payload, 'Unable to place order.');
    return MobileCheckoutResult.fromJson(payload);
  }

  Future<void> updateStatus({
    required String orderId,
    required String status,
  }) async {
    final payload = await _apiClient.patchJson(
      '/api/orders/$orderId',
      body: {'status': status},
    );
    _expectOk(payload, 'Unable to update order status.');
  }

  Future<void> raiseDispute({
    required String orderId,
    required String reason,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/disputes',
      body: {'orderId': orderId, 'reason': reason},
    );
    _expectOk(payload, 'Unable to file dispute.');
  }

  Future<MobileRazorpayOrder> createRazorpayOrder({
    required int amountPaise,
    required String receipt,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/payment/create-order',
      body: {
        'amount': amountPaise,
        'receipt': receipt,
        'notes': {'source': 'serviq_mobile'},
      },
    );
    _expectOk(payload, 'Unable to start Razorpay payment.');
    return MobileRazorpayOrder.fromJson(payload);
  }

  Future<void> verifyRazorpayPayment({
    required String razorpayOrderId,
    required String razorpayPaymentId,
    required String razorpaySignature,
    required List<String> serviQOrderIds,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/payment/verify',
      body: {
        'razorpayOrderId': razorpayOrderId,
        'razorpayPaymentId': razorpayPaymentId,
        'razorpaySignature': razorpaySignature,
        'serviQOrderIds': serviQOrderIds,
      },
    );
    _expectOk(payload, 'Unable to verify Razorpay payment.');
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
