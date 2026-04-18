import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../../feed/data/feed_repository.dart';
import '../../feed/domain/feed_snapshot.dart';

class WelcomePage extends ConsumerStatefulWidget {
  const WelcomePage({super.key, this.snapshotOverride});

  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;

  @override
  ConsumerState<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends ConsumerState<WelcomePage> {
  final _searchController = TextEditingController();
  String _query = '';
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
    _searchController.addListener(_handleSearchChanged);
    _subscribeToRealtime();
  }

  @override
  void dispose() {
    _searchController
      ..removeListener(_handleSearchChanged)
      ..dispose();
    final client = _readBootstrap()?.client;
    final channel = _feedChannel;
    if (client != null && channel != null) {
      client.removeChannel(channel);
    }
    super.dispose();
  }

  void _handleSearchChanged() {
    setState(() {
      _query = _searchController.text;
    });
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
        .channel('mobile-welcome-feed')
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
    ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
    await ref.read(feedSnapshotProvider(MobileFeedScope.all).future);
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> snapshot =
        widget.snapshotOverride ??
        ref.watch(feedSnapshotProvider(MobileFeedScope.all));

    return Scaffold(
      appBar: AppBar(
        title: const Text('Welcome'),
        actions: [
          IconButton(
            onPressed: () => context.go('/app/create'),
            icon: const Icon(Icons.add_circle_outline_rounded),
            tooltip: 'Post a need',
          ),
        ],
      ),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
            children: [
              snapshot.when(
                data: (data) {
                  final filteredItems = data.items.where((item) {
                    final normalizedQuery = _query.trim().toLowerCase();
                    if (normalizedQuery.isEmpty) {
                      return true;
                    }

                    final haystack = [
                      item.title,
                      item.description,
                      item.category,
                      item.creatorName,
                      item.locationLabel,
                    ].join(' ').toLowerCase();

                    return haystack.contains(normalizedQuery);
                  }).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _WelcomeHero(snapshot: data),
                      const SizedBox(height: 16),
                      TextField(
                        controller: _searchController,
                        textInputAction: TextInputAction.search,
                        decoration: const InputDecoration(
                          labelText: 'Search your network feed',
                          hintText: 'Need, service, product, or location',
                          prefixIcon: Icon(Icons.search_rounded),
                        ),
                      ),
                      const SizedBox(height: 18),
                      if (filteredItems.isEmpty)
                        const SectionCard(child: _WelcomeEmptyState())
                      else
                        ...filteredItems.take(8).map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(bottom: 14),
                            child: _WelcomeFeedCard(item: item),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _WelcomeLoadingState(),
                error: (error, stackTrace) =>
                    SectionCard(child: _WelcomeErrorState(error: error)),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _WelcomeHero extends StatelessWidget {
  const _WelcomeHero({required this.snapshot});

  final MobileFeedSnapshot snapshot;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            crossAxisAlignment: WrapCrossAlignment.center,
            spacing: 10,
            runSpacing: 10,
            children: [
              Text(
                'SERVIQ',
                style: Theme.of(context).textTheme.labelLarge?.copyWith(
                  letterSpacing: 2,
                  fontWeight: FontWeight.w900,
                  color: const Color(0xFF475569),
                ),
              ),
              _WelcomeStatPill(
                label: '${snapshot.stats.total} posts live',
                background: const Color(0xFFDCFCE7),
                foreground: const Color(0xFF166534),
              ),
            ],
          ),
          const SizedBox(height: 14),
          Text(
            'Local Help Marketplace for Everyday Needs',
            style: Theme.of(context).textTheme.headlineSmall,
          ),
          const SizedBox(height: 8),
          Text(
            'Connecting people with human-centered services near you, with one live backend shared across web and mobile.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 18),
          SizedBox(
            width: double.infinity,
            child: FilledButton.icon(
              onPressed: () => context.go('/app/create'),
              icon: const Icon(Icons.bolt_rounded),
              label: const Text('Post a Need'),
            ),
          ),
          const SizedBox(height: 10),
          SizedBox(
            width: double.infinity,
            child: OutlinedButton.icon(
              onPressed: () => context.go('/app/people'),
              icon: const Icon(Icons.people_alt_rounded),
              label: const Text('Earn Nearby'),
            ),
          ),
        ],
      ),
    );
  }
}

class _WelcomeFeedCard extends StatelessWidget {
  const _WelcomeFeedCard({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _WelcomeStatPill(
                label: item.type.label,
                background: const Color(0xFFE0F2FE),
                foreground: const Color(0xFF0B1F33),
              ),
              _WelcomeStatPill(
                label: item.timeLabel,
                background: const Color(0xFFF8FAFC),
                foreground: const Color(0xFF475569),
              ),
              if (item.urgent)
                const _WelcomeStatPill(
                  label: 'Urgent',
                  background: Color(0xFFFEE2E2),
                  foreground: Color(0xFFB91C1C),
                ),
            ],
          ),
          const SizedBox(height: 14),
          Text(item.creatorName, style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 10),
          Text(item.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(item.description, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 14),
          Wrap(
            spacing: 10,
            runSpacing: 10,
            children: [
              _WelcomeMetaPill(
                icon: Icons.place_outlined,
                label: item.distanceLabel,
              ),
              _WelcomeMetaPill(
                icon: Icons.sell_outlined,
                label: item.priceLabel,
              ),
              _WelcomeMetaPill(
                icon: Icons.category_outlined,
                label: item.category,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _WelcomeMetaPill extends StatelessWidget {
  const _WelcomeMetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 16, color: const Color(0xFF334155)),
          const SizedBox(width: 8),
          Text(label, style: Theme.of(context).textTheme.bodySmall),
        ],
      ),
    );
  }
}

class _WelcomeStatPill extends StatelessWidget {
  const _WelcomeStatPill({
    required this.label,
    required this.background,
    required this.foreground,
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
      decoration: BoxDecoration(
        color: background,
        borderRadius: BorderRadius.circular(999),
      ),
      child: Text(
        label,
        style: Theme.of(
          context,
        ).textTheme.bodySmall?.copyWith(color: foreground, fontWeight: FontWeight.w700),
      ),
    );
  }
}

class _WelcomeEmptyState extends StatelessWidget {
  const _WelcomeEmptyState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('No matches right now', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 8),
        Text(
          'Try a different search, post a new need, or open Explore to browse more of the network.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}

class _WelcomeLoadingState extends StatelessWidget {
  const _WelcomeLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(
        3,
        (index) => const Padding(
          padding: EdgeInsets.only(bottom: 14),
          child: SectionCard(
            child: SizedBox(
              height: 180,
              child: Center(child: CircularProgressIndicator()),
            ),
          ),
        ),
      ),
    );
  }
}

class _WelcomeErrorState extends StatelessWidget {
  const _WelcomeErrorState({required this.error});

  final Object error;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(
          'Unable to load welcome right now',
          style: Theme.of(context).textTheme.titleLarge,
        ),
        const SizedBox(height: 8),
        Text(error.toString(), style: Theme.of(context).textTheme.bodyMedium),
      ],
    );
  }
}
