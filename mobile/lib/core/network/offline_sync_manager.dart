import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../api/mobile_api_provider.dart';
import 'connectivity_service.dart';
import 'offline_queue.dart';

final offlineSyncManagerProvider = Provider<OfflineSyncManager>((ref) {
  final manager = OfflineSyncManager(ref);
  ref.onDispose(manager.dispose);
  return manager;
});

class OfflineSyncManager {
  OfflineSyncManager(this._ref) {
    _ref.listen(connectivityStatusProvider, (prev, next) {
      if (prev?.value == AppConnectivityStatus.offline &&
          next.value == AppConnectivityStatus.online) {
        _processQueue();
      }
    });
    _queue.load();
  }

  final Ref _ref;
  final OfflineQueue _queue = OfflineQueue();
  bool _processing = false;

  OfflineQueue get queue => _queue;

  Future<void> enqueue(OfflineOperation operation) async {
    await _queue.enqueue(operation);
  }

  Future<void> _processQueue() async {
    if (_processing) return;
    _processing = true;
    try {
      final operations = _queue.dequeueAll();
      for (final op in operations) {
        try {
          await _execute(op);
        } catch (_) {
          await _queue.enqueueFront(op);
          break;
        }
      }
    } finally {
      _processing = false;
    }
  }

  Future<void> _execute(OfflineOperation op) async {
    final client = _ref.read(mobileApiClientProvider);
    switch (op.type) {
      case OfflineOperationType.sendMessage:
        await client.postJson('/api/chat/send', body: op.payload);
      case OfflineOperationType.createNeed:
        await client.postJson('/api/listings', body: op.payload);
      case OfflineOperationType.updateTask:
        await client.patchJson(
          '/api/tasks/${op.payload['taskId']}',
          body: op.payload['updates'] as Map<String, dynamic>? ?? op.payload,
        );
      case OfflineOperationType.submitReview:
        await client.postJson('/api/profile/review', body: op.payload);
      case OfflineOperationType.updateOrderStatus:
        await client.patchJson(
          '/api/orders/${op.payload['orderId']}/status',
          body: {'status': op.payload['status']},
        );
    }
  }

  void dispose() {
  }
}
