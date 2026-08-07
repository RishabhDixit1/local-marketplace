import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/constants/app_routes.dart';
import '../../core/theme/design_tokens.dart';
import '../../core/firebase/mobile_push_notifications.dart';
import '../../core/network/offline_banner.dart';
import '../../core/network/offline_sync_manager.dart';
import '../../core/realtime/mobile_live_hub.dart';
import '../../core/services/analytics_service.dart';
import '../../features/chat/data/chat_repository.dart';
import '../../features/tasks/data/task_repository.dart';
import '../../l10n/l10n.dart';
import 'main_bottom_nav.dart';

@visibleForTesting
bool shouldShowPostActionForBranch(int index) => index == 0 || index == 1;

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
    ref.watch(offlineSyncManagerProvider);
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

    return LayoutBuilder(
      builder: (context, constraints) {
        final useRail = shouldUseRailNavigation(constraints.maxWidth);
        void destinationSelected(int index) {
          _onDestinationSelected(context, ref, index);
        }

        return Scaffold(
          extendBody: true,
          body: Column(
            children: [
              const OfflineBanner(),
              if (!useRail)
                SafeArea(
                  bottom: false,
                  child: Align(
                    alignment: Alignment.centerRight,
                    child: Padding(
                      padding: const EdgeInsets.only(right: AppSpacing.xs, top: AppSpacing.xxs),
                      child: IconButton(
                        onPressed: () => context.push(AppRoutes.profile),
                        icon: CircleAvatar(
                          radius: 16,
                          backgroundColor: Theme.of(context).colorScheme.primaryContainer,
                          child: Icon(Icons.person_rounded, size: 18, color: Theme.of(context).colorScheme.onPrimaryContainer),
                        ),
                        tooltip: AppLocalizations.of(context).profile,
                      ),
                    ),
                  ),
                ),
              Expanded(
                child: useRail
                    ? Row(
                        children: [
                          MainNavigationRail(
                            currentIndex: navigationShell.currentIndex,
                            onTap: destinationSelected,
                            chatCount: unreadChatCount,
                            taskCount: activeTaskCount,
                          ),
                          Expanded(child: navigationShell),
                        ],
                      )
                    : navigationShell,
              ),
            ],
          ),
          floatingActionButton: Padding(
            padding: EdgeInsets.only(bottom: useRail ? 16 : 66),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                if (showPostAction) ...[
                  const SizedBox(height: AppSpacing.sm),
                  FloatingActionButton.extended(
                    heroTag: 'post-need-fab',
                    onPressed: () {
                      HapticFeedback.lightImpact();
                      context.push(AppRoutes.createNeed);
                    },
                    icon: const Icon(Icons.add_rounded),
                    label: Text(AppLocalizations.of(context).postNeed),
                    backgroundColor: Theme.of(context).colorScheme.primary,
                    foregroundColor: Theme.of(context).colorScheme.onPrimary,
                    elevation: 3,
                    extendedPadding: const EdgeInsetsDirectional.symmetric(
                      horizontal: 18,
                    ),
                  ),
                ],
              ],
            ),
          ),
          floatingActionButtonLocation: FloatingActionButtonLocation.endFloat,
          bottomNavigationBar: useRail
              ? null
              : Padding(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).padding.bottom > 0 ? 0 : 8,
                  ),
                  child: MainBottomNav(
                    currentIndex: navigationShell.currentIndex,
                    onTap: destinationSelected,
                    chatCount: unreadChatCount,
                    taskCount: activeTaskCount,
                  ),
                ),
        );
      },
    );
  }
}
