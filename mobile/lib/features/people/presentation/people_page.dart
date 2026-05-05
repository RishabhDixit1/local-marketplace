import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';
import '../../connections/data/connections_repository.dart';
import '../data/people_repository.dart';
import '../domain/people_snapshot.dart';

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
  String? _busyConnectId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(analyticsServiceProvider).trackScreen('people');
      }
    });
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(peopleSnapshotProvider);
    await ref.read(peopleSnapshotProvider.future);
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () {
      if (mounted) {
        final nextQuery = value.trim();
        setState(() => _query = nextQuery);
        if (nextQuery.length >= 2) {
          ref
              .read(analyticsServiceProvider)
              .trackEvent(
                'people_search',
                extras: {
                  'query_length': nextQuery.length,
                  'filter_count': _filters.length,
                },
              );
        }
      }
    });
  }

  void _clearSearchAndFilters() {
    _debounce?.cancel();
    _searchController.clear();
    setState(() {
      _query = '';
      _filters.clear();
    });
  }

  void _trackPeopleFilterChange() {
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'people_filter_changed',
          extras: {'filter_count': _filters.length},
        );
  }

  void _openProvider(MobilePersonCard person) {
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'provider_open',
          extras: {'source': 'people_provider_card', 'provider_id': person.id},
        );
    context.push(AppRoutes.provider(person.id));
  }

  Future<void> _connect(MobilePersonCard person) async {
    if (_busyConnectId != null) {
      return;
    }
    setState(() => _busyConnectId = person.id);
    try {
      await ref
          .read(connectionsRepositoryProvider)
          .sendConnectionRequest(person.id);
      ref.invalidate(peopleSnapshotProvider);
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(const SnackBar(content: Text('Connection request sent.')));
    } catch (error) {
      if (!mounted) {
        return;
      }
      ScaffoldMessenger.of(
        context,
      ).showSnackBar(SnackBar(content: Text(AppErrorMapper.toMessage(error))));
    } finally {
      if (mounted) {
        setState(() => _busyConnectId = null);
      }
    }
  }

  @override
  Widget build(BuildContext context) {
    final snapshot = ref.watch(peopleSnapshotProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Find'),
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
          color: Theme.of(context).colorScheme.primary,
          backgroundColor: Theme.of(context).colorScheme.surface,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(16, 10, 16, 140),
            children: [
              SectionCard(
                padding: const EdgeInsets.all(14),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      'Find nearby help',
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      'Search by skill, area, speed, or reputation.',
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 12),
                    AppSearchField(
                      controller: _searchController,
                      hintText: 'Search name, skill, area',
                      onChanged: _onQueryChanged,
                    ),
                    const SizedBox(height: 10),
                    FilterChipGroup<String>(
                      options: const [
                        FilterOption(
                          value: 'online',
                          label: 'Online',
                          icon: Icons.bolt_rounded,
                        ),
                        FilterOption(
                          value: 'verified',
                          label: 'Verified',
                          icon: Icons.verified_user_outlined,
                        ),
                        FilterOption(
                          value: 'top_rated',
                          label: 'Top rated',
                          icon: Icons.star_rounded,
                        ),
                      ],
                      selectedValues: _filters,
                      onChanged: (next) {
                        setState(() {
                          _filters
                            ..clear()
                            ..addAll(next);
                        });
                        _trackPeopleFilterChange();
                      },
                    ),
                  ],
                ),
              ),
              const SizedBox(height: 16),
              ServiqAsyncBody<MobilePeopleSnapshot>(
                value: snapshot,
                errorTitle: 'Unable to load people',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: _refresh,
                loadingBuilder: () => const _PeopleLoading(),
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
                  }).toList()..sort(_compareFindPeople);

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
                        SectionCard(
                          child: EmptyStateView(
                            title: 'No matching providers',
                            message:
                                'Broaden the search or clear a filter to widen the local network.',
                            icon: Icons.search_off_rounded,
                            actionLabel: 'Clear search',
                            onAction: _clearSearchAndFilters,
                          ),
                        )
                      else
                        ...filtered.map(
                          (person) => Padding(
                            padding: const EdgeInsets.only(bottom: 12),
                            child: ProviderDirectoryCard(
                              person: person,
                              onOpenProfile: () => _openProvider(person),
                              onMessage: () => context.push(
                                AppRoutes.chatDirect(
                                  recipientId: person.id,
                                  contextTitle: person.name,
                                  source: 'people_provider_card',
                                ),
                              ),
                              onConnect: person.isAcceptedConnection
                                  ? null
                                  : () => _connect(person),
                              connecting: _busyConnectId == person.id,
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

int _compareFindPeople(MobilePersonCard left, MobilePersonCard right) {
  final scoreCompare = _findPeopleScore(
    right,
  ).compareTo(_findPeopleScore(left));
  if (scoreCompare != 0) {
    return scoreCompare;
  }

  return left.name.toLowerCase().compareTo(right.name.toLowerCase());
}

int _findPeopleScore(MobilePersonCard person) {
  var score = person.priorityScore;
  if (person.isOnline) {
    score += 160;
  }
  if (person.completionPercent >= 80) {
    score += 90;
  }
  if (person.isAcceptedConnection) {
    score += 80;
  }
  if ((person.averageRating ?? 0) >= 4.5 && person.reviewCount > 0) {
    score += 70 + person.reviewCount.clamp(0, 20).toInt();
  }
  if (person.locationLabel.trim().isNotEmpty &&
      person.locationLabel.trim().toLowerCase() != 'nearby') {
    score += 18;
  }
  score += person.mutualConnectionsCount.clamp(0, 10).toInt() * 4;
  score += person.completedJobs.clamp(0, 20).toInt();
  return score;
}

class _PeopleLoading extends StatelessWidget {
  const _PeopleLoading();

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
                LoadingShimmer(height: 20, width: 180),
                SizedBox(height: 10),
                LoadingShimmer(height: 14, width: 240),
                SizedBox(height: 16),
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
