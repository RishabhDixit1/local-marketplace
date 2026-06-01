import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/analytics_models.dart';

final analyticsRepositoryProvider = Provider<AnalyticsRepository>((ref) {
  return AnalyticsRepository(ref.watch(mobileApiClientProvider));
});

final analyticsProvider = FutureProvider.family<AnalyticsData, int>((ref, year) {
  return ref.watch(analyticsRepositoryProvider).fetch(year);
});

class AnalyticsRepository {
  const AnalyticsRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<AnalyticsData> fetch(int year) async {
    final payload = await _apiClient.getJson(
      '/api/provider/analytics',
      queryParameters: {'year': year.toString()},
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to load analytics.',
        statusCode: payload['statusCode'] as int?,
      );
    }

    return AnalyticsData.fromJson(payload);
  }
}
