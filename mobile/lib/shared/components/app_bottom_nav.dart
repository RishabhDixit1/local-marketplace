import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';

class AppBottomNav extends StatelessWidget {
  const AppBottomNav({
    super.key,
    required this.currentIndex,
    required this.onTap,
    this.badgeCounts = const AppBottomNavBadgeCounts(),
  });

  final int currentIndex;
  final ValueChanged<int> onTap;
  final AppBottomNavBadgeCounts badgeCounts;

  @override
  Widget build(BuildContext context) {
    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      destinations: [
        NavigationDestination(
          icon: const _NavIcon(icon: Icons.home_outlined),
          selectedIcon: const _NavIcon(icon: Icons.home_rounded),
          label: 'Home',
        ),
        NavigationDestination(
          icon: const _NavIcon(icon: Icons.explore_outlined),
          selectedIcon: const _NavIcon(icon: Icons.explore_rounded),
          label: 'Explore',
        ),
        NavigationDestination(
          icon: _NavIcon(
            icon: Icons.assignment_outlined,
            badgeCount: badgeCounts.taskCount,
          ),
          selectedIcon: _NavIcon(
            icon: Icons.assignment_rounded,
            badgeCount: badgeCounts.taskCount,
          ),
          label: 'Tasks',
        ),
        NavigationDestination(
          icon: _NavIcon(
            icon: Icons.chat_bubble_outline_rounded,
            badgeCount: badgeCounts.chatCount,
          ),
          selectedIcon: _NavIcon(
            icon: Icons.chat_bubble_rounded,
            badgeCount: badgeCounts.chatCount,
          ),
          label: 'Chat',
        ),
        NavigationDestination(
          icon: const _NavIcon(icon: Icons.person_outline_rounded),
          selectedIcon: const _NavIcon(icon: Icons.person_rounded),
          label: 'Profile',
        ),
      ],
    );
  }
}

class AppBottomNavBadgeCounts {
  const AppBottomNavBadgeCounts({this.chatCount = 0, this.taskCount = 0});

  final int chatCount;
  final int taskCount;
}

class _NavIcon extends StatelessWidget {
  const _NavIcon({required this.icon, this.badgeCount = 0});

  final IconData icon;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);

    return SizedBox(
      width: 28,
      height: 28,
      child: Stack(
        clipBehavior: Clip.none,
        children: [
          Center(child: Icon(icon)),
          if (badgeCount > 0)
            Positioned(
              top: -4,
              right: -10,
              child: Container(
                constraints: const BoxConstraints(minWidth: 18, minHeight: 18),
                padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 1),
                decoration: BoxDecoration(
                  color: AppColors.danger,
                  borderRadius: BorderRadius.circular(999),
                  border: Border.all(
                    color: theme.colorScheme.surface,
                    width: 2,
                  ),
                ),
                alignment: Alignment.center,
                child: Text(
                  badgeCount > 99 ? '99+' : '$badgeCount',
                  style: theme.textTheme.labelMedium?.copyWith(
                    color: Colors.white,
                    fontSize: badgeCount > 99 ? 9 : 10,
                  ),
                ),
              ),
            ),
        ],
      ),
    );
  }
}
