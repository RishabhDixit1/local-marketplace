import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/connection_models.dart';

final connectionsRepositoryProvider = Provider<ConnectionsRepository>((ref) {
  return ConnectionsRepository(ref.watch(mobileApiClientProvider));
});

final connectionsListProvider = FutureProvider<List<ConnectionRequestRow>>((ref) {
  return ref.watch(connectionsRepositoryProvider).fetchConnections();
});

class ConnectionsRepository {
  const ConnectionsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<ConnectionRequestRow>> fetchConnections() async {
    final payload = await _apiClient.getJson('/api/connections');
    final rows = (payload['rows'] as List?) ?? [];
    return rows
        .whereType<Map<String, dynamic>>()
        .map(ConnectionRequestRow.fromJson)
        .toList();
  }

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

  Future<void> respondToConnection({
    required String requestId,
    required String decision,
  }) async {
    final payload = await _apiClient.patchJson(
      '/api/connections/$requestId',
      body: {'decision': decision},
    );
    _expectOk(payload, 'Unable to update connection request.');
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
