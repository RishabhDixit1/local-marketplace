import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

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
  RealtimeChannel? _channel;
  bool _busy = false;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _bindRealtime();
    });
  }

  @override
  void dispose() {
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
    final notifications = ref.watch(notificationListProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Notifications'),
        actions: [
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
