import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/mock/serviq_mock_store.dart';
import '../../../core/models/serviq_models.dart';

final notificationsCenterRepositoryProvider =
    Provider<NotificationsCenterRepository>((ref) {
      return NotificationsCenterRepository(ref);
    });

final notificationsCenterProvider = FutureProvider<NotificationsCenter>((
  ref,
) async {
  return ref.read(notificationsCenterRepositoryProvider).fetchCenter();
});

class NotificationsCenterRepository {
  NotificationsCenterRepository(this._ref);

  final Ref _ref;

  Future<NotificationsCenter> fetchCenter() async {
    await Future<void>.delayed(const Duration(milliseconds: 140));
    return NotificationsCenter(
      items: _ref.read(serviqMockStoreProvider).notifications,
    );
  }

  Future<void> markRead(String id) async {
    _ref.read(serviqMockStoreProvider.notifier).markNotificationRead(id);
  }

  Future<void> markAllRead() async {
    _ref.read(serviqMockStoreProvider.notifier).markAllNotificationsRead();
  }
}
