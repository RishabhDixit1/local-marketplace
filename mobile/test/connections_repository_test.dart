import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:serviq_mobile/core/api/mobile_api_client.dart';
import 'package:serviq_mobile/features/connections/data/connections_repository.dart';

class MockMobileApiClient extends Mock implements MobileApiClient {}

void main() {
  late MockMobileApiClient mockApi;
  late ConnectionsRepository repository;

  setUp(() {
    mockApi = MockMobileApiClient();
    repository = ConnectionsRepository(mockApi);
  });

  group('ConnectionsRepository', () {
    group('fetchConnections', () {
      test('parses connection rows from payload', () async {
        when(() => mockApi.getJson('/api/connections',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'rows': [
                    {
                      'id': 'conn-1',
                      'requester_id': 'user-1',
                      'target_id': 'user-2',
                      'status': 'accepted',
                      'created_at': '2026-07-20T10:00:00Z',
                    },
                    {
                      'id': 'conn-2',
                      'requester_id': 'user-3',
                      'target_id': 'user-1',
                      'status': 'pending',
                      'created_at': '2026-07-21T10:00:00Z',
                    },
                  ],
                });

        final rows = await repository.fetchConnections();

        expect(rows.length, 2);
        expect(rows[0].id, 'conn-1');
        expect(rows[1].id, 'conn-2');
      });

      test('returns empty list when rows is null', () async {
        when(() => mockApi.getJson('/api/connections',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {});

        final rows = await repository.fetchConnections();

        expect(rows, isEmpty);
      });

      test('passes limit and offset query parameters', () async {
        when(() => mockApi.getJson('/api/connections',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {'rows': []});

        await repository.fetchConnections(limit: 25, offset: 50);

        verify(
          () => mockApi.getJson('/api/connections', queryParameters: {
            'limit': '25',
            'offset': '50',
          }),
        ).called(1);
      });
    });

    group('sendConnectionRequest', () {
      test('sends request with trimmed targetUserId', () async {
        when(() => mockApi.postJson('/api/connections',
                body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        await repository.sendConnectionRequest('  user-2  ');

        verify(
          () => mockApi.postJson('/api/connections', body: {
            'targetUserId': 'user-2',
          }),
        ).called(1);
      });

      test('throws immediately for empty targetUserId', () async {
        expect(
          () => repository.sendConnectionRequest(''),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Missing provider.',
            ),
          ),
        );

        verifyNever(() => mockApi.postJson(any(), body: any(named: 'body')));
      });

      test('throws for whitespace-only targetUserId', () async {
        expect(
          () => repository.sendConnectionRequest('   '),
          throwsA(isA<ApiException>()),
        );
      });

      test('throws on API failure', () async {
        when(() => mockApi.postJson('/api/connections',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'Already connected',
                });

        expect(
          () => repository.sendConnectionRequest('user-2'),
          throwsA(isA<ApiException>()),
        );
      });
    });

    group('respondToConnection', () {
      test('sends PATCH with decision', () async {
        when(() => mockApi.patchJson('/api/connections/conn-1',
                body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        await repository.respondToConnection(
          requestId: 'conn-1',
          decision: 'accept',
        );

        verify(
          () => mockApi.patchJson('/api/connections/conn-1', body: {
            'decision': 'accept',
          }),
        ).called(1);
      });

      test('throws on failure', () async {
        when(() => mockApi.patchJson('/api/connections/conn-1',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'Connection not found',
                  'statusCode': 404,
                });

        expect(
          () => repository.respondToConnection(
            requestId: 'conn-1',
            decision: 'reject',
          ),
          throwsA(
            isA<ApiException>().having(
              (e) => e.statusCode,
              'statusCode',
              404,
            ),
          ),
        );
      });
    });
  });
}
