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

final adminListingsProvider = FutureProvider<List<AdminListing>>((ref) {
  return ref.watch(adminRepositoryProvider).fetchListings();
});

final adminOrdersProvider = FutureProvider<List<AdminOrder>>((ref) {
  return ref.watch(adminRepositoryProvider).fetchOrders();
});

final adminDisputesProvider = FutureProvider<List<AdminDispute>>((ref) {
  return ref.watch(adminRepositoryProvider).fetchDisputes();
});

final adminVerificationsProvider = FutureProvider<List<AdminVerification>>((
  ref,
) {
  return ref.watch(adminRepositoryProvider).fetchVerifications();
});

class AdminRepository {
  const AdminRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<AdminStats> fetchStats() async {
    final payload = await _apiClient.getJson('/api/admin/stats');
    return AdminStats.fromJson(payload);
  }

  Future<List<AdminUser>> fetchUsers({String? query, int limit = 50, int offset = 0}) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
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

  Future<List<AdminReport>> fetchReports({int limit = 50, int offset = 0}) async {
    final payload = await _apiClient.getJson(
      '/api/admin/reports',
      queryParameters: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
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

  Future<List<AdminListing>> fetchListings({
    String? status,
    int limit = 50,
    int offset = 0,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (status != null && status.isNotEmpty) params['status'] = status;
    final payload = await _apiClient.getJson(
      '/api/admin/listings',
      queryParameters: params,
    );
    final list = (payload['listings'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(AdminListing.fromJson)
        .toList();
  }

  Future<void> flagListing(String id) async {
    await _apiClient.patchJson('/api/admin/listings', body: {
      'id': id,
      'action': 'flag',
    });
  }

  Future<void> unflagListing(String id) async {
    await _apiClient.patchJson('/api/admin/listings', body: {
      'id': id,
      'action': 'unflag',
    });
  }

  Future<void> removeListing(String id) async {
    await _apiClient.patchJson('/api/admin/listings', body: {
      'id': id,
      'action': 'remove',
    });
  }

  Future<void> restoreListing(String id) async {
    await _apiClient.patchJson('/api/admin/listings', body: {
      'id': id,
      'action': 'restore',
    });
  }

  Future<List<AdminOrder>> fetchOrders({
    String? status,
    int limit = 50,
    int offset = 0,
  }) async {
    final params = <String, String>{
      'limit': limit.toString(),
      'offset': offset.toString(),
    };
    if (status != null && status.isNotEmpty) params['status'] = status;
    final payload = await _apiClient.getJson(
      '/api/admin/orders',
      queryParameters: params,
    );
    final list = (payload['orders'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(AdminOrder.fromJson)
        .toList();
  }

  Future<void> refundOrder(String orderId) async {
    await _apiClient.patchJson('/api/admin/orders', body: {
      'id': orderId,
      'action': 'refund',
    });
  }

  Future<void> overrideOrderStatus(String orderId, String newStatus) async {
    await _apiClient.patchJson('/api/admin/orders', body: {
      'id': orderId,
      'action': 'status_override',
      'status': newStatus,
    });
  }

  Future<List<AdminDispute>> fetchDisputes({
    int limit = 50,
    int offset = 0,
  }) async {
    final payload = await _apiClient.getJson(
      '/api/admin/disputes',
      queryParameters: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );
    final list = (payload['disputes'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(AdminDispute.fromJson)
        .toList();
  }

  Future<void> dismissDispute(String id) async {
    await _apiClient.patchJson('/api/admin/disputes', body: {
      'id': id,
      'action': 'dismiss',
    });
  }

  Future<void> resolveDispute(String id, String resolution) async {
    await _apiClient.patchJson('/api/admin/disputes', body: {
      'id': id,
      'action': 'resolve',
      'resolution': resolution,
    });
  }

  Future<List<AdminVerification>> fetchVerifications({
    int limit = 50,
    int offset = 0,
  }) async {
    final payload = await _apiClient.getJson(
      '/api/admin/verifications',
      queryParameters: {
        'limit': limit.toString(),
        'offset': offset.toString(),
      },
    );
    final list = (payload['verifications'] as List?) ?? [];
    return list
        .whereType<Map<String, dynamic>>()
        .map(AdminVerification.fromJson)
        .toList();
  }

  Future<void> approveVerification(String id) async {
    await _apiClient.patchJson('/api/admin/verifications', body: {
      'id': id,
      'action': 'approve',
    });
  }

  Future<void> rejectVerification(String id, {String? reason}) async {
    await _apiClient.patchJson('/api/admin/verifications', body: {
      'id': id,
      'action': 'reject',
      'reason': ?reason,
    });
  }
}
