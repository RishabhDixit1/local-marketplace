import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/auth/auth_state_controller.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../cart/application/cart_notifier.dart';
import '../../cart/presentation/cart_sheet.dart';
import '../../orders/domain/order_models.dart';
import '../../profile/data/profile_repository.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/marketplace_guidance.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';
import '../../chat/data/chat_repository.dart';
import '../../people/data/people_repository.dart';
import '../../people/domain/people_snapshot.dart';
import '../../tasks/data/task_repository.dart';
import '../../tasks/domain/task_snapshot.dart';
import '../data/feed_repository.dart';
import '../domain/feed_snapshot.dart';

enum FeedPageMode {
  welcome,
  explore;

  MobileFeedScope get scope => this == FeedPageMode.welcome
      ? MobileFeedScope.connected
      : MobileFeedScope.all;

  String get title => this == FeedPageMode.welcome ? 'Home' : 'Find Help';

  String get searchHint => this == FeedPageMode.welcome
      ? 'What do you need?'
      : 'Search services, requests, or areas';

  String get heroTitle => this == FeedPageMode.welcome
      ? 'What do you need?'
      : 'Find local help nearby.';

  String get heroMessage => this == FeedPageMode.welcome
      ? 'Post a need, find providers, and track active work.'
      : 'Browse requests, services, products, and trusted providers.';
}

class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({
    super.key,
    this.mode = FeedPageMode.explore,
    this.snapshotOverride,
    this.peopleOverride,
  });

  final FeedPageMode mode;
  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;
  final AsyncValue<MobilePeopleSnapshot>? peopleOverride;

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  late MobileFeedScope _scope;
  final Set<String> _filters = <String>{};
  String? _busyFeedActionId;

  @override
  void initState() {
    super.initState();
    _scope = widget.mode.scope;
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(feedSnapshotProvider(_scope));
    await ref.read(feedSnapshotProvider(_scope).future);
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () {
      if (mounted) {
        setState(() => _query = value.trim());
      }
    });
  }

  Future<void> _openPostTask() async {
    final posted = await context.push<bool>(AppRoutes.createNeed);
    if (posted == true && mounted) {
      await _refresh();
    }
  }

  MobileCheckoutItem _checkoutLineFromFeed(MobileFeedItem item) {
    final type = item.type == MobileFeedItemType.product
        ? 'product'
        : 'service';
    return MobileCheckoutItem(
      providerId: item.providerId,
      itemType: type,
      itemId: item.id,
      title: item.title,
      price: item.price,
      quantity: 1,
      providerName: item.creatorName,
    );
  }

  void _showListingActionsSheet(MobileFeedItem item) {
    final currentUserId =
        ref.read(currentSessionProvider).asData?.value?.user.id ?? '';
    if (currentUserId.isNotEmpty && item.providerId == currentUserId) {
      ServiqToast.show(
        context,
        message: 'This is your own listing.',
        tone: ServiqToastTone.warning,
      );
      return;
    }

    ServiqBottomSheet.show<void>(
      context: context,
      title: item.title,
      subtitle: 'Choose how to continue with this listing.',
      children: [
        ListTile(
          leading: const Icon(Icons.add_shopping_cart_outlined),
          title: const Text('Add to cart'),
          onTap: () async {
            Navigator.of(context).pop();
            final line = _checkoutLineFromFeed(item);
            await ref
                .read(cartProvider.notifier)
                .addListing(line, providerName: item.creatorName);
            if (!mounted) {
              return;
            }
            ServiqToast.show(
              context,
              message: 'Added to cart.',
              tone: ServiqToastTone.success,
            );
          },
        ),
        ListTile(
          leading: const Icon(Icons.payments_outlined),
          title: Text(_checkoutLabelFor(item)),
          onTap: () {
            Navigator.of(context).pop();
            _openCheckout(item);
          },
        ),
        ListTile(
          leading: const Icon(Icons.chat_bubble_outline_rounded),
          title: const Text('Message provider'),
          onTap: () {
            Navigator.of(context).pop();
            _messageActionFor(item)?.call();
          },
        ),
      ],
    );
  }

  VoidCallback? _moreActionFor(MobileFeedItem item) {
    if (item.type != MobileFeedItemType.service &&
        item.type != MobileFeedItemType.product) {
      return null;
    }
    return () => _showListingActionsSheet(item);
  }

  void _openListingDetail(MobileFeedItem item) {
    context.push(
      AppRoutes.listingDetail(item.id, source: item.source.apiValue),
    );
  }

  Future<void> _sendInterest(MobileFeedItem item) async {
    final helpRequestId = item.helpRequestId;
    if (helpRequestId == null || _busyFeedActionId != null) {
      return;
    }

    setState(() => _busyFeedActionId = item.id);
    try {
      if (item.viewerHasExpressedInterest) {
        await ref.read(feedRepositoryProvider).withdrawInterest(helpRequestId);
      } else {
        await ref.read(feedRepositoryProvider).expressInterest(helpRequestId);
      }

      ref.invalidate(feedSnapshotProvider(_scope));
      await ref.read(feedSnapshotProvider(_scope).future);
      if (!mounted) {
        return;
      }

      ServiqToast.show(
        context,
        message: item.viewerHasExpressedInterest
            ? 'Interest withdrawn.'
            : 'Interest sent. The requester will review it shortly.',
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
        setState(() => _busyFeedActionId = null);
      }
    }
  }

  Future<void> _openChat(MobileFeedItem item) async {
    if (_busyFeedActionId != null || item.providerId.trim().isEmpty) {
      return;
    }

    final currentUserId =
        ref.read(currentSessionProvider).asData?.value?.user.id ?? '';
    if (currentUserId.isNotEmpty && item.providerId == currentUserId) {
      ServiqToast.show(
        context,
        message: 'This is your own post.',
        tone: ServiqToastTone.warning,
      );
      return;
    }

    setState(() => _busyFeedActionId = item.id);
    try {
      final conversationId = await ref
          .read(chatRepositoryProvider)
          .ensureConversation(item.providerId);
      if (!mounted) {
        return;
      }
      context.push(
        AppRoutes.chatThreadWithContext(
          conversationId,
          contextTitle: item.title,
          contextTaskId: item.id,
          contextStatus: item.statusLabel,
          source: 'feed_card',
        ),
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
        setState(() => _busyFeedActionId = null);
      }
    }
  }

  List<MobileFeedItem> _filterItems(List<MobileFeedItem> items) {
    return items.where((item) {
      if (_filters.contains('verified') && !item.isVerified) {
        return false;
      }
      if (_filters.contains('urgent') && !item.urgent) {
        return false;
      }
      if (_filters.contains('media') && !item.hasMedia) {
        return false;
      }
      if (_filters.contains('top_rated') &&
          ((item.averageRating ?? 0) < 4.5 || item.reviewCount < 1)) {
        return false;
      }

      final query = _query.trim().toLowerCase();
      if (query.isEmpty) {
        return true;
      }

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

  List<MobilePersonCard> _filterPeople(List<MobilePersonCard> people) {
    return people.where((person) {
      if (_filters.contains('verified') && person.completionPercent < 80) {
        return false;
      }
      if (_filters.contains('top_rated') &&
          ((person.averageRating ?? 0) < 4.5 || person.reviewCount < 1)) {
        return false;
      }

      return person.matchesQuery(_query);
    }).toList();
  }

  VoidCallback? _primaryActionFor(MobileFeedItem item) {
    if (item.helpRequestId == null) {
      if (item.providerId.trim().isEmpty) {
        return null;
      }
      if (item.type == MobileFeedItemType.service ||
          item.type == MobileFeedItemType.product) {
        return () => _openListingDetail(item);
      }
      return () => context.push(AppRoutes.provider(item.providerId));
    }

    return () => _sendInterest(item);
  }

  void _openCheckout(MobileFeedItem item) {
    final currentUserId =
        ref.read(currentSessionProvider).asData?.value?.user.id ?? '';
    if (currentUserId.isNotEmpty && item.providerId == currentUserId) {
      ServiqToast.show(
        context,
        message: 'This is your own listing.',
        tone: ServiqToastTone.warning,
      );
      return;
    }

    context.push(
      AppRoutes.checkoutItem(
        providerId: item.providerId,
        itemType: item.type == MobileFeedItemType.product
            ? 'product'
            : 'service',
        itemId: item.id,
        title: item.title,
        price: item.price,
      ),
    );
  }

  VoidCallback? _messageActionFor(MobileFeedItem item) {
    if (item.providerId.trim().isEmpty) {
      return null;
    }

    return () => _openChat(item);
  }

  String _primaryLabelFor(MobileFeedItem item) {
    if (item.helpRequestId == null) {
      if (item.type == MobileFeedItemType.product) {
        return 'View details';
      }
      if (item.type == MobileFeedItemType.service) {
        return 'View details';
      }
      return 'Open profile';
    }
    if (item.viewerHasExpressedInterest) {
      return 'Withdraw interest';
    }
    return 'Express interest';
  }

  String _checkoutLabelFor(MobileFeedItem item) {
    if (item.type == MobileFeedItemType.product) {
      return 'Order';
    }
    return 'Reserve';
  }

  String _secondaryLabelFor(MobileFeedItem item) {
    if (_busyFeedActionId == item.id) {
      return 'Working...';
    }
    return 'Message';
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> snapshot =
        widget.snapshotOverride ?? ref.watch(feedSnapshotProvider(_scope));
    final AsyncValue<MobilePeopleSnapshot> peopleSnapshot =
        widget.peopleOverride ?? ref.watch(peopleSnapshotProvider);
    final previewData = snapshot.asData?.value;
    final profileSnapshot = ref.watch(profileSnapshotProvider);
    final taskSnapshot = ref.watch(taskSnapshotProvider);
    final chatConversations = ref.watch(chatConversationsProvider);
    final cartAsync = ref.watch(cartProvider);
    final cartCount = cartAsync.value == null
        ? 0
        : cartTotalQuantity(cartAsync.value!);
    final unreadChatCount = chatConversations.maybeWhen(
      data: (conversations) => conversations.fold<int>(
        0,
        (count, conversation) => count + conversation.unreadCount,
      ),
      orElse: () => 0,
    );
    final activeTaskCount = taskSnapshot.maybeWhen(
      data: (tasks) => tasks.items
          .where(
            (item) =>
                item.status == MobileTaskStatus.active ||
                item.status == MobileTaskStatus.inProgress,
          )
          .length,
      orElse: () => 0,
    );

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.mode.title),
        actions: [
          IconButton(
            onPressed: () => context.push(AppRoutes.search),
            icon: const Icon(Icons.search_rounded),
          ),
          IconButton(
            onPressed: () => context.push(AppRoutes.saved),
            icon: const Icon(Icons.bookmarks_outlined),
          ),
          IconButton(
            onPressed: () => showServiqCartSheet(context),
            icon: Badge(
              isLabelVisible: cartCount > 0,
              label: Text('$cartCount'),
              child: const Icon(Icons.shopping_cart_outlined),
            ),
          ),
          IconButton(
            onPressed: () => context.push(AppRoutes.notifications),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
            children: [
              ...profileSnapshot.maybeWhen(
                data: (profile) {
                  if (profile.completionPercent >= 50) {
                    return <Widget>[];
                  }
                  return [
                    SectionCard(
                      child: ListTile(
                        contentPadding: EdgeInsets.zero,
                        leading: Icon(
                          Icons.assignment_turned_in_outlined,
                          color: AppColors.primary,
                        ),
                        title: const Text('Finish your public profile'),
                        subtitle: Text(
                          'You are at ${profile.completionPercent}% — add name, area, and contact so nearby customers trust you faster.',
                          style: Theme.of(context).textTheme.bodySmall,
                        ),
                        trailing: FilledButton.tonal(
                          onPressed: () => context.push(AppRoutes.profile),
                          child: const Text('Go'),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                  ];
                },
                orElse: () => <Widget>[],
              ),
              MarketplaceLoopHero(
                title: widget.mode.heroTitle,
                message: widget.mode.heroMessage,
                searchLabel: widget.mode.searchHint,
                primaryLabel: 'Post Need',
                signalLabels: _exploreHeroSignals(
                  snapshot: previewData,
                  providerCount:
                      peopleSnapshot.asData?.value.people.length ?? 0,
                ),
                onPrimaryTap: _openPostTask,
                onSearchTap: () => context.push(AppRoutes.search),
              ),
              if (widget.mode == FeedPageMode.welcome) ...[
                const SizedBox(height: 16),
                _HomeCommandCenter(
                  snapshot: previewData,
                  people: peopleSnapshot.asData?.value,
                  profileCompletion:
                      profileSnapshot.asData?.value.completionPercent,
                  activeTaskCount: activeTaskCount,
                  unreadChatCount: unreadChatCount,
                  onPostNeed: _openPostTask,
                  onReplyInbox: () => context.push(AppRoutes.chat),
                  onOpenTasks: () => context.go(AppRoutes.tasks),
                  onCompleteProfile: () => context.push(AppRoutes.profile),
                  onFindProvider: () => context.go(AppRoutes.people),
                ),
              ],
              const SizedBox(height: 16),
              _ExploreIntentPanel(
                mode: widget.mode,
                searchController: _searchController,
                scope: _scope,
                filters: _filters,
                onQueryChanged: _onQueryChanged,
                onScopeChanged: (scope) => setState(() => _scope = scope),
                onFiltersChanged: (next) => setState(() {
                  _filters
                    ..clear()
                    ..addAll(next);
                }),
                onOpenPeople: () => context.push(AppRoutes.people),
              ),
              if (previewData != null &&
                  widget.mode == FeedPageMode.explore) ...[
                const SizedBox(height: 16),
                _ExploreLaneSummary(
                  stats: previewData.stats,
                  providerCount:
                      peopleSnapshot.asData?.value.people.length ?? 0,
                  featuredItem: previewData.items.isNotEmpty
                      ? previewData.items.first
                      : null,
                ),
              ],
              const SizedBox(height: 16),
              ServiqAsyncBody<MobileFeedSnapshot>(
                value: snapshot,
                errorTitle: 'Unable to load the feed',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: _refresh,
                loadingBuilder: () => const _FeedLoadingState(),
                data: (data) {
                  final items = _filterItems(data.items);
                  final people = _filterPeople(
                    peopleSnapshot.asData?.value.people ??
                        const <MobilePersonCard>[],
                  );

                  if (widget.mode == FeedPageMode.explore) {
                    return _ExploreMarketplaceLanes(
                      items: items,
                      people: people,
                      peopleSnapshot: peopleSnapshot,
                      viewerRoleFamily: data.viewerRoleFamily,
                      onOpenPeople: () => context.go(AppRoutes.people),
                      onRetryPeople: () {
                        ref.invalidate(peopleSnapshotProvider);
                      },
                      feedCardBuilder: (item) => FeedCard(
                        item: item,
                        onPrimaryTap: _primaryActionFor(item),
                        onSecondaryTap: _messageActionFor(item),
                        primaryLabel: _primaryLabelFor(item),
                        secondaryLabel: _secondaryLabelFor(item),
                        onMoreTap: _moreActionFor(item),
                      ),
                      providerCardBuilder: (person) => ProviderCard(
                        person: person,
                        onOpenProfile: () =>
                            context.push(AppRoutes.provider(person.id)),
                        onMessage: () => context.push(
                          AppRoutes.chatDirect(
                            recipientId: person.id,
                            contextTitle: person.name,
                            source: 'feed_provider_card',
                          ),
                        ),
                      ),
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _FeedMetrics(snapshot: data),
                      const SizedBox(height: 16),
                      SectionHeader(
                        title: widget.mode == FeedPageMode.welcome
                            ? 'Connected feed'
                            : 'Live local feed',
                        subtitle:
                            'Marketplace feed with ${items.length} items matching your current search and filters.',
                      ),
                      const SizedBox(height: 12),
                      if (items.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'No matching posts',
                            message:
                                'Try a broader term or clear one of the active filters to widen the nearby feed.',
                          ),
                        )
                      else
                        ...items.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: FeedCard(
                              item: item,
                              onPrimaryTap: _primaryActionFor(item),
                              onSecondaryTap: _messageActionFor(item),
                              primaryLabel: _primaryLabelFor(item),
                              secondaryLabel: _secondaryLabelFor(item),
                              onMoreTap: _moreActionFor(item),
                            ),
                          ),
                        ),
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
}

List<String> _exploreHeroSignals({
  required MobileFeedSnapshot? snapshot,
  required int providerCount,
}) {
  final stats = snapshot?.stats;
  if (stats == null) {
    return const ['Find help', 'Post need', 'Track tasks'];
  }

  return [
    '${stats.demand} requests',
    '$providerCount providers',
    '${stats.urgent} urgent',
  ];
}

class _ExploreIntentPanel extends StatelessWidget {
  const _ExploreIntentPanel({
    required this.mode,
    required this.searchController,
    required this.scope,
    required this.filters,
    required this.onQueryChanged,
    required this.onScopeChanged,
    required this.onFiltersChanged,
    required this.onOpenPeople,
  });

  final FeedPageMode mode;
  final TextEditingController searchController;
  final MobileFeedScope scope;
  final Set<String> filters;
  final ValueChanged<String> onQueryChanged;
  final ValueChanged<MobileFeedScope> onScopeChanged;
  final ValueChanged<Set<String>> onFiltersChanged;
  final VoidCallback onOpenPeople;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Search and filters',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.md),
          AppSearchField(
            controller: searchController,
            hintText: 'Filter by service, provider, area, or request',
            onChanged: onQueryChanged,
          ),
          const SizedBox(height: AppSpacing.sm),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: MobileFeedScope.values.map((nextScope) {
                    return ChoiceChip(
                      label: Text(nextScope.label),
                      selected: scope == nextScope,
                      onSelected: (_) => onScopeChanged(nextScope),
                    );
                  }).toList(),
                ),
              ),
              const SizedBox(width: AppSpacing.sm),
              SizedBox(
                width: 112,
                child: OutlinedButton.icon(
                  onPressed: onOpenPeople,
                  icon: const Icon(Icons.people_outline_rounded),
                  label: const Text('Find'),
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          FilterChipGroup<String>(
            options: const [
              FilterOption(value: 'urgent', label: 'Urgent'),
              FilterOption(value: 'verified', label: 'Verified'),
              FilterOption(value: 'top_rated', label: 'Top rated'),
              FilterOption(value: 'media', label: 'Media'),
            ],
            selectedValues: filters,
            onChanged: onFiltersChanged,
          ),
        ],
      ),
    );
  }
}

class _ExploreLaneSummary extends StatelessWidget {
  const _ExploreLaneSummary({
    required this.stats,
    required this.providerCount,
    this.featuredItem,
  });

  final MobileFeedStats stats;
  final int providerCount;
  final MobileFeedItem? featuredItem;

  @override
  Widget build(BuildContext context) {
    final item = featuredItem;

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Explore the live marketplace by intent.',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Requests, trusted providers, services, products, and urgent work stay separated so the next action stays obvious.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          LayoutBuilder(
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
                      label: 'Open requests',
                      value: stats.demand.toString(),
                      icon: Icons.flash_on_rounded,
                    ),
                  ),
                  SizedBox(
                    width: width,
                    child: MetricTile(
                      label: 'Trusted providers',
                      value: providerCount.toString(),
                      icon: Icons.people_outline_rounded,
                    ),
                  ),
                ],
              );
            },
          ),
          if (item != null) ...[
            const SizedBox(height: AppSpacing.md),
            Text(
              'Featured nearby',
              style: Theme.of(context).textTheme.titleMedium,
            ),
            const SizedBox(height: AppSpacing.xs),
            Text(
              item.title,
              style: Theme.of(
                context,
              ).textTheme.bodyLarge?.copyWith(fontWeight: FontWeight.w700),
            ),
            const SizedBox(height: 4),
            Text(item.category, style: Theme.of(context).textTheme.bodySmall),
          ],
        ],
      ),
    );
  }
}

class _HomeCommandCenter extends StatelessWidget {
  const _HomeCommandCenter({
    required this.snapshot,
    required this.people,
    required this.profileCompletion,
    required this.activeTaskCount,
    required this.unreadChatCount,
    required this.onPostNeed,
    required this.onReplyInbox,
    required this.onOpenTasks,
    required this.onCompleteProfile,
    required this.onFindProvider,
  });

  final MobileFeedSnapshot? snapshot;
  final MobilePeopleSnapshot? people;
  final int? profileCompletion;
  final int activeTaskCount;
  final int unreadChatCount;
  final VoidCallback onPostNeed;
  final VoidCallback onReplyInbox;
  final VoidCallback onOpenTasks;
  final VoidCallback onCompleteProfile;
  final VoidCallback onFindProvider;

  @override
  Widget build(BuildContext context) {
    final urgentDemand = snapshot?.stats.urgent ?? 0;
    final providerCount = people?.people.length ?? 0;
    final completion = profileCompletion ?? 0;
    final roleFamily = snapshot?.viewerRoleFamily ?? people?.viewerRoleFamily;
    final isProvider = roleFamily == 'provider';
    final action = _homePrimaryAction(
      activeTaskCount: activeTaskCount,
      unreadChatCount: unreadChatCount,
      urgentDemand: urgentDemand,
      completion: completion,
      isProvider: isProvider,
    );
    final attentionItems = <Widget>[
      if (unreadChatCount > 0)
        _CommandMetricTile(
          icon: Icons.mark_chat_unread_outlined,
          value: unreadChatCount.toString(),
          label: 'Inbox',
        ),
      if (activeTaskCount > 0)
        _CommandMetricTile(
          icon: Icons.assignment_turned_in_outlined,
          value: activeTaskCount.toString(),
          label: 'Work',
        ),
      if (urgentDemand > 0)
        _CommandMetricTile(
          icon: Icons.bolt_rounded,
          value: urgentDemand.toString(),
          label: 'Nearby',
        ),
    ];

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Needs attention',
                  style: Theme.of(context).textTheme.titleLarge,
                ),
              ),
              Container(
                padding: const EdgeInsets.symmetric(
                  horizontal: 10,
                  vertical: 7,
                ),
                decoration: BoxDecoration(
                  color: AppColors.accentSoft,
                  borderRadius: BorderRadius.circular(AppRadii.pill),
                ),
                child: Text(
                  isProvider ? 'Provider mode' : 'Buyer mode',
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    color: AppColors.accentDeep,
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
            ],
          ),
          if (attentionItems.isNotEmpty) ...[
            const SizedBox(height: 12),
            SingleChildScrollView(
              scrollDirection: Axis.horizontal,
              child: Row(
                children: attentionItems
                    .map(
                      (item) => Padding(
                        padding: const EdgeInsets.only(right: 10),
                        child: SizedBox(width: 142, child: item),
                      ),
                    )
                    .toList(),
              ),
            ),
            const SizedBox(height: 12),
          ] else
            const SizedBox(height: 12),
          _HomeActionCard(
            title: action.title,
            message: action.message,
            icon: action.icon,
            onTap: switch (action.target) {
              _HomeActionTarget.inbox => onReplyInbox,
              _HomeActionTarget.tasks => onOpenTasks,
              _HomeActionTarget.profile => onCompleteProfile,
              _HomeActionTarget.people => onFindProvider,
              _HomeActionTarget.postNeed => onPostNeed,
            },
          ),
          if (providerCount == 0 || (snapshot?.items.isEmpty ?? false)) ...[
            const SizedBox(height: 12),
            _RoleAwareEmptyHint(
              isProvider: isProvider,
              onPostNeed: onPostNeed,
              onFindProvider: onFindProvider,
            ),
          ],
        ],
      ),
    );
  }
}

class _CommandMetricTile extends StatelessWidget {
  const _CommandMetricTile({
    required this.icon,
    required this.value,
    required this.label,
  });

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 68,
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Container(
            width: 36,
            height: 36,
            decoration: BoxDecoration(
              color: AppColors.surface,
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(icon, color: AppColors.primary, size: 18),
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(value, maxLines: 1, overflow: TextOverflow.ellipsis),
                const SizedBox(height: 1),
                Text(
                  label,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: Theme.of(context).textTheme.bodySmall,
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _HomeActionCard extends StatelessWidget {
  const _HomeActionCard({
    required this.title,
    required this.message,
    required this.icon,
    required this.onTap,
  });

  final String title;
  final String message;
  final IconData icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.ink,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(14),
          child: Row(
            children: [
              Icon(icon, color: Colors.white),
              const SizedBox(width: 12),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      title,
                      style: Theme.of(
                        context,
                      ).textTheme.titleMedium?.copyWith(color: Colors.white),
                    ),
                    const SizedBox(height: 4),
                    Text(
                      message,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: Colors.white.withValues(alpha: 0.74),
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(Icons.arrow_forward_rounded, color: Colors.white),
            ],
          ),
        ),
      ),
    );
  }
}

class _RoleAwareEmptyHint extends StatelessWidget {
  const _RoleAwareEmptyHint({
    required this.isProvider,
    required this.onPostNeed,
    required this.onFindProvider,
  });

  final bool isProvider;
  final VoidCallback onPostNeed;
  final VoidCallback onFindProvider;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: isProvider ? AppColors.warmSoft : AppColors.accentSoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(
            isProvider
                ? Icons.storefront_outlined
                : Icons.person_search_outlined,
            color: isProvider ? AppColors.warmDeep : AppColors.accentDeep,
          ),
          const SizedBox(width: 10),
          Expanded(
            child: Text(
              isProvider
                  ? 'No hot leads yet. Keep your listings fresh and watch urgent nearby demand.'
                  : 'No strong matches yet. Post a specific need or browse trusted providers nearby.',
              style: Theme.of(context).textTheme.bodySmall,
            ),
          ),
          TextButton(
            onPressed: isProvider ? onFindProvider : onPostNeed,
            child: Text(isProvider ? 'People' : 'Post'),
          ),
        ],
      ),
    );
  }
}

enum _HomeActionTarget { inbox, tasks, profile, people, postNeed }

class _HomeAction {
  const _HomeAction({
    required this.title,
    required this.message,
    required this.icon,
    required this.target,
  });

  final String title;
  final String message;
  final IconData icon;
  final _HomeActionTarget target;
}

_HomeAction _homePrimaryAction({
  required int activeTaskCount,
  required int unreadChatCount,
  required int urgentDemand,
  required int completion,
  required bool isProvider,
}) {
  if (unreadChatCount > 0) {
    return const _HomeAction(
      title: 'Reply to inbox',
      message: 'Unread local work conversations need a response.',
      icon: Icons.mark_chat_unread_outlined,
      target: _HomeActionTarget.inbox,
    );
  }
  if (activeTaskCount > 0) {
    return const _HomeAction(
      title: 'Open task board',
      message: 'Track active work, quotes, and next status updates.',
      icon: Icons.assignment_turned_in_outlined,
      target: _HomeActionTarget.tasks,
    );
  }
  if (completion > 0 && completion < 70) {
    return const _HomeAction(
      title: 'Complete profile',
      message: 'Trust signals make hiring and earning feel safer.',
      icon: Icons.verified_user_outlined,
      target: _HomeActionTarget.profile,
    );
  }
  if (isProvider && urgentDemand > 0) {
    return const _HomeAction(
      title: 'Find urgent demand',
      message: 'Nearby requests are waiting for fast provider response.',
      icon: Icons.bolt_rounded,
      target: _HomeActionTarget.people,
    );
  }
  return const _HomeAction(
    title: 'Post a need',
    message:
        'Describe the job once and keep chat, tracking, and payment together.',
    icon: Icons.add_circle_outline_rounded,
    target: _HomeActionTarget.postNeed,
  );
}

class _FeedMetrics extends StatelessWidget {
  const _FeedMetrics({required this.snapshot});

  final MobileFeedSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
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
                label: 'Live requests',
                value: snapshot.stats.demand.toString(),
                icon: Icons.flash_on_rounded,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Urgent now',
                value: snapshot.stats.urgent.toString(),
                icon: Icons.warning_amber_rounded,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Services',
                value: snapshot.stats.service.toString(),
                icon: Icons.design_services_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Products',
                value: snapshot.stats.product.toString(),
                icon: Icons.inventory_2_outlined,
              ),
            ),
          ],
        );
      },
    );
  }
}

class _ExploreMarketplaceLanes extends StatelessWidget {
  const _ExploreMarketplaceLanes({
    required this.items,
    required this.people,
    required this.peopleSnapshot,
    required this.viewerRoleFamily,
    required this.onOpenPeople,
    required this.onRetryPeople,
    required this.feedCardBuilder,
    required this.providerCardBuilder,
  });

  final List<MobileFeedItem> items;
  final List<MobilePersonCard> people;
  final AsyncValue<MobilePeopleSnapshot>? peopleSnapshot;
  final String viewerRoleFamily;
  final VoidCallback onOpenPeople;
  final VoidCallback onRetryPeople;
  final Widget Function(MobileFeedItem item) feedCardBuilder;
  final Widget Function(MobilePersonCard person) providerCardBuilder;

  @override
  Widget build(BuildContext context) {
    final nearbyRequests = items
        .where((item) => item.type == MobileFeedItemType.demand && !item.urgent)
        .take(4)
        .toList();
    final urgentRequests = items.where((item) => item.urgent).take(2).toList();
    final recommendedPeople = people.take(3).toList();
    final fastResponders = people
        .where(
          (person) =>
              person.isOnline ||
              person.activityLabel.toLowerCase().contains('min'),
        )
        .take(3)
        .toList();
    final popularServices =
        items.where((item) => item.type != MobileFeedItemType.demand).toList()
          ..sort((left, right) {
            final leftScore =
                (left.averageRating ?? 0) * 10 +
                left.reviewCount +
                left.completedJobs +
                left.listingCount;
            final rightScore =
                (right.averageRating ?? 0) * 10 +
                right.reviewCount +
                right.completedJobs +
                right.listingCount;
            return rightScore.compareTo(leftScore);
          });
    final hasAnyFeed =
        nearbyRequests.isNotEmpty ||
        urgentRequests.isNotEmpty ||
        recommendedPeople.isNotEmpty ||
        fastResponders.isNotEmpty ||
        popularServices.isNotEmpty;
    final isProvider = viewerRoleFamily == 'provider';

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!hasAnyFeed)
          SectionCard(
            child: EmptyStateView(
              title: isProvider
                  ? 'No matching demand yet'
                  : 'No matching local activity',
              message: isProvider
                  ? 'Clear a filter or broaden the category to find nearby requests, fast buyers, and provider opportunities.'
                  : 'Broaden the search or clear a filter to bring requests, trusted providers, and popular services back into view.',
            ),
          )
        else ...[
          if (urgentRequests.isNotEmpty) ...[
            _ExploreFeedLane(
              title: 'Urgent nearby',
              subtitle: 'Open requests that need a fast response.',
              items: urgentRequests,
              cardBuilder: feedCardBuilder,
            ),
            const SizedBox(height: 18),
          ],
          _ExploreProviderLane(
            title: 'Trusted providers',
            subtitle:
                'Recommended providers ranked by trust, response, proof, and local fit.',
            people: recommendedPeople,
            peopleSnapshot: peopleSnapshot,
            onOpenPeople: onOpenPeople,
            onRetryPeople: onRetryPeople,
            providerCardBuilder: providerCardBuilder,
          ),
          const SizedBox(height: 18),
          _ExploreProviderLane(
            title: 'Fast responders',
            subtitle: 'Available people who can keep a job moving today.',
            people: fastResponders,
            peopleSnapshot: peopleSnapshot,
            onOpenPeople: onOpenPeople,
            onRetryPeople: onRetryPeople,
            providerCardBuilder: providerCardBuilder,
            emptyTitle: 'No fast responders match',
          ),
          const SizedBox(height: 18),
          _ExploreFeedLane(
            title: 'Requests you can act on',
            subtitle: 'Nearby requests you can discuss, quote, and track.',
            items: nearbyRequests,
            cardBuilder: feedCardBuilder,
            emptyTitle: isProvider
                ? 'No open requests in this view'
                : 'No nearby requests in this view',
            emptyMessage: isProvider
                ? 'Clear a filter or check a broader category for provider demand.'
                : 'Post your own need or clear a filter to widen the local feed.',
          ),
          const SizedBox(height: 18),
          _ExploreFeedLane(
            title: 'Popular services',
            subtitle: 'Bookable listings with proof, pricing, and chat.',
            items: popularServices.take(4).toList(),
            cardBuilder: feedCardBuilder,
            emptyTitle: 'No services match these filters',
            emptyMessage:
                'Clear search or open People to browse provider storefronts.',
          ),
        ],
      ],
    );
  }
}

class _ExploreFeedLane extends StatelessWidget {
  const _ExploreFeedLane({
    required this.title,
    required this.subtitle,
    required this.items,
    required this.cardBuilder,
    this.emptyTitle,
    this.emptyMessage,
  });

  final String title;
  final String subtitle;
  final List<MobileFeedItem> items;
  final Widget Function(MobileFeedItem item) cardBuilder;
  final String? emptyTitle;
  final String? emptyMessage;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(title: title, subtitle: subtitle),
        const SizedBox(height: 12),
        if (items.isEmpty)
          SectionCard(
            child: EmptyStateView(
              title: emptyTitle ?? 'Nothing here yet',
              message:
                  emptyMessage ??
                  'Clear a filter or search a broader category.',
            ),
          )
        else
          ...items.map(
            (item) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: cardBuilder(item),
            ),
          ),
      ],
    );
  }
}

class _ExploreProviderLane extends StatelessWidget {
  const _ExploreProviderLane({
    required this.title,
    required this.subtitle,
    required this.people,
    required this.peopleSnapshot,
    required this.onOpenPeople,
    required this.onRetryPeople,
    required this.providerCardBuilder,
    this.emptyTitle,
  });

  final String title;
  final String subtitle;
  final List<MobilePersonCard> people;
  final AsyncValue<MobilePeopleSnapshot>? peopleSnapshot;
  final VoidCallback onOpenPeople;
  final VoidCallback onRetryPeople;
  final Widget Function(MobilePersonCard person) providerCardBuilder;
  final String? emptyTitle;

  @override
  Widget build(BuildContext context) {
    final snapshot = peopleSnapshot;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: title,
          subtitle: subtitle,
          actionLabel: 'Find',
          onAction: onOpenPeople,
        ),
        const SizedBox(height: 12),
        if (snapshot?.isLoading == true)
          const SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LoadingShimmer(height: 18, width: 180),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 220),
              ],
            ),
          )
        else if (snapshot?.hasError == true)
          SectionCard(
            child: ErrorStateView(
              title: 'Provider lane is delayed',
              message: 'Requests and services are still available.',
              onRetry: onRetryPeople,
            ),
          )
        else if (people.isEmpty)
          SectionCard(
            child: EmptyStateView(
              title: emptyTitle ?? 'No providers match these filters',
              message: 'Open Find to browse the wider provider directory.',
              actionLabel: 'Open Find',
              onAction: onOpenPeople,
            ),
          )
        else
          ...people.map(
            (person) => Padding(
              padding: const EdgeInsets.only(bottom: 12),
              child: providerCardBuilder(person),
            ),
          ),
      ],
    );
  }
}

class _FeedLoadingState extends StatelessWidget {
  const _FeedLoadingState();

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
                LoadingShimmer(height: 16, width: 96),
                SizedBox(height: 14),
                LoadingShimmer(height: 22, width: 220),
                SizedBox(height: 10),
                LoadingShimmer(height: 14),
                SizedBox(height: 8),
                LoadingShimmer(height: 14, width: 260),
                SizedBox(height: 16),
                LoadingShimmer(height: 88),
              ],
            ),
          ),
        ),
      ),
    );
  }
}
