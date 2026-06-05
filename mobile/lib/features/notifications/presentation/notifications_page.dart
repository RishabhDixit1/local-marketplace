import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
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

String _sectionLabel(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.message:
      return 'Messages';
    case MobileNotificationKind.order:
      return 'Orders';
    case MobileNotificationKind.review:
      return 'Reviews';
    case MobileNotificationKind.connection:
      return 'Connections';
    case MobileNotificationKind.system:
      return 'System';
  }
}

IconData _sectionIcon(MobileNotificationKind kind) {
  switch (kind) {
    case MobileNotificationKind.message:
      return Icons.chat_bubble_outline_rounded;
    case MobileNotificationKind.order:
      return Icons.assignment_outlined;
    case MobileNotificationKind.review:
      return Icons.star_outline_rounded;
    case MobileNotificationKind.connection:
      return Icons.people_outline_rounded;
    case MobileNotificationKind.system:
      return Icons.notifications_none_rounded;
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
  final Set<MobileNotificationKind> _collapsedSections = {};

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
          callback: (_) => ref.invalidate(notificationListProvider),
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
      ServiqToast.show(
        context,
        message: successMessage,
        tone: ServiqToastTone.success,
      );
    } on ApiException catch (error) {
      if (!mounted) {
        return;
      }
      ServiqToast.show(
        context,
        message: error.message,
        tone: ServiqToastTone.danger,
      );
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
    }

    ref.invalidate(notificationListProvider);
    final action = resolveMobileNotificationAction(item);
    if (!mounted) {
      return;
    }

    context.push(action.location);
  }

  Future<void> _respondConnection({
    required String requestId,
    required String decision,
  }) async {
    if (_busy) return;
    setState(() => _busy = true);
    try {
      await ref.read(mobileApiClientProvider).patchJson(
        '/api/connections/$requestId',
        body: {'decision': decision},
        authenticated: true,
      );

      ref.invalidate(notificationListProvider);
      await ref.read(notificationListProvider.future);
      if (!mounted) return;
      ServiqToast.show(
        context,
        message: decision == 'accepted'
            ? 'Connection accepted'
            : 'Connection declined',
        tone: ServiqToastTone.success,
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ServiqToast.show(
        context,
        message: error.message,
        tone: ServiqToastTone.danger,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

      ref.invalidate(notificationListProvider);
      await ref.read(notificationListProvider.future);
      if (!mounted) return;
      ServiqToast.show(
        context,
        message: decision == 'accepted'
            ? 'Connection accepted'
            : 'Connection declined',
        tone: ServiqToastTone.success,
      );
    } on ApiException catch (error) {
      if (!mounted) return;
      ServiqToast.show(
        context,
        message: error.message,
        tone: ServiqToastTone.danger,
      );
    } finally {
      if (mounted) setState(() => _busy = false);
    }
  }

  bool _matchesFilter(MobileNotificationItem item) {
    switch (_filter) {
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

  @override
  Widget build(BuildContext context) {
    final notificationsAsync = ref.watch(notificationListProvider);
    final unreadCount =
        notificationsAsync.asData?.value.where((item) => item.unread).length ??
        0;
    final query = _searchController.text.trim().toLowerCase();

    return ServiqScaffold(
      appBar: ServiqTopBar(
        title: 'Notifications',
        subtitle: unreadCount == 0
            ? 'All caught up'
            : '$unreadCount unread update${unreadCount == 1 ? '' : 's'}',
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
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.md,
              AppSpacing.sm,
              AppSpacing.md,
              AppSpacing.xxl,
            ),
            children: [
              AppSearchField(
                controller: _searchController,
                hintText: 'Search updates, messages, trust, or tasks',
                onChanged: (_) => setState(() {}),
              ),
              const SizedBox(height: AppSpacing.sm),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: _NotificationFilter.values.map((filter) {
                  return ChoiceChip(
                    label: Text(filter.label),
                    selected: _filter == filter,
                    onSelected: (_) => setState(() => _filter = filter),
                  );
                }).toList(),
              ),
              const SizedBox(height: AppSpacing.md),
              ServiqAsyncBody<List<MobileNotificationItem>>(
                value: notificationsAsync,
                errorTitle: 'Unable to load notifications',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: _refresh,
                loadingBuilder: () => const Padding(
                  padding: EdgeInsets.symmetric(vertical: 32),
                  child: Center(child: CircularProgressIndicator()),
                ),
                data: (items) {
                  final filtered = items.where((item) {
                    if (!_matchesFilter(item)) {
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

                  final grouped = <MobileNotificationKind, List<MobileNotificationItem>>{};
                  for (final item in filtered) {
                    grouped.putIfAbsent(item.kind, () => []).add(item);
                  }

                  final kindOrder = [
                    MobileNotificationKind.message,
                    MobileNotificationKind.order,
                    MobileNotificationKind.connection,
                    MobileNotificationKind.review,
                    MobileNotificationKind.system,
                  ];
                  kindOrder.removeWhere((k) => !grouped.containsKey(k));

                  if (filtered.isEmpty) {
                    return const SectionCard(
                      child: EmptyStateView(
                        title: 'No matching notifications',
                        message:
                            'New chats, task updates, and trust signals will appear here as activity comes in.',
                      ),
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      for (final kind in kindOrder) ...[
                        _buildSectionHeader(kind, grouped[kind]!.length),
                        if (!_collapsedSections.contains(kind))
                          ...grouped[kind]!.map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(
                                bottom: AppSpacing.sm,
                              ),
                              child: _NotificationCard(
                                item: item,
                                busy: _busy,
                                actionLabel:
                                    resolveMobileNotificationAction(item).label,
                                onOpen: () => _openNotification(item),
                                onClear: () => _runAction(
                                  () => ref
                                      .read(notificationRepositoryProvider)
                                      .clearNotification(item.id),
                                  successMessage: 'Notification cleared.',
                                ),
                                onAcceptConnection: item.kind ==
                                        MobileNotificationKind.connection
                                    ? () => _respondConnection(
                                          requestId: item.entityId ?? item.id,
                                          decision: 'accepted',
                                        )
                                    : null,
                                onRejectConnection: item.kind ==
                                        MobileNotificationKind.connection
                                    ? () => _respondConnection(
                                          requestId: item.entityId ?? item.id,
                                          decision: 'rejected',
                                        )
                                    : null,
                              ),
                            ),
                          ),
                      ],
                    ],
                  );
                },
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildSectionHeader(MobileNotificationKind kind, int count) {
    final collapsed = _collapsedSections.contains(kind);
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.sm, bottom: AppSpacing.xs),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: () {
          setState(() {
            if (collapsed) {
              _collapsedSections.remove(kind);
            } else {
              _collapsedSections.add(kind);
            }
          });
        },
        child: Row(
          children: [
            Icon(
              _sectionIcon(kind),
              size: 18,
              color: AppColors.inkSubtle,
            ),
            const SizedBox(width: AppSpacing.sm),
            Text(
              _sectionLabel(kind),
              style: Theme.of(context).textTheme.titleSmall?.copyWith(
                    fontWeight: FontWeight.w600,
                    color: AppColors.inkStrong,
                  ),
            ),
            const SizedBox(width: AppSpacing.xs),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
              decoration: BoxDecoration(
                color: AppColors.surfaceMuted,
                borderRadius: BorderRadius.circular(8),
              ),
              child: Text(
                '$count',
                style: const TextStyle(
                  fontSize: 11,
                  fontWeight: FontWeight.w600,
                  color: AppColors.inkSubtle,
                ),
              ),
            ),
            const Spacer(),
            Icon(
              collapsed
                  ? Icons.keyboard_arrow_down_rounded
                  : Icons.keyboard_arrow_up_rounded,
              size: 20,
              color: AppColors.inkSubtle,
            ),
          ],
        ),
      ),
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
    this.onAcceptConnection,
    this.onRejectConnection,
  });

  final MobileNotificationItem item;
  final bool busy;
  final String actionLabel;
  final VoidCallback onOpen;
  final VoidCallback onClear;
  final VoidCallback? onAcceptConnection;
  final VoidCallback? onRejectConnection;

  IconData _icon() {
    switch (item.kind) {
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

  @override
  Widget build(BuildContext context) {
    final icon = _icon();

    return SectionCard(
      variant: item.unread
          ? ServiqSurfaceVariant.highlight
          : ServiqSurfaceVariant.flat,
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
                  color: item.unread
                      ? AppColors.verifiedSoft
                      : AppColors.surfaceMuted,
                  borderRadius: BorderRadius.circular(14),
                ),
                child: Icon(
                  icon,
                  color: item.unread ? AppColors.verified : AppColors.inkSubtle,
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
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
                              color: AppColors.accent,
                              shape: BoxShape.circle,
                            ),
                          ),
                      ],
                    ),
                    const SizedBox(height: 2),
                    Text(
                      item.message,
                      style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                            color: AppColors.inkSubtle,
                          ),
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            children: [
              TrustBadge(label: _kindLabel(item.kind)),
              const Spacer(),
              Text(
                item.timeLabel,
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.inkSubtle,
                    ),
              ),
            ],
          ),
          if (onAcceptConnection != null && onRejectConnection != null) ...[
            const SizedBox(height: AppSpacing.md),
            Row(
              children: [
                Expanded(
                  child: FilledButton.tonalIcon(
                    onPressed: busy ? null : onAcceptConnection,
                    icon: const Icon(Icons.check_rounded, size: 18),
                    label: const Text('Accept'),
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: OutlinedButton.icon(
                    onPressed: busy ? null : onRejectConnection,
                    icon: const Icon(Icons.close_rounded, size: 18),
                    label: const Text('Decline'),
                  ),
                ),
              ],
            ),
          ],
          const SizedBox(height: AppSpacing.md),
          ServiqActionBar(
            primaryLabel: actionLabel,
            primaryIcon: Icons.open_in_new_rounded,
            onPrimary: busy ? null : onOpen,
            secondaryActions: [
              ServiqCompactAction(
                icon: Icons.delete_outline_rounded,
                tooltip: 'Clear notification',
                onPressed: busy ? null : onClear,
              ),
            ],
          ),
        ],
      ),
    );
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
}
