import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/payment_models.dart';

final paymentRepositoryProvider = Provider<PaymentRepository>((ref) {
  return PaymentRepository(ref.watch(mobileApiClientProvider));
});

final transactionHistoryProvider = FutureProvider<List<TransactionRecord>>((ref) {
  return ref.watch(paymentRepositoryProvider).fetchTransactions();
});

class PaymentRepository {
  const PaymentRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<TransactionRecord>> fetchTransactions({int limit = 50}) async {
    final payload = await _apiClient.getJson(
      '/api/consumer/transactions',
      queryParameters: {'limit': limit.toString()},
    );

    final items = (payload['transactions'] as List?) ?? [];
    return items
        .whereType<Map>()
        .map((row) => TransactionRecord.fromOrderJson(Map<String, dynamic>.from(row)))
        .toList();
  }

  Future<void> savePaymentPreference(String method) async {
    await _apiClient.postJson(
      '/api/profile/payment-preference',
      body: {'payment_method': method},
    );
  }
}
