import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../shared/widgets/chips.dart';

class MainBottomNav extends StatelessWidget {
  const MainBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.chatCount = 0,
    this.taskCount = 0,
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final int chatCount;
  final int taskCount;

  @override
  Widget build(BuildContext context) {
    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(12, 0, 12, 8),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.surface,
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(color: AppColors.border),
          boxShadow: AppShadows.floating,
        ),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.lg),
          child: NavigationBar(
            height: 70,
            backgroundColor: AppColors.surface,
            surfaceTintColor: Colors.transparent,
            selectedIndex: currentIndex,
            onDestinationSelected: onTap,
            labelBehavior: NavigationDestinationLabelBehavior.alwaysShow,
            destinations: [
              const NavigationDestination(
                icon: Icon(Icons.home_outlined),
                selectedIcon: Icon(Icons.home_rounded),
                label: 'Home',
              ),
              const NavigationDestination(
                icon: Icon(Icons.people_outline_rounded),
                selectedIcon: Icon(Icons.people_alt_rounded),
                label: 'People',
              ),
              NavigationDestination(
                icon: _DestinationIcon(
                  icon: Icons.assignment_outlined,
                  badgeCount: taskCount,
                ),
                selectedIcon: _DestinationIcon(
                  icon: Icons.assignment_rounded,
                  badgeCount: taskCount,
                ),
                label: 'Tasks',
              ),
              NavigationDestination(
                icon: _DestinationIcon(
                  icon: Icons.chat_bubble_outline_rounded,
                  badgeCount: chatCount,
                ),
                selectedIcon: _DestinationIcon(
                  icon: Icons.chat_bubble_rounded,
                  badgeCount: chatCount,
                ),
                label: 'Inbox',
              ),
              const NavigationDestination(
                icon: Icon(Icons.person_outline_rounded),
                selectedIcon: Icon(Icons.person_rounded),
                label: 'You',
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DestinationIcon extends StatelessWidget {
  const _DestinationIcon({required this.icon, required this.badgeCount});

  final IconData icon;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 28,
      height: 28,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Center(child: Icon(icon)),
          Positioned(top: -6, right: -12, child: CountBadge(count: badgeCount)),
        ],
      ),
    );
  }
}
