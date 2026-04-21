import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/models/serviq_models.dart';
import '../../../core/services/analytics_service.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/widgets/cards.dart';
import '../../../shared/widgets/chips.dart';
import '../../../shared/widgets/empty_state.dart';
import '../../../shared/widgets/error_state.dart';
import '../../../shared/widgets/loading_skeletons.dart';
import '../../../shared/widgets/section_header.dart';
import '../data/explore_repository.dart';
import '../../people/data/people_hub_repository.dart';
import 'explore_cards.dart';
import 'explore_filters_sheet.dart';
import 'explore_header.dart';

class ExploreScreen extends ConsumerStatefulWidget {
  const ExploreScreen({super.key});

  @override
  ConsumerState<ExploreScreen> createState() => _ExploreScreenState();
}

class _ExploreScreenState extends ConsumerState<ExploreScreen> {
  ExploreSort _sort = ExploreSort.relevance;
  bool _urgentOnly = false;
  bool _verifiedOnly = false;
  bool _showMap = false;
  String? _selectedCategoryId;

  @override
  void initState() {
    super.initState();
    WidgetsBinding.instance.addPostFrameCallback((_) {
      ref.read(analyticsServiceProvider).trackScreen('explore_screen');
    });
  }

  Future<void> _refresh() async {
    ref.invalidate(exploreDashboardProvider);
    await ref.read(exploreDashboardProvider.future);
  }

  Future<void> _openFilters() async {
    final result = await showExploreFiltersSheet(
      context,
      currentSort: _sort,
      urgentOnly: _urgentOnly,
      verifiedOnly: _verifiedOnly,
    );
    if (result == null || !mounted) {
      return;
    }
    setState(() {
      _sort = result.sort;
      _urgentOnly = result.urgentOnly;
      _verifiedOnly = result.verifiedOnly;
    });
    ref
        .read(analyticsServiceProvider)
        .trackEvent(
          'explore_filters_applied',
          extras: {
            'sort': _sort.name,
            'urgent_only': _urgentOnly,
            'verified_only': _verifiedOnly,
          },
        );
  }

  List<ExploreItem> _applyFilters(List<ExploreItem> items) {
    final filtered = items.where((item) {
      if (_selectedCategoryId != null &&
          item.category.toLowerCase() != _selectedCategoryId!.toLowerCase()) {
        return false;
      }
      if (_urgentOnly && !item.urgent) {
        return false;
      }
      if (_verifiedOnly && !item.verified) {
        return false;
      }
      return true;
    }).toList();

    switch (_sort) {
      case ExploreSort.relevance:
        filtered.sort(
          (a, b) => (b.mutualConnections + b.reviewCount).compareTo(
            a.mutualConnections + a.reviewCount,
          ),
        );
      case ExploreSort.nearest:
        filtered.sort((a, b) => a.distanceKm.compareTo(b.distanceKm));
      case ExploreSort.freshest:
        filtered.sort((a, b) => b.postedAt.compareTo(a.postedAt));
      case ExploreSort.urgent:
        filtered.sort((a, b) => (b.urgent ? 1 : 0).compareTo(a.urgent ? 1 : 0));
      case ExploreSort.trust:
        filtered.sort((a, b) => b.reviewCount.compareTo(a.reviewCount));
    }

    return filtered;
  }

  @override
  Widget build(BuildContext context) {
    final dashboardAsync = ref.watch(exploreDashboardProvider);

    return Scaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: _refresh,
          child: ListView(
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageInset,
              AppSpacing.sm,
              AppSpacing.pageInset,
              120,
            ),
            children: [
              dashboardAsync.when(
                data: (dashboard) {
                  final trending = _applyFilters(dashboard.trendingRequests);
                  final featured = _applyFilters(
                    dashboard.featuredOpportunities,
                  );

                  return Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      ExploreHeader(
                        locationTitle: dashboard.locationTitle,
                        onSearchTap: () => context.push(AppRoutes.search),
                        onFilterTap: _openFilters,
                        onNotificationsTap: () =>
                            context.push(AppRoutes.notifications),
                        showMap: _showMap,
                        onToggleMap: (value) =>
                            setState(() => _showMap = value),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      LayoutBuilder(
                        builder: (context, constraints) {
                          final tileWidth =
                              (constraints.maxWidth - AppSpacing.sm) / 2;
                          return Wrap(
                            spacing: AppSpacing.sm,
                            runSpacing: AppSpacing.sm,
                            children: [
                              SizedBox(
                                width: tileWidth,
                                child: AppMetricCard(
                                  label: 'Saved',
                                  value: '${dashboard.savedCount}',
                                  caption: 'Listings already shortlisted',
                                  icon: Icons.bookmark_rounded,
                                ),
                              ),
                              SizedBox(
                                width: tileWidth,
                                child: AppMetricCard(
                                  label: 'Live now',
                                  value:
                                      '${dashboard.trendingRequests.where((item) => item.urgent).length} urgent',
                                  caption: 'High-intent jobs nearby',
                                  icon: Icons.flash_on_rounded,
                                ),
                              ),
                            ],
                          );
                        },
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppSectionHeader(
                        title: 'Categories',
                        subtitle:
                            'Jump straight into the highest local intent buckets.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      SingleChildScrollView(
                        scrollDirection: Axis.horizontal,
                        child: Row(
                          children: [
                            Padding(
                              padding: const EdgeInsets.only(
                                right: AppSpacing.sm,
                              ),
                              child: AppFilterChip(
                                label: 'All',
                                selected: _selectedCategoryId == null,
                                onSelected: (_) =>
                                    setState(() => _selectedCategoryId = null),
                              ),
                            ),
                            ...dashboard.categories.map(
                              (category) => Padding(
                                padding: const EdgeInsets.only(
                                  right: AppSpacing.sm,
                                ),
                                child: AppFilterChip(
                                  label:
                                      '${category.label} (${category.activeCount})',
                                  selected:
                                      _selectedCategoryId == category.label,
                                  leading: category.icon,
                                  onSelected: (_) => setState(
                                    () => _selectedCategoryId =
                                        _selectedCategoryId == category.label
                                        ? null
                                        : category.label,
                                  ),
                                ),
                              ),
                            ),
                          ],
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      if (_showMap) ...[
                        ExploreMapPlaceholder(
                          locationTitle: dashboard.locationTitle,
                          hotspots: trending,
                        ),
                        const SizedBox(height: AppSpacing.lg),
                      ],
                      AppSectionHeader(
                        title: 'Urgent and trending',
                        subtitle:
                            'Requests and opportunities ranked for proximity, urgency, and trust.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      if (trending.isEmpty)
                        AppEmptyState(
                          title: 'Nothing matches your current filters',
                          message:
                              'Try widening the category or switching off trust filters for broader local discovery.',
                          primaryAction: FilledButton(
                            onPressed: () {
                              setState(() {
                                _urgentOnly = false;
                                _verifiedOnly = false;
                                _selectedCategoryId = null;
                              });
                            },
                            child: const Text('Reset filters'),
                          ),
                        )
                      else
                        ...trending.map(
                          (item) => Padding(
                            padding: const EdgeInsets.only(
                              bottom: AppSpacing.md,
                            ),
                            child: ExploreListingCard(
                              item: item,
                              onSave: () async {
                                await ref
                                    .read(exploreRepositoryProvider)
                                    .toggleSaved(item.id);
                                ref.invalidate(exploreDashboardProvider);
                                ref
                                    .read(analyticsServiceProvider)
                                    .trackEvent(
                                      'save_listing',
                                      extras: {'listing_id': item.id},
                                    );
                              },
                            ),
                          ),
                        ),
                      const SizedBox(height: AppSpacing.lg),
                      AppSectionHeader(
                        title: 'Recommended providers',
                        subtitle:
                            'People with fast replies, strong trust signals, and local fit.',
                        action: TextButton(
                          onPressed: () => context.go(AppRoutes.people),
                          child: const Text('View all'),
                        ),
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      SizedBox(
                        height: 220,
                        child: ListView.separated(
                          scrollDirection: Axis.horizontal,
                          itemBuilder: (context, index) {
                            final person =
                                dashboard.recommendedProviders[index];
                            return RecommendedProviderCard(
                              person: person,
                              onSave: () async {
                                await ref
                                    .read(peopleHubRepositoryProvider)
                                    .toggleSaved(person.id);
                                ref.invalidate(peopleHubProvider);
                              },
                            );
                          },
                          separatorBuilder: (context, index) =>
                              const SizedBox(width: AppSpacing.sm),
                          itemCount: dashboard.recommendedProviders.length,
                        ),
                      ),
                      const SizedBox(height: AppSpacing.lg),
                      AppSectionHeader(
                        title: 'Featured opportunities',
                        subtitle:
                            'Higher-value local work suited to reliable providers and dual-role users.',
                      ),
                      const SizedBox(height: AppSpacing.sm),
                      ...featured.map(
                        (item) => Padding(
                          padding: const EdgeInsets.only(bottom: AppSpacing.md),
                          child: ExploreListingCard(
                            item: item,
                            onSave: () async {
                              await ref
                                  .read(exploreRepositoryProvider)
                                  .toggleSaved(item.id);
                              ref.invalidate(exploreDashboardProvider);
                            },
                          ),
                        ),
                      ),
                    ],
                  );
                },
                loading: () => const Column(
                  children: [
                    CardListSkeleton(count: 1),
                    SizedBox(height: AppSpacing.lg),
                    CardListSkeleton(count: 2),
                  ],
                ),
                error: (error, _) => AppErrorState(
                  title: 'Explore is unavailable right now',
                  message: AppErrorMapper.toMessage(error),
                  onRetry: _refresh,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
