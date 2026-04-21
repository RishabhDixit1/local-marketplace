import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../data/settings_repository.dart';

class PrivacySettingsScreen extends ConsumerWidget {
  const PrivacySettingsScreen({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final settingsAsync = ref.watch(settingsProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Privacy')),
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
                final privacy = settings.privacySettings;
                Future<void> save(PrivacySettings next) async {
                  await ref
                      .read(settingsRepositoryProvider)
                      .saveSettings(settings.copyWith(privacySettings: next));
                  ref.invalidate(settingsProvider);
                }

                return AppCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Safe defaults',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: AppSpacing.xs),
                      Text(
                        'Favor connection-scoped visibility until trust is established.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      DropdownButtonFormField<ProfileVisibility>(
                        initialValue: privacy.profileVisibility,
                        decoration: const InputDecoration(
                          labelText: 'Profile visibility',
                        ),
                        items: ProfileVisibility.values
                            .map(
                              (value) => DropdownMenuItem(
                                value: value,
                                child: Text(value.label),
                              ),
                            )
                            .toList(),
                        onChanged: (value) {
                          if (value == null) {
                            return;
                          }
                          save(privacy.copyWith(profileVisibility: value));
                        },
                      ),
                      const SizedBox(height: AppSpacing.md),
                      SwitchListTile.adaptive(
                        value: privacy.showPreciseLocation,
                        title: const Text('Show precise location'),
                        subtitle: const Text(
                          'Keep this off by default and expose only locality-level context.',
                        ),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(privacy.copyWith(showPreciseLocation: value)),
                      ),
                      SwitchListTile.adaptive(
                        value: privacy.showMutualConnections,
                        title: const Text('Show mutual connections'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) => save(
                          privacy.copyWith(showMutualConnections: value),
                        ),
                      ),
                      SwitchListTile.adaptive(
                        value: privacy.allowDirectMessages,
                        title: const Text('Allow direct messages'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(privacy.copyWith(allowDirectMessages: value)),
                      ),
                      SwitchListTile.adaptive(
                        value: privacy.showOnlineStatus,
                        title: const Text('Show online status'),
                        contentPadding: EdgeInsets.zero,
                        onChanged: (value) =>
                            save(privacy.copyWith(showOnlineStatus: value)),
                      ),
                    ],
                  ),
                );
              },
              loading: () => const CardListSkeleton(count: 2),
              error: (error, _) => AppErrorState(
                title: 'Privacy settings unavailable',
                message: AppErrorMapper.toMessage(error),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
