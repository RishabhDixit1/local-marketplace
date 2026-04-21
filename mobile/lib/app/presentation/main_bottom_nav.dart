import 'package:flutter/material.dart';

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
    return NavigationBar(
      selectedIndex: currentIndex,
      onDestinationSelected: onTap,
      destinations: [
        const NavigationDestination(
          icon: Icon(Icons.explore_outlined),
          selectedIcon: Icon(Icons.explore_rounded),
          label: 'Explore',
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
          label: 'Chat',
        ),
        const NavigationDestination(
          icon: Icon(Icons.person_outline_rounded),
          selectedIcon: Icon(Icons.person_rounded),
          label: 'Profile',
        ),
      ],
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
