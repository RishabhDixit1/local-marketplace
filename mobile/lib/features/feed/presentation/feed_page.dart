import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/auth/auth_state_controller.dart';
import '../../inbox/data/chat_repository.dart';
import '../../notifications/data/notification_repository.dart';
import '../data/feed_repository.dart';
import '../domain/feed_snapshot.dart';

enum FeedPageMode {
  welcome,
  explore;

  MobileFeedScope get scope =>
      this == FeedPageMode.welcome ? MobileFeedScope.connected : MobileFeedScope.all;

  String get searchHint => this == FeedPageMode.welcome
      ? 'Search your network feed'
      : 'Search the live marketplace';

  String get feedLabel =>
      this == FeedPageMode.welcome ? 'Connected feed' : 'Marketplace feed';
}

class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({
    super.key,
    this.snapshotOverride,
    this.pageTitle = 'Explore',
    this.initialScope = MobileFeedScope.all,
    this.mode = FeedPageMode.explore,
    this.snapshotOverride,
  });

  final FeedPageMode mode;
  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;
  final String pageTitle;
  final MobileFeedScope initialScope;

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
  late MobileFeedScope _scope;
  RealtimeChannel? _feedChannel;

  AppBootstrap? _readBootstrap() {
    try {
      return ref.read(appBootstrapProvider);
    } catch (_) {
      return null;
    }
  }

  @override
  void initState() {
    super.initState();
    _scope = widget.initialScope;
    _subscribeToRealtime();
  }

  @override
  void dispose() {
    final client = _readBootstrap()?.client;
    final channel = _feedChannel;
    if (client != null && channel != null) {
      client.removeChannel(channel);
    }
    super.dispose();
  }

  void _subscribeToRealtime() {
    final client = _readBootstrap()?.client;
    if (client == null) {
      return;
    }

    void invalidateFeed() {
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.connected));
    }

    _feedChannel = client
        .channel('mobile-explore-feed')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'posts',
          callback: (_) => invalidateFeed(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'help_requests',
          callback: (_) => invalidateFeed(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'service_listings',
          callback: (_) => invalidateFeed(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'product_catalog',
          callback: (_) => invalidateFeed(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'connection_requests',
          callback: (_) => invalidateFeed(),
        )
        .subscribe();
  }
  final TextEditingController _searchController = TextEditingController();
  String _searchQuery = '';
  String? _busyFeedActionId;

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(feedSnapshotProvider(widget.mode.scope));
    await ref.read(feedSnapshotProvider(widget.mode.scope).future);
  }

  Future<void> _openPostTask() async {
    final posted = await context.push<bool>('/app/post-task');
    if (posted == true && mounted) {
      await _refresh();
    }
  }

  Future<void> _sendInterest(MobileFeedItem item) async {
    final helpRequestId = item.helpRequestId;
    if (helpRequestId == null || _busyFeedActionId != null) {
      return;
    }

    setState(() {
      _busyFeedActionId = item.id;
    });

    try {
      if (item.viewerHasExpressedInterest) {
        await ref.read(feedRepositoryProvider).withdrawInterest(helpRequestId);
      } else {
        await ref.read(feedRepositoryProvider).expressInterest(helpRequestId);
      }

      ref.invalidate(feedSnapshotProvider(widget.mode.scope));
      await ref.read(feedSnapshotProvider(widget.mode.scope).future);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            item.viewerHasExpressedInterest
                ? 'Interest withdrawn.'
                : 'Interest sent. The requester will review it shortly.',
          ),
        ),
      );
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
          _busyFeedActionId = null;
        });
      }
    }
  }

  Future<void> _openChat(MobileFeedItem item) async {
    if (_busyFeedActionId != null || item.providerId.trim().isEmpty) {
      return;
    }

    final userId = ref.read(currentSessionProvider).asData?.value?.user.id ?? '';
    if (userId.isNotEmpty && item.providerId == userId) {
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('This is your own post.')));
      return;
    }

    setState(() {
      _busyFeedActionId = item.id;
    });

    try {
      final conversationId = await ref
          .read(chatRepositoryProvider)
          .getOrCreateDirectConversation(recipientId: item.providerId);
      if (!mounted) {
        return;
      }
      context.push('/app/inbox/$conversationId');
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
          _busyFeedActionId = null;
        });
      }
    }
  }

  List<MobileFeedItem> _filterItems(List<MobileFeedItem> items) {
    final query = _searchQuery.trim().toLowerCase();
    if (query.isEmpty) {
      return items;
    }

    return items.where((item) {
      final haystack = [
        item.title,
        item.description,
        item.category,
        item.creatorName,
        item.locationLabel,
        item.priceLabel,
      ].join(' ').toLowerCase();
      return haystack.contains(query);
    }).toList();
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> snapshot =
        widget.snapshotOverride ?? ref.watch(feedSnapshotProvider(widget.mode.scope));
    final conversations = ref.watch(conversationListProvider).asData?.value ?? const [];
    final unreadChatCount = conversations.fold<int>(
      0,
      (count, item) => count + item.unreadCount,
    );
    final unreadNotifications = ref.watch(unreadNotificationCountProvider);
    final session = ref.watch(currentSessionProvider).asData?.value;
    final currentUser = session?.user;

    return Scaffold(
      appBar: AppBar(title: Text(widget.pageTitle)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(14, 12, 14, 28),
            children: [
              _DashboardTopBar(
                userLabel: _displayLabelForUser(currentUser),
                onInbox: () => context.push('/app/inbox'),
                onExplore: () => context.go('/app/explore'),
                onTasks: () => context.go('/app/tasks'),
                onNotifications: () => context.push('/app/notifications'),
                onAccount: () => context.go('/app/control'),
                unreadChatCount: unreadChatCount,
                unreadNotificationCount: unreadNotifications,
              ),
              const SizedBox(height: 16),
              _DashboardSearchBar(
                controller: _searchController,
                hintText: widget.mode.searchHint,
                query: _searchQuery,
                onChanged: (value) => setState(() => _searchQuery = value),
                onClear: () {
                  _searchController.clear();
                  setState(() => _searchQuery = '');
                },
              ),
              const SizedBox(height: 16),
              snapshot.when(
                data: (data) {
                  final filteredItems = _filterItems(data.items);
                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _WelcomeHeroCard(
                        mode: widget.mode,
                        liveCount: data.stats.total,
                        onPrimaryAction: _openPostTask,
                        onSecondaryAction: () => context.go('/app/people'),
                      ),
                      const SizedBox(height: 14),
                      _FeedSummaryRow(
                        mode: widget.mode,
                        total: data.stats.total,
                        urgent: data.stats.urgent,
                        itemCount: filteredItems.length,
                        searchActive: _searchQuery.trim().isNotEmpty,
                      ),
                      const SizedBox(height: 12),
                      if (filteredItems.isEmpty)
                        _FeedEmptyState(
                          mode: widget.mode,
                          searchQuery: _searchQuery,
                        )
                      else
                        ...filteredItems.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: _FeedStoryCard(
                              item: item,
                              busy: _busyFeedActionId == item.id,
                              onPrimaryAction:
                                  item.isDemand &&
                                      item.helpRequestId != null &&
                                      item.providerId != data.currentUserId &&
                                      !item.isClosed
                                  ? () => _sendInterest(item)
                                  : null,
                              onChatAction:
                                  item.providerId.isNotEmpty &&
                                      item.providerId != data.currentUserId
                                  ? () => _openChat(item)
                                  : null,
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => Column(
                  children: [
                    _WelcomeHeroCard(
                      mode: widget.mode,
                      liveCount: 0,
                      onPrimaryAction: _openPostTask,
                      onSecondaryAction: () => context.go('/app/people'),
                    ),
                    const SizedBox(height: 14),
                    ...List.generate(
                      3,
                      (_) => const Padding(
                        padding: EdgeInsets.only(bottom: 14),
                        child: _LoadingFeedCard(),
                      ),
                    ),
                  ],
                ),
                error: (error, _) => _FeedErrorState(error: error),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _FeedHero extends StatelessWidget {
  const _FeedHero({required this.scope, required this.onScopeChanged});

  final MobileFeedScope scope;
  final ValueChanged<MobileFeedScope> onScopeChanged;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 360;

    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(compact ? 26 : 32),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B1F33), Color(0xFF11466A), Color(0xFF0EA5A4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: EdgeInsets.all(compact ? 18 : 22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Nearby demand, trusted providers, faster response.',
            style: Theme.of(context).textTheme.headlineSmall?.copyWith(
              color: Colors.white,
              fontSize: compact ? 23 : null,
              height: 1.12,
            ),
          ),
          const SizedBox(height: 8),
          Text(
            'Browse the same marketplace data as the web app, with one shared backend for demand, services, products, and trust signals.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              fontSize: compact ? 13 : null,
              height: 1.45,
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          SizedBox(height: compact ? 14 : 18),
          _FeedScopeSelector(
            scope: scope,
            compact: compact,
            onScopeChanged: onScopeChanged,
          ),
        ],
      ),
    );
String _displayLabelForUser(User? user) {
  final metadataName = user?.userMetadata?['name'];
  if (metadataName is String && metadataName.trim().isNotEmpty) {
    return metadataName.trim();
  }
  final email = user?.email?.trim() ?? '';
  if (email.isNotEmpty) {
    return email.split('@').first;
  }
  return 'ServiQ';
}

class _DashboardTopBar extends StatelessWidget {
  const _DashboardTopBar({
    required this.userLabel,
    required this.onInbox,
    required this.onExplore,
    required this.onTasks,
    required this.onNotifications,
    required this.onAccount,
    required this.unreadChatCount,
    required this.unreadNotificationCount,
  });

  final String userLabel;
  final VoidCallback onInbox;
  final VoidCallback onExplore;
  final VoidCallback onTasks;
  final VoidCallback onNotifications;
  final VoidCallback onAccount;
  final int unreadChatCount;
  final int unreadNotificationCount;

  @override
  Widget build(BuildContext context) {
    return Row(
      children: [
        Container(
          width: 46,
          height: 46,
          decoration: BoxDecoration(
            color: const Color(0xFFF4F8FD),
            borderRadius: BorderRadius.circular(16),
            border: Border.all(color: const Color(0xFFD9E4EF)),
          ),
          alignment: Alignment.center,
          child: Stack(
            clipBehavior: Clip.none,
            children: [
              Center(
                child: Text(
                  userLabel.trim().isEmpty
                      ? 'S'
                      : userLabel.trim()[0].toUpperCase(),
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontSize: 20,
                  ),
                ),
              ),
              const Positioned(
                right: -1,
                bottom: -1,
                child: CircleAvatar(
                  radius: 5,
                  backgroundColor: Color(0xFF4FD1C5),
                ),
              ),
            ],
          ),
        ),
        const Spacer(),
        Wrap(
          spacing: 8,
          children: [
            _TopIconButton(
              icon: Icons.chat_bubble_outline_rounded,
              onTap: onInbox,
              badgeCount: unreadChatCount,
            ),
            _TopIconButton(
              icon: Icons.explore_outlined,
              onTap: onExplore,
            ),
            _TopIconButton(
              icon: Icons.assignment_outlined,
              onTap: onTasks,
            ),
            _TopIconButton(
              icon: Icons.notifications_none_rounded,
              onTap: onNotifications,
              badgeCount: unreadNotificationCount,
            ),
            _TopIconButton(
              icon: Icons.person_outline_rounded,
              onTap: onAccount,
            ),
          ],
        ),
      ],
    );
  }
}

class _TopIconButton extends StatelessWidget {
  const _TopIconButton({
    required this.icon,
    required this.onTap,
    this.badgeCount = 0,
  });

  final IconData icon;
  final VoidCallback onTap;
  final int badgeCount;

  @override
  Widget build(BuildContext context) {
    return Stack(
      clipBehavior: Clip.none,
      children: [
        Material(
          color: Colors.white,
          borderRadius: BorderRadius.circular(14),
          child: InkWell(
            borderRadius: BorderRadius.circular(14),
            onTap: onTap,
            child: Ink(
              width: 42,
              height: 42,
              decoration: BoxDecoration(
                borderRadius: BorderRadius.circular(14),
                border: Border.all(color: const Color(0xFFD9E4EF)),
              ),
              child: Icon(icon, size: 20, color: const Color(0xFF0F172A)),
            ),
          ),
        ),
        if (badgeCount > 0)
          Positioned(
            top: -5,
            right: -4,
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 5, vertical: 2),
              decoration: BoxDecoration(
                color: const Color(0xFFF43F5E),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                badgeCount > 9 ? '9+' : '$badgeCount',
                style: Theme.of(context).textTheme.labelSmall?.copyWith(
                  color: Colors.white,
                  fontWeight: FontWeight.w800,
                ),
              ),
            ),
          ),
      ],
    );
  }
}

class _DashboardSearchBar extends StatelessWidget {
  const _DashboardSearchBar({
    required this.controller,
    required this.hintText,
    required this.query,
    required this.onChanged,
    required this.onClear,
  });

  final TextEditingController controller;
  final String hintText;
  final String query;
  final ValueChanged<String> onChanged;
  final VoidCallback onClear;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: const Color(0xFFF4F7FB),
        borderRadius: BorderRadius.circular(24),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        children: [
          Expanded(
            child: TextField(
              controller: controller,
              onChanged: onChanged,
              decoration: InputDecoration(
                hintText: hintText,
                prefixIcon: const Icon(Icons.search_rounded),
                suffixIcon: query.trim().isEmpty
                    ? null
                    : IconButton(
                        onPressed: onClear,
                        icon: const Icon(Icons.close_rounded),
                      ),
                fillColor: Colors.white,
                contentPadding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
              ),
            ),
          ),
          const SizedBox(width: 10),
          Container(
            width: 42,
            height: 42,
            decoration: BoxDecoration(
              color: const Color(0xFF0F172A),
              borderRadius: BorderRadius.circular(14),
            ),
            child: const Icon(Icons.auto_awesome_rounded, color: Colors.white),
          ),
        ],
      ),
    );
  }
}

class _WelcomeHeroCard extends StatelessWidget {
  const _WelcomeHeroCard({
    required this.mode,
    required this.liveCount,
    required this.onPrimaryAction,
    required this.onSecondaryAction,
  });

  final FeedPageMode mode;
  final int liveCount;
  final VoidCallback onPrimaryAction;
  final VoidCallback onSecondaryAction;

  @override
  Widget build(BuildContext context) {
    final statusLabel = liveCount > 0 ? '$liveCount posts live' : 'Feed syncing';

    return Card(
      child: Container(
        decoration: BoxDecoration(
          borderRadius: BorderRadius.circular(28),
          gradient: const LinearGradient(
            colors: [Color(0xFFFFFFFF), Color(0xFFF7FAFC)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              left: -24,
              top: -12,
              child: Container(
                width: 110,
                height: 110,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFF67E8F9).withValues(alpha: 0.10),
                ),
              ),
            ),
            Positioned(
              right: -18,
              bottom: -18,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: const Color(0xFFFDE68A).withValues(alpha: 0.14),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Wrap(
                    spacing: 8,
                    runSpacing: 8,
                    crossAxisAlignment: WrapCrossAlignment.center,
                    children: [
                      Text(
                        'SERVIQ',
                        style: Theme.of(context).textTheme.labelLarge?.copyWith(
                          letterSpacing: 1.4,
                          color: const Color(0xFF11466A),
                        ),
                      ),
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 10,
                          vertical: 5,
                        ),
                        decoration: BoxDecoration(
                          color: const Color(0xFFE6FFFB),
                          borderRadius: BorderRadius.circular(999),
                          border: Border.all(
                            color: const Color(0xFFB2F5EA),
                          ),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Container(
                              width: 7,
                              height: 7,
                              decoration: const BoxDecoration(
                                shape: BoxShape.circle,
                                color: Color(0xFF14B8A6),
                              ),
                            ),
                            const SizedBox(width: 6),
                            Text(
                              statusLabel,
                              style: Theme.of(context)
                                  .textTheme
                                  .labelLarge
                                  ?.copyWith(
                                    fontSize: 11,
                                    color: const Color(0xFF0F766E),
                                  ),
                            ),
                          ],
                        ),
                      ),
                    ],
                  ),
                  const SizedBox(height: 10),
                  Text(
                    'Local Help Marketplace for Everyday Needs.',
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: 6),
                  Text(
                    'Connecting people with Human-Centered Services Near You!',
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: const Color(0xFF64748B),
                    ),
                  ),
                  const SizedBox(height: 8),
                  Text(
                    mode == FeedPageMode.welcome
                        ? 'Post what you need. Someone nearby will help.'
                        : 'Explore what is active nearby across the wider marketplace.',
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: const Color(0xFF475569),
                    ),
                  ),
                  const SizedBox(height: 16),
                  SizedBox(
                    width: double.infinity,
                    child: FilledButton.icon(
                      onPressed: onPrimaryAction,
                      icon: const Icon(Icons.flash_on_rounded, size: 18),
                      label: const Text('Post a Need'),
                    ),
                  ),
                  const SizedBox(height: 10),
                  SizedBox(
                    width: double.infinity,
                    child: OutlinedButton.icon(
                      onPressed: onSecondaryAction,
                      icon: const Icon(Icons.people_alt_outlined, size: 18),
                      label: const Text('Earn Nearby'),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedSummaryRow extends StatelessWidget {
  const _FeedSummaryRow({
    required this.mode,
    required this.total,
    required this.urgent,
    required this.itemCount,
    required this.searchActive,
  });

  final FeedPageMode mode;
  final int total;
  final int urgent;
  final int itemCount;
  final bool searchActive;

  @override
  Widget build(BuildContext context) {
    final searchText = searchActive ? '$itemCount match this search' : '$itemCount visible now';

    return Row(
      children: [
        Expanded(
          child: Text(
            '${mode.feedLabel} • $searchText',
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              fontWeight: FontWeight.w700,
            ),
          ),
        ),
        if (urgent > 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFFFEEF2),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$urgent urgent',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: const Color(0xFFE11D48),
                fontSize: 11,
              ),
            ),
          ),
        if (total > 0 && urgent == 0)
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
            decoration: BoxDecoration(
              color: const Color(0xFFE8F6F8),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              '$total live',
              style: Theme.of(context).textTheme.labelLarge?.copyWith(
                color: const Color(0xFF0F766E),
                fontSize: 11,
              ),
            ),
          ),
      ],
    );
  }
}

class _FeedStoryCard extends StatelessWidget {
  const _FeedStoryCard({
    required this.item,
    required this.busy,
    required this.onPrimaryAction,
    required this.onChatAction,
  });

  final MobileFeedItem item;
  final bool busy;
  final VoidCallback? onPrimaryAction;
  final VoidCallback? onChatAction;

  @override
  Widget build(BuildContext context) {
    return Card(
      child: Padding(
        padding: const EdgeInsets.all(16),
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
                    shape: BoxShape.circle,
                    color: const Color(0xFF1E293B),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    item.creatorName.isEmpty
                        ? 'S'
                        : item.creatorName[0].toUpperCase(),
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                ),
                const SizedBox(width: 12),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        item.creatorName,
                        style: Theme.of(context).textTheme.titleMedium?.copyWith(
                          fontWeight: FontWeight.w800,
                        ),
                      ),
                      const SizedBox(height: 3),
                      Wrap(
                        spacing: 8,
                        runSpacing: 4,
                        children: [
                          Text(
                            item.timeLabel,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          Text(
                            item.distanceLabel,
                            style: Theme.of(context).textTheme.bodySmall,
                          ),
                          if (item.urgent)
                            Text(
                              'Urgent',
                              style: Theme.of(context)
                                  .textTheme
                                  .bodySmall
                                  ?.copyWith(color: const Color(0xFFE11D48)),
                            ),
                        ],
                      ),
                    ],
                  ),
                ),
                const Icon(Icons.more_vert_rounded, color: Color(0xFF94A3B8)),
              ],
            ),
            const SizedBox(height: 14),
            _StoryPreviewCard(item: item),
            const SizedBox(height: 14),
            Text(
              item.title,
              style: Theme.of(context).textTheme.titleLarge?.copyWith(
                fontSize: 24,
                fontWeight: FontWeight.w800,
              ),
            ),
            const SizedBox(height: 8),
            Text(
              item.description,
              style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                height: 1.45,
              ),
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: [
                _ChipTag(
                  label: item.type.label,
                  background: const Color(0xFFFFEEF2),
                  foreground: const Color(0xFFE11D48),
                ),
                _ChipTag(label: item.category),
                _ChipTag(label: item.priceLabel),
                _ChipTag(label: item.statusLabel),
              ],
            ),
            if (onPrimaryAction != null || onChatAction != null) ...[
              const SizedBox(height: 16),
              Row(
                children: [
                  if (onPrimaryAction != null)
                    Expanded(
                      child: FilledButton(
                        onPressed: busy ? null : onPrimaryAction,
                        child: busy
                            ? const SizedBox(
                                width: 18,
                                height: 18,
                                child: CircularProgressIndicator(
                                  strokeWidth: 2,
                                  color: Colors.white,
                                ),
                              )
                            : Text(
                                item.viewerHasExpressedInterest
                                    ? 'Withdraw Interest'
                                    : 'Express Interest',
                              ),
                      ),
                    ),
                  if (onPrimaryAction != null && onChatAction != null)
                    const SizedBox(width: 10),
                  if (onChatAction != null)
                    Expanded(
                      child: OutlinedButton.icon(
                        onPressed: busy ? null : onChatAction,
                        icon: const Icon(Icons.chat_bubble_outline_rounded),
                        label: const Text('Chat'),
                      ),
                    ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }
}

class _StoryPreviewCard extends StatelessWidget {
  const _StoryPreviewCard({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        color: const Color(0xFFFFFBF5),
        border: Border.all(color: const Color(0xFFF1E7D9)),
      ),
      child: Stack(
        children: [
          Positioned(
            right: -18,
            top: -16,
            child: Container(
              width: 90,
              height: 90,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFF9E8C7).withValues(alpha: 0.55),
              ),
            ),
          ),
          Positioned(
            left: -18,
            bottom: -18,
            child: Container(
              width: 84,
              height: 84,
              decoration: BoxDecoration(
                shape: BoxShape.circle,
                color: const Color(0xFFF7EDE0).withValues(alpha: 0.65),
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(16),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    borderRadius: BorderRadius.circular(10),
                    color: const Color(0xFFF5A623),
                  ),
                  alignment: Alignment.center,
                  child: Text(
                    item.creatorName.isEmpty
                        ? 'S'
                        : item.creatorName[0].toUpperCase(),
                    style: Theme.of(context).textTheme.labelLarge?.copyWith(
                      color: Colors.white,
                    ),
                  ),
                ),
                const SizedBox(height: 10),
                Text(
                  item.type == MobileFeedItemType.demand ? 'DEMAND' : item.type.label.toUpperCase(),
                  style: Theme.of(context).textTheme.labelSmall?.copyWith(
                    color: const Color(0xFFF59E0B),
                    letterSpacing: 0.9,
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 8),
                Text(
                  item.title,
                  maxLines: 2,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.titleLarge?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: 6),
                Text(
                  item.creatorName,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
                const SizedBox(height: 16),
                Container(
                  height: 10,
                  width: double.infinity,
                  decoration: BoxDecoration(
                    color: const Color(0xFFF1F5F9),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                const SizedBox(height: 10),
                Container(
                  height: 6,
                  width: 72,
                  decoration: BoxDecoration(
                    color: const Color(0xFFCBD5E1),
                    borderRadius: BorderRadius.circular(999),
                  ),
                ),
                const SizedBox(height: 14),
                Align(
                  alignment: Alignment.bottomRight,
                  child: Container(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 8,
                      vertical: 5,
                    ),
                    decoration: BoxDecoration(
                      color: const Color(0xFFFFF5E6),
                      borderRadius: BorderRadius.circular(999),
                    ),
                    child: Text(
                      item.urgent ? 'Urgent live card' : 'Live network card',
                      style: Theme.of(context).textTheme.labelSmall?.copyWith(
                        color: const Color(0xFFF59E0B),
                        fontWeight: FontWeight.w800,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ChipTag extends StatelessWidget {
  const _ChipTag({
    required this.label,
    this.background = const Color(0xFFF1F5F9),
    this.foreground = const Color(0xFF475569),
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: background == const Color(0xFFF1F5F9)
            ? const Color(0xFFE2E8F0)
            : background),
      ),
      child: Text(
        label,
        style: Theme.of(context).textTheme.labelLarge?.copyWith(
          color: foreground,
          fontSize: 11,
        ),
      ),
    );
  }
}

class _LoadingFeedCard extends StatelessWidget {
  const _LoadingFeedCard();

  @override
  Widget build(BuildContext context) {
    return Card(
      child: SizedBox(
        height: 240,
        child: Center(
          child: CircularProgressIndicator(
            color: Theme.of(context).colorScheme.primary,
          ),
        ),
      ),
    );
  }
}

class _FeedErrorState extends StatelessWidget {
  const _FeedErrorState({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    final message = switch (error) {
      ApiException apiError => apiError.message,
      _ => error.toString(),
    };

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              'The feed could not load yet',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(message, style: Theme.of(context).textTheme.bodyMedium),
            const SizedBox(height: 10),
            Text(
              'If you are signed in but still see this, check API_BASE_URL and confirm the authenticated Next.js deployment is reachable from the device.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ],
        ),
      ),
    );
  }
}

class _FeedEmptyState extends StatelessWidget {
  const _FeedEmptyState({
    required this.mode,
    required this.searchQuery,
  });

  final FeedPageMode mode;
  final String searchQuery;

  @override
  Widget build(BuildContext context) {
    final isSearching = searchQuery.trim().isNotEmpty;

    return Card(
      child: Padding(
        padding: const EdgeInsets.all(20),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text(
              isSearching
                  ? 'No live cards match your search'
                  : mode == FeedPageMode.welcome
                  ? 'Your connected feed is still warming up'
                  : 'No marketplace cards yet',
              style: Theme.of(context).textTheme.titleLarge,
            ),
            const SizedBox(height: 10),
            Text(
              isSearching
                  ? 'Try a different title, category, location, or owner name.'
                  : mode == FeedPageMode.welcome
                  ? 'Once accepted connections and nearby requests are available, they will start showing up here with the same live workflow you use on web.'
                  : 'Pull to refresh or post a new need to get the marketplace moving.',
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ),
      ),
    );
  }
}
