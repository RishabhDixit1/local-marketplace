import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/admin_models.dart';

final adminRepositoryProvider = Provider<AdminRepository>((ref) {
  return AdminRepository(ref.watch(mobileApiClientProvider));
});

final adminStatsProvider = FutureProvider<AdminStats>((ref) {
  return ref.watch(adminRepositoryProvider).fetchStats();
});

final adminUsersProvider = FutureProvider<List<AdminUser>>((ref) {
  return ref.watch(adminRepositoryProvider).fetchUsers();
});

final adminReportsProvider = FutureProvider<List<AdminReport>>((ref) {
  return ref.watch(adminRepositoryProvider).fetchReports();
});

class AdminRepository {
  const AdminRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<AdminStats> fetchStats() async {
    final payload = await _apiClient.getJson('/api/admin/stats');
    return AdminStats.fromJson(payload);
  }

  Future<List<AdminUser>> fetchUsers({String? query, int limit = 50}) async {
    final params = <String, String>{'limit': limit.toString()};
    if (query != null && query.isNotEmpty) params['q'] = query;
    final payload = await _apiClient.getJson(
      '/api/admin/users',
      queryParameters: params,
    );
    final list = (payload['users'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(AdminUser.fromJson)
        .toList();
  }

  Future<List<AdminReport>> fetchReports({int limit = 50}) async {
    final payload = await _apiClient.getJson(
      '/api/admin/reports',
      queryParameters: {'limit': limit.toString()},
    );
    final list = (payload['reports'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(AdminReport.fromJson)
        .toList();
  }

  Future<void> dismissReport(String id) async {
    await _apiClient.patchJson('/api/admin/reports', body: {
      'id': id,
      'action': 'dismiss',
    });
  }
}
