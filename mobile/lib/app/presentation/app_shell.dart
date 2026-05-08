import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/app_routes.dart';
import '../../core/firebase/mobile_push_notifications.dart';
import '../../core/realtime/mobile_live_hub.dart';
import '../../core/services/analytics_service.dart';
import '../../features/chat/data/chat_repository.dart';
import '../../features/tasks/data/task_repository.dart';
import 'main_bottom_nav.dart';

@visibleForTesting
bool shouldShowPostActionForBranch(int index) => index == 1;

class AppShell extends ConsumerWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(BuildContext context, WidgetRef ref, int index) {
    HapticFeedback.selectionClick();
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
    ref.watch(mobilePushNotificationServiceProvider).start();
    final chatConversations = ref.watch(chatConversationsProvider);
    final taskSnapshot = ref.watch(taskSnapshotProvider);
    final showPostAction = shouldShowPostActionForBranch(
      navigationShell.currentIndex,
    );

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
      extendBody: true,
      body: navigationShell,
      floatingActionButton: AnimatedSwitcher(
        duration: const Duration(milliseconds: 220),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        child: showPostAction
            ? Padding(
                key: const ValueKey('post-need-fab'),
                padding: const EdgeInsets.only(bottom: 66),
                child: FloatingActionButton.extended(
                  heroTag: 'post-need-fab',
                  onPressed: () {
                    HapticFeedback.lightImpact();
                    context.push(AppRoutes.createNeed);
                  },
                  icon: const Icon(Icons.add_rounded),
                  label: const Text('Post Need'),
                  backgroundColor: Theme.of(context).colorScheme.primary,
                  foregroundColor: Theme.of(context).colorScheme.onPrimary,
                  elevation: 3,
                  extendedPadding: const EdgeInsetsDirectional.symmetric(
                    horizontal: 18,
                  ),
                ),
              )
            : const SizedBox.shrink(key: ValueKey('no-post-need-fab')),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
      bottomNavigationBar: MainBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: (index) => _onDestinationSelected(context, ref, index),
        chatCount: unreadChatCount,
        taskCount: activeTaskCount,
      ),
    );
  }
}
