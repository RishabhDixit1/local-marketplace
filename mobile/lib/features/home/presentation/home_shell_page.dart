import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/realtime/mobile_live_hub.dart';
import '../../../shared/components/app_bottom_nav.dart';

class HomeShellPage extends ConsumerWidget {
  const HomeShellPage({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    ref.watch(mobileLiveHubProvider);
    final badgeCounts = ref.watch(mobileShellBadgeCountsProvider);

    return Scaffold(
      body: navigationShell,
      floatingActionButton: FloatingActionButton.extended(
        onPressed: () => context.push(AppRoutes.createRequest),
        icon: const Icon(Icons.add_photo_alternate_outlined),
        label: const Text('Create'),
      ),
      floatingActionButtonLocation: FloatingActionButtonLocation.centerFloat,
      bottomNavigationBar: AppBottomNav(
        currentIndex: navigationShell.currentIndex,
        onTap: _onDestinationSelected,
        badgeCounts: AppBottomNavBadgeCounts(
          chatCount: badgeCounts.unreadChatCount,
          taskCount: badgeCounts.activeTaskCount,
        ),
      ),
    );
  }
}
