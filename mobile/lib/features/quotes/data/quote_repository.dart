import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/quote_models.dart';

final quoteRepositoryProvider = Provider<QuoteRepository>((ref) {
  return QuoteRepository(ref.watch(mobileApiClientProvider));
});

final quoteWorkspaceProvider =
    FutureProvider.family<MobileQuoteWorkspace, QuoteWorkspaceRequest>((
      ref,
      request,
    ) {
      return ref.watch(quoteRepositoryProvider).fetchWorkspace(request);
    });

class QuoteWorkspaceRequest {
  const QuoteWorkspaceRequest({required this.mode, required this.targetId});

  final MobileQuoteTargetMode mode;
  final String targetId;

  @override
  bool operator ==(Object other) {
    return other is QuoteWorkspaceRequest &&
        other.mode == mode &&
        other.targetId == targetId;
  }

  @override
  int get hashCode => Object.hash(mode, targetId);
}

class QuoteRepository {
  const QuoteRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<MobileQuoteWorkspace> fetchWorkspace(
    QuoteWorkspaceRequest request,
  ) async {
    final payload = await _apiClient.getJson(
      '/api/quotes/draft',
      queryParameters: {
        if (request.mode == MobileQuoteTargetMode.order)
          'orderId': request.targetId,
        if (request.mode == MobileQuoteTargetMode.helpRequest)
          'helpRequestId': request.targetId,
      },
    );
    _expectOk(payload, 'Unable to load quote workspace.');
    return MobileQuoteWorkspace.fromJson(payload);
  }

  Future<MobileQuoteWorkspace> saveDraft(MobileQuoteDraftInput input) async {
    final payload = await _apiClient.postJson(
      '/api/quotes/draft',
      body: input.toJson(),
    );
    _expectOk(payload, 'Unable to save quote draft.');
    return MobileQuoteWorkspace.fromJson(payload);
  }

  Future<MobileQuoteWorkspace> sendQuote(MobileQuoteDraftInput input) async {
    final payload = await _apiClient.postJson(
      '/api/quotes/send',
      body: input.toJson(),
    );
    _expectOk(payload, 'Unable to send quote.');
    return MobileQuoteWorkspace.fromJson(payload);
  }

  Future<void> acceptQuote(String quoteId) async {
    final payload = await _apiClient.postJson('/api/quotes/$quoteId/accept');
    _expectOk(payload, 'Unable to accept quote.');
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
