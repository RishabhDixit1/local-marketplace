import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../domain/booking_model.dart';

final bookingRepositoryProvider = Provider<BookingRepository>((ref) {
  return BookingRepository(ref.watch(mobileApiClientProvider));
});

final bookingsProvider = FutureProvider<List<Booking>>((ref) {
  return ref.watch(bookingRepositoryProvider).fetch();
});

class BookingRepository {
  const BookingRepository(this._apiClient);

  final MobileApiClient _apiClient;

  Future<List<Booking>> fetch() async {
    final payload = await _apiClient.getJson('/api/provider/bookings');

    if (payload['ok'] != true) {
      throw ApiException(
        (payload['message'] as String?) ?? 'Unable to load bookings.',
      );
    }

    final items = (payload['bookings'] as List?) ?? [];
    return items
        .whereType<Map<String, dynamic>>()
        .map(Booking.fromJson)
        .toList();
  }
}
