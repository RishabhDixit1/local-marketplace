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
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';
import '../data/people_repository.dart';

class PeoplePage extends ConsumerStatefulWidget {
  const PeoplePage({super.key});

  @override
  ConsumerState<PeoplePage> createState() => _PeoplePageState();
}

class _PeoplePageState extends ConsumerState<PeoplePage> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  final Set<String> _filters = <String>{};
  RealtimeChannel? _peopleChannel;
  SupabaseClient? _client;

  @override
  void initState() {
    super.initState();
    try {
      _client = ref.read(appBootstrapProvider).client;
    } catch (_) {
      _client = null;
    }
    _subscribe();
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    if (_client != null && _peopleChannel != null) {
      _client!.removeChannel(_peopleChannel!);
    }
    super.dispose();
  }

  void _subscribe() {
    final client = _client;
    if (client == null) {
      return;
    }

    _peopleChannel = client
        .channel('mobile-people-directory')
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'profiles',
          callback: (_) => ref.invalidate(peopleSnapshotProvider),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'provider_presence',
          callback: (_) => ref.invalidate(peopleSnapshotProvider),
        )
        .onPostgresChanges(
          event: PostgresChangeEvent.all,
          schema: 'public',
          table: 'reviews',
          callback: (_) => ref.invalidate(peopleSnapshotProvider),
        )
        .subscribe();
  }

  Future<void> _refresh() async {
    ref.invalidate(peopleSnapshotProvider);
    await ref.read(peopleSnapshotProvider.future);
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () {
      if (mounted) {
        setState(() => _query = value.trim());
      }
    });
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(peopleSnapshotProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('People'),
        actions: [
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
            padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
            children: [
              SectionCard(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Nearby providers, trust first.',
                      style: Theme.of(context).textTheme.headlineSmall,
                    ),
                    const SizedBox(height: 8),
                    Text(
                      'Search by skill, service area, response speed, and reputation.',
                      style: Theme.of(context).textTheme.bodyMedium,
                    ),
                    const SizedBox(height: 16),
                    AppSearchField(
                      controller: _searchController,
                      hintText: 'Search name, skill, area, or trust signal',
                      onChanged: _onQueryChanged,
                    ),
                    const SizedBox(height: 12),
                    FilterChipGroup<String>(
                      options: const [
                        FilterOption(value: 'online', label: 'Online now'),
                        FilterOption(value: 'verified', label: 'Verified'),
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
                  final filtered = data.people.where((person) {
                    if (_filters.contains('online') && !person.isOnline) {
                      return false;
                    }
                    if (_filters.contains('verified') &&
                        person.completionPercent < 80) {
                      return false;
                    }
                    if (_filters.contains('top_rated') &&
                        ((person.averageRating ?? 0) < 4.5 ||
                            person.reviewCount < 1)) {
                      return false;
                    }

                    return person.matchesQuery(_query);
                  }).toList();

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      SectionHeader(
                        title: 'Provider directory',
                        subtitle:
                            '${filtered.length} people match your current view.',
                      ),
                      const SizedBox(height: 12),
                      if (filtered.isEmpty)
                        const SectionCard(
                          child: EmptyStateView(
                            title: 'No matching providers',
                            message:
                                'Broaden the search or clear a filter to widen the local network.',
                          ),
                        )
                      else
                        ...filtered.map(
                          (person) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: ProviderCard(
                              person: person,
                              onOpenProfile: () =>
                                  context.push(AppRoutes.provider(person.id)),
                              onMessage: () => context.push(
                                '${AppRoutes.chat}?recipientId=${person.id}',
                              ),
                            ),
                          ),
                        ),
                    ],
                  );
                },
                loading: () => const _PeopleLoading(),
                error: (error, _) => SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load people',
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

class _PeopleLoading extends StatelessWidget {
  const _PeopleLoading();

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
                LoadingShimmer(height: 18, width: 140),
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
