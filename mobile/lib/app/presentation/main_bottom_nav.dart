import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../core/theme/app_theme.dart';
import '../../shared/widgets/chips.dart';

const _navigationRailWidthBreakpoint = AppBreakpoints.expanded;

bool shouldUseRailNavigation(double width) =>
    width >= _navigationRailWidthBreakpoint;

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
    final destinations = _mainDestinations(
      chatCount: chatCount,
      taskCount: taskCount,
    );

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
          padding: const EdgeInsets.fromLTRB(8, 6, 8, 8),
          child: Row(
            children: [
              for (var index = 0; index < destinations.length; index += 1)
                Expanded(
                  child: _NavDestinationButton(
                    destination: destinations[index],
                    selected: currentIndex == index,
                    index: index,
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

class MainNavigationRail extends StatelessWidget {
  const MainNavigationRail({
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
    final width = MediaQuery.sizeOf(context).width;
    final extended = width >= 1040;
    final destinations = _mainDestinations(
      chatCount: chatCount,
      taskCount: taskCount,
    );

    return DecoratedBox(
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(right: BorderSide(color: AppColors.border)),
      ),
      child: SafeArea(
        right: false,
        child: NavigationRail(
          extended: extended,
          minWidth: 82,
          minExtendedWidth: 188,
          labelType: extended
              ? NavigationRailLabelType.none
              : NavigationRailLabelType.all,
          selectedIndex: currentIndex,
          onDestinationSelected: onTap,
          leading: Padding(
            padding: const EdgeInsets.only(top: AppSpacing.xs, bottom: 18),
            child: Tooltip(
              message: 'ServiQ Home',
              child: Container(
                width: 46,
                height: 46,
                alignment: Alignment.center,
                decoration: BoxDecoration(
                  color: AppColors.inkStrong,
                  borderRadius: BorderRadius.circular(AppRadii.md),
                  boxShadow: AppShadows.glow,
                ),
                child: Text(
                  'S',
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    color: Colors.white,
                    fontWeight: FontWeight.w900,
                  ),
                ),
              ),
            ),
          ),
          destinations: [
            for (final destination in destinations)
              NavigationRailDestination(
                icon: _NavRailIcon(destination: destination, selected: false),
                selectedIcon: _NavRailIcon(
                  destination: destination,
                  selected: true,
                ),
                label: Text(destination.label),
              ),
          ],
        ),
      ),
    );
  }
}

List<_NavDestination> _mainDestinations({
  required int chatCount,
  required int taskCount,
}) {
  return [
    const _NavDestination(
      label: 'Market',
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
    ),
    _NavDestination(
      label: 'Work',
      icon: Icons.assignment_outlined,
      selectedIcon: Icons.assignment_rounded,
      badgeCount: taskCount + chatCount,
    ),
    const _NavDestination(
      label: 'You',
      icon: Icons.person_outline_rounded,
      selectedIcon: Icons.person_rounded,
    ),
  ];
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

class _NavRailIcon extends StatelessWidget {
  const _NavRailIcon({required this.destination, required this.selected});

  final _NavDestination destination;
  final bool selected;

  @override
  Widget build(BuildContext context) {
    final foreground = selected ? AppColors.accentDeep : AppColors.inkSubtle;
    final icon = selected ? destination.selectedIcon : destination.icon;

    return Tooltip(
      message: destination.label,
      child: SizedBox.square(
        dimension: AppTouchTargets.minimum,
        child: Stack(
          clipBehavior: Clip.none,
          alignment: Alignment.center,
          children: [
            Icon(icon, color: foreground),
            Positioned(
              top: 4,
              right: 4,
              child: CountBadge(count: destination.badgeCount),
            ),
          ],
        ),
      ),
    );
  }
}

class _NavDestinationButton extends StatelessWidget {
  const _NavDestinationButton({
    required this.destination,
    required this.selected,
    required this.index,
    required this.onTap,
  });

  final _NavDestination destination;
  final bool selected;
  final int index;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final foreground = selected ? AppColors.primaryDeep : AppColors.inkSubtle;
    final icon = selected ? destination.selectedIcon : destination.icon;
    final selectedBackground = selected
        ? AppColors.primarySoft
        : Colors.transparent;
    final badgeCount = destination.badgeCount;
    final semanticLabel = badgeCount > 0
        ? '${destination.label}, $badgeCount new item${badgeCount == 1 ? '' : 's'}'
        : destination.label;

    return Semantics(
      selected: selected,
      button: true,
      label: semanticLabel,
      sortKey: OrdinalSortKey(index.toDouble()),
      child: Tooltip(
        message: destination.label,
        child: Material(
          color: Colors.transparent,
          child: InkWell(
            onTap: onTap,
            borderRadius: BorderRadius.circular(AppRadii.md),
            child: AnimatedContainer(
              duration: AppDurations.fast,
              curve: Curves.easeOutCubic,
              constraints: const BoxConstraints(
                minHeight: AppTouchTargets.minimum,
              ),
              height: 58,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 5),
              decoration: BoxDecoration(
                color: selectedBackground,
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Column(
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  SizedBox(
                    width: 34,
                    height: 26,
                    child: Stack(
                      clipBehavior: Clip.none,
                      alignment: Alignment.center,
                      children: [
                        Icon(icon, size: selected ? 23 : 21, color: foreground),
                        Positioned(
                          top: -6,
                          right: -8,
                          child: CountBadge(count: destination.badgeCount),
                        ),
                      ],
                    ),
                  ),
                  const SizedBox(height: 3),
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
      ),
    );
  }
}
