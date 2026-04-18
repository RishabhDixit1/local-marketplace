import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/section_header.dart';
import '../data/feed_repository.dart';
import '../domain/feed_snapshot.dart';

class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({
    super.key,
    this.snapshotOverride,
    this.pageTitle = 'Explore',
    this.initialScope = MobileFeedScope.all,
  });

  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;
  final String pageTitle;
  final MobileFeedScope initialScope;

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  late MobileFeedScope _scope;
  final Set<String> _filters = <String>{};
  RealtimeChannel? _feedChannel;
  SupabaseClient? _client;

  @override
  void initState() {
    super.initState();
    _scope = widget.initialScope;
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
        setState(() => _query = value.trim().toLowerCase());
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> snapshot =
        widget.snapshotOverride ?? ref.watch(feedSnapshotProvider(_scope));

    return Scaffold(
      appBar: AppBar(
        title: Text(widget.pageTitle),
        actions: [
          IconButton(
            onPressed: () => context.push(AppRoutes.notifications),
            icon: const Icon(Icons.notifications_none_rounded),
          ),
          IconButton(
            onPressed: () => context.push(AppRoutes.chat),
            icon: const Icon(Icons.chat_bubble_outline_rounded),
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
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
                      hintText: 'Search by title, category, or locality',
                      onChanged: _onQueryChanged,
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
                        ((item.averageRating ?? 0) < 4.5 || item.reviewCount < 1)) {
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

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      LayoutBuilder(
                        builder: (context, constraints) {
                          final width = (constraints.maxWidth - 12) / 2;
                          return Wrap(
                            spacing: 12,
                            runSpacing: 12,
                            children: [
                              SizedBox(
                                width: width,
                                child: MetricTile(
                                  label: 'Total',
                                  value: data.stats.total.toString(),
                                  icon: Icons.public_rounded,
                                ),
                              ),
                              SizedBox(
                                width: width,
                                child: MetricTile(
                                  label: 'Urgent',
                                  value: data.stats.urgent.toString(),
                                  icon: Icons.priority_high_rounded,
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: 16),
                      SectionHeader(
                        title: 'Live local feed',
                        subtitle:
                            '${items.length} results matched your current view.',
                      ),
                      const SizedBox(height: 12),
                      if (items.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'No matches in this view',
                            message:
                                'Try removing a filter or widening from Connected to All.',
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

class _FeedLoadingState extends StatelessWidget {
  const _FeedLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => Padding(
          padding: const EdgeInsets.only(bottom: 12),
          child: SectionCard(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 18, width: 180),
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
