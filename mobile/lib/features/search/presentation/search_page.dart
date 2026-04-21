import 'dart:async';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/widgets/section_card.dart';
import '../../../features/feed/data/feed_repository.dart';
import '../../../features/feed/domain/feed_snapshot.dart';
import '../../../features/people/data/people_repository.dart';
import '../../../features/people/domain/people_snapshot.dart';
import '../../../shared/components/app_search_field.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/filter_chip_group.dart';
import '../../../shared/components/provider_card.dart';
import '../../../shared/components/request_card.dart';
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

class _SearchPageState extends ConsumerState<SearchPage> {
  final _searchController = TextEditingController();
  Timer? _debounce;
  String _query = '';
  _SearchScope _scope = _SearchScope.all;
  final Set<String> _flags = <String>{};

  @override
  void initState() {
    super.initState();
    final initial = widget.initialQuery?.trim() ?? '';
    _searchController.text = initial;
    _query = initial;
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
        setState(() => _query = value.trim());
      }
    });
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
                  onSelected: (_) => setState(() => _scope = scope),
                );
              }).toList(),
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
              onChanged: (next) => setState(() {
                _flags
                  ..clear()
                  ..addAll(next);
              }),
            ),
            const SizedBox(height: 16),
            feedAsync.when(
              data: (feed) => peopleAsync.when(
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
                                  onOpenProfile: () => context.push(
                                    AppRoutes.provider(person.id),
                                  ),
                                  onMessage: () => context.push(
                                    '${AppRoutes.chat}?recipientId=${person.id}',
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
                      ],
                    ],
                  );
                },
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (error, _) => SectionCard(
                  child: ErrorStateView(
                    title: 'Unable to load people',
                    message: AppErrorMapper.toMessage(error),
                  ),
                ),
              ),
              loading: () => const Center(child: CircularProgressIndicator()),
              error: (error, _) => SectionCard(
                child: ErrorStateView(
                  title: 'Unable to search',
                  message: AppErrorMapper.toMessage(error),
                ),
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
