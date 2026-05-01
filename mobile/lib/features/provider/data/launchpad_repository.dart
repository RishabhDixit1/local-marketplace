import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/launchpad_models.dart';

final launchpadRepositoryProvider = Provider<LaunchpadRepository>((ref) {
  return LaunchpadRepository(ref.watch(mobileApiClientProvider));
});

final launchpadWorkspaceProvider = FutureProvider<MobileLaunchpadWorkspace>((
  ref,
) {
  return ref.watch(launchpadRepositoryProvider).fetchWorkspace();
});

class LaunchpadRepository {
  const LaunchpadRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<MobileLaunchpadWorkspace> fetchWorkspace() async {
    final payload = await _apiClient.getJson('/api/launchpad/draft');
    _expectOk(payload, 'Unable to load provider launchpad.');
    return MobileLaunchpadWorkspace.fromJson(payload);
  }

  Future<MobileLaunchpadDraft> saveDraft(MobileLaunchpadAnswers answers) async {
    final payload = await _apiClient.postJson(
      '/api/launchpad/draft',
      body: {'answers': answers.toJson(), 'inputSource': 'manual'},
    );
    _expectOk(payload, 'Unable to save launchpad draft.');

    return MobileLaunchpadDraft.fromJson(
      Map<String, dynamic>.from(
        (payload['draft'] as Map?) ?? const <String, dynamic>{},
      ),
    );
  }

  Future<MobileLaunchpadPublishResult> publish({String? draftId}) async {
    final payload = await _apiClient.postJson(
      '/api/launchpad/publish',
      body: {if ((draftId ?? '').trim().isNotEmpty) 'draftId': draftId!.trim()},
    );
    _expectOk(payload, 'Unable to publish provider profile.');
    return MobileLaunchpadPublishResult.fromJson(payload);
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
