import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/auth/auth_state_controller.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../inbox/data/chat_repository.dart';
import '../../notifications/data/notification_repository.dart';

class ControlPage extends ConsumerWidget {
  const ControlPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final user = ref.watch(currentSessionProvider).asData?.value?.user;
    final auth = ref.watch(authStateControllerProvider);
    final bootstrap = ref.watch(appBootstrapProvider);
    final conversations = ref.watch(conversationListProvider).asData?.value;
    final unreadNotifications = ref.watch(unreadNotificationCountProvider);

    final unreadChats = (conversations ?? const []).fold<int>(
      0,
      (count, item) => count + item.unreadCount,
    );

    return Scaffold(
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 14, 16, 28),
          children: [
            Text(
              'Control',
              style: Theme.of(context).textTheme.headlineMedium,
            ),
            const SizedBox(height: 8),
            Text(
              'Manage your ServiQ account, jump into high-frequency workflows, and keep your mobile session aligned with the web dashboard.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
            const SizedBox(height: 16),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(20),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      user?.email ?? 'ServiQ account',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'APP_ENV: ${bootstrap.config.environment}',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 16),
                    Wrap(
                      spacing: 10,
                      runSpacing: 10,
                      children: [
                        _ControlMetricCard(
                          label: 'Unread chats',
                          value: unreadChats.toString(),
                          icon: Icons.chat_bubble_outline_rounded,
                        ),
                        _ControlMetricCard(
                          label: 'Notifications',
                          value: unreadNotifications.toString(),
                          icon: Icons.notifications_none_rounded,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            Card(
              child: Padding(
                padding: const EdgeInsets.all(16),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Quick actions',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 14),
                    _ControlActionTile(
                      icon: Icons.person_outline_rounded,
                      title: 'Account methods',
                      subtitle: 'Passwords, linked sign-in providers, and auth callback details.',
                      onTap: () => context.push('/app/profile'),
                    ),
                    _ControlActionTile(
                      icon: Icons.chat_bubble_outline_rounded,
                      title: 'Inbox',
                      subtitle: 'Jump back into current chats and quotes.',
                      onTap: () => context.push('/app/inbox'),
                    ),
                    _ControlActionTile(
                      icon: Icons.notifications_none_rounded,
                      title: 'Notifications',
                      subtitle: 'Review live alerts from messages, tasks, and reviews.',
                      onTap: () => context.push('/app/notifications'),
                    ),
                    _ControlActionTile(
                      icon: Icons.add_task_rounded,
                      title: 'Post a Need',
                      subtitle: 'Create a live request using the same backend workflow as web.',
                      onTap: () => context.push('/app/post-task'),
                    ),
                  ],
                ),
              ),
            ),
            const SizedBox(height: 14),
            FilledButton.icon(
              onPressed: () async {
                await auth.signOut();
                if (context.mounted) {
                  context.go('/sign-in');
                }
              },
              icon: const Icon(Icons.logout_rounded),
              label: const Text('Sign out'),
            ),
          ],
        ),
      ),
    );
  }
}

class _ControlMetricCard extends StatelessWidget {
  const _ControlMetricCard({
    required this.label,
    required this.value,
    required this.icon,
  });

  final String label;
  final String value;
  final IconData icon;

  @override
  Widget build(BuildContext context) {
    return SizedBox(
      width: 150,
      child: Container(
        padding: const EdgeInsets.all(14),
        decoration: BoxDecoration(
          color: const Color(0xFFF8FAFC),
          borderRadius: BorderRadius.circular(20),
          border: Border.all(color: const Color(0xFFE2E8F0)),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Icon(icon, color: const Color(0xFF0B1F33)),
            const SizedBox(height: 10),
            Text(
              value,
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 4),
            Text(label, style: Theme.of(context).textTheme.bodySmall),
          ],
        ),
      ),
    );
  }
}

class _ControlActionTile extends StatelessWidget {
  const _ControlActionTile({
    required this.icon,
    required this.title,
    required this.subtitle,
    required this.onTap,
  });

  final IconData icon;
  final String title;
  final String subtitle;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: 10),
      child: Material(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(20),
        child: InkWell(
          borderRadius: BorderRadius.circular(20),
          onTap: onTap,
          child: Padding(
            padding: const EdgeInsets.all(14),
            child: Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 42,
                  height: 42,
                  decoration: BoxDecoration(
                    color: Colors.white,
                    borderRadius: BorderRadius.circular(14),
                  ),
                  child: Icon(icon, color: const Color(0xFF0B1F33)),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(title, style: Theme.of(context).textTheme.titleMedium),
                      const SizedBox(height: 4),
                      Text(
                        subtitle,
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                ),
                const SizedBox(width: 8),
                const Icon(Icons.chevron_right_rounded),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
