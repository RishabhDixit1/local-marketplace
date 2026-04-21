import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../data/settings_repository.dart';

class NotificationSettingsScreen extends ConsumerWidget {
  const NotificationSettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(settingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Notifications')),
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
                final prefs = settings.notificationPreferences;
                Future<void> save(NotificationPreferences next) async {
                  await ref
                      .read(settingsRepositoryProvider)
                      .saveSettings(
                        settings.copyWith(notificationPreferences: next),
                      );
                  ref.invalidate(settingsProvider);
                }

                return AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Useful, not noisy',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Favor actionable updates over passive noise. Each category should map to a real next step.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      SwitchListTile.adaptive(
                        value: prefs.messages,
                        title: const Text('Messages'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(prefs.copyWith(messages: value)),
                      ),
                      SwitchListTile.adaptive(
                        value: prefs.taskUpdates,
                        title: const Text('Task updates'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(prefs.copyWith(taskUpdates: value)),
                      ),
                      SwitchListTile.adaptive(
                        value: prefs.connectionRequests,
                        title: const Text('Connection requests'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(prefs.copyWith(connectionRequests: value)),
                      ),
                      SwitchListTile.adaptive(
                        value: prefs.reminders,
                        title: const Text('Reminders'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(prefs.copyWith(reminders: value)),
                      ),
                      SwitchListTile.adaptive(
                        value: prefs.trustAlerts,
                        title: const Text('Trust and safety alerts'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(prefs.copyWith(trustAlerts: value)),
                      ),
                      SwitchListTile.adaptive(
                        value: prefs.promotions,
                        title: const Text('Promotions and invites'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(prefs.copyWith(promotions: value)),
                      ),
                    ],
                  ),
                );
              },
              loading: () => const CardListSkeleton(count: 2),
              error: (error, _) => AppErrorState(
                title: 'Notification settings unavailable',
                message: AppErrorMapper.toMessage(error),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
