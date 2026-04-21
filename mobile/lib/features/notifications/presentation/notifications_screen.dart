import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../../../shared/widgets/section_header.dart';
import '../data/notifications_center_repository.dart';
import 'notification_tiles.dart';

class NotificationsScreen extends ConsumerStatefulWidget {
  const NotificationsScreen({super.key});

  @override
  ConsumerState<NotificationsScreen> createState() =>
      _NotificationsScreenState();
}

class _NotificationsScreenState extends ConsumerState<NotificationsScreen> {
  NotificationKind? _filterKind;
  bool _unreadOnly = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).trackScreen('notifications_screen');
    });
  }

  Future<void> _refresh() async {
    ref.invalidate(notificationsCenterProvider);
    await ref.read(notificationsCenterProvider.future);
  }

  List<AppNotification> _filter(List<AppNotification> items) {
    return items.where((item) {
      if (_filterKind != null && item.kind != _filterKind) {
        return false;
      }
      if (_unreadOnly && item.read) {
        return false;
      }
      return true;
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final centerAsync = ref.watch(notificationsCenterProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: () async {
              await ref
                  .read(notificationsCenterRepositoryProvider)
                  .markAllRead();
              ref.invalidate(notificationsCenterProvider);
            },
            child: const Text('Mark all read'),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageInset,
              AppSpacing.sm,
              AppSpacing.pageInset,
              AppSpacing.pageInset,
            ),
            children: [
              AppCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Actionable, not noisy',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: AppSpacing.xs),
                    Text(
                      'Every notification should point to a clear next step or improve trust.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: AppSpacing.md),
                    Wrap(
                      spacing: AppSpacing.sm,
                      runSpacing: AppSpacing.sm,
                      children: [
                        AppFilterChip(
                          label: 'Unread only',
                          selected: _unreadOnly,
                          onSelected: (value) =>
                              setState(() => _unreadOnly = value),
                        ),
                        ...NotificationKind.values.map(
                          (kind) => AppFilterChip(
                            label: kind.label,
                            selected: _filterKind == kind,
                            onSelected: (_) => setState(
                              () => _filterKind = _filterKind == kind
                                  ? null
                                  : kind,
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              centerAsync.when(
                data: (center) {
                  final filtered = _filter(center.items);
                  if (filtered.isEmpty) {
                    return const AppEmptyState(
                      title: 'You are caught up',
                      message:
                          'New provider replies, connection updates, and reminders will appear here.',
                    );
                  }

                  final unread = filtered.where((item) => !item.read).toList();
                  final read = filtered.where((item) => item.read).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (unread.isNotEmpty) ...[
                        AppSectionHeader(
                          title: 'Needs attention',
                          subtitle:
                              '${unread.length} updates can move work or trust.',
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        ...unread.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: NotificationTile(
                              notification: item,
                              onRead: () async {
                                await ref
                                    .read(notificationsCenterRepositoryProvider)
                                    .markRead(item.id);
                                ref.invalidate(notificationsCenterProvider);
                              },
                            ),
                          ),
                        ),
                      ],
                      if (read.isNotEmpty) ...[
                        const SizedBox(height: AppSpacing.md),
                        AppSectionHeader(
                          title: 'Earlier',
                          subtitle:
                              'Read updates remain available as a lightweight audit trail.',
                        ),
                        const SizedBox(height: AppSpacing.sm),
                        ...read.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: NotificationTile(
                              notification: item,
                              onRead: () async {
                                await ref
                                    .read(notificationsCenterRepositoryProvider)
                                    .markRead(item.id);
                                ref.invalidate(notificationsCenterProvider);
                              },
                            ),
                          ),
                        ),
                      ],
                    ],
                  );
                },
                loading: () => const CardListSkeleton(count: 4),
                error: (error, _) => AppErrorState(
                  title: 'Notifications failed to load',
                  message: AppErrorMapper.toMessage(error),
                  onRetry: _refresh,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
