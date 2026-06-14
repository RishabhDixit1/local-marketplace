import 'package:flutter_test/flutter_test.dart';
import 'package:shared_preferences/shared_preferences.dart';

import 'package:serviq_mobile/core/network/offline_queue.dart';

void main() {
  group('OfflineOperation', () {
    test('toJson and fromJson round-trip', () {
      final op = OfflineOperation(
        type: OfflineOperationType.sendMessage,
        payload: {'conversationId': 'c-1', 'text': 'hello'},
        createdAt: DateTime(2026, 6, 1, 12, 0, 0),
      );
      final json = op.toJson();
      final restored = OfflineOperation.fromJson(json);
      expect(restored.type, OfflineOperationType.sendMessage);
      expect(restored.payload, {'conversationId': 'c-1', 'text': 'hello'});
      expect(restored.createdAt, DateTime(2026, 6, 1, 12, 0, 0));
    });

    test('defaults createdAt to now', () {
      final before = DateTime.now();
      final op = OfflineOperation(
        type: OfflineOperationType.createNeed,
        payload: {'title': 'test'},
      );
      final after = DateTime.now();
      expect(op.createdAt.isAfter(before) || op.createdAt == before, isTrue);
      expect(op.createdAt.isBefore(after) || op.createdAt == after, isTrue);
    });

    test('fromJson falls back to sendMessage for unknown type', () {
      final json = {
        'type': 'unknown_type',
        'payload': <String, dynamic>{},
        'createdAt': '2026-06-01T12:00:00.000',
      };
      final op = OfflineOperation.fromJson(json);
      expect(op.type, OfflineOperationType.sendMessage);
    });
  });

  group('OfflineQueue', () {
    test('enqueue adds operation to back', () async {
      SharedPreferences.setMockInitialValues({});
      final queue = OfflineQueue();
      await queue.enqueue(
        OfflineOperation(type: OfflineOperationType.sendMessage, payload: {}),
      );
      await queue.enqueue(
        OfflineOperation(type: OfflineOperationType.createNeed, payload: {}),
      );
      expect(queue.hasPending, isTrue);
      final all = queue.dequeueAll();
      expect(all.length, 2);
      expect(all[0].type, OfflineOperationType.sendMessage);
      expect(all[1].type, OfflineOperationType.createNeed);
    });

    test('enqueueFront inserts at front', () async {
      SharedPreferences.setMockInitialValues({});
      final queue = OfflineQueue();
      await queue.enqueue(
        OfflineOperation(type: OfflineOperationType.sendMessage, payload: {}),
      );
      await queue.enqueueFront(
        OfflineOperation(type: OfflineOperationType.createNeed, payload: {}),
      );
      final all = queue.dequeueAll();
      expect(all.length, 2);
      expect(all[0].type, OfflineOperationType.createNeed);
      expect(all[1].type, OfflineOperationType.sendMessage);
    });

    test('dequeueAll clears queue and returns all items', () async {
      SharedPreferences.setMockInitialValues({});
      final queue = OfflineQueue();
      await queue.enqueue(
        OfflineOperation(type: OfflineOperationType.submitReview, payload: {}),
      );
      final items = queue.dequeueAll();
      expect(items.length, 1);
      expect(queue.hasPending, isFalse);
    });

    test('hasPending is false for empty queue', () async {
      SharedPreferences.setMockInitialValues({});
      final queue = OfflineQueue();
      expect(queue.hasPending, isFalse);
    });

    test('persists and loads from SharedPreferences', () async {
      SharedPreferences.setMockInitialValues({});
      final queue = OfflineQueue();
      await queue.enqueue(
        OfflineOperation(
          type: OfflineOperationType.updateOrderStatus,
          payload: {'orderId': 'o-1', 'status': 'completed'},
        ),
      );

      final queue2 = OfflineQueue();
      await queue2.load();
      expect(queue2.hasPending, isTrue);
      final items = queue2.dequeueAll();
      expect(items.length, 1);
      expect(items[0].type, OfflineOperationType.updateOrderStatus);
      expect(items[0].payload['orderId'], 'o-1');
    });
  });
}
