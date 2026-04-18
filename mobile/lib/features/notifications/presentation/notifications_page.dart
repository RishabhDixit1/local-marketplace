import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/error/app_error_mapper.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/trust_badge.dart';
import '../data/notifications_repository.dart';
import '../domain/notification_item.dart';

enum _NotificationFilter {
  all,
  unread,
  messages,
  orders,
  trust,
}
import '../../../core/api/mobile_api_client.dart';
import '../../../core/widgets/section_card.dart';
import '../data/notification_repository.dart';
import '../domain/notification_models.dart';

class NotificationsPage extends ConsumerStatefulWidget {
  const NotificationsPage({super.key});

  @override
  ConsumerState<NotificationsPage> createState() => _NotificationsPageState();
}

class _NotificationsPageState extends ConsumerState<NotificationsPage> {
  final _searchController = TextEditingController();
  _NotificationFilter _filter = _NotificationFilter.all;
  RealtimeChannel? _channel;
  SupabaseClient? _client;
  RealtimeChannel? _channel;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    _subscribe();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bindRealtime();
    });
  }

  @override
  void dispose() {
    _searchController.dispose();
    if (_client != null && _channel != null) {
      _client!.removeChannel(_channel!);
    }
    super.dispose();
  }

  void _subscribe() {
    final client = _client;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      return;
    }

    _disposeChannel();
    super.dispose();
  }

  void _bindRealtime() {
    _disposeChannel();
    final userId = Supabase.instance.client.auth.currentUser?.id ?? '';
    if (userId.isEmpty) {
      return;
    }

    final client = Supabase.instance.client;
    _channel = client
        .channel('mobile-notifications-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'notifications',
          callback: (_) => ref.invalidate(notificationsSnapshotProvider),
          filter: PostgresChangeFilter(
            type: PostgresChangeFilterType.eq,
            column: 'user_id',
            value: userId,
          ),
          callback: (_) {
            ref.invalidate(notificationListProvider);
          },
        )
        .subscribe();
  }

  Future<void> _refresh() async {
    ref.invalidate(notificationsSnapshotProvider);
    await ref.read(notificationsSnapshotProvider.future);
  }

  Future<void> _markAllRead() async {
    await ref.read(notificationsRepositoryProvider).markAllRead();
    await _refresh();
  void _disposeChannel() {
    final client = Supabase.instance.client;
    if (_channel != null) {
      unawaited(client.removeChannel(_channel!));
      _channel = null;
    }
  }

  Future<void> _refresh() async {
    ref.invalidate(notificationListProvider);
    await ref.read(notificationListProvider.future);
  }

  Future<void> _runAction(
    Future<void> Function() action, {
    required String successMessage,
  }) async {
    if (_busy) {
      return;
    }

    setState(() {
      _busy = true;
    });

    try {
      await action();
      ref.invalidate(notificationListProvider);
      await ref.read(notificationListProvider.future);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(successMessage)));
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
    } finally {
      if (mounted) {
        setState(() {
          _busy = false;
        });
      }
    }
  }

  Future<void> _openNotification(MobileNotificationItem item) async {
    try {
      if (item.unread) {
        await ref.read(notificationRepositoryProvider).markAsRead(item.id);
      }
    } catch (_) {
      // Navigation still wins if marking as read fails.
    }

    ref.invalidate(notificationListProvider);
    final action = resolveMobileNotificationAction(item);
    if (!mounted) {
      return;
    }
    context.push(
      Uri(
        path: action.route,
        queryParameters: action.queryParameters.isEmpty
            ? null
            : action.queryParameters,
      ).toString(),
    );
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(notificationsSnapshotProvider);
    final query = _searchController.text.trim().toLowerCase();
    final unreadCount = snapshot.asData?.value.unreadCount ?? 0;
    final notifications = ref.watch(notificationListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          TextButton(
            onPressed: unreadCount == 0 ? null : _markAllRead,
            child: const Text('Mark all read'),
          IconButton(
            tooltip: 'Mark all read',
            onPressed: _busy
                ? null
                : () => _runAction(
                    ref.read(notificationRepositoryProvider).markAllAsRead,
                    successMessage: 'Notifications marked as read.',
                  ),
            icon: const Icon(Icons.done_all_rounded),
          ),
          IconButton(
            tooltip: 'Clear all',
            onPressed: _busy
                ? null
                : () => _runAction(
                    ref.read(notificationRepositoryProvider).clearAll,
                    successMessage: 'Notifications cleared.',
                  ),
            icon: const Icon(Icons.delete_outline_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              AppSearchField(
                controller: _searchController,
                hintText: 'Search updates, messages, trust, or tasks',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: 12),
              Wrap(
                spacing: 8,
                runSpacing: 8,
                children: _NotificationFilter.values.map((filter) {
                  final selected = _filter == filter;
                  return ChoiceChip(
                    label: Text(_labelForFilter(filter)),
                    selected: selected,
                    onSelected: (_) => setState(() => _filter = filter),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              snapshot.when(
                data: (data) {
                  final items = data.items.where((item) {
                    if (!_matchesFilter(item, _filter)) {
                      return false;
                    }
                    if (query.isEmpty) {
                      return true;
                    }
                    final haystack =
                        '${item.title} ${item.message} ${item.kind.label}'
                            .toLowerCase();
                    return haystack.contains(query);
                  }).toList();
                  final groupedItems = _groupNotifications(items);

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (data.demoMode || (data.notice ?? '').isNotEmpty)
                        Container(
                          width: double.infinity,
                          margin: const EdgeInsets.only(bottom: 12),
                          padding: const EdgeInsets.all(12),
                          decoration: BoxDecoration(
                            color: AppColors.warningSoft,
                            borderRadius: BorderRadius.circular(AppRadii.md),
                            border: Border.all(color: AppColors.warning),
                          ),
                          child: Text(
                            data.notice ??
                                'Notifications are currently running in demo mode.',
                            style: Theme.of(context).textTheme.bodySmall?.copyWith(
                              color: AppColors.warning,
                            ),
                          ),
                        ),
                      _NotificationSummary(snapshot: data),
                      const SizedBox(height: 16),
                      if (items.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'You are all caught up',
                            message:
                                'New replies, order movement, and trust updates will appear here.',
                          ),
                        )
                      else
                        ...groupedItems.map(
                          (group) => Padding(
                            padding: const EdgeInsets.only(bottom: 18),
                            child: _NotificationGroupSection(group: group),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _NotificationsLoading(),
                error: (error, _) => SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load notifications',
                    message: AppErrorMapper.toMessage(error),
                    onRetry: _refresh,
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }

  bool _matchesFilter(
    MobileNotificationItem item,
    _NotificationFilter filter,
  ) {
    switch (filter) {
      case _NotificationFilter.all:
        return true;
      case _NotificationFilter.unread:
        return item.unread;
      case _NotificationFilter.messages:
        return item.kind == MobileNotificationKind.message;
      case _NotificationFilter.orders:
        return item.kind == MobileNotificationKind.order;
      case _NotificationFilter.trust:
        return item.kind == MobileNotificationKind.review ||
            item.kind == MobileNotificationKind.connection;
    }
  }

  String _labelForFilter(_NotificationFilter filter) {
    switch (filter) {
      case _NotificationFilter.all:
        return 'All';
      case _NotificationFilter.unread:
        return 'Unread';
      case _NotificationFilter.messages:
        return 'Messages';
      case _NotificationFilter.orders:
        return 'Orders';
      case _NotificationFilter.trust:
        return 'Trust';
    }
  }

  List<_NotificationGroup> _groupNotifications(List<MobileNotificationItem> items) {
    final unread = items.where((item) => item.unread).toList();
    final read = items.where((item) => !item.unread).toList();
    final groups = <_NotificationGroup>[];

    if (unread.isNotEmpty) {
      groups.add(
        _NotificationGroup(
          title: 'Needs attention',
          subtitle: 'Unread updates that can move a conversation or task.',
          items: unread,
        ),
      );
    }

    final buckets = <MobileNotificationKind, List<MobileNotificationItem>>{};
    for (final item in read) {
      buckets.putIfAbsent(item.kind, () => []).add(item);
    }

    for (final kind in [
      MobileNotificationKind.message,
      MobileNotificationKind.order,
      MobileNotificationKind.review,
      MobileNotificationKind.connection,
      MobileNotificationKind.system,
    ]) {
      final bucket = buckets[kind];
      if (bucket == null || bucket.isEmpty) {
        continue;
      }
      groups.add(
        _NotificationGroup(
          title: kind.label,
          subtitle: _groupSubtitle(kind),
          items: bucket,
        ),
      );
    }

    return groups;
  }

  String _groupSubtitle(MobileNotificationKind kind) {
    switch (kind) {
      case MobileNotificationKind.message:
        return 'Conversation handoffs and fresh replies.';
      case MobileNotificationKind.order:
        return 'Nearby request and task movement.';
      case MobileNotificationKind.review:
        return 'Trust, ratings, and reputation signals.';
      case MobileNotificationKind.connection:
        return 'People, intros, and local network updates.';
      case MobileNotificationKind.system:
        return 'Account and platform updates.';
    }
  }
}

class _NotificationSummary extends StatelessWidget {
  const _NotificationSummary({required this.snapshot});

  final MobileNotificationsSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    final messageCount = snapshot.items
        .where((item) => item.kind == MobileNotificationKind.message)
        .length;
    final orderCount = snapshot.items
        .where((item) => item.kind == MobileNotificationKind.order)
        .length;

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final tileWidth = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: tileWidth,
              child: MetricTile(
                label: 'Unread',
                value: snapshot.unreadCount.toString(),
                caption: 'Updates still needing attention',
                icon: Icons.mark_chat_unread_outlined,
              ),
            ),
            SizedBox(
              width: tileWidth,
              child: MetricTile(
                label: 'Message + task',
                value: '${messageCount + orderCount}',
                caption: 'Actionable handoffs into chat and tasks',
                icon: Icons.bolt_outlined,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _NotificationGroupSection extends StatelessWidget {
  const _NotificationGroupSection({required this.group});

  final _NotificationGroup group;
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              Text(
                'Realtime updates from tasks, messages, and system events.',
                style: Theme.of(context).textTheme.headlineMedium,
              ),
              const SizedBox(height: 10),
              Text(
                'Tap any notification to jump into the matching mobile workflow.',
                style: Theme.of(context).textTheme.bodyLarge,
              ),
              const SizedBox(height: 16),
              notifications.when(
                data: (items) {
                  if (items.isEmpty) {
                    return const SectionCard(child: _EmptyNotificationsState());
                  }

                  return Column(
                    children: items
                        .map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _NotificationCard(
                              item: item,
                              onOpen: () => _openNotification(item),
                              onClear: () => _runAction(
                                () => ref
                                    .read(notificationRepositoryProvider)
                                    .clearNotification(item.id),
                                successMessage: 'Notification cleared.',
                              ),
                            ),
                          ),
                        )
                        .toList(),
                  );
                },
                loading: () => const SectionCard(child: _LoadingState()),
                error: (error, _) =>
                    SectionCard(child: _ErrorState(error: error.toString())),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.item,
    required this.onOpen,
    required this.onClear,
  });

  final MobileNotificationItem item;
  final VoidCallback onOpen;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    final action = resolveMobileNotificationAction(item);
    final icon = switch (item.kind) {
      MobileNotificationKind.order => Icons.local_shipping_outlined,
      MobileNotificationKind.message => Icons.chat_bubble_outline_rounded,
      MobileNotificationKind.review => Icons.star_outline_rounded,
      MobileNotificationKind.connection => Icons.person_add_alt_rounded,
      MobileNotificationKind.system => Icons.shield_outlined,
    };

    return SectionCard(
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 44,
            height: 44,
            decoration: BoxDecoration(
              color: const Color(0xFFE0F2FE),
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(icon, color: const Color(0xFF0B1F33)),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        item.title,
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                    ),
                    if (item.unread)
                      Container(
                        width: 10,
                        height: 10,
                        decoration: const BoxDecoration(
                          color: Color(0xFF0EA5A4),
                          shape: BoxShape.circle,
                        ),
                      ),
                  ],
                ),
                const SizedBox(height: 8),
                Text(
                  item.message,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 10),
                Text(
                  item.timeLabel,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 14),
                Wrap(
                  spacing: 10,
                  runSpacing: 10,
                  children: [
                    FilledButton.tonal(
                      onPressed: onOpen,
                      child: Text(action.label),
                    ),
                    TextButton(onPressed: onClear, child: const Text('Clear')),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _EmptyNotificationsState extends StatelessWidget {
  const _EmptyNotificationsState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(group.title, style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 6),
        Text(group.subtitle, style: Theme.of(context).textTheme.bodyMedium),
        const SizedBox(height: 12),
        ...group.items.map(
          (item) => Padding(
            padding: const EdgeInsets.only(bottom: 12),
            child: _NotificationCard(item: item),
          ),
        ),
      ],
    );
  }
}

class _NotificationCard extends ConsumerWidget {
  const _NotificationCard({required this.item});

  final MobileNotificationItem item;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final icon = switch (item.kind) {
      MobileNotificationKind.order => Icons.local_shipping_outlined,
      MobileNotificationKind.message => Icons.chat_bubble_outline_rounded,
      MobileNotificationKind.review => Icons.star_outline_rounded,
      MobileNotificationKind.connection => Icons.people_outline_rounded,
      MobileNotificationKind.system => Icons.notifications_none_rounded,
    };

    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.md),
      onTap: () => _openNotification(context, ref),
      child: SectionCard(
        child: Row(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Container(
              width: 44,
              height: 44,
              decoration: BoxDecoration(
                color: item.unread
                    ? AppColors.primarySoft
                    : AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Icon(icon, color: AppColors.ink),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Expanded(
                        child: Text(
                          item.title,
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                      ),
                      const SizedBox(width: 8),
                      Text(
                        _relativeTime(item.createdAt),
                        style: Theme.of(context).textTheme.bodySmall,
                      ),
                    ],
                  ),
                  const SizedBox(height: 6),
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    children: [
                      TrustBadge(
                        label: item.kind.label,
                        icon: icon,
                        backgroundColor: AppColors.surfaceMuted,
                        foregroundColor: AppColors.ink,
                      ),
                      if (item.unread)
                        TrustBadge(
                          label: 'Unread',
                          icon: Icons.circle,
                          backgroundColor: AppColors.primarySoft,
                          foregroundColor: AppColors.primary,
                        ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    item.message,
                    style: Theme.of(context).textTheme.bodyMedium,
                  ),
                  const SizedBox(height: 12),
                  Row(
                    children: [
                      Expanded(
                        child: Text(
                          _handoffCopy(item),
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                      ),
                      const SizedBox(width: 12),
                      TextButton.icon(
                        onPressed: () => _openNotification(context, ref),
                        icon: const Icon(Icons.arrow_forward_rounded),
                        label: Text(item.actionLabel),
                      ),
                    ],
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Future<void> _openNotification(BuildContext context, WidgetRef ref) async {
    await ref.read(notificationsRepositoryProvider).markRead(item.id);
    if (!context.mounted) {
      return;
    }
    context.push(item.actionRoute);
  }

  String _handoffCopy(MobileNotificationItem item) {
    final normalized = item.entityType.toLowerCase();
    if (normalized.contains('conversation') || normalized.contains('message')) {
      return 'Opens the relevant chat thread.';
    }
    if (normalized.contains('order') || normalized.contains('task')) {
      return 'Takes you into the live task board.';
    }
    if (normalized.contains('review')) {
      return 'Jumps to the profile trust surface.';
    }
    if (normalized.contains('connection')) {
      return 'Opens the local people view.';
    }
    return 'Opens the linked destination.';
  }
}

class _NotificationsLoading extends StatelessWidget {
  const _NotificationsLoading();
        Text(
          'No notifications yet',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(
          'New task updates, chat messages, and service alerts will appear here automatically.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

class _LoadingState extends StatelessWidget {
  const _LoadingState();

  @override
  Widget build(BuildContext context) {
    return const SizedBox(
      height: 180,
      child: Center(child: CircularProgressIndicator()),
    );
  }
}

class _ErrorState extends StatelessWidget {
  const _ErrorState({required this.error});

  final String error;

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        4,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 18, width: 160),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 220),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NotificationGroup {
  const _NotificationGroup({
    required this.title,
    required this.subtitle,
    required this.items,
  });

  final String title;
  final String subtitle;
  final List<MobileNotificationItem> items;
}

String _relativeTime(DateTime value) {
  final diff = DateTime.now().difference(value.toLocal());
  if (diff.inMinutes < 1) {
    return 'Just now';
  }
  if (diff.inHours < 1) {
    return '${diff.inMinutes}m ago';
  }
  if (diff.inDays < 1) {
    return '${diff.inHours}h ago';
  }
  return '${diff.inDays}d ago';
}
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Notifications unavailable',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(error, style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}
