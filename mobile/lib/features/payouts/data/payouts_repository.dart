import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/payout_models.dart';

final payoutsRepositoryProvider = Provider<PayoutsRepository>((ref) {
  return PayoutsRepository(ref.watch(mobileApiClientProvider));
});

final payoutsBundleProvider = FutureProvider<PayoutsBundle>((ref) {
  return ref.watch(payoutsRepositoryProvider).fetchPayouts();
});

final payoutAccountsProvider = FutureProvider<List<PayoutAccount>>((ref) {
  return ref.watch(payoutsRepositoryProvider).fetchAccounts();
});

class PayoutsRepository {
  const PayoutsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<PayoutsBundle> fetchPayouts() async {
    final payload = await _apiClient.getJson('/api/provider/payouts');
    _expectOk(payload, 'Unable to load payouts.');

    return PayoutsBundle.fromJson(payload);
  }

  Future<PayoutTransaction> requestPayout({
    required int amountPaise,
    required String payoutMethod,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/provider/payouts',
      body: {
        'amount_paise': amountPaise,
        'payout_method': payoutMethod,
      },
    );
    _expectOk(payload, 'Unable to request payout.');

    return PayoutTransaction.fromJson(
      Map<String, dynamic>.from(
        (payload['payout'] as Map?) ?? <String, dynamic>{},
      ),
    );
  }

  Future<List<PayoutAccount>> fetchAccounts() async {
    final payload = await _apiClient.getJson('/api/provider/bank-accounts');
    _expectOk(payload, 'Unable to load payout accounts.');

    final list = (payload['accounts'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(PayoutAccount.fromJson)
        .toList();
  }

  Future<PayoutAccount> addAccount(Map<String, dynamic> body) async {
    final payload = await _apiClient.postJson(
      '/api/provider/bank-accounts',
      body: body,
    );
    _expectOk(payload, 'Unable to add account.');

    return PayoutAccount.fromJson(
      Map<String, dynamic>.from(
        (payload['account'] as Map?) ?? <String, dynamic>{},
      ),
    );
  }

  Future<void> deleteAccount(String id) async {
    final payload = await _apiClient.deleteJson(
      '/api/provider/bank-accounts/$id',
    );
    _expectOk(payload, 'Unable to delete account.');
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
