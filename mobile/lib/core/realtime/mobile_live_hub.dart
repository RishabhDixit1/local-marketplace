import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../features/chat/data/chat_repository.dart';
import '../../features/feed/data/feed_repository.dart';
import '../../features/feed/domain/feed_snapshot.dart';
import '../../features/notifications/data/notifications_repository.dart';
import '../../features/people/data/people_repository.dart';
import '../../features/profile/data/profile_repository.dart';
import '../../features/tasks/data/task_repository.dart';
import '../../features/tasks/domain/task_snapshot.dart';
import '../supabase/app_bootstrap.dart';

final mobileLiveHubProvider = Provider<MobileLiveHub?>((ref) {
  final client = ref.watch(appBootstrapProvider).client;
  final userId = client?.auth.currentUser?.id ?? '';

  if (client == null || userId.isEmpty) {
    return null;
  }

  void invalidateFeed() {
    ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
    ref.invalidate(feedSnapshotProvider(MobileFeedScope.connected));
  }

  void invalidatePeople() {
    ref.invalidate(peopleSnapshotProvider);
  }

  void invalidateTasks() {
    ref.invalidate(taskSnapshotProvider);
  }

  void invalidateNotifications() {
    ref.invalidate(notificationsSnapshotProvider);
  }

  void invalidateChat() {
    ref.invalidate(chatConversationsProvider);
  }

  void invalidateProfile() {
    ref.invalidate(profileSnapshotProvider);
  }

  final channel = client
      .channel('mobile-live-shell-$userId')
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'posts',
        callback: (_) => invalidateFeed(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'help_requests',
        callback: (_) {
          invalidateFeed();
          invalidateTasks();
        },
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'service_listings',
        callback: (_) => invalidateFeed(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'product_catalog',
        callback: (_) => invalidateFeed(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'profiles',
        callback: (_) {
          invalidatePeople();
          invalidateProfile();
        },
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'provider_presence',
        callback: (_) {
          invalidatePeople();
          invalidateProfile();
        },
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'reviews',
        callback: (_) {
          invalidatePeople();
          invalidateProfile();
        },
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'connection_requests',
        callback: (_) {
          invalidateFeed();
          invalidatePeople();
          invalidateNotifications();
        },
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'orders',
        callback: (_) {
          invalidateTasks();
          invalidateNotifications();
        },
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'task_events',
        callback: (_) => invalidateTasks(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'notification_escalations',
        callback: (_) => invalidateTasks(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'notifications',
        callback: (_) => invalidateNotifications(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'conversation_participants',
        callback: (_) => invalidateChat(),
      )
      .onPostgresChanges(
        event: PostgresChangeEvent.all,
        schema: 'public',
        table: 'messages',
        callback: (_) {
          invalidateChat();
          invalidateNotifications();
        },
      )
      .subscribe();

  ref.onDispose(() {
    client.removeChannel(channel);
  });

  return MobileLiveHub(channel: channel);
});

final mobileShellBadgeCountsProvider = Provider<MobileShellBadgeCounts>((ref) {
  ref.watch(mobileLiveHubProvider);

  final chatConversations = ref.watch(chatConversationsProvider);
  final taskSnapshot = ref.watch(taskSnapshotProvider);
  final notificationsSnapshot = ref.watch(notificationsSnapshotProvider);

  final unreadChatCount = chatConversations.maybeWhen(
    data: (conversations) => conversations.fold<int>(
      0,
      (count, conversation) => count + conversation.unreadCount,
    ),
    orElse: () => 0,
  );

  final activeTaskCount = taskSnapshot.maybeWhen(
    data: (snapshot) => snapshot.items.where((item) {
      return item.status == MobileTaskStatus.active ||
          item.status == MobileTaskStatus.inProgress;
    }).length,
    orElse: () => 0,
  );

  final unreadNotificationCount = notificationsSnapshot.maybeWhen(
    data: (snapshot) => snapshot.unreadCount,
    orElse: () => 0,
  );

  return MobileShellBadgeCounts(
    unreadChatCount: unreadChatCount,
    activeTaskCount: activeTaskCount,
    unreadNotificationCount: unreadNotificationCount,
  );
});

class MobileLiveHub {
  const MobileLiveHub({required this.channel});

  final RealtimeChannel channel;
}

class MobileShellBadgeCounts {
  const MobileShellBadgeCounts({
    required this.unreadChatCount,
    required this.activeTaskCount,
    required this.unreadNotificationCount,
  });

  final int unreadChatCount;
  final int activeTaskCount;
  final int unreadNotificationCount;
}
