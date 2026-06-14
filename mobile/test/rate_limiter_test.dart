import 'package:flutter_test/flutter_test.dart';

import 'package:serviq_mobile/core/network/rate_limiter.dart';

void main() {
  group('RateLimiter', () {
    test('allows requests up to maxRequests', () {
      final limiter = RateLimiter(maxRequests: 3, windowMs: 10000);
      expect(limiter.tryConsume('test'), isTrue);
      expect(limiter.tryConsume('test'), isTrue);
      expect(limiter.tryConsume('test'), isTrue);
      expect(limiter.tryConsume('test'), isFalse);
    });

    test('tracks different operations independently', () {
      final limiter = RateLimiter(maxRequests: 2, windowMs: 10000);
      expect(limiter.tryConsume('op-a'), isTrue);
      expect(limiter.tryConsume('op-a'), isTrue);
      expect(limiter.tryConsume('op-a'), isFalse);
      expect(limiter.tryConsume('op-b'), isTrue);
      expect(limiter.tryConsume('op-b'), isTrue);
      expect(limiter.tryConsume('op-b'), isFalse);
    });

    test('consume throws RateLimitExceeded when limit reached', () {
      final limiter = RateLimiter(maxRequests: 1, windowMs: 10000);
      limiter.consume('test');
      expect(
        () => limiter.consume('test'),
        throwsA(isA<RateLimitExceeded>()),
      );
    });

    test('RateLimitExceeded includes retryAfterMs', () {
      final limiter = RateLimiter(maxRequests: 1, windowMs: 1000);
      limiter.consume('test');
      try {
        limiter.consume('test');
        fail('Expected RateLimitExceeded');
      } on RateLimitExceeded catch (e) {
        expect(e.operation, 'test');
        expect(e.retryAfterMs, greaterThanOrEqualTo(0));
        expect(e.retryAfterMs, lessThanOrEqualTo(1000));
        expect(e.toString(), contains('test'));
        expect(e.toString(), contains('Retry in'));
      }
    });

    test('reset clears state for one operation', () {
      final limiter = RateLimiter(maxRequests: 1, windowMs: 10000);
      limiter.consume('test');
      expect(limiter.tryConsume('test'), isFalse);
      limiter.reset('test');
      expect(limiter.tryConsume('test'), isTrue);
    });

    test('resetAll clears all operations', () {
      final limiter = RateLimiter(maxRequests: 1, windowMs: 10000);
      limiter.consume('a');
      limiter.consume('b');
      limiter.resetAll();
      expect(limiter.tryConsume('a'), isTrue);
      expect(limiter.tryConsume('b'), isTrue);
    });

    test('prunes expired timestamps within window', () async {
      final limiter = RateLimiter(maxRequests: 1, windowMs: 50);
      expect(limiter.tryConsume('test'), isTrue);
      expect(limiter.tryConsume('test'), isFalse);
      await Future.delayed(const Duration(milliseconds: 60));
      expect(limiter.tryConsume('test'), isTrue);
    });
  });
}
