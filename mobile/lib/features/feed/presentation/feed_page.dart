import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/auth/auth_state_controller.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('This is your own post.')));
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
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(error.message)));
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
      return () => context.push(AppRoutes.provider(item.providerId));
    }

    return () => _sendInterest(item);
  }

  VoidCallback? _messageActionFor(MobileFeedItem item) {
    if (item.providerId.trim().isEmpty) {
      return null;
    }

    return () => _openChat(item);
  }

  String _primaryLabelFor(MobileFeedItem item) {
    if (item.helpRequestId == null) {
      return 'Open profile';
    }
    if (item.viewerHasExpressedInterest) {
      return 'Withdraw interest';
    }
    return 'Express interest';
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
    final AsyncValue<MobilePeopleSnapshot>? peopleSnapshot =
        widget.mode == FeedPageMode.explore
        ? widget.peopleOverride ?? ref.watch(peopleSnapshotProvider)
        : widget.peopleOverride;
    final previewData = snapshot.asData?.value;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.mode.title),
        actions: [
          IconButton(
            onPressed: () => context.push(AppRoutes.search),
            icon: const Icon(Icons.search_rounded),
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
              MarketplaceLoopHero(
                title: widget.mode.heroTitle,
                message: widget.mode.heroMessage,
                searchLabel: widget.mode.searchHint,
                primaryLabel: 'Post Need',
                signalLabels: _exploreHeroSignals(
                  snapshot: previewData,
                  providerCount:
                      peopleSnapshot?.asData?.value.people.length ?? 0,
                ),
                onPrimaryTap: _openPostTask,
                onSearchTap: () => context.push(AppRoutes.search),
              ),
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
                      peopleSnapshot?.asData?.value.people.length ?? 0,
                  featuredItem: previewData.items.isNotEmpty
                      ? previewData.items.first
                      : null,
                ),
              ],
              const SizedBox(height: 16),
              snapshot.when(
                data: (data) {
                  final items = _filterItems(data.items);
                  final people = _filterPeople(
                    peopleSnapshot?.asData?.value.people ??
                        const <MobilePersonCard>[],
                  );

                  if (widget.mode == FeedPageMode.explore) {
                    return _ExploreMarketplaceLanes(
                      items: items,
                      people: people,
                      peopleSnapshot: peopleSnapshot,
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
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _FeedLoadingState(),
                error: (error, _) => SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load the feed',
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
    required this.onOpenPeople,
    required this.onRetryPeople,
    required this.feedCardBuilder,
    required this.providerCardBuilder,
  });

  final List<MobileFeedItem> items;
  final List<MobilePersonCard> people;
  final AsyncValue<MobilePeopleSnapshot>? peopleSnapshot;
  final VoidCallback onOpenPeople;
  final VoidCallback onRetryPeople;
  final Widget Function(MobileFeedItem item) feedCardBuilder;
  final Widget Function(MobilePersonCard person) providerCardBuilder;

  @override
  Widget build(BuildContext context) {
    final urgent = items.where((item) => item.urgent).take(2).toList();
    final requests = items
        .where((item) => item.type == MobileFeedItemType.demand && !item.urgent)
        .take(4)
        .toList();
    final visiblePeople = people.take(3).toList();
    final hasAnyFeed =
        urgent.isNotEmpty || requests.isNotEmpty || visiblePeople.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        if (!hasAnyFeed)
          const SectionCard(
            child: EmptyStateView(
              title: 'No matching local activity',
              message:
                  'Broaden the search or clear a filter to bring urgent requests, trusted providers, and nearby work back into view.',
            ),
          )
        else ...[
          if (urgent.isNotEmpty) ...[
            _ExploreFeedLane(
              title: 'Urgent nearby',
              subtitle: 'Open requests that need a fast response.',
              items: urgent,
              cardBuilder: feedCardBuilder,
            ),
            const SizedBox(height: 18),
          ],
          _ExploreProviderLane(
            people: visiblePeople,
            peopleSnapshot: peopleSnapshot,
            onOpenPeople: onOpenPeople,
            onRetryPeople: onRetryPeople,
            providerCardBuilder: providerCardBuilder,
          ),
          const SizedBox(height: 18),
          _ExploreFeedLane(
            title: 'Requests you can act on',
            subtitle: 'Nearby needs matched to your area.',
            items: requests,
            cardBuilder: feedCardBuilder,
            emptyTitle: 'No open requests in this view',
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
  });

  final String title;
  final String subtitle;
  final List<MobileFeedItem> items;
  final Widget Function(MobileFeedItem item) cardBuilder;
  final String? emptyTitle;

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
              message: 'Clear a filter or search a broader category.',
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
    required this.people,
    required this.peopleSnapshot,
    required this.onOpenPeople,
    required this.onRetryPeople,
    required this.providerCardBuilder,
  });

  final List<MobilePersonCard> people;
  final AsyncValue<MobilePeopleSnapshot>? peopleSnapshot;
  final VoidCallback onOpenPeople;
  final VoidCallback onRetryPeople;
  final Widget Function(MobilePersonCard person) providerCardBuilder;

  @override
  Widget build(BuildContext context) {
    final snapshot = peopleSnapshot;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Trusted providers',
          subtitle: 'Nearby providers with trust signals.',
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
              title: 'No providers match these filters',
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
