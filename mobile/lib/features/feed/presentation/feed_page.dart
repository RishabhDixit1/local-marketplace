import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/auth/auth_state_controller.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/section_header.dart';
import '../../inbox/data/chat_repository.dart';
import '../data/feed_repository.dart';
import '../domain/feed_snapshot.dart';

enum FeedPageMode {
  welcome,
  explore;

  MobileFeedScope get scope =>
      this == FeedPageMode.welcome ? MobileFeedScope.connected : MobileFeedScope.all;

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
  });

  final FeedPageMode mode;
  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;

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
  RealtimeChannel? _feedChannel;
  SupabaseClient? _client;

  @override
  void initState() {
    super.initState();
    _scope = widget.mode.scope;
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    _subscribeToRealtime();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    if (_client != null && _feedChannel != null) {
      _client!.removeChannel(_feedChannel!);
    }
    super.dispose();
  }

  void _subscribeToRealtime() {
    final client = _client;
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
        .subscribe();
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

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> snapshot =
        widget.snapshotOverride ??
        ref.watch(feedSnapshotProvider(_scope));
    final previewData = snapshot.asData?.value;

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.mode.title),
        actions: [
          IconButton(
            onPressed: () => context.push(AppRoutes.people),
            icon: const Icon(Icons.people_alt_outlined),
            onPressed: () => context.push(AppRoutes.search),
            icon: const Icon(Icons.search_rounded),
          ),
          IconButton(
            onPressed: () => context.push(AppRoutes.notifications),
            icon: const Icon(Icons.notifications_none_rounded),
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
                      'Local discovery with stronger trust cues.',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Find nearby needs, services, and products without losing local context.',
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
                    if (previewData != null && previewData.items.isNotEmpty) ...[
                      const SizedBox(height: 16),
                      Text(
                        'Live local feed',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        'Marketplace feed',
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
                  final items = data.items.where((item) {
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
                        ((item.averageRating ?? 0) < 4.5 ||
                            item.reviewCount < 1)) {
                      return false;
                    }
                    if (_query.isEmpty) {
                      return true;
                    }
                    final haystack = [
                      item.title,
                      item.description,
                      item.category,
                      item.creatorName,
                      item.locationLabel,
                    ].join(' ').toLowerCase();
                    return haystack.contains(_query);
                  }).toList();
                  final items = _filterItems(data.items);

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
                              onPrimaryTap: item.providerId.trim().isEmpty
                                  ? null
                                  : () => context.push(
                                      AppRoutes.provider(item.providerId),
                                    ),
                              onSecondaryTap: item.providerId.trim().isEmpty
                                  ? null
                                  : () => context.push(
                                      '${AppRoutes.chat}?recipientId=${item.providerId}',
                                    ),
                              primaryLabel: 'Open',
                              secondaryLabel: 'Contact',
                              onPrimaryTap: item.helpRequestId == null
                                  ? () {
                                      if (item.providerId.trim().isEmpty) {
                                        return;
                                      }
                                      context.push(
                                        AppRoutes.provider(item.providerId),
                                      );
                                    }
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
