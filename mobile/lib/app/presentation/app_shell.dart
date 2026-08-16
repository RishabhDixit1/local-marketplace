import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter/services.dart';
import 'package:go_router/go_router.dart';

import '../../core/firebase/mobile_push_notifications.dart';
import '../../core/network/offline_banner.dart';
import '../../core/network/offline_sync_manager.dart';
import '../../core/realtime/mobile_live_hub.dart';
import '../../core/services/analytics_service.dart';
import 'main_bottom_nav.dart';

class AppShell extends ConsumerStatefulWidget {
  const AppShell({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  @override
  ConsumerState<AppShell> createState() => _AppShellState();
}

class _AppShellState extends ConsumerState<AppShell> {
  void _onDestinationSelected(BuildContext context, WidgetRef ref, int index) {
    HapticFeedback.selectionClick();
    widget.navigationShell.goBranch(
      index,
      initialLocation: index == widget.navigationShell.currentIndex,
    );

    ref
        .read(analyticsServiceProvider)
        .trackEvent('tap_bottom_nav', extras: {'index': index});
  }

  @override
  Widget build(BuildContext context) {
    ref.watch(mobileLiveHubProvider);
    ref.watch(mobilePushNotificationServiceProvider).start();
    ref.watch(offlineSyncManagerProvider);

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
              Expanded(
                child: useRail
                    ? Row(
                        children: [
                          MainNavigationRail(
                            currentIndex: widget.navigationShell.currentIndex,
                            onTap: destinationSelected,
                          ),
                          Expanded(child: widget.navigationShell),
                        ],
                      )
                    : widget.navigationShell,
              ),
            ],
          ),
          bottomNavigationBar: useRail
              ? null
              : Padding(
                  padding: EdgeInsets.only(
                    bottom: MediaQuery.of(context).padding.bottom > 0 ? 0 : 8,
                  ),
                  child: MainBottomNav(
                    currentIndex: widget.navigationShell.currentIndex,
                    onTap: destinationSelected,
                  ),
                ),
        );
      },
    );
  }
}
