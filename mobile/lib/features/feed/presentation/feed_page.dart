import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../../../core/api/mobile_api_client.dart';
import '../../../core/widgets/section_card.dart';
import '../data/feed_repository.dart';
import '../domain/feed_snapshot.dart';

class FeedPage extends ConsumerStatefulWidget {
  const FeedPage({super.key});

  @override
  ConsumerState<FeedPage> createState() => _FeedPageState();
}

class _FeedPageState extends ConsumerState<FeedPage> {
  MobileFeedScope _scope = MobileFeedScope.all;

  Future<void> _refresh() async {
    ref.invalidate(feedSnapshotProvider(_scope));
    await ref.read(feedSnapshotProvider(_scope).future);
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(feedSnapshotProvider(_scope));

    return Scaffold(
      appBar: AppBar(title: const Text('Marketplace')),
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(20, 12, 20, 28),
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
    return Container(
      decoration: BoxDecoration(
        borderRadius: BorderRadius.circular(32),
        gradient: const LinearGradient(
          colors: [Color(0xFF0B1F33), Color(0xFF11466A), Color(0xFF0EA5A4)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      padding: const EdgeInsets.all(22),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Nearby demand, trusted providers, faster response.',
            style: Theme.of(
              context,
            ).textTheme.headlineSmall?.copyWith(color: Colors.white),
          ),
          const SizedBox(height: 8),
          Text(
            'This feed uses the same authenticated backend routes as the web app, so ranking and workflow logic stay shared across platforms.',
            style: Theme.of(context).textTheme.bodyMedium?.copyWith(
              color: Colors.white.withValues(alpha: 0.84),
            ),
          ),
          const SizedBox(height: 18),
          SegmentedButton<MobileFeedScope>(
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
          ),
        ],
      ),
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

    return Wrap(
      spacing: 10,
      runSpacing: 10,
      children: entries
          .map(
            (entry) => Chip(
              avatar: CircleAvatar(
                radius: 12,
                backgroundColor: Colors.white,
                child: Text(
                  entry.$2.toString(),
                  style: Theme.of(context).textTheme.labelMedium?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
              ),
              label: Text(entry.$1),
            ),
          )
          .toList(),
    );
  }
}

class _FeedCard extends StatelessWidget {
  const _FeedCard({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          _FeedVisual(item: item),
          Padding(
            padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    Chip(label: Text(item.type.label)),
                    Chip(label: Text(item.category)),
                    if (item.urgent) const Chip(label: Text('Urgent')),
                    if (item.mediaCount > 0)
                      Chip(label: Text('${item.mediaCount} media')),
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
                Wrap(
                  spacing: 14,
                  runSpacing: 10,
                  children: [
                    _MetaPill(
                      icon: Icons.person_rounded,
                      label: item.creatorName,
                    ),
                    _MetaPill(
                      icon: Icons.location_on_outlined,
                      label: item.distanceLabel,
                    ),
                    _MetaPill(
                      icon: Icons.payments_outlined,
                      label: item.priceLabel,
                    ),
                    _MetaPill(
                      icon: Icons.schedule_rounded,
                      label: item.timeLabel,
                    ),
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

class _FeedVisual extends StatelessWidget {
  const _FeedVisual({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    if (item.hasMedia) {
      return Container(
        height: 150,
        width: double.infinity,
        decoration: const BoxDecoration(
          borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
          gradient: LinearGradient(
            colors: [Color(0xFF0B1F33), Color(0xFF11466A)],
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Stack(
          children: [
            Positioned(
              right: -16,
              top: -10,
              child: Container(
                width: 120,
                height: 120,
                decoration: BoxDecoration(
                  shape: BoxShape.circle,
                  color: Colors.white.withValues(alpha: 0.08),
                ),
              ),
            ),
            Padding(
              padding: const EdgeInsets.all(18),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.end,
                children: [
                  const Icon(Icons.collections_rounded, color: Colors.white),
                  const SizedBox(height: 8),
                  Text(
                    '${item.mediaCount} attached files',
                    style: Theme.of(
                      context,
                    ).textTheme.titleMedium?.copyWith(color: Colors.white),
                  ),
                  const SizedBox(height: 4),
                  Text(
                    'This is the media-rich card variant for posts that include images or supporting files.',
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      color: Colors.white.withValues(alpha: 0.84),
                    ),
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
      padding: const EdgeInsets.fromLTRB(18, 18, 18, 18),
      decoration: const BoxDecoration(
        borderRadius: BorderRadius.vertical(top: Radius.circular(28)),
        gradient: LinearGradient(
          colors: [Color(0xFFF8FAFC), Color(0xFFE0F2FE)],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 8),
            decoration: BoxDecoration(
              color: const Color(0xFF0B1F33),
              borderRadius: BorderRadius.circular(999),
            ),
            child: Text(
              'Text-only post',
              style: Theme.of(
                context,
              ).textTheme.labelLarge?.copyWith(color: Colors.white),
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
      padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
      decoration: BoxDecoration(
        color: const Color(0xFFF8FAFC),
        borderRadius: BorderRadius.circular(999),
        border: Border.all(color: const Color(0xFFE2E8F0)),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [Icon(icon, size: 16), const SizedBox(width: 7), Text(label)],
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
