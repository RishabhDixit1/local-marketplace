import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/trust_badge.dart';
import '../data/notification_repository.dart';
import '../domain/notification_models.dart';

enum _NotificationFilter {
  all,
  unread,
  messages,
  orders,
  trust;

  String get label {
    switch (this) {
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
}

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
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    _bindRealtime();
  }

  @override
  void dispose() {
    _searchController.dispose();
    if (_client != null && _channel != null) {
      _client!.removeChannel(_channel!);
    }
    super.dispose();
  }

  void _bindRealtime() {
    final client = _client;
    final userId = client?.auth.currentUser?.id ?? '';
    if (client == null || userId.isEmpty) {
      return;
    }

    _channel = client
        .channel('mobile-notifications-$userId')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'notifications',
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

    setState(() => _busy = true);
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
        setState(() => _busy = false);
      }
    }
  }

  Future<void> _openNotification(MobileNotificationItem item) async {
    try {
      if (item.unread) {
        await ref.read(notificationRepositoryProvider).markAsRead(item.id);
      }
    } catch (_) {
      // Let navigation continue even if read state fails.
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
    final notificationsAsync = ref.watch(notificationListProvider);
    final unreadCount =
        notificationsAsync.asData?.value.where((item) => item.unread).length ??
        0;
    final query = _searchController.text.trim().toLowerCase();

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
          IconButton(
            tooltip: 'Mark all read',
            onPressed: _busy || unreadCount == 0
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
                  return ChoiceChip(
                    label: Text(filter.label),
                    selected: _filter == filter,
                    onSelected: (_) => setState(() => _filter = filter),
                  );
                }).toList(),
              ),
              const SizedBox(height: 16),
              notificationsAsync.when(
                data: (items) {
                  final filtered = items.where((item) {
                    if (!_matchesFilter(item, _filter)) {
                      return false;
                    }
                    if (query.isEmpty) {
                      return true;
                    }
                    final haystack =
                        '${item.title} ${item.message} ${item.kind.name}'
                            .toLowerCase();
                    return haystack.contains(query);
                  }).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _NotificationSummary(
                        items: items,
                        filteredCount: filtered.length,
                      ),
                      const SizedBox(height: 16),
                      if (filtered.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'No matching notifications',
                            message:
                                'New chats, task updates, and trust signals will appear here as activity comes in.',
                          ),
                        )
                      else
                        ...filtered.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: _NotificationCard(
                              item: item,
                              busy: _busy,
                              actionLabel: resolveMobileNotificationAction(
                                item,
                              ).label,
                              onOpen: () => _openNotification(item),
                              onClear: () => _runAction(
                                () => ref
                                    .read(notificationRepositoryProvider)
                                    .clearNotification(item.id),
                                successMessage: 'Notification cleared.',
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _NotificationsLoadingState(),
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
}

bool _matchesFilter(MobileNotificationItem item, _NotificationFilter filter) {
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

String _kindLabel(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.order:
      return 'Order';
    case MobileNotificationKind.message:
      return 'Message';
    case MobileNotificationKind.review:
      return 'Review';
    case MobileNotificationKind.system:
      return 'System';
    case MobileNotificationKind.connection:
      return 'Connection';
  }
}

IconData _kindIcon(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.order:
      return Icons.assignment_outlined;
    case MobileNotificationKind.message:
      return Icons.chat_bubble_outline_rounded;
    case MobileNotificationKind.review:
      return Icons.star_outline_rounded;
    case MobileNotificationKind.system:
      return Icons.notifications_none_rounded;
    case MobileNotificationKind.connection:
      return Icons.people_outline_rounded;
  }
}

class _NotificationSummary extends StatelessWidget {
  const _NotificationSummary({
    required this.items,
    required this.filteredCount,
  });

  final List<MobileNotificationItem> items;
  final int filteredCount;

  @override
  Widget build(BuildContext context) {
    final unread = items.where((item) => item.unread).length;
    final messages = items
        .where((item) => item.kind == MobileNotificationKind.message)
        .length;
    final orders = items
        .where((item) => item.kind == MobileNotificationKind.order)
        .length;
    final trust = items
        .where(
          (item) =>
              item.kind == MobileNotificationKind.review ||
              item.kind == MobileNotificationKind.connection,
        )
        .length;

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 12.0;
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Unread',
                value: unread.toString(),
                caption: '$filteredCount visible now',
                icon: Icons.mark_email_unread_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Messages',
                value: messages.toString(),
                caption: '$orders task updates',
                icon: Icons.chat_bubble_outline_rounded,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Trust',
                value: trust.toString(),
                caption: 'Reviews and connections',
                icon: Icons.verified_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'All activity',
                value: items.length.toString(),
                caption: 'Realtime notification stream',
                icon: Icons.notifications_active_outlined,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _NotificationCard extends StatelessWidget {
  const _NotificationCard({
    required this.item,
    required this.busy,
    required this.actionLabel,
    required this.onOpen,
    required this.onClear,
  });

  final MobileNotificationItem item;
  final bool busy;
  final String actionLabel;
  final VoidCallback onOpen;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Container(
                width: 42,
                height: 42,
                decoration: BoxDecoration(
                  color: const Color(0xFFF1F5F9),
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  _kindIcon(item.kind),
                  color: const Color(0xFF0B1F33),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      item.message,
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                  ],
                ),
              ),
              if (item.unread)
                const TrustBadge(
                  label: 'Unread',
                  icon: Icons.fiber_manual_record_rounded,
                ),
            ],
          ),
          const SizedBox(height: 14),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(label: _kindLabel(item.kind)),
              TrustBadge(
                label: item.timeLabel,
                icon: Icons.schedule_rounded,
                backgroundColor: const Color(0xFFE0F2FE),
                foregroundColor: const Color(0xFF0B1F33),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              Expanded(
                child: OutlinedButton.icon(
                  onPressed: busy ? null : onClear,
                  icon: const Icon(Icons.delete_outline_rounded),
                  label: const Text('Clear'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: FilledButton.icon(
                  onPressed: busy ? null : onOpen,
                  icon: const Icon(Icons.open_in_new_rounded),
                  label: Text(actionLabel),
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _NotificationsLoadingState extends StatelessWidget {
  const _NotificationsLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (_) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 20, width: 180),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 220),
                SizedBox(height: 16),
                LoadingShimmer(height: 42),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
