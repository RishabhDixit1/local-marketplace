import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/availability_models.dart';

final availabilityRepositoryProvider = Provider<AvailabilityRepository>((ref) {
  return AvailabilityRepository(ref.watch(mobileApiClientProvider));
});

final availabilitySlotsProvider = FutureProvider<List<AvailabilitySlot>>((ref) {
  return ref.watch(availabilityRepositoryProvider).fetch();
});

final availabilityExceptionsProvider = FutureProvider<List<AvailabilityException>>((ref) {
  return ref.watch(availabilityRepositoryProvider).fetchExceptions();
});

class AvailabilityRepository {
  const AvailabilityRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<AvailabilitySlot>> fetch() async {
    final payload = await _apiClient.getJson('/api/provider/availability');

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to load availability.',
      );
    }

    final slots = (payload['slots'] as List?) ?? [];
    return slots
        .whereType<Map<String, dynamic>>()
        .map(AvailabilitySlot.fromJson)
        .toList();
  }

  Future<List<AvailabilitySlot>> update(
    List<AvailabilitySlot> slots, {
    String timezone = 'Asia/Kolkata',
  }) async {
    final body = {
      'slots': slots.map((s) => s.toPayload()).toList(),
      'timezone': timezone,
    };

    final payload = await _apiClient.postJson(
      '/api/provider/availability',
      body: body,
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to save availability.',
      );
    }

    final updatedSlots = (payload['slots'] as List?) ?? [];
    return updatedSlots
        .whereType<Map<String, dynamic>>()
        .map(AvailabilitySlot.fromJson)
        .toList();
  }

  Future<List<AvailabilityException>> fetchExceptions() async {
    final payload = await _apiClient.getJson('/api/provider/availability/exceptions');

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to load exceptions.',
      );
    }

    final items = (payload['exceptions'] as List?) ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(AvailabilityException.fromJson)
        .toList();
  }

  Future<List<AvailabilityException>> addException(AvailabilityException exception) async {
    final payload = await _apiClient.postJson(
      '/api/provider/availability/exceptions',
      body: exception.toPayload(),
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to add exception.',
      );
    }

    final items = (payload['exceptions'] as List?) ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(AvailabilityException.fromJson)
        .toList();
  }

  Future<void> removeException(String date) async {
    final payload = await _apiClient.deleteJson(
      '/api/provider/availability/exceptions',
      queryParameters: {'date': date},
    );

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to remove exception.',
      );
    }
  }
}
