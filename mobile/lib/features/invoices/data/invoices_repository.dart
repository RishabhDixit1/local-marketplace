import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/invoice_models.dart';

final invoicesRepositoryProvider = Provider<InvoicesRepository>((ref) {
  return InvoicesRepository(ref.watch(mobileApiClientProvider));
});

final invoiceListProvider = FutureProvider<List<InvoiceRecord>>((ref) {
  return ref.watch(invoicesRepositoryProvider).fetchInvoices();
});

class InvoicesRepository {
  const InvoicesRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<InvoiceRecord>> fetchInvoices() async {
    final payload = await _apiClient.getJson('/api/invoices/list');

    final list = (payload['invoices'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(InvoiceRecord.fromJson)
        .toList();
  }

  Future<InvoiceDetail> fetchInvoice({String? invoiceId, String? orderId}) async {
    final params = <String, String>{};
    if (invoiceId != null) params['invoiceId'] = invoiceId;
    if (orderId != null) params['orderId'] = orderId;

    final payload = await _apiClient.getJson(
      '/api/invoices',
      queryParameters: params,
    );

    final invoice = payload['invoice'];
    if (invoice is! Map<String, dynamic>) {
      throw Exception('Invoice not found.');
    }
    return InvoiceDetail.fromJson(invoice);
  }

  Future<InvoiceGenerateResult> generateInvoice(String orderId) async {
    final payload = await _apiClient.postJson(
      '/api/invoices/generate',
      body: {'orderId': orderId},
    );
    return InvoiceGenerateResult(
      invoiceId: payload['invoiceId'] as String? ?? '',
      invoiceNumber: payload['invoiceNumber'] as String? ?? '',
    );
  }
}
