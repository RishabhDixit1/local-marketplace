import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/feed/data/feed_repository.dart';
import '../../../features/feed/domain/feed_snapshot.dart';
import '../../../features/people/data/people_repository.dart';
import '../../../features/people/domain/people_snapshot.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/feed_card.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/section_header.dart';

enum _SearchScope {
  all,
  providers,
  requests,
  services,
  products;

  String get label {
    switch (this) {
      case _SearchScope.all:
        return 'All';
      case _SearchScope.providers:
        return 'Providers';
      case _SearchScope.requests:
        return 'Requests';
      case _SearchScope.services:
        return 'Services';
      case _SearchScope.products:
        return 'Products';
    }
  }
}

class SearchPage extends ConsumerStatefulWidget {
  const SearchPage({super.key, this.initialQuery});

  final String? initialQuery;

  @override
  ConsumerState<SearchPage> createState() => _SearchPageState();
}

const _searchCategories = [
  'Electrician', 'Plumber', 'RO Repair', 'AC Repair',
  'Geyser Repair', 'Appliance Repair', 'Carpenter',
];

class _SearchPageState extends ConsumerState<SearchPage> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  _SearchScope _scope = _SearchScope.all;
  final Set<String> _flags = <String>{};
  String? _selectedCategory;
  List<Map<String, dynamic>> _localities = [];
  String? _selectedLocalityId;

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuery?.trim() ?? '';
    _searchController.text = initial;
    _query = initial;
    WidgetsBinding.instance.addPostFrameCallback((_) {
      if (!mounted) {
        return;
      }
      ref.read(analyticsServiceProvider).trackScreen('search');
      _trackSearchSubmit(initial);
      _loadLocalities();
    });
  }

  Future<void> _loadLocalities() async {
    try {
      final client = ref.read(mobileApiClientProvider);
      final locs = await client.getLocalities(zoneType: 'society', phase: 1);
      if (mounted) setState(() => _localities = locs);
    } catch (_) {}
  }

  @override
  void dispose() {
    _debounce?.cancel();
    _searchController.dispose();
    super.dispose();
  }

  void _onQueryChanged(String value) {
    _debounce?.cancel();
    _debounce = Timer(const Duration(milliseconds: 220), () {
      if (mounted) {
        final nextQuery = value.trim();
        setState(() => _query = nextQuery);
        _trackSearchSubmit(nextQuery);
      }
    });
  }

  void _trackSearchSubmit(String query) {
    final normalized = query.trim();
    if (normalized.length < 2) {
      return;
    }
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'search_submit',
          extras: {'query_length': normalized.length, 'scope': _scope.name},
        );
  }

  void _trackSearchFilterChange() {
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'search_filter_changed',
          extras: {'scope': _scope.name, 'filter_count': _flags.length},
        );
  }

  void _openProvider(String providerId, {required String source}) {
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'provider_open',
          extras: {'source': source, 'provider_id': providerId},
        );
    context.push(AppRoutes.provider(providerId));
  }

  void _openListing(MobileFeedItem item) {
    context.push(
      AppRoutes.listingDetail(item.id, source: item.source.apiValue),
    );
  }

  @override
  Widget build(BuildContext context) {
    final feedAsync = ref.watch(feedSnapshotProvider(MobileFeedScope.all));
    final peopleAsync = ref.watch(peopleSnapshotProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Search nearby')),
      body: SafeArea(
        child: ListView(
          padding: const EdgeInsets.fromLTRB(16, 12, 16, 24),
          children: [
            AppSearchField(
              controller: _searchController,
              hintText: 'Service, provider, product, or request',
              autofocus: true,
              onChanged: _onQueryChanged,
            ),
            const SizedBox(height: 12),
            Wrap(
              spacing: 8,
              runSpacing: 8,
              children: _SearchScope.values.map((scope) {
                return ChoiceChip(
                  label: Text(scope.label),
                  selected: _scope == scope,
                  onSelected: (_) {
                    setState(() => _scope = scope);
                    _trackSearchFilterChange();
                  },
                );
              }).toList(),
            ),
            const SizedBox(height: 8),
            SizedBox(
              height: 32,
              child: ListView.separated(
                scrollDirection: Axis.horizontal,
                itemCount: _searchCategories.length,
                separatorBuilder: (_, _) => const SizedBox(width: 6),
                itemBuilder: (context, index) {
                  final cat = _searchCategories[index];
                  final selected = _selectedCategory == cat;
                  return FilterChip(
                    label: Text(cat, style: const TextStyle(fontSize: 11)),
                    selected: selected,
                    onSelected: (_) => setState(() => _selectedCategory = selected ? null : cat),
                    visualDensity: VisualDensity.compact,
                  );
                },
              ),
            ),
            const SizedBox(height: 8),
            Container(
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
            FilterChipGroup<String>(
              options: const [
                FilterOption(value: 'verified', label: 'Verified'),
                FilterOption(value: 'urgent', label: 'Urgent'),
                FilterOption(value: 'open_now', label: 'Open now'),
                FilterOption(value: 'top_rated', label: 'Top rated'),
              ],
              selectedValues: _flags,
              onChanged: (next) {
                setState(() {
                  _flags
                    ..clear()
                    ..addAll(next);
                });
                _trackSearchFilterChange();
              },
            ),
            const SizedBox(height: 16),
            ServiqAsyncBody<MobileFeedSnapshot>(
              value: feedAsync,
              errorTitle: 'Unable to search',
              errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
              onRetry: () =>
                  ref.invalidate(feedSnapshotProvider(MobileFeedScope.all)),
              loadingBuilder: () =>
                  const Center(child: CircularProgressIndicator()),
              data: (feed) => ServiqAsyncBody<MobilePeopleSnapshot>(
                value: peopleAsync,
                errorTitle: 'Unable to load people',
                errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
                onRetry: () => ref.invalidate(peopleSnapshotProvider),
                loadingBuilder: () =>
                    const Center(child: CircularProgressIndicator()),
                data: (people) {
                  final providerResults = _filterProviders(people.people);
                  final feedResults = _filterFeed(feed.items);

                  if (providerResults.isEmpty && feedResults.isEmpty) {
                    return const SectionCard(
                      child: EmptyStateView(
                        title: 'No nearby matches',
                        message:
                            'Try a broader term, remove a filter, or post a request so the right local people can find you.',
                      ),
                    );
                  }

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      if (providerResults.isNotEmpty &&
                          (_scope == _SearchScope.all ||
                              _scope == _SearchScope.providers)) ...[
                        SectionHeader(
                          title: 'Providers',
                          subtitle:
                              '${providerResults.length} nearby people match your search.',
                        ),
                        const SizedBox(height: 12),
                        ...providerResults
                            .take(6)
                            .map(
                              (person) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: ProviderCard(
                                  person: person,
                                  onOpenProfile: () => _openProvider(
                                    person.id,
                                    source: 'search_provider',
                                  ),
                                  onMessage: () => context.push(
                                    AppRoutes.chatDirect(
                                      recipientId: person.id,
                                      contextTitle: person.name,
                                      source: 'search_provider',
                                    ),
                                  ),
                                ),
                              ),
                            ),
                        const SizedBox(height: 12),
                      ],
                      if (feedResults.isNotEmpty &&
                          _scope != _SearchScope.providers) ...[
                        SectionHeader(
                          title: 'Listings and requests',
                          subtitle:
                              '${feedResults.length} results near your current network.',
                        ),
                        const SizedBox(height: 12),
                        ...feedResults
                            .take(8)
                            .map(
                              (item) => Padding(
                                padding: const EdgeInsets.only(bottom: 12),
                                child: FeedCard(
                                  item: item,
                                  primaryLabel:
                                      item.type == MobileFeedItemType.demand
                                      ? 'Open request'
                                      : 'View details',
                                  secondaryLabel: 'Contact',
                                  onPrimaryTap: item.providerId.trim().isEmpty
                                      ? null
                                      : item.type == MobileFeedItemType.demand
                                      ? () => _openProvider(
                                          item.providerId,
                                          source: 'search_result',
                                        )
                                      : () => _openListing(item),
                                  onSecondaryTap: item.providerId.trim().isEmpty
                                      ? null
                                      : () => context.push(
                                          AppRoutes.chatDirect(
                                            recipientId: item.providerId,
                                            contextTitle: item.title,
                                            contextTaskId: item.id,
                                            contextStatus: item.statusLabel,
                                            source: 'search_result',
                                          ),
                                        ),
                                ),
                              ),
                            ),
                      ],
                    ],
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }

  List<MobilePersonCard> _filterProviders(List<MobilePersonCard> people) {
    return people.where((person) {
      if (_scope != _SearchScope.all && _scope != _SearchScope.providers) {
        return false;
      }
      if (_flags.contains('verified') && person.completionPercent < 80) {
        return false;
      }
      if (_flags.contains('open_now') && !person.isOnline) {
        return false;
      }
      if (_flags.contains('top_rated') &&
          ((person.averageRating ?? 0) < 4.5 || person.reviewCount < 1)) {
        return false;
      }
      if (_selectedCategory != null &&
          !person.primaryTags.any((t) => t.toLowerCase() == _selectedCategory!.toLowerCase())) {
        return false;
      }
      if (_selectedLocalityId != null) {
        final locName = _localities
            .where((l) => l['id'] == _selectedLocalityId)
            .map((l) => (l['name'] as String? ?? '').toLowerCase())
            .firstOrNull;
        if (locName != null && !person.locationLabel.toLowerCase().contains(locName)) {
          return false;
        }
      }
      return person.matchesQuery(_query);
    }).toList();
  }

  List<MobileFeedItem> _filterFeed(List<MobileFeedItem> items) {
    return items.where((item) {
      if (_scope == _SearchScope.requests &&
          item.type != MobileFeedItemType.demand) {
        return false;
      }
      if (_scope == _SearchScope.services &&
          item.type != MobileFeedItemType.service) {
        return false;
      }
      if (_scope == _SearchScope.products &&
          item.type != MobileFeedItemType.product) {
        return false;
      }
      if (_flags.contains('verified') && !item.isVerified) {
        return false;
      }
      if (_flags.contains('urgent') && !item.urgent) {
        return false;
      }
      if (_flags.contains('top_rated') &&
          ((item.averageRating ?? 0) < 4.5 || item.reviewCount < 1)) {
        return false;
      }
      if (_selectedCategory != null &&
          !item.category.toLowerCase().contains(_selectedCategory!.toLowerCase())) {
        return false;
      }
      if (_selectedLocalityId != null) {
        final locName = _localities
            .where((l) => l['id'] == _selectedLocalityId)
            .map((l) => (l['name'] as String? ?? '').toLowerCase())
            .firstOrNull;
        if (locName != null && !item.locationLabel.toLowerCase().contains(locName)) {
          return false;
        }
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
      return haystack.contains(_query.toLowerCase());
    }).toList();
  }
}
