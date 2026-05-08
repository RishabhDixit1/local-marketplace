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
    final destinations = <_NavDestination>[
      const _NavDestination(
        label: 'Home',
        icon: Icons.home_outlined,
        selectedIcon: Icons.home_rounded,
      ),
      const _NavDestination(
        label: 'People',
        icon: Icons.people_outline_rounded,
        selectedIcon: Icons.people_alt_rounded,
      ),
      _NavDestination(
        label: 'Work',
        icon: Icons.assignment_outlined,
        selectedIcon: Icons.assignment_rounded,
        badgeCount: taskCount,
      ),
      _NavDestination(
        label: 'Inbox',
        icon: Icons.chat_bubble_outline_rounded,
        selectedIcon: Icons.chat_bubble_rounded,
        badgeCount: chatCount,
      ),
      const _NavDestination(
        label: 'You',
        icon: Icons.person_outline_rounded,
        selectedIcon: Icons.person_rounded,
      ),
    ];

    return SafeArea(
      top: false,
      minimum: const EdgeInsets.fromLTRB(0, 0, 0, 0),
      child: DecoratedBox(
        decoration: BoxDecoration(
          color: AppColors.surface,
          border: const Border(top: BorderSide(color: AppColors.border)),
          boxShadow: const [
            BoxShadow(
              color: AppColors.shadow,
              blurRadius: 18,
              offset: Offset(0, -6),
            ),
          ],
        ),
        child: Padding(
          padding: const EdgeInsets.fromLTRB(6, 4, 6, 6),
          child: Row(
            children: [
              for (var index = 0; index < destinations.length; index += 1)
                Expanded(
                  child: _NavDestinationButton(
                    destination: destinations[index],
                    selected: currentIndex == index,
                    onTap: () => onTap(index),
                  ),
                ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NavDestination {
  const _NavDestination({
    required this.label,
    required this.icon,
    required this.selectedIcon,
    this.badgeCount = 0,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
  final int badgeCount;
}

class _NavDestinationButton extends StatelessWidget {
  const _NavDestinationButton({
    required this.destination,
    required this.selected,
    required this.onTap,
  });

  final _NavDestination destination;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = selected ? AppColors.primaryDeep : AppColors.inkSubtle;
    final icon = selected ? destination.selectedIcon : destination.icon;

    return Semantics(
      selected: selected,
      button: true,
      label: destination.label,
      child: Material(
        color: Colors.transparent,
        child: InkWell(
          onTap: onTap,
          borderRadius: BorderRadius.circular(AppRadii.md),
          child: AnimatedContainer(
            duration: const Duration(milliseconds: 180),
            curve: Curves.easeOutCubic,
            height: 54,
            padding: const EdgeInsets.symmetric(horizontal: 2, vertical: 3),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                AnimatedContainer(
                  duration: const Duration(milliseconds: 180),
                  width: selected ? 20 : 0,
                  height: 3,
                  margin: const EdgeInsets.only(bottom: 4),
                  decoration: BoxDecoration(
                    color: AppColors.primary,
                    borderRadius: BorderRadius.circular(AppRadii.pill),
                  ),
                ),
                SizedBox(
                  width: 30,
                  height: 22,
                  child: Stack(
                    clipBehavior: Clip.none,
                    alignment: Alignment.center,
                    children: [
                      Icon(icon, size: selected ? 22 : 21, color: foreground),
                      Positioned(
                        top: -10,
                        right: -12,
                        child: CountBadge(count: destination.badgeCount),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: 2),
                Text(
                  destination.label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: foreground,
                    fontWeight: selected ? FontWeight.w900 : FontWeight.w700,
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
