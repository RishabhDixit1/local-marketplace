import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter/semantics.dart';

import '../../core/theme/app_theme.dart';
import '../../l10n/l10n.dart';
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
    final l10n = AppLocalizations.of(context);
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final destinations = _mainDestinations(
      l10n: l10n,
      chatCount: chatCount,
      taskCount: taskCount,
    );

    return ClipRRect(
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 24, sigmaY: 24),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: isDark
                  ? [
                      AppColors.darkSurface.withValues(alpha: 0.92),
                      AppColors.darkSurfaceAlt.withValues(alpha: 0.8),
                    ]
                  : [
                      Colors.white.withValues(alpha: 0.92),
                      Colors.white.withValues(alpha: 0.85),
                    ],
              begin: Alignment.topCenter,
              end: Alignment.bottomCenter,
            ),
            border: Border(
              top: BorderSide(
                color: isDark ? AppColors.glassStrokeDark : AppColors.glassStroke,
              ),
            ),
          ),
          child: SafeArea(
            top: false,
            child: Padding(
              padding: const EdgeInsets.fromLTRB(8, 6, 8, 12),
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
    final l10n = AppLocalizations.of(context);
    final destinations = _mainDestinations(
      l10n: l10n,
      chatCount: chatCount,
      taskCount: taskCount,
    );

    return DecoratedBox(
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.surface,
        border: Border(
          right: BorderSide(color: Theme.of(context).dividerColor),
        ),
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
                  gradient: AppGradients.premiumDark,
                  borderRadius: BorderRadius.circular(AppRadii.lg),
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
  required AppLocalizations l10n,
  required int chatCount,
  required int taskCount,
}) {
  return [
    _NavDestination(
      label: l10n.home,
      icon: Icons.home_outlined,
      selectedIcon: Icons.home_rounded,
    ),
    _NavDestination(
      label: l10n.discovery,
      icon: Icons.explore_outlined,
      selectedIcon: Icons.explore_rounded,
    ),
    _NavDestination(
      label: l10n.market,
      icon: Icons.store_outlined,
      selectedIcon: Icons.store_rounded,
    ),
    _NavDestination(
      label: l10n.work,
      icon: Icons.assignment_outlined,
      selectedIcon: Icons.assignment_rounded,
      badgeCount: taskCount,
    ),
    _NavDestination(
      label: l10n.inbox,
      icon: Icons.chat_outlined,
      selectedIcon: Icons.chat_rounded,
      badgeCount: chatCount,
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
    final foreground = selected
        ? AppColors.accent
        : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
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
    final isDark = Theme.of(context).brightness == Brightness.dark;
    final foreground = selected
        ? AppColors.accent
        : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6);
    final icon = selected ? destination.selectedIcon : destination.icon;
    final selectedBackground = selected
        ? (isDark ? AppColors.accentDeep.withValues(alpha: 0.3) : AppColors.accentSoft)
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
            borderRadius: BorderRadius.circular(AppRadii.lg),
            child: AnimatedContainer(
              duration: AppDurations.fast,
              curve: Curves.easeOutCubic,
              constraints: const BoxConstraints(
                minHeight: AppTouchTargets.minimum,
              ),
              height: 56,
              margin: const EdgeInsets.symmetric(horizontal: 2),
              padding: const EdgeInsets.symmetric(horizontal: 4, vertical: 4),
              decoration: BoxDecoration(
                color: selectedBackground,
                borderRadius: BorderRadius.circular(AppRadii.lg),
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
                        AnimatedSwitcher(
                          duration: AppDurations.fast,
                          transitionBuilder: (child, anim) => ScaleTransition(
                            scale: anim,
                            child: child,
                          ),
                          child: Icon(
                            icon,
                            size: AppIconSize.lg,
                            color: foreground,
                            key: ValueKey(selected),
                          ),
                        ),
                        Positioned(
                          top: -6,
                          right: -8,
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
                      fontWeight: selected ? FontWeight.w800 : FontWeight.w600,
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
