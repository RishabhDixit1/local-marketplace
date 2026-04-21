import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';

final createNeedRepositoryProvider = Provider<CreateNeedRepository>((ref) {
  return CreateNeedRepository(ref.watch(mobileApiClientProvider));
});

enum CreateNeedMode {
  urgent,
  schedule;

  String get apiValue => this == CreateNeedMode.urgent ? 'urgent' : 'schedule';
}

class CreateNeedDraft {
  const CreateNeedDraft({
    required this.title,
    required this.details,
    required this.category,
    required this.budget,
    required this.locationLabel,
    required this.radiusKm,
    required this.mode,
    required this.neededWithin,
    this.media = const <CreateNeedUploadedMedia>[],
  });

  final String title;
  final String details;
  final String category;
  final double? budget;
  final String locationLabel;
  final double radiusKm;
  final CreateNeedMode mode;
  final String neededWithin;
  final List<CreateNeedUploadedMedia> media;

  Map<String, dynamic> toJson() {
    return {
      'postType': 'need',
      'title': title.trim(),
      'details': details.trim(),
      'category': category.trim(),
      'budget': budget,
      'locationLabel': locationLabel.trim(),
      'radiusKm': radiusKm,
      'mode': mode.apiValue,
      'neededWithin': neededWithin.trim(),
      'scheduleDate': '',
      'scheduleTime': '',
      'flexibleTiming': true,
      'media': media.map((item) => item.toJson()).toList(),
      'latitude': null,
      'longitude': null,
    };
  }
}

class CreateNeedUploadedMedia {
  const CreateNeedUploadedMedia({
    required this.name,
    required this.url,
    required this.type,
  });

  factory CreateNeedUploadedMedia.fromJson(Map<String, dynamic> json) {
    return CreateNeedUploadedMedia(
      name: _readString(json['name']),
      url: _readString(json['url']),
      type: _readString(json['type']),
    );
  }

  final String name;
  final String url;
  final String type;

  bool get isImage => type.startsWith('image/');
  bool get isVideo => type.startsWith('video/');

  Map<String, dynamic> toJson() {
    return {'name': name, 'url': url, 'type': type};
  }
}

class CreateNeedResult {
  const CreateNeedResult({
    required this.helpRequestId,
    required this.matchedCount,
    required this.notifiedProviders,
    required this.firstNotificationLatencyMs,
  });

  factory CreateNeedResult.fromJson(Map<String, dynamic> json) {
    return CreateNeedResult(
      helpRequestId: _readString(json['helpRequestId']),
      matchedCount: _readInt(json['matchedCount']),
      notifiedProviders: _readInt(json['notifiedProviders']),
      firstNotificationLatencyMs: _readInt(json['firstNotificationLatencyMs']),
    );
  }

  final String helpRequestId;
  final int matchedCount;
  final int notifiedProviders;
  final int firstNotificationLatencyMs;
}

class CreateNeedRepository {
  const CreateNeedRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<CreateNeedUploadedMedia> uploadMedia({
    required String filePath,
    required String fileName,
    required String mediaType,
  }) async {
    final payload = await _apiClient.uploadFile(
      '/api/upload/post-media',
      filePath: filePath,
      fileName: fileName,
      mediaType: mediaType,
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to upload this media.',
      );
    }

    final media = Map<String, dynamic>.from(
      (payload['media'] as Map?) ?? const <String, dynamic>{},
    );
    return CreateNeedUploadedMedia.fromJson(media);
  }

  Future<CreateNeedResult> publishNeed(CreateNeedDraft draft) async {
    final payload = await _apiClient.postJson(
      '/api/needs/publish',
      body: draft.toJson(),
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to publish this request.',
      );
    }

    return CreateNeedResult.fromJson(payload);
  }
}

String _readString(Object? value) {
  final text = value is String ? value.trim() : '';
  return text;
}

int _readInt(Object? value) {
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
