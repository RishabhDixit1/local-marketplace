import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../domain/live_talk_models.dart';

final liveTalkRepositoryProvider = Provider<LiveTalkRepository>((ref) {
  final bootstrap = ref.watch(appBootstrapProvider);
  return LiveTalkRepository(
    supabase: bootstrap.client,
    apiClient: ref.watch(mobileApiClientProvider),
  );
});

final liveTalkRequestProvider = FutureProvider.family<LiveTalkRequest?, String>((ref, conversationId) {
  return ref.watch(liveTalkRepositoryProvider).fetchRequest(conversationId);
});

class LiveTalkRepository {
  LiveTalkRepository({
    required SupabaseClient? supabase,
    required MobileApiClient apiClient,
  })  : _supabase = supabase,
        _apiClient = apiClient;

  final SupabaseClient? _supabase;
  final MobileApiClient _apiClient;

  Future<LiveTalkRequest?> fetchRequest(String conversationId) async {
    if (_supabase == null) return null;
    final result = await _supabase
        .from('live_talk_requests')
        .select()
        .eq('conversation_id', conversationId)
        .not('status', 'in', '("ended","cancelled","declined")')
        .order('created_at', ascending: false)
        .limit(1);
    if (result.isNotEmpty) {
      return LiveTalkRequest.fromJson(result.first);
    }
    return null;
  }

  Future<LiveTalkRequest> createRequest(String conversationId, String recipientId) async {
    final payload = await _apiClient.postJson('/api/live-talk', body: {
      'conversationId': conversationId,
      'recipientId': recipientId,
    });
    _expectOk(payload, 'Failed to start call.');
    return LiveTalkRequest.fromJson(payload);
  }

  Future<void> updateRequestStatus(String requestId, String status) async {
    final payload = await _apiClient.patchJson('/api/live-talk', body: {
      'requestId': requestId,
      'status': status,
    });
    _expectOk(payload, 'Failed to update call status.');
  }

  void _expectOk(Map<String, dynamic> payload, String fallbackMessage) {
    if (payload['ok'] == true) return;
    throw ApiException(
      (payload['message'] as String?) ?? fallbackMessage,
      statusCode: payload['statusCode'] as int?,
    );
  }
}
