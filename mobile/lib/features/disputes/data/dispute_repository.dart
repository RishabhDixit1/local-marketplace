import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/dispute_models.dart';

final disputeRepositoryProvider = Provider<DisputeRepository>((ref) {
  return DisputeRepository(apiClient: ref.watch(mobileApiClientProvider));
});

class DisputeRepository {
  const DisputeRepository({required MobileApiClient apiClient}) : _apiClient = apiClient;

  final MobileApiClient _apiClient;

  Future<void> fileDispute(DisputeSubmission submission) async {
    final payload = await _apiClient.postJson(
      '/api/disputes',
      body: submission.toJson(),
    );
    _expectOk(payload, 'Unable to file dispute.');
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
