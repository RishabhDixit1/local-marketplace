import 'package:flutter_test/flutter_test.dart';
import 'package:mocktail/mocktail.dart';

import 'package:serviq_mobile/core/api/mobile_api_client.dart';
import 'package:serviq_mobile/core/cache/feed_cache.dart';
import 'package:serviq_mobile/features/feed/data/feed_repository.dart';
import 'package:serviq_mobile/features/feed/domain/feed_snapshot.dart';

class MockMobileApiClient extends Mock implements MobileApiClient {}

class MockFeedCache extends Mock implements FeedCache {}

void main() {
  late MockMobileApiClient mockApi;
  late MockFeedCache mockCache;
  late FeedRepository repository;

  setUpAll(() {
    registerFallbackValue(const MobileFeedSnapshot(
      currentUserId: '',
      stats: MobileFeedStats(
        total: 0,
        urgent: 0,
        demand: 0,
        service: 0,
        product: 0,
      ),
      items: [],
    ));
  });

  setUp(() {
    mockApi = MockMobileApiClient();
    mockCache = MockFeedCache();
    repository = FeedRepository(mockApi, mockCache);
  });

  const emptySnapshot = MobileFeedSnapshot(
    currentUserId: 'user-1',
    stats: MobileFeedStats(
      total: 0,
      urgent: 0,
      demand: 0,
      service: 0,
      product: 0,
    ),
    items: [],
  );

  group('FeedRepository', () {
    group('fetchFeed', () {
      test('fetches feed and caches on success', () async {
        when(() => mockApi.getJson('/api/community/feed',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'ok': true,
                  'currentUserId': 'user-1',
                  'stats': {
                    'total': 0,
                    'urgent': 0,
                    'demand': 0,
                    'service': 0,
                    'product': 0,
                  },
                  'feedItems': [],
                });
        when(() => mockCache.cacheFeed(any())).thenAnswer((_) async {});

        final result = await repository.fetchFeed(scope: MobileFeedScope.all);

        expect(result.currentUserId, 'user-1');
        verify(() => mockCache.cacheFeed(any())).called(1);
      });

      test('falls back to cache on API error', () async {
        when(() => mockApi.getJson('/api/community/feed',
                queryParameters: any(named: 'queryParameters')))
            .thenThrow(Exception('Network error'));
        when(() => mockCache.getCachedFeed())
            .thenAnswer((_) async => emptySnapshot);

        final result = await repository.fetchFeed(scope: MobileFeedScope.all);

        expect(result, equals(emptySnapshot));
        verifyNever(() => mockCache.cacheFeed(any()));
      });

      test('rethrows when no cache available', () async {
        when(() => mockApi.getJson('/api/community/feed',
                queryParameters: any(named: 'queryParameters')))
            .thenThrow(Exception('Network error'));
        when(() => mockCache.getCachedFeed()).thenAnswer((_) async => null);

        expect(
          () => repository.fetchFeed(scope: MobileFeedScope.all),
          throwsException,
        );
      });

      test('throws ApiException when ok is false and no cache', () async {
        when(() => mockApi.getJson('/api/community/feed',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'Service unavailable',
                });
        when(() => mockCache.getCachedFeed()).thenAnswer((_) async => null);

        expect(
          () => repository.fetchFeed(scope: MobileFeedScope.all),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Service unavailable',
            ),
          ),
        );
      });

      test('uses cache when API returns ok:false but cache exists', () async {
        when(() => mockApi.getJson('/api/community/feed',
                queryParameters: any(named: 'queryParameters')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'Service unavailable',
                });
        when(() => mockCache.getCachedFeed())
            .thenAnswer((_) async => emptySnapshot);

        final result = await repository.fetchFeed(scope: MobileFeedScope.all);

        expect(result, equals(emptySnapshot));
      });
    });

    group('expressInterest', () {
      test('succeeds on ok', () async {
        when(() => mockApi.postJson('/api/needs/express-interest',
                body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        await repository.expressInterest('need-1');

        verify(
          () => mockApi.postJson('/api/needs/express-interest', body: {
            'helpRequestId': 'need-1',
          }),
        ).called(1);
      });

      test('throws on failure', () async {
        when(() => mockApi.postJson('/api/needs/express-interest',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'Already expressed interest',
                });

        expect(
          () => repository.expressInterest('need-1'),
          throwsA(
            isA<ApiException>().having(
              (e) => e.message,
              'message',
              'Already expressed interest',
            ),
          ),
        );
      });
    });

    group('withdrawInterest', () {
      test('succeeds on ok', () async {
        when(() => mockApi.postJson('/api/needs/withdraw-interest',
                body: any(named: 'body')))
            .thenAnswer((_) async => {'ok': true});

        await repository.withdrawInterest('need-1');

        verify(
          () => mockApi.postJson('/api/needs/withdraw-interest', body: {
            'helpRequestId': 'need-1',
          }),
        ).called(1);
      });

      test('throws on failure', () async {
        when(() => mockApi.postJson('/api/needs/withdraw-interest',
                body: any(named: 'body')))
            .thenAnswer((_) async => {
                  'ok': false,
                  'message': 'No interest to withdraw',
                });

        expect(
          () => repository.withdrawInterest('need-1'),
          throwsA(isA<ApiException>()),
        );
      });
    });
  });
}
