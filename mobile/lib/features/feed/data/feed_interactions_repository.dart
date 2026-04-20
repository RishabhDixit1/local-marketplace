import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';

final feedInteractionsRepositoryProvider = Provider<FeedInteractionsRepository>(
  (ref) {
    return FeedInteractionsRepository(ref.watch(mobileApiClientProvider));
  },
);

class FeedCardInteractionContext {
  const FeedCardInteractionContext({
    required this.cardId,
    required this.focusId,
    required this.cardType,
    required this.title,
    this.subtitle,
    this.actionPath,
    this.metadata,
  });

  final String cardId;
  final String focusId;
  final String cardType;
  final String title;
  final String? subtitle;
  final String? actionPath;
  final Map<String, Object?>? metadata;

  Map<String, Object?> toJson() {
    return {
      'card_id': cardId,
      'focus_id': focusId,
      'card_type': cardType,
      'title': title,
      'subtitle': subtitle,
      'action_path': actionPath,
      'metadata': metadata,
    };
  }
}

class FeedInteractionsRepository {
  const FeedInteractionsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<void> save(FeedCardInteractionContext card) async {
    await _apiClient.postJson(
      '/api/feed-card-interactions',
      body: {'action': 'save', 'card': card.toJson()},
    );
  }

  Future<void> removeSave(String cardId) async {
    await _apiClient.postJson(
      '/api/feed-card-interactions',
      body: {'action': 'remove_save', 'cardId': cardId},
    );
  }

  Future<void> share(
    FeedCardInteractionContext card, {
    required String channel,
  }) async {
    await _apiClient.postJson(
      '/api/feed-card-interactions',
      body: {'action': 'share', 'card': card.toJson(), 'channel': channel},
    );
  }

  Future<void> hide(FeedCardInteractionContext card, {String? reason}) async {
    await _apiClient.postJson(
      '/api/feed-card-interactions',
      body: {'action': 'hide', 'card': card.toJson(), 'reason': reason},
    );
  }

  Future<void> report(
    FeedCardInteractionContext card, {
    required String reason,
  }) async {
    await _apiClient.postJson(
      '/api/feed-card-interactions',
      body: {'action': 'report', 'card': card.toJson(), 'reason': reason},
    );
  }
}
