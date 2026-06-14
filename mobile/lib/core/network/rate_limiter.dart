import 'dart:collection';

class RateLimitExceeded implements Exception {
  RateLimitExceeded(this.operation, {this.retryAfterMs});
  final String operation;
  final int? retryAfterMs;
  @override
  String toString() =>
      'Rate limit exceeded for $operation'
      '${retryAfterMs != null ? ". Retry in ${retryAfterMs}ms" : ""}';
}

class RateLimiter {
  RateLimiter({
    this.maxRequests = 30,
    this.windowMs = 1000,
  });

  final int maxRequests;
  final int windowMs;

  final _buckets = <String, Queue<int>>{};

  bool _prune(String key) {
    final queue = _buckets[key];
    if (queue == null) return true;
    final cutoff = DateTime.now().millisecondsSinceEpoch - windowMs;
    while (queue.isNotEmpty && queue.first < cutoff) {
      queue.removeFirst();
    }
    return queue.isEmpty;
  }

  bool tryConsume(String operation) {
    _prune(operation);
    final queue = _buckets.putIfAbsent(operation, () => Queue<int>());
    if (queue.length >= maxRequests) {
      return false;
    }
    queue.add(DateTime.now().millisecondsSinceEpoch);
    return true;
  }

  void consume(String operation) {
    if (!tryConsume(operation)) {
      final queue = _buckets[operation]!;
      final oldest = queue.isEmpty ? 0 : queue.first;
      final retryAfter = windowMs -
          (DateTime.now().millisecondsSinceEpoch - oldest);
      throw RateLimitExceeded(operation, retryAfterMs: retryAfter.clamp(0, windowMs));
    }
  }

  void reset(String operation) {
    _buckets.remove(operation);
  }

  void resetAll() {
    _buckets.clear();
  }
}
