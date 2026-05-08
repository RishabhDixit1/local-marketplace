import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';
import '../../../shared/components/trust_badge.dart';
import '../../connections/data/connections_repository.dart';
import '../data/people_repository.dart';
import '../domain/people_snapshot.dart';

enum _DiscoveryMode { best, nearby, compare }

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
  String _selectedCategory = 'All';
  _DiscoveryMode _mode = _DiscoveryMode.best;
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
      _selectedCategory = 'All';
      _mode = _DiscoveryMode.best;
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

  void _selectDiscoveryMode(_DiscoveryMode mode) {
    HapticFeedback.selectionClick();
    setState(() => _mode = mode);
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'people_discovery_mode_changed',
          extras: {'mode': mode.name},
        );
  }

  void _selectCategory(String category) {
    HapticFeedback.selectionClick();
    setState(() => _selectedCategory = category);
    ref
        .read(analyticsServiceProvider)
        .trackEvent('people_category_selected', extras: {'category': category});
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
                    const SizedBox(height: 12),
                    _DiscoveryModeControl(
                      selectedMode: _mode,
                      onSelected: _selectDiscoveryMode,
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
                        FilterOption(
                          value: 'connected',
                          label: 'Connected',
                          icon: Icons.diversity_3_outlined,
                        ),
                        FilterOption(
                          value: 'fast',
                          label: 'Fast replies',
                          icon: Icons.speed_rounded,
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
                  final categories = _topCategories(data.people);
                  final filtered =
                      data.people.where((person) {
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
                        if (_filters.contains('connected') &&
                            !person.isAcceptedConnection) {
                          return false;
                        }
                        if (_filters.contains('fast') &&
                            !person.isOnline &&
                            !person.activityLabel.toLowerCase().contains(
                              'min',
                            )) {
                          return false;
                        }
                        if (_selectedCategory != 'All' &&
                            !person.primaryTags.any(
                              (tag) =>
                                  tag.toLowerCase() ==
                                  _selectedCategory.toLowerCase(),
                            )) {
                          return false;
                        }

                        return person.matchesQuery(_query);
                      }).toList()..sort(
                        (left, right) =>
                            _compareFindPeopleForMode(left, right, _mode),
                      );

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      _DiscoveryOverview(snapshot: data, filtered: filtered),
                      const SizedBox(height: 14),
                      _CategoryRail(
                        categories: categories,
                        selectedCategory: _selectedCategory,
                        onSelected: _selectCategory,
                      ),
                      if (_mode == _DiscoveryMode.compare &&
                          filtered.isNotEmpty) ...[
                        const SizedBox(height: 14),
                        _ProviderComparePanel(
                          providers: filtered.take(3).toList(),
                          onOpenProvider: _openProvider,
                        ),
                      ],
                      const SizedBox(height: 16),
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
                              rankingReason: _providerRankingReason(person),
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

int _compareFindPeopleForMode(
  MobilePersonCard left,
  MobilePersonCard right,
  _DiscoveryMode mode,
) {
  switch (mode) {
    case _DiscoveryMode.best:
    case _DiscoveryMode.compare:
      return _compareFindPeople(left, right);
    case _DiscoveryMode.nearby:
      final leftLocation = left.locationLabel.toLowerCase() == 'nearby' ? 0 : 1;
      final rightLocation = right.locationLabel.toLowerCase() == 'nearby'
          ? 0
          : 1;
      final locationCompare = rightLocation.compareTo(leftLocation);
      if (locationCompare != 0) {
        return locationCompare;
      }
      if (left.isOnline != right.isOnline) {
        return right.isOnline ? 1 : -1;
      }
      return _compareFindPeople(left, right);
  }
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

String _providerRankingReason(MobilePersonCard person) {
  final explicitReason = person.reason.trim();
  if (explicitReason.isNotEmpty) {
    return explicitReason;
  }
  if (person.isOnline) {
    return 'Available today and ready for fast follow-up.';
  }
  if (person.completedJobs >= 3) {
    return '${person.completedJobs} completed jobs nearby.';
  }
  if ((person.averageRating ?? 0) >= 4.5 && person.reviewCount > 0) {
    return '${person.ratingLabel} from ${person.reviewCount} review${person.reviewCount == 1 ? '' : 's'}.';
  }
  if (person.completionPercent >= 80) {
    return 'Verified profile with stronger trust signals.';
  }
  if (person.activityLabel.toLowerCase().contains('min')) {
    return person.activityLabel;
  }
  if (person.priceLabel.toLowerCase() != 'pricing in chat') {
    return '${person.priceLabel} with profile details ready to compare.';
  }
  return 'Matched by skill, local area, and marketplace activity.';
}

List<String> _topCategories(List<MobilePersonCard> people) {
  final counts = <String, int>{};
  for (final person in people) {
    for (final tag in person.primaryTags) {
      final normalized = tag.trim();
      if (normalized.isEmpty) {
        continue;
      }
      counts.update(normalized, (value) => value + 1, ifAbsent: () => 1);
    }
  }

  final ranked = counts.entries.toList()
    ..sort((left, right) {
      final countCompare = right.value.compareTo(left.value);
      if (countCompare != 0) {
        return countCompare;
      }
      return left.key.toLowerCase().compareTo(right.key.toLowerCase());
    });

  return ['All', ...ranked.take(8).map((entry) => entry.key)];
}

class _DiscoveryModeControl extends StatelessWidget {
  const _DiscoveryModeControl({
    required this.selectedMode,
    required this.onSelected,
  });

  final _DiscoveryMode selectedMode;
  final ValueChanged<_DiscoveryMode> onSelected;

  @override
  Widget build(BuildContext context) {
    return SegmentedButton<_DiscoveryMode>(
      showSelectedIcon: false,
      segments: const [
        ButtonSegment(
          value: _DiscoveryMode.best,
          label: Text('Best'),
          icon: Icon(Icons.auto_awesome_outlined),
        ),
        ButtonSegment(
          value: _DiscoveryMode.nearby,
          label: Text('Nearby'),
          icon: Icon(Icons.place_outlined),
        ),
        ButtonSegment(
          value: _DiscoveryMode.compare,
          label: Text('Compare'),
          icon: Icon(Icons.compare_arrows_rounded),
        ),
      ],
      selected: {selectedMode},
      onSelectionChanged: (selection) => onSelected(selection.first),
    );
  }
}

class _DiscoveryOverview extends StatelessWidget {
  const _DiscoveryOverview({required this.snapshot, required this.filtered});

  final MobilePeopleSnapshot snapshot;
  final List<MobilePersonCard> filtered;

  @override
  Widget build(BuildContext context) {
    final topRated = snapshot.people
        .where((person) => (person.averageRating ?? 0) >= 4.5)
        .length;
    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Expanded(
                child: Text(
                  'Local signal board',
                  style: Theme.of(context).textTheme.titleMedium,
                ),
              ),
              Text(
                '${filtered.length}/${snapshot.totalCount}',
                style: Theme.of(
                  context,
                ).textTheme.labelLarge?.copyWith(color: AppColors.primary),
              ),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              TrustBadge(
                label: '${snapshot.onlineCount} online',
                icon: Icons.bolt_rounded,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primary,
              ),
              TrustBadge(
                label: '${snapshot.verifiedCount} verified',
                icon: Icons.verified_user_outlined,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
              TrustBadge(
                label: '$topRated top rated',
                icon: Icons.star_rounded,
                backgroundColor: AppColors.warningSoft,
                foregroundColor: AppColors.warning,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _CategoryRail extends StatelessWidget {
  const _CategoryRail({
    required this.categories,
    required this.selectedCategory,
    required this.onSelected,
  });

  final List<String> categories;
  final String selectedCategory;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    if (categories.length <= 1) {
      return const SizedBox.shrink();
    }

    return SizedBox(
      height: 42,
      child: ListView.separated(
        scrollDirection: Axis.horizontal,
        itemCount: categories.length,
        separatorBuilder: (_, _) => const SizedBox(width: 8),
        itemBuilder: (context, index) {
          final category = categories[index];
          final selected = category == selectedCategory;
          return ChoiceChip(
            label: Text(category),
            selected: selected,
            onSelected: (_) => onSelected(category),
          );
        },
      ),
    );
  }
}

class _ProviderComparePanel extends StatelessWidget {
  const _ProviderComparePanel({
    required this.providers,
    required this.onOpenProvider,
  });

  final List<MobilePersonCard> providers;
  final ValueChanged<MobilePersonCard> onOpenProvider;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      padding: EdgeInsets.zero,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              gradient: LinearGradient(
                colors: [AppColors.ink, AppColors.accentDeep],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.vertical(
                top: Radius.circular(AppRadii.md),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  'Trust comparison',
                  style: Theme.of(
                    context,
                  ).textTheme.titleLarge?.copyWith(color: Colors.white),
                ),
                const SizedBox(height: 6),
                Text(
                  'Compare price, proof, speed, and reputation before opening a storefront.',
                  style: Theme.of(context).textTheme.bodySmall?.copyWith(
                    color: Colors.white.withValues(alpha: 0.76),
                  ),
                ),
              ],
            ),
          ),
          Padding(
            padding: const EdgeInsets.all(14),
            child: Column(
              children: [
                for (final person in providers)
                  Padding(
                    padding: const EdgeInsets.only(bottom: 10),
                    child: _CompareRow(
                      person: person,
                      onTap: () => onOpenProvider(person),
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

class _CompareRow extends StatelessWidget {
  const _CompareRow({required this.person, required this.onTap});

  final MobilePersonCard person;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: AppColors.surfaceAlt,
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.md),
        onTap: onTap,
        child: Padding(
          padding: const EdgeInsets.all(12),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              CircleAvatar(
                radius: 22,
                backgroundColor: AppColors.primarySoft,
                backgroundImage: person.avatarUrl.trim().isEmpty
                    ? null
                    : NetworkImage(person.avatarUrl),
                child: person.avatarUrl.trim().isEmpty
                    ? Text(person.name.characters.first.toUpperCase())
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      person.name,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                    const SizedBox(height: 4),
                    Text(
                      person.headline,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 8,
                      children: [
                        TrustBadge(
                          label: person.priceLabel,
                          icon: Icons.payments_outlined,
                          backgroundColor: AppColors.surface,
                          foregroundColor: AppColors.ink,
                        ),
                        TrustBadge(
                          label: person.ratingLabel,
                          icon: Icons.star_rounded,
                          backgroundColor: AppColors.warningSoft,
                          foregroundColor: AppColors.warning,
                        ),
                        TrustBadge(
                          label: person.activityLabel,
                          icon: Icons.bolt_rounded,
                          backgroundColor: AppColors.primarySoft,
                          foregroundColor: AppColors.primary,
                        ),
                        TrustBadge(
                          label: person.completedJobs > 0
                              ? '${person.completedJobs} jobs'
                              : person.locationLabel,
                          icon: person.completedJobs > 0
                              ? Icons.task_alt_rounded
                              : Icons.place_outlined,
                          backgroundColor: AppColors.successSoft,
                          foregroundColor: AppColors.success,
                        ),
                      ],
                    ),
                    const SizedBox(height: 8),
                    Text(
                      _providerRankingReason(person),
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.bodySmall?.copyWith(
                        color: AppColors.accentDeep,
                        fontWeight: FontWeight.w700,
                      ),
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 8),
              const Icon(
                Icons.chevron_right_rounded,
                color: AppColors.inkMuted,
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
