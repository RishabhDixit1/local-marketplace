import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:supabase_flutter/supabase_flutter.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/supabase/app_bootstrap.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/feed/data/feed_repository.dart';
import '../../../features/feed/domain/feed_snapshot.dart';
import '../../../features/people/data/people_repository.dart';
import '../../../features/people/domain/people_snapshot.dart';
import '../../../shared/components/app_buttons.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/metric_tile.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/request_card.dart';
import '../../../shared/components/section_header.dart';

class WelcomePage extends ConsumerStatefulWidget {
  const WelcomePage({
    super.key,
    this.snapshotOverride,
    this.peopleOverride,
  });

  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;
  final AsyncValue<MobilePeopleSnapshot>? peopleOverride;

  @override
  ConsumerState<WelcomePage> createState() => _WelcomePageState();
}

class _WelcomePageState extends ConsumerState<WelcomePage> {
  RealtimeChannel? _feedChannel;
  SupabaseClient? _client;

  @override
  void initState() {
    super.initState();
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    _subscribeToRealtime();
  }

  @override
  void dispose() {
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

    void invalidateAll() {
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
      ref.invalidate(feedSnapshotProvider(MobileFeedScope.connected));
      ref.invalidate(peopleSnapshotProvider);
    }

    _feedChannel = client
        .channel('mobile-home-snapshot')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'posts',
          callback: (_) => invalidateAll(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'help_requests',
          callback: (_) => invalidateAll(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'service_listings',
          callback: (_) => invalidateAll(),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'product_catalog',
          callback: (_) => invalidateAll(),
        )
        .subscribe();
  }

  Future<void> _refresh() async {
    ref.invalidate(feedSnapshotProvider(MobileFeedScope.all));
    ref.invalidate(peopleSnapshotProvider);
    await Future.wait([
      ref.read(feedSnapshotProvider(MobileFeedScope.all).future),
      ref.read(peopleSnapshotProvider.future),
    ]);
  }

  @override
  Widget build(BuildContext context) {
    final AsyncValue<MobileFeedSnapshot> feedAsync =
        widget.snapshotOverride ??
        ref.watch(feedSnapshotProvider(MobileFeedScope.all));
    final AsyncValue<MobilePeopleSnapshot> peopleAsync =
        widget.peopleOverride ?? ref.watch(peopleSnapshotProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('ServiQ'),
        actions: [
          IconButton(
            onPressed: () => context.push(AppRoutes.search),
            icon: const Icon(Icons.search_rounded),
            tooltip: 'Search',
          ),
          IconButton(
            onPressed: () => context.push(AppRoutes.notifications),
            icon: const Icon(Icons.notifications_none_rounded),
            tooltip: 'Notifications',
          ),
          IconButton(
            onPressed: () => context.push(AppRoutes.chat),
            icon: const Icon(Icons.chat_bubble_outline_rounded),
            tooltip: 'Chat',
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
                      'What do you need nearby?',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Fast local help, trusted providers, and a cleaner path from discovery to action.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    GestureDetector(
                      onTap: () => context.push(AppRoutes.search),
                      child: AbsorbPointer(
                        child: AppSearchField(
                          controller: TextEditingController(),
                          hintText: 'Search services, products, or providers',
                        ),
                      ),
                    ),
                    const SizedBox(height: 16),
                    Row(
                      children: [
                        Expanded(
                          child: PrimaryButton(
                            label: 'Post a request',
                            onPressed: () => context.push(AppRoutes.createRequest),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: SecondaryButton(
                            label: 'Become a provider',
                            onPressed: () => context.push(AppRoutes.providerOnboarding),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              feedAsync.when(
                data: (feed) => peopleAsync.when(
                  data: (people) {
                    final demandItems = feed.requests.take(3).toList();
                    final providerItems = people.people.take(3).toList();
                    final categories = feed.items
                        .map((item) => item.category)
                        .where((value) => value.trim().isNotEmpty)
                        .toSet()
                        .take(6)
                        .toList();
                    final avgResponseMinutes = feed.items
                        .where((item) => item.responseMinutes > 0)
                        .fold<int>(0, (sum, item) => sum + item.responseMinutes);
                    final avgResponse = feed.items
                            .where((item) => item.responseMinutes > 0)
                            .isEmpty
                        ? 'Building'
                        : '${(avgResponseMinutes / feed.items.where((item) => item.responseMinutes > 0).length).round()} min';

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
                                    label: 'Live requests',
                                    value: feed.stats.demand.toString(),
                                    icon: Icons.flash_on_rounded,
                                  ),
                                ),
                                SizedBox(
                                  width: width,
                                  child: MetricTile(
                                    label: 'Verified providers',
                                    value: people.verifiedCount.toString(),
                                    icon: Icons.verified_rounded,
                                  ),
                                ),
                                SizedBox(
                                  width: width,
                                  child: MetricTile(
                                    label: 'Urgent posts',
                                    value: feed.stats.urgent.toString(),
                                    icon: Icons.warning_amber_rounded,
                                  ),
                                ),
                                SizedBox(
                                  width: width,
                                  child: MetricTile(
                                    label: 'Avg response',
                                    value: avgResponse,
                                    icon: Icons.schedule_rounded,
                                  ),
                                ),
                              ],
                            );
                          },
                        ),
                        if (categories.isNotEmpty) ...[
                          const SizedBox(height: 16),
                          const SectionHeader(
                            title: 'Quick categories',
                            subtitle:
                                'Jump into the local demand patterns already showing up nearby.',
                          ),
                          const SizedBox(height: 12),
                          Wrap(
                            spacing: 8,
                            runSpacing: 8,
                            children: categories
                                .map(
                                  (category) => ActionChip(
                                    label: Text(category),
                                    onPressed: () => context.push(
                                      '${AppRoutes.search}?q=${Uri.encodeComponent(category)}',
                                    ),
                                  ),
                                )
                                .toList(),
                          ),
                        ],
                        const SizedBox(height: 20),
                        const SectionHeader(
                          title: 'Nearby requests',
                          subtitle:
                              'The highest-intent needs in the local network right now.',
                          actionLabel: 'Explore all',
                        ),
                        const SizedBox(height: 12),
                        if (demandItems.isEmpty)
                          const SectionCard(
                            child: EmptyStateView(
                              title: 'No nearby requests yet',
                              message:
                                  'New requests will appear here as local demand picks up.',
                            ),
                          )
                        else
                          ...demandItems.map(
                            (item) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: RequestCard(
                                item: item,
                                onOpen: item.providerId.trim().isEmpty
                                    ? null
                                    : () => context.push(
                                          AppRoutes.provider(item.providerId),
                                        ),
                                onMessage: item.providerId.trim().isEmpty
                                    ? null
                                    : () => context.push(
                                          '${AppRoutes.chat}?recipientId=${item.providerId}',
                                        ),
                              ),
                            ),
                          ),
                        const SizedBox(height: 8),
                        const SectionHeader(
                          title: 'Nearby providers',
                          subtitle:
                              'People ready to respond with stronger trust and local fit.',
                        ),
                        const SizedBox(height: 12),
                        if (providerItems.isEmpty)
                          const SectionCard(
                            child: EmptyStateView(
                              title: 'Provider discovery is warming up',
                              message:
                                  'Nearby providers will show up here as more local profiles come online.',
                            ),
                          )
                        else
                          ...providerItems.map(
                            (person) => Padding(
                              padding: const EdgeInsets.only(bottom: 12),
                              child: ProviderCard(
                                person: person,
                                onOpenProfile: () => context.push(
                                  AppRoutes.provider(person.id),
                                ),
                                onMessage: () => context.push(
                                  '${AppRoutes.chat}?recipientId=${person.id}',
                                ),
                              ),
                            ),
                          ),
                      ],
                    );
                  },
                  loading: () => const Center(child: CircularProgressIndicator()),
                  error: (error, _) => SectionCard(
                    child: ErrorStateView(
                      title: 'Unable to load local providers',
                      message: AppErrorMapper.toMessage(error),
                      onRetry: _refresh,
                    ),
                  ),
                ),
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load home',
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
