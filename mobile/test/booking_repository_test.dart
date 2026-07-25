import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:serviq_mobile/core/api/mobile_api_client.dart';
import 'package:serviq_mobile/features/bookings/data/booking_repository.dart';

class MockMobileApiClient extends Mock implements MobileApiClient {}

void main() {
  late MockMobileApiClient mockApi;
  late BookingRepository repository;

  setUp(() {
    mockApi = MockMobileApiClient();
    repository = BookingRepository(mockApi);
  });

  group('BookingRepository', () {
    group('fetch', () {
      test('parses bookings from payload', () async {
        when(() => mockApi.getJson('/api/provider/bookings',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'bookings': [
                    {
                      'id': 'booking-1',
                      'status': 'confirmed',
                      'created_at': '2026-07-20T10:00:00Z',
                    },
                    {
                      'id': 'booking-2',
                      'status': 'pending',
                      'created_at': '2026-07-21T10:00:00Z',
                    },
                  ],
                });

        final bookings = await repository.fetch();

        expect(bookings.length, 2);
        expect(bookings[0].id, 'booking-1');
        expect(bookings[1].id, 'booking-2');
      });

      test('returns empty list when bookings is null', () async {
        when(() => mockApi.getJson('/api/provider/bookings',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {'ok': true});

        final bookings = await repository.fetch();

        expect(bookings, isEmpty);
      });

      test('passes limit and offset query parameters', () async {
        when(() => mockApi.getJson('/api/provider/bookings',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {'ok': true, 'bookings': []});

        await repository.fetch(limit: 10, offset: 20);

        verify(
          () => mockApi.getJson('/api/provider/bookings', queryParameters: {
            'limit': '10',
            'offset': '20',
          }),
        ).called(1);
      });

      test('throws ApiException when ok is false', () async {
        when(() => mockApi.getJson('/api/provider/bookings',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'Provider not found',
                });

        expect(
          () => repository.fetch(),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Provider not found',
            ),
          ),
        );
      });

      test('throws with default message when no message in payload', () async {
        when(() => mockApi.getJson('/api/provider/bookings',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {'ok': false});

        expect(
          () => repository.fetch(),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Unable to load bookings.',
            ),
          ),
        );
      });
    });
  });
}
