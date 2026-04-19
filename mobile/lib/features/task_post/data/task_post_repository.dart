import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';

final taskPostRepositoryProvider = Provider<TaskPostRepository>((ref) {
  return TaskPostRepository(ref.watch(mobileApiClientProvider));
});

class PublishTaskResult {
  const PublishTaskResult({
    required this.postId,
    required this.helpRequestId,
    required this.matchedCount,
    required this.notifiedProviders,
  });

  final String? postId;
  final String? helpRequestId;
  final int matchedCount;
  final int notifiedProviders;
}

class TaskPostRepository {
  const TaskPostRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<PublishTaskResult> publishNeed({
    required String title,
    required String details,
    required String category,
    required String locationLabel,
    required double? budget,
    required bool urgent,
  }) async {
    final payload = await _apiClient.postJson(
      '/api/needs/publish',
      body: {
        'postType': 'need',
        'title': title.trim(),
        'details': details.trim(),
        'category': category.trim(),
        'budget': budget,
        'locationLabel': locationLabel.trim(),
        'radiusKm': 8,
        'mode': urgent ? 'urgent' : 'schedule',
        'neededWithin': urgent ? 'Today' : 'This week',
        'scheduleDate': '',
        'scheduleTime': '',
        'flexibleTiming': true,
        'media': const [],
        'latitude': null,
        'longitude': null,
      },
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to publish this task.',
      );
    }

    return PublishTaskResult(
      postId: _nullableString(payload['postId']),
      helpRequestId: _nullableString(payload['helpRequestId']),
      matchedCount: _toInt(payload['matchedCount']),
      notifiedProviders: _toInt(payload['notifiedProviders']),
    );
  }
}

String? _nullableString(Object? value) {
  final text = value is String ? value.trim() : '';
  return text.isEmpty ? null : text;
}

int _toInt(Object? value) {
  if (value is int) {
    return value;
  }
  if (value is num) {
    return value.toInt();
  }
  if (value is String) {
    return int.tryParse(value) ?? 0;
  }
  return 0;
}
