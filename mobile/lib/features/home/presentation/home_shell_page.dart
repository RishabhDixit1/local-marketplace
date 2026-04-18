import 'package:flutter/material.dart';
import 'package:go_router/go_router.dart';

class HomeShellPage extends StatelessWidget {
  const HomeShellPage({super.key, required this.navigationShell});

  final StatefulNavigationShell navigationShell;

  void _onDestinationSelected(int index) {
    navigationShell.goBranch(
      index,
      initialLocation: index == navigationShell.currentIndex,
    );
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      body: navigationShell,
      bottomNavigationBar: NavigationBar(
        selectedIndex: navigationShell.currentIndex,
        onDestinationSelected: _onDestinationSelected,
        destinations: const [
          NavigationDestination(
            icon: Icon(Icons.home_outlined),
            selectedIcon: Icon(Icons.home_rounded),
            label: 'Home',
          ),
          NavigationDestination(
            icon: Icon(Icons.explore_outlined),
            selectedIcon: Icon(Icons.explore_rounded),
            label: 'Explore',
          ),
          NavigationDestination(
            icon: Icon(Icons.people_outline_rounded),
            selectedIcon: Icon(Icons.people_alt_rounded),
            label: 'People',
          ),
          NavigationDestination(
            icon: Icon(Icons.assignment_outlined),
            selectedIcon: Icon(Icons.assignment_rounded),
            label: 'Tasks',
          ),
          NavigationDestination(
            icon: Icon(Icons.tune_outlined),
            selectedIcon: Icon(Icons.person_rounded),
            label: 'Profile',
          ),
        ],
      bottomNavigationBar: SafeArea(
        top: false,
        child: Padding(
          padding: const EdgeInsets.fromLTRB(14, 8, 14, 10),
          child: Container(
            decoration: BoxDecoration(
              color: Colors.white,
              borderRadius: BorderRadius.circular(26),
              border: Border.all(color: const Color(0xFFE2E8F0)),
              boxShadow: const [
                BoxShadow(
                  color: Color(0x120F172A),
                  blurRadius: 30,
                  offset: Offset(0, 14),
                ),
              ],
            ),
            padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 8),
            child: Row(
              children: List.generate(_items.length, (index) {
                final item = _items[index];
                final selected = navigationShell.currentIndex == index;
                return Expanded(
                  child: InkWell(
                    borderRadius: BorderRadius.circular(18),
                    onTap: () => _onDestinationSelected(index),
                    child: AnimatedContainer(
                      duration: const Duration(milliseconds: 180),
                      padding: const EdgeInsets.symmetric(vertical: 8),
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(18),
                        color: selected
                            ? const Color(0xFFE8F6F8)
                            : Colors.transparent,
                      ),
                      child: Column(
                        mainAxisSize: MainAxisSize.min,
                        children: [
                          Icon(
                            selected ? item.selectedIcon : item.icon,
                            color: selected
                                ? const Color(0xFF0B1F33)
                                : const Color(0xFF64748B),
                            size: 22,
                          ),
                          const SizedBox(height: 6),
                          Text(
                            item.label,
                            style: Theme.of(context).textTheme.labelMedium
                                ?.copyWith(
                                  color: selected
                                      ? const Color(0xFF0B1F33)
                                      : const Color(0xFF64748B),
                                  fontWeight: selected
                                      ? FontWeight.w800
                                      : FontWeight.w600,
                                ),
                          ),
                        ],
                      ),
                    ),
                  ),
                );
              }),
            ),
          ),
        ),
      ),
    );
  }
}

const _items = [
  _ShellNavItem(
    label: 'Welcome',
    icon: Icons.home_outlined,
    selectedIcon: Icons.home_rounded,
  ),
  _ShellNavItem(
    label: 'Explore',
    icon: Icons.newspaper_outlined,
    selectedIcon: Icons.newspaper_rounded,
  ),
  _ShellNavItem(
    label: 'People',
    icon: Icons.people_outline_rounded,
    selectedIcon: Icons.people_rounded,
  ),
  _ShellNavItem(
    label: 'Tasks',
    icon: Icons.assignment_outlined,
    selectedIcon: Icons.assignment_rounded,
  ),
  _ShellNavItem(
    label: 'Control',
    icon: Icons.work_outline_rounded,
    selectedIcon: Icons.work_rounded,
  ),
];

class _ShellNavItem {
  const _ShellNavItem({
    required this.label,
    required this.icon,
    required this.selectedIcon,
  });

  final String label;
  final IconData icon;
  final IconData selectedIcon;
}
