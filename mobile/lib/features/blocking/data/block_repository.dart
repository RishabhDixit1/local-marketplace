import '../../../core/api/mobile_api_client.dart';

class BlockRepository {
  const BlockRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<bool> isBlocked(String targetUserId) async {
    final response = await _apiClient.getJson(
      '/api/block',
      queryParameters: {'userId': targetUserId},
    );
    return response['blocked'] == true;
  }

  Future<List<Map<String, dynamic>>> listBlocked() async {
    final response = await _apiClient.getJson('/api/block');
    return (response['blockedUsers'] as List<dynamic>?)
            ?.cast<Map<String, dynamic>>() ??
        [];
  }

  Future<void> blockUser(String targetUserId) async {
    await _apiClient.postJson('/api/block', body: {
      'blockedId': targetUserId,
    });
  }

  Future<void> unblockUser(String targetUserId) async {
    await _apiClient.deleteJson('/api/block', queryParameters: {
      'blockedId': targetUserId,
    });
  }
}
