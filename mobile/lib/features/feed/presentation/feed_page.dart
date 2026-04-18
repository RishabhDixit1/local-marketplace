import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
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

  Future<void> _refresh() async {
    ref.invalidate(feedSnapshotProvider(_scope));
    await ref.read(feedSnapshotProvider(_scope).future);
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> snapshot =
        widget.snapshotOverride ?? ref.watch(feedSnapshotProvider(_scope));
    final viewportWidth = MediaQuery.sizeOf(context).width;
    final horizontalPadding = switch (viewportWidth) {
      < 360 => 14.0,
      < 430 => 16.0,
      _ => 20.0,
    };

    return Scaffold(
      appBar: AppBar(title: Text(widget.pageTitle)),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: EdgeInsets.fromLTRB(
              horizontalPadding,
              12,
              horizontalPadding,
              28,
            ),
            children: [
              _FeedHero(
                scope: _scope,
                onScopeChanged: (scope) => setState(() => _scope = scope),
              ),
              const SizedBox(height: 16),
              snapshot.when(
                data: (data) => Column(
                  children: [
                    _StatsRow(stats: data.stats),
                    const SizedBox(height: 16),
                    if (data.items.isEmpty)
                      const SectionCard(child: _EmptyFeedState())
                    else
                      ...data.items.map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: 14),
                          child: _FeedCard(item: item),
                        ),
                      ),
                  ],
                ),
                loading: () => Column(
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
                ),
                error: (error, stackTrace) =>
                    SectionCard(child: _FeedErrorState(error: error)),
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
  }
}

class _FeedScopeSelector extends StatelessWidget {
  const _FeedScopeSelector({
    required this.scope,
    required this.compact,
    required this.onScopeChanged,
  });

  final MobileFeedScope scope;
  final bool compact;
  final ValueChanged<MobileFeedScope> onScopeChanged;

  @override
  Widget build(BuildContext context) {
    if (!compact) {
      return SegmentedButton<MobileFeedScope>(
        segments: MobileFeedScope.values
            .map(
              (entry) => ButtonSegment<MobileFeedScope>(
                value: entry,
                label: Text(entry.label),
                icon: Icon(
                  entry == MobileFeedScope.connected
                      ? Icons.people_alt_rounded
                      : Icons.public_rounded,
                ),
              ),
            )
            .toList(),
        selected: {scope},
        showSelectedIcon: false,
        style: SegmentedButton.styleFrom(
          foregroundColor: Colors.white,
          backgroundColor: Colors.white.withValues(alpha: 0.06),
          selectedBackgroundColor: Colors.white.withValues(alpha: 0.2),
          side: BorderSide(color: Colors.white.withValues(alpha: 0.12)),
        ),
        onSelectionChanged: (selection) => onScopeChanged(selection.first),
      );
    }

    return Column(
      children: MobileFeedScope.values.map((entry) {
        final selected = entry == scope;

        return Padding(
          padding: EdgeInsets.only(
            bottom: entry == MobileFeedScope.values.last ? 0 : 10,
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(18),
              onTap: () => onScopeChanged(entry),
              child: AnimatedContainer(
                duration: const Duration(milliseconds: 160),
                width: double.infinity,
                padding: const EdgeInsets.symmetric(
                  horizontal: 16,
                  vertical: 14,
                ),
                decoration: BoxDecoration(
                  color: Colors.white.withValues(alpha: selected ? 0.18 : 0.06),
                  borderRadius: BorderRadius.circular(18),
                  border: Border.all(
                    color: Colors.white.withValues(
                      alpha: selected ? 0.24 : 0.12,
                    ),
                  ),
                ),
                child: Row(
                  children: [
                    Icon(
                      entry == MobileFeedScope.connected
                          ? Icons.people_alt_rounded
                          : Icons.public_rounded,
                      color: Colors.white,
                    ),
                    const SizedBox(width: 12),
                    Expanded(
                      child: Text(
                        entry.label,
                        style: Theme.of(
                          context,
                        ).textTheme.labelLarge?.copyWith(color: Colors.white),
                      ),
                    ),
                    if (selected)
                      const Icon(
                        Icons.check_circle_rounded,
                        size: 18,
                        color: Colors.white,
                      ),
                  ],
                ),
              ),
            ),
          ),
        );
      }).toList(),
    );
  }
}

class _StatsRow extends StatelessWidget {
  const _StatsRow({required this.stats});

  final MobileFeedStats stats;

  @override
  Widget build(BuildContext context) {
    final entries = [
      ('Total', stats.total),
      ('Urgent', stats.urgent),
      ('Needs', stats.demand),
      ('Services', stats.service),
      ('Products', stats.product),
    ];

    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final columns = switch (constraints.maxWidth) {
          >= 760 => 5,
          >= 520 => 3,
          _ => 2,
        };
        final tileWidth =
            (constraints.maxWidth - (gap * (columns - 1))) / columns;

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: entries
              .map(
                (entry) => SizedBox(
                  width: tileWidth,
                  child: _StatCard(label: entry.$1, value: entry.$2),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _StatCard extends StatelessWidget {
  const _StatCard({required this.label, required this.value});

  final String label;
  final int value;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
      decoration: BoxDecoration(
        color: Colors.white,
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            label,
            style: Theme.of(
              context,
            ).textTheme.bodySmall?.copyWith(fontWeight: FontWeight.w700),
          ),
          const SizedBox(height: 6),
          Text(
            value.toString(),
            style: Theme.of(
              context,
            ).textTheme.titleLarge?.copyWith(fontSize: 22),
          ),
        ],
      ),
    );
  }
}

class _FeedCard extends StatelessWidget {
  const _FeedCard({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    final compact = MediaQuery.sizeOf(context).width < 360;
    final contentPadding = compact ? 14.0 : 18.0;

    return SectionCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _FeedVisual(item: item, compact: compact),
          Padding(
            padding: EdgeInsets.fromLTRB(
              contentPadding,
              contentPadding,
              contentPadding,
              contentPadding,
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    _FeedTag(label: item.type.label),
                    _FeedTag(label: item.category),
                    if (item.urgent)
                      const _FeedTag(
                        label: 'Urgent',
                        background: Color(0xFF0B1F33),
                        foreground: Colors.white,
                      ),
                    if (item.mediaCount > 0)
                      _FeedTag(label: '${item.mediaCount} media'),
                  ],
                ),
                const SizedBox(height: 14),
                Text(item.title, style: Theme.of(context).textTheme.titleLarge),
                const SizedBox(height: 8),
                Text(
                  item.description,
                  style: Theme.of(context).textTheme.bodyMedium,
                ),
                const SizedBox(height: 16),
                _FeedMetaGrid(
                  entries: [
                    (icon: Icons.person_rounded, label: item.creatorName),
                    (
                      icon: Icons.location_on_outlined,
                      label: item.distanceLabel,
                    ),
                    (icon: Icons.payments_outlined, label: item.priceLabel),
                    (icon: Icons.schedule_rounded, label: item.timeLabel),
                  ],
                ),
                const SizedBox(height: 16),
                Container(
                  width: double.infinity,
                  padding: const EdgeInsets.symmetric(
                    horizontal: 14,
                    vertical: 12,
                  ),
                  decoration: BoxDecoration(
                    color: const Color(0xFFF8FAFC),
                    borderRadius: BorderRadius.circular(18),
                    border: Border.all(color: const Color(0xFFE2E8F0)),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.track_changes_rounded, size: 18),
                      const SizedBox(width: 10),
                      Expanded(
                        child: Text(
                          'Current state: ${item.statusLabel}',
                          style: Theme.of(context).textTheme.bodyMedium
                              ?.copyWith(fontWeight: FontWeight.w700),
                        ),
                      ),
                    ],
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

class _FeedTag extends StatelessWidget {
  const _FeedTag({
    required this.label,
    this.background = const Color(0xFFE0F2FE),
    this.foreground = const Color(0xFF0B1F33),
  });

  final String label;
  final Color background;
  final Color foreground;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: BoxConstraints(
        maxWidth: MediaQuery.sizeOf(context).width * 0.72,
      ),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
        decoration: BoxDecoration(
          color: background,
          borderRadius: BorderRadius.circular(999),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(
            context,
          ).textTheme.labelLarge?.copyWith(color: foreground),
        ),
      ),
    );
  }
}

class _FeedMetaGrid extends StatelessWidget {
  const _FeedMetaGrid({required this.entries});

  final List<({IconData icon, String label})> entries;

  @override
  Widget build(BuildContext context) {
    return LayoutBuilder(
      builder: (context, constraints) {
        const gap = 10.0;
        final columns = constraints.maxWidth < 360 ? 1 : 2;
        final tileWidth = columns == 1
            ? constraints.maxWidth
            : (constraints.maxWidth - gap) / columns;

        return Wrap(
          spacing: gap,
          runSpacing: gap,
          children: entries
              .map(
                (entry) => SizedBox(
                  width: tileWidth,
                  child: _MetaPill(icon: entry.icon, label: entry.label),
                ),
              )
              .toList(),
        );
      },
    );
  }
}

class _FeedVisual extends StatelessWidget {
  const _FeedVisual({required this.item, required this.compact});

  final MobileFeedItem item;
  final bool compact;

  @override
  Widget build(BuildContext context) {
    final topRadius = Radius.circular(compact ? 24 : 28);

    if (item.hasMedia) {
      return Container(
        height: compact ? 156 : 170,
        width: double.infinity,
        decoration: BoxDecoration(
          borderRadius: BorderRadius.vertical(top: topRadius),
          gradient: const LinearGradient(
            colors: [Color(0xFF0B1F33), Color(0xFF11466A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: compact ? -10 : -16,
              top: compact ? -4 : -10,
              child: Container(
                width: compact ? 96 : 120,
                height: compact ? 96 : 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.08),
                ),
              ),
            ),
            Padding(
              padding: EdgeInsets.all(compact ? 16 : 18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  const Icon(Icons.collections_rounded, color: Colors.white),
                  const SizedBox(height: 8),
                  Text(
                    '${item.mediaCount} attached files',
                    style: Theme.of(context).textTheme.titleMedium?.copyWith(
                      color: Colors.white,
                      fontSize: compact ? 16 : null,
                    ),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'This is the media-rich card variant for posts that include images or supporting files.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontSize: compact ? 11.5 : null,
                      color: Colors.white.withValues(alpha: 0.84),
                    ),
                    maxLines: compact ? 2 : 3,
                    overflow: TextOverflow.ellipsis,
                  ),
                ],
              ),
            ),
          ],
        ),
      );
    }

    return Container(
      width: double.infinity,
      padding: EdgeInsets.fromLTRB(
        compact ? 16 : 18,
        compact ? 16 : 18,
        compact ? 16 : 18,
        compact ? 16 : 18,
      ),
      decoration: BoxDecoration(
        borderRadius: BorderRadius.vertical(top: topRadius),
        gradient: const LinearGradient(
          colors: [Color(0xFFF8FAFC), Color(0xFFE0F2FE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ConstrainedBox(
            constraints: BoxConstraints(
              maxWidth: MediaQuery.sizeOf(context).width * 0.56,
            ),
            child: Container(
              padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
              decoration: BoxDecoration(
                color: const Color(0xFF0B1F33),
                borderRadius: BorderRadius.circular(999),
              ),
              child: Text(
                'Text-only post',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(color: Colors.white),
              ),
            ),
          ),
          const SizedBox(height: 14),
          Text(
            'Clean and intentional for pure text workflows.',
            style: Theme.of(context).textTheme.titleMedium,
          ),
          const SizedBox(height: 6),
          Text(
            'This variant prevents text-only needs from feeling like a broken media card.',
            style: Theme.of(context).textTheme.bodySmall,
          ),
        ],
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(18),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Icon(icon, size: 16),
          const SizedBox(width: 8),
          Expanded(
            child: Text(label, maxLines: 2, overflow: TextOverflow.ellipsis),
          ),
        ],
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

    return Column(
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
    );
  }
}

class _EmptyFeedState extends StatelessWidget {
  const _EmptyFeedState();

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('No items yet', style: Theme.of(context).textTheme.titleLarge),
        const SizedBox(height: 10),
        Text(
          'Once the community feed returns items for this account, they will appear here with mobile-specific card layouts for media-rich and text-only posts.',
          style: Theme.of(context).textTheme.bodyMedium,
        ),
      ],
    );
  }
}
