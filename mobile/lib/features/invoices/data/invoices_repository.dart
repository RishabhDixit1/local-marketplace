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
}
