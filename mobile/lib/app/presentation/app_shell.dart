import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/app_routes.dart';
import '../../core/services/analytics_service.dart';
import '../../features/chat/data/chat_hub_repository.dart';
import '../../features/notifications/data/notifications_center_repository.dart';
import '../../features/tasks/data/tasks_repository.dart';
import 'main_bottom_nav.dart';

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(BuildContext context, WidgetRef ref, int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );

    ref
        .read(analyticsServiceProvider)
        .trackEvent('tap_bottom_nav', extras: {'index': index});
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final chatThreads = ref.watch(chatThreadsProvider);
    final taskBoard = ref.watch(tasksBoardProvider);
    ref.watch(notificationsCenterProvider);

    final unreadChatCount = chatThreads.maybeWhen(
      data: (threads) =>
          threads.fold<int>(0, (count, thread) => count + thread.unreadCount),
      orElse: () => 0,
    );
    final activeTaskCount = taskBoard.maybeWhen(
      data: (board) => board.items
          .where(
            (item) =>
                item.status.name == 'open' || item.status.name == 'inProgress',
          )
          .length,
      orElse: () => 0,
    );

    return Scaffold(
      body: navigationShell,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoutes.createNeed),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Post need'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerDocked,
      bottomNavigationBar: MainBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) => _onDestinationSelected(context, ref, index),
        chatCount: unreadChatCount,
        taskCount: activeTaskCount,
      ),
    );
  }
}
