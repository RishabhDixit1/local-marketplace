import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/verification_models.dart';

final verificationRepositoryProvider = Provider<VerificationRepository>((ref) {
  return VerificationRepository(ref.watch(mobileApiClientProvider));
});

final verificationBundleProvider = FutureProvider<VerificationBundle>((ref) {
  return ref.watch(verificationRepositoryProvider).fetchBundle();
});

class VerificationRepository {
  const VerificationRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<VerificationBundle> fetchBundle() async {
    final [statusPayload, docPayload] = await Future.wait([
      _apiClient.getJson('/api/verification/status'),
      _apiClient.getJson('/api/verification/documents'),
    ]);

    _expectOk(statusPayload, 'Unable to load verification status.');
    _expectOk(docPayload, 'Unable to load documents.');

    final docList = (docPayload['documents'] as List?) ?? [];
    return VerificationBundle.fromJson(statusPayload, docList);
  }

  Future<Map<String, dynamic>> uploadDocument({
    required String filePath,
    required String fileName,
    required String mediaType,
    required String documentType,
  }) async {
    final payload = await _apiClient.uploadFile(
      '/api/verification/documents',
      filePath: filePath,
      fileName: fileName,
      mediaType: mediaType,
      fields: {'document_type': documentType},
    );
    _expectOk(payload, 'Unable to upload document.');

    return payload;
  }

  Future<String> submitForReview() async {
    final payload = await _apiClient.postJson('/api/verification/submit');
    _expectOk(payload, 'Unable to submit for review.');

    return (payload['message'] as String?) ?? 'Submitted for review.';
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
