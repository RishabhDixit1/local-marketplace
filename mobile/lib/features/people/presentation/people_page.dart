import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_provider.dart';
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
  Timer? _localityRetryTimer;
  String _query = '';
  final Set<String> _filters = <String>{};
  String _selectedCategory = 'All';
  _DiscoveryMode _mode = _DiscoveryMode.best;
  String? _busyConnectId;
  List<Map<String, dynamic>> _localities = [];
  String? _selectedLocalityId;
  bool _localityLoadError = false;
  AppLifecycleListener? _lifecycleListener;

  @override
  void initState() {
    super.initState();
    _lifecycleListener = AppLifecycleListener(
      onResume: () {
        ref.invalidate(peopleSnapshotProvider);
        _loadLocalities();
      },
    );
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (mounted) {
        ref.read(analyticsServiceProvider).trackScreen('people');
      }
    });
    _loadLocalities();
  }

  Future<void> _loadLocalities() async {
    _localityRetryTimer?.cancel();
    try {
      final client = ref.read(mobileApiClientProvider);
      final locs = await client.getLocalities(zoneType: 'society', phase: 1);
      if (mounted) {
        setState(() {
          _localities = locs;
          _localityLoadError = false;
        });
      }
    } catch (e) {
      debugPrint('[_loadLocalities] Failed: $e');
      if (e.toString().contains('[object Object]') && mounted) {
        try {
          final client = ref.read(mobileApiClientProvider);
          final locs = await client.getLocalities();
          if (mounted) {
            setState(() {
              _localities = locs;
              _localityLoadError = false;
            });
            return;
          }
        } catch (fallbackError) {
          debugPrint('[_loadLocalities] Fallback also failed: $fallbackError');
        }
      }
      if (mounted) {
        setState(() => _localityLoadError = true);
      }
    }
  }

  @override
  void dispose() {
    _lifecycleListener?.dispose();
    _localityRetryTimer?.cancel();
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  Future<void> _refresh() async {
    ref.invalidate(peopleSnapshotProvider);
    await _loadLocalities();
    await ref.read(peopleSnapshotProvider.future);
  }

  int get _activeDiscoveryFilterCount {
    var count = _filters.length;
    if (_selectedCategory != 'All') {
      count += 1;
    }
    if (_mode != _DiscoveryMode.best) {
      count += 1;
    }
    return count;
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
                  'filter_count': _activeDiscoveryFilterCount,
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
          extras: {'filter_count': _activeDiscoveryFilterCount},
        );
  }

  void _showDiscoverySheet(List<String> categories) {
    HapticFeedback.selectionClick();
    final availableCategories = categories.isEmpty ? const ['All'] : categories;

    showModalBottomSheet<void>(
      context: context,
      showDragHandle: true,
      isScrollControlled: true,
      builder: (sheetContext) {
        var sheetMode = _mode;
        var sheetCategory = availableCategories.contains(_selectedCategory)
            ? _selectedCategory
            : 'All';
        var sheetFilters = <String>{..._filters};

        void syncSheetState(StateSetter setSheetState) {
          setSheetState(() {
            sheetMode = _mode;
            sheetCategory = availableCategories.contains(_selectedCategory)
                ? _selectedCategory
                : 'All';
            sheetFilters = <String>{..._filters};
          });
        }

        return SafeArea(
          child: Padding(
            padding: EdgeInsets.fromLTRB(
              20,
              4,
              20,
              20 + MediaQuery.viewInsetsOf(sheetContext).bottom,
            ),
            child: StatefulBuilder(
              builder: (context, setSheetState) {
                void update(void Function() change) {
                  setState(change);
                  syncSheetState(setSheetState);
                  _trackPeopleFilterChange();
                }

                return SingleChildScrollView(
                  child: Column(
                    mainAxisSize: MainAxisSize.min,
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Discovery filters',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      Text(
                        'Sort by',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 10),
                      _DiscoveryModeControl(
                        selectedMode: sheetMode,
                        onSelected: (mode) {
                          update(() => _mode = mode);
                          ref
                              .read(analyticsServiceProvider)
                              .trackEvent(
                                'people_discovery_mode_changed',
                                extras: {'mode': mode.name},
                              );
                        },
                      ),
                      if (availableCategories.length > 1) ...[
                        const SizedBox(height: 18),
                        Text(
                          'Category',
                          style: Theme.of(context).textTheme.titleMedium,
                        ),
                        const SizedBox(height: 10),
                        _CategoryChoiceWrap(
                          categories: availableCategories,
                          selectedCategory: sheetCategory,
                          onSelected: (category) {
                            update(() => _selectedCategory = category);
                            ref
                                .read(analyticsServiceProvider)
                                .trackEvent(
                                  'people_category_selected',
                                  extras: {'category': category},
                                );
                          },
                        ),
                      ],
                      const SizedBox(height: 18),
                      Text(
                        'Signals',
                        style: Theme.of(context).textTheme.titleMedium,
                      ),
                      const SizedBox(height: 10),
                      FilterChipGroup<String>(
                        options: _peopleFilterOptions,
                        selectedValues: sheetFilters,
                        onChanged: (next) {
                          update(() {
                            _filters
                              ..clear()
                              ..addAll(next);
                          });
                        },
                      ),
                      const SizedBox(height: 18),
                      Row(
                        children: [
                          Expanded(
                            child: OutlinedButton.icon(
                              onPressed: () {
                                update(() {
                                  _filters.clear();
                                  _selectedCategory = 'All';
                                  _mode = _DiscoveryMode.best;
                                });
                              },
                              icon: const Icon(Icons.restart_alt_rounded),
                              label: const Text('Reset'),
                            ),
                          ),
                          const SizedBox(width: 10),
                          Expanded(
                            child: FilledButton(
                              onPressed: () => Navigator.of(sheetContext).pop(),
                              child: const Text('Show providers'),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ),
                );
              },
            ),
          ),
        );
      },
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
      ).showSnackBar(SnackBar(content: Text('Connection request sent to ${person.name}.')));
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
    final preview = snapshot.asData?.value;
    final categories = preview == null
        ? const ['All']
        : _topCategories(preview.people);

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
                    const SizedBox(height: 12),
                    AppSearchField(
                      controller: _searchController,
                      hintText: 'Search name, skill, area',
                      onChanged: _onQueryChanged,
                    ),
                    const SizedBox(height: 8),
                    _localityLoadError
                        ? GestureDetector(
                          onTap: _loadLocalities,
                          child: Container(
                            height: 40,
                            decoration: BoxDecoration(
                              borderRadius: BorderRadius.circular(AppRadii.xl),
                              border: Border.all(color: AppColors.danger.withValues(alpha: 0.4)),
                              color: AppColors.dangerSoft,
                            ),
                            padding: const EdgeInsets.symmetric(horizontal: 12),
                            child: Row(
                              children: [
                                Icon(Icons.cloud_off_rounded, size: 14, color: AppColors.danger),
                                const SizedBox(width: 6),
                                const Expanded(child: Text('Localities unavailable — tap to retry', style: TextStyle(fontSize: 12), overflow: TextOverflow.ellipsis)),
                              ],
                            ),
                          ),
                        )
                        : Container(
                      height: 40,
                      decoration: BoxDecoration(
                        borderRadius: BorderRadius.circular(AppRadii.xl),
                        border: Border.all(color: AppColors.border),
                        color: AppColors.surface,
                      ),
                      padding: const EdgeInsets.symmetric(horizontal: 12),
                      child: DropdownButtonHideUnderline(
                        child: DropdownButton<String?>(
                          value: _selectedLocalityId,
                          hint: const Text('All localities', style: TextStyle(fontSize: 13)),
                          style: const TextStyle(fontSize: 13, color: AppColors.inkStrong),
                          isExpanded: true,
                          isDense: true,
                          items: [
                            const DropdownMenuItem(value: null, child: Text('All localities', style: TextStyle(fontSize: 13))),
                            ..._localities.map((loc) => DropdownMenuItem(
                              value: loc['id'] as String?,
                              child: Text(loc['name'] as String? ?? '', style: const TextStyle(fontSize: 13)),
                            )),
                          ],
                          onChanged: (val) => setState(() => _selectedLocalityId = val),
                        ),
                      ),
                    ),
                    const SizedBox(height: 12),
                    _PeopleDiscoverySummary(
                      mode: _mode,
                      selectedCategory: _selectedCategory,
                      filters: _filters,
                      activeCount: _activeDiscoveryFilterCount,
                      onOpenFilters: () => _showDiscoverySheet(categories),
                      onClear: _activeDiscoveryFilterCount == 0
                          ? null
                          : _clearSearchAndFilters,
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

                        if (_selectedLocalityId != null) {
                          final locName = _localities
                              .where((l) => l['id'] == _selectedLocalityId)
                              .map((l) => (l['name'] as String? ?? '').toLowerCase())
                              .firstOrNull;
                          if (locName != null &&
                              !person.locationLabel.toLowerCase().contains(locName)) {
                            return false;
                          }
                        }

                        return person.matchesQuery(_query);
                      }).toList()..sort(
                        (left, right) =>
                            _compareFindPeopleForMode(left, right, _mode),
                      );

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
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

const _peopleFilterOptions = [
  FilterOption(value: 'online', label: 'Online', icon: Icons.bolt_rounded),
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
  FilterOption(value: 'fast', label: 'Fast replies', icon: Icons.speed_rounded),
];

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

class _PeopleDiscoverySummary extends StatelessWidget {
  const _PeopleDiscoverySummary({
    required this.mode,
    required this.selectedCategory,
    required this.filters,
    required this.activeCount,
    required this.onOpenFilters,
    required this.onClear,
  });

  final _DiscoveryMode mode;
  final String selectedCategory;
  final Set<String> filters;
  final int activeCount;
  final VoidCallback onOpenFilters;
  final VoidCallback? onClear;

  @override
  Widget build(BuildContext context) {
    final chips = [
      _modeLabel(mode),
      if (selectedCategory == 'All') 'All categories' else selectedCategory,
      ...filters.map(_filterLabelFor),
    ];

    return Container(
      padding: const EdgeInsets.all(10),
      decoration: BoxDecoration(
        color: AppColors.surfaceMuted,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Wrap(
              spacing: 8,
              runSpacing: 8,
              children: chips.map((label) {
                return TrustBadge(
                  label: label,
                  icon: Icons.check_rounded,
                  backgroundColor: AppColors.surface,
                  foregroundColor: AppColors.ink,
                );
              }).toList(),
            ),
          ),
          const SizedBox(width: 10),
          if (onClear != null)
            Tooltip(
              message: 'Reset filters',
              child: IconButton(
                onPressed: onClear,
                icon: const Icon(Icons.restart_alt_rounded),
              ),
            ),
          OutlinedButton.icon(
            onPressed: onOpenFilters,
            style: OutlinedButton.styleFrom(
              minimumSize: const Size(0, 44),
              padding: const EdgeInsets.symmetric(horizontal: 12),
            ),
            icon: Badge(
              isLabelVisible: activeCount > 0,
              label: Text('$activeCount'),
              child: const Icon(Icons.tune_rounded),
            ),
            label: const Text('Filters'),
          ),
        ],
      ),
    );
  }
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

String _modeLabel(_DiscoveryMode mode) {
  return switch (mode) {
    _DiscoveryMode.best => 'Best matches',
    _DiscoveryMode.nearby => 'Nearby first',
    _DiscoveryMode.compare => 'Compare mode',
  };
}

String _filterLabelFor(String value) {
  return switch (value) {
    'online' => 'Online',
    'verified' => 'Verified',
    'top_rated' => 'Top rated',
    'connected' => 'Connected',
    'fast' => 'Fast replies',
    _ => value,
  };
}

class _CategoryChoiceWrap extends StatelessWidget {
  const _CategoryChoiceWrap({
    required this.categories,
    required this.selectedCategory,
    required this.onSelected,
  });

  final List<String> categories;
  final String selectedCategory;
  final ValueChanged<String> onSelected;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: 8,
      runSpacing: 8,
      children: categories.map((category) {
        return ChoiceChip(
          label: Text(category),
          selected: category == selectedCategory,
          onSelected: (_) => onSelected(category),
        );
      }).toList(),
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
                foregroundImage: person.avatarUrl.trim().isEmpty
                    ? null
                    : NetworkImage(person.avatarUrl),
                onForegroundImageError: person.avatarUrl.trim().isEmpty
                    ? null
                    : (_, _) {},
                child: Text(_avatarInitial(person.name)),
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

String _avatarInitial(String value) {
  final trimmed = value.trim();
  return trimmed.isEmpty ? 'S' : trimmed.characters.first.toUpperCase();
}
