import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';

final connectionsRepositoryProvider = Provider<ConnectionsRepository>((ref) {
  return ConnectionsRepository(ref.watch(mobileApiClientProvider));
});

class ConnectionsRepository {
  const ConnectionsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  /// Sends a connection request to [targetUserId] (public profile / provider user id).
  Future<void> sendConnectionRequest(String targetUserId) async {
    final trimmed = targetUserId.trim();
    if (trimmed.isEmpty) {
      throw ApiException('Missing provider.');
    }
    final payload = await _apiClient.postJson(
      '/api/connections',
      body: {'targetUserId': trimmed},
    );
    _expectOk(payload, 'Unable to send connection request.');
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
