import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/app_routes.dart';
import '../../core/services/analytics_service.dart';
import '../../core/realtime/mobile_live_hub.dart';
import '../../features/chat/data/chat_repository.dart';
import '../../features/tasks/data/task_repository.dart';
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
    ref.watch(mobileLiveHubProvider);
    final chatConversations = ref.watch(chatConversationsProvider);
    final taskSnapshot = ref.watch(taskSnapshotProvider);

    final unreadChatCount = chatConversations.maybeWhen(
      data: (conversations) => conversations.fold<int>(
        0,
        (count, conversation) => count + conversation.unreadCount,
      ),
      orElse: () => 0,
    );
    final activeTaskCount = taskSnapshot.maybeWhen(
      data: (snapshot) => snapshot.items.where((item) {
        return item.status.name == 'active' || item.status.name == 'inProgress';
      }).length,
      orElse: () => 0,
    );

    return Scaffold(
      body: navigationShell,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoutes.createNeed),
        icon: const Icon(Icons.add_rounded),
        label: const Text('Post'),
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
