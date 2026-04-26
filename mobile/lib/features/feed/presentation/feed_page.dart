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
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';
import '../../inbox/data/chat_repository.dart';
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

  String get title =>
      this == FeedPageMode.welcome ? 'Your network feed' : 'Explore';

  String get searchHint => this == FeedPageMode.welcome
      ? 'Search your network feed'
      : 'Search the live marketplace';

  String get heroTitle => this == FeedPageMode.welcome
      ? 'Stay close to the people already around you.'
      : 'Local Help Marketplace for Everyday Needs.';

  String get heroMessage => this == FeedPageMode.welcome
      ? 'Track nearby needs, trusted providers, and fast follow-up across your connected ServiQ network.'
      : 'Browse fresh requests, services, and products with the same mobile workflow powering the marketplace.';
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
              _FeedHero(
                mode: widget.mode,
                onPrimaryAction: _openPostTask,
                onSecondaryAction: () => context.push(AppRoutes.search),
              ),
              const SizedBox(height: 16),
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      widget.mode == FeedPageMode.explore
                          ? 'Explore the live marketplace by intent.'
                          : 'Local discovery with stronger trust cues.',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      widget.mode == FeedPageMode.explore
                          ? 'Requests, trusted providers, services, products, and urgent work stay separated so the next action is obvious.'
                          : 'Find nearby needs, services, and products without losing local context.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    AppSearchField(
                      controller: _searchController,
                      hintText: widget.mode.searchHint,
                      onChanged: _onQueryChanged,
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        ChoiceChip(
                          label: const Text('Marketplace'),
                          selected: true,
                          onSelected: (_) {},
                        ),
                        ChoiceChip(
                          label: const Text('People'),
                          selected: false,
                          onSelected: (_) => context.push(AppRoutes.people),
                        ),
                      ],
                    ),
                    const SizedBox(height: 12),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: MobileFeedScope.values.map((scope) {
                        return ChoiceChip(
                          label: Text(scope.label),
                          selected: _scope == scope,
                          onSelected: (_) => setState(() => _scope = scope),
                        );
                      }).toList(),
                    ),
                    const SizedBox(height: 12),
                    FilterChipGroup<String>(
                      options: const [
                        FilterOption(value: 'verified', label: 'Verified'),
                        FilterOption(value: 'urgent', label: 'Urgent'),
                        FilterOption(value: 'media', label: 'Media'),
                        FilterOption(value: 'top_rated', label: 'Top rated'),
                      ],
                      selectedValues: _filters,
                      onChanged: (next) => setState(() {
                        _filters
                          ..clear()
                          ..addAll(next);
                      }),
                    ),
                    if (previewData != null &&
                        widget.mode == FeedPageMode.explore) ...[
                      const SizedBox(height: 16),
                      _ExploreLaneSummary(
                        stats: previewData.stats,
                        providerCount:
                            peopleSnapshot?.asData?.value.people.length ?? 0,
                        previewData.items.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Live local feed',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        previewData.items.first.title,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        previewData.items.first.category,
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                    ],
                  ],
                ),
              ),
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
                          '${AppRoutes.chat}?recipientId=${person.id}',
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
                              onPrimaryTap: item.helpRequestId == null
                                  ? item.providerId.trim().isEmpty
                                        ? null
                                        : () => context.push(
                                            AppRoutes.provider(item.providerId),
                                          )
                                  : () => _sendInterest(item),
                              onSecondaryTap: item.providerId.trim().isEmpty
                                  ? null
                                  : () => _openChat(item),
                              primaryLabel: item.helpRequestId == null
                                  ? 'Open profile'
                                  : item.viewerHasExpressedInterest
                                  ? 'Withdraw interest'
                                  : 'Express interest',
                              secondaryLabel: _busyFeedActionId == item.id
                                  ? 'Working...'
                                  : 'Message',
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

class _FeedHero extends StatelessWidget {
  const _FeedHero({
    required this.mode,
    required this.onPrimaryAction,
    required this.onSecondaryAction,
  });

  final FeedPageMode mode;
  final VoidCallback onPrimaryAction;
  final VoidCallback onSecondaryAction;

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(24),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B1F33), Color(0xFF1D4ED8), Color(0xFF0EA5A4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            mode.heroTitle,
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            mode.heroMessage,
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          const SizedBox(height: 18),
          Row(
            children: [
              Expanded(
                child: FilledButton.icon(
                  onPressed: onPrimaryAction,
                  icon: const Icon(Icons.bolt_rounded),
                  label: const Text('Post a Need'),
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: SecondaryButton(
                  label: 'Search nearby',
                  onPressed: onSecondaryAction,
                ),
              ),
            ],
          ),
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

class _ExploreLaneSummary extends StatelessWidget {
  const _ExploreLaneSummary({required this.stats, required this.providerCount});

  final MobileFeedStats stats;
  final int providerCount;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final width = (constraints.maxWidth - gap) / 2;
        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: [
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Requests',
                value: stats.demand.toString(),
                icon: Icons.handyman_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Providers',
                value: providerCount.toString(),
                icon: Icons.people_outline_rounded,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Services',
                value: stats.service.toString(),
                icon: Icons.design_services_outlined,
              ),
            ),
            SizedBox(
              width: width,
              child: MetricTile(
                label: 'Urgent',
                value: stats.urgent.toString(),
                icon: Icons.flash_on_rounded,
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
    final services = items
        .where((item) => item.type == MobileFeedItemType.service)
        .take(3)
        .toList();
    final products = items
        .where((item) => item.type == MobileFeedItemType.product)
        .take(3)
        .toList();
    final visiblePeople = people.take(3).toList();
    final hasAnyFeed =
        urgent.isNotEmpty ||
        requests.isNotEmpty ||
        services.isNotEmpty ||
        products.isNotEmpty;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        const SectionCard(child: _ExploreRankingContext()),
        const SizedBox(height: 16),
        if (!hasAnyFeed && visiblePeople.isEmpty)
          const SectionCard(
            child: EmptyStateView(
              title: 'No matching marketplace lanes',
              message:
                  'Broaden the search or clear a filter to bring requests, providers, services, and products back into view.',
            ),
          )
        else ...[
          if (urgent.isNotEmpty) ...[
            _ExploreFeedLane(
              title: 'Urgent nearby',
              subtitle:
                  'Open requests with stronger time pressure and fast follow-up potential.',
              items: urgent,
              cardBuilder: feedCardBuilder,
            ),
            const SizedBox(height: 18),
          ],
          _ExploreFeedLane(
            title: 'Requests',
            subtitle:
                'People nearby who need help, ranked by local fit and trust context.',
            items: requests,
            cardBuilder: feedCardBuilder,
            emptyTitle: 'No open requests in this view',
          ),
          const SizedBox(height: 18),
          _ExploreProviderLane(
            people: visiblePeople,
            peopleSnapshot: peopleSnapshot,
            onOpenPeople: onOpenPeople,
            onRetryPeople: onRetryPeople,
            providerCardBuilder: providerCardBuilder,
          ),
          const SizedBox(height: 18),
          _ExploreFeedLane(
            title: 'Services',
            subtitle:
                'Provider offers you can compare by response speed, proof, and distance.',
            items: services,
            cardBuilder: feedCardBuilder,
            emptyTitle: 'No services match these filters',
          ),
          const SizedBox(height: 18),
          _ExploreFeedLane(
            title: 'Products',
            subtitle:
                'Local products with provider identity and marketplace trust signals attached.',
            items: products,
            cardBuilder: feedCardBuilder,
            emptyTitle: 'No products match these filters',
          ),
        ],
      ],
    );
  }
}

class _ExploreRankingContext extends StatelessWidget {
  const _ExploreRankingContext();

  @override
  Widget build(BuildContext context) {
    return Row(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Container(
          width: 40,
          height: 40,
          decoration: BoxDecoration(
            color: AppColors.primarySoft,
            borderRadius: BorderRadius.circular(AppRadii.md),
          ),
          child: const Icon(
            Icons.verified_user_outlined,
            color: AppColors.primary,
          ),
        ),
        const SizedBox(width: 12),
        Expanded(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Text(
                'Trust-first marketplace',
                style: Theme.of(context).textTheme.titleMedium,
              ),
              const SizedBox(height: 6),
              Text(
                'Each lane favors nearby relevance, urgent intent, profile proof, response speed, and trusted network activity.',
                style: Theme.of(context).textTheme.bodyMedium,
              ),
            ],
          ),
        ),
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
              message:
                  'Clear a filter or search a broader category to widen this lane.',
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
          title: 'Providers',
          subtitle:
              'Nearby people with trust, availability, proof, and service context.',
          actionLabel: 'People',
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
              message:
                  'Requests, services, and products are still available while provider discovery catches up.',
              onRetry: onRetryPeople,
            ),
          )
        else if (people.isEmpty)
          SectionCard(
            child: EmptyStateView(
              title: 'No providers match these filters',
              message:
                  'Open People to browse the wider local provider directory.',
              actionLabel: 'Open People',
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
