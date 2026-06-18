import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/ai_prompt_models.dart';

final aiPromptRepositoryProvider = Provider<AiPromptRepository>((ref) {
  return AiPromptRepository(ref.watch(mobileApiClientProvider));
});

class AiPromptRepository {
  const AiPromptRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<AiPromptResponse> sendQuery({
    required String query,
    Map<String, dynamic>? context,
  }) async {
    final json = await _apiClient.sendPrompt(
      query: query,
      context: context,
    );
    return AiPromptResponse.fromJson(json);
  }
}
