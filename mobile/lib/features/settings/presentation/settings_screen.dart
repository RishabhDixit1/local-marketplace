import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../data/settings_repository.dart';

class SettingsScreen extends ConsumerWidget {
  const SettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(settingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Settings')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(
            AppSpacing.pageInset,
            AppSpacing.sm,
            AppSpacing.pageInset,
            AppSpacing.pageInset,
          ),
          children: [
            settingsAsync.when(
              data: (settings) {
                return Column(
                  children: [
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(
                            'Account and safety',
                            style: Theme.of(context).textTheme.titleLarge,
                          ),
                          const SizedBox(height: AppSpacing.xs),
                          Text(
                            'Keep identity, notifications, permissions, and privacy clear enough that trust scales.',
                            style: Theme.of(context).textTheme.bodyMedium,
                          ),
                        ],
                      ),
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _SettingsGroup(
                      title: 'Preferences',
                      items: [
                        _SettingsItem(
                          title: 'Location preferences',
                          subtitle: settings.locationEnabled
                              ? 'Enabled'
                              : 'Disabled',
                          icon: Icons.location_on_outlined,
                          onTap: () {},
                        ),
                        _SettingsItem(
                          title: 'Language',
                          subtitle: settings.languageCode.toUpperCase(),
                          icon: Icons.language_outlined,
                          onTap: () {},
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _SettingsGroup(
                      title: 'Privacy and notifications',
                      items: [
                        _SettingsItem(
                          title: 'Privacy controls',
                          subtitle: 'Visibility, DMs, locality, online status',
                          icon: Icons.lock_outline_rounded,
                          onTap: () => context.push(AppRoutes.privacySettings),
                        ),
                        _SettingsItem(
                          title: 'Notification preferences',
                          subtitle: 'Messages, tasks, reminders, trust alerts',
                          icon: Icons.notifications_outlined,
                          onTap: () =>
                              context.push(AppRoutes.notificationSettings),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    _SettingsGroup(
                      title: 'Safety and support',
                      items: [
                        _SettingsItem(
                          title: 'Blocked users',
                          subtitle: '${settings.blockedUserIds.length} blocked',
                          icon: Icons.block_outlined,
                          onTap: () {},
                        ),
                        _SettingsItem(
                          title: 'Help and support',
                          subtitle: 'Contact support and marketplace help',
                          icon: Icons.help_outline_rounded,
                          onTap: () {},
                        ),
                        _SettingsItem(
                          title: 'Invite friends',
                          subtitle:
                              'Share ServiQ locally and grow your trust graph',
                          icon: Icons.share_outlined,
                          onTap: () {},
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.md),
                    AppCard(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          SwitchListTile.adaptive(
                            value: settings.allowAnalytics,
                            title: const Text('Analytics and quality insights'),
                            subtitle: const Text(
                              'Helps improve ranking, speed, and product quality.',
                            ),
                            contentPadding: EdgeInsets.zero,
                            onChanged: (value) async {
                              await ref
                                  .read(settingsRepositoryProvider)
                                  .saveSettings(
                                    settings.copyWith(allowAnalytics: value),
                                  );
                              ref.invalidate(settingsProvider);
                            },
                          ),
                          const Divider(),
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(Icons.logout_rounded),
                            title: const Text('Log out'),
                            onTap: () {
                              ScaffoldMessenger.of(context).showSnackBar(
                                const SnackBar(
                                  content: Text(
                                    'Sign out wiring is ready here.',
                                  ),
                                ),
                              );
                            },
                          ),
                          ListTile(
                            contentPadding: EdgeInsets.zero,
                            leading: const Icon(
                              Icons.delete_outline_rounded,
                              color: AppColors.danger,
                            ),
                            title: const Text('Delete account'),
                            subtitle: const Text(
                              'Requires confirmation, export, and support fallback.',
                            ),
                            onTap: () => showDialog<void>(
                              context: context,
                              builder: (context) => AlertDialog(
                                title: const Text('Delete account'),
                                content: const Text(
                                  'This destructive flow should be backed by a real server confirmation before launch.',
                                ),
                                actions: [
                                  TextButton(
                                    onPressed: () =>
                                        Navigator.of(context).pop(),
                                    child: const Text('Cancel'),
                                  ),
                                  FilledButton(
                                    onPressed: () =>
                                        Navigator.of(context).pop(),
                                    child: const Text('Understood'),
                                  ),
                                ],
                              ),
                            ),
                          ),
                        ],
                      ),
                    ),
                  ],
                );
              },
              loading: () => const CardListSkeleton(count: 4),
              error: (error, _) => AppErrorState(
                title: 'Settings unavailable',
                message: AppErrorMapper.toMessage(error),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _SettingsGroup extends StatelessWidget {
  const _SettingsGroup({required this.title, required this.items});

  final String title;
  final List<_SettingsItem> items;

  @override
  Widget build(BuildContext context) {
    return AppCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.sm),
          ...items.map((item) => item),
        ],
      ),
    );
  }
}

class _SettingsItem extends StatelessWidget {
  const _SettingsItem({
    required this.title,
    required this.subtitle,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String subtitle;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return ListTile(
      contentPadding: EdgeInsets.zero,
      leading: Icon(icon),
      title: Text(title),
      subtitle: Text(subtitle),
      trailing: const Icon(Icons.chevron_right_rounded),
      onTap: onTap,
    );
  }
}
