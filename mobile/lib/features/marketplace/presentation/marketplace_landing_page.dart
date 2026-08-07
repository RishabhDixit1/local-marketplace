import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/design_system/design_system.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/api/mobile_api_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../shared/components/error_state_view.dart';
import '../../../shared/components/marketplace_provider_card.dart';
import '../../../shared/components/section_header.dart';
import '../../../shared/widgets/ai_prompt_bar.dart';
import '../data/marketplace_repository.dart';
import '../domain/marketplace_provider.dart';

final _categoriesProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, void>((ref, _) async {
  final repo = ref.watch(marketplaceRepositoryProvider);
  return repo.fetchServiceCategories();
});

final _zonesProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, void>((ref, _) async {
  final client = ref.watch(mobileApiClientProvider);
  final localities = await client.getLocalities();
  final grouped = <String, List<Map<String, dynamic>>>{};
  for (final loc in localities) {
    final zoneType = loc['zone_type'] as String? ?? 'unknown';
    final zoneName = loc['name'] as String? ?? '';
    if (zoneName.isEmpty) continue;
    final status = zoneType == 'expansion' ? 'coming_soon' : 'live';
    grouped.putIfAbsent(status, () => []);
    grouped[status]!.add({
      'name': zoneName,
      'city': loc['city'] as String? ?? '',
      'status': status,
      'societyCount': zoneType == 'society' ? 1 : 0,
      'marketCount': zoneType == 'market' ? 1 : 0,
    });
  }
  return [
    ...?grouped['live']?.take(10),
    ...?grouped['coming_soon']?.take(5),
  ];
});

class MarketplaceLandingPage extends ConsumerStatefulWidget {
  const MarketplaceLandingPage({
    super.key,
    this.zoneSlug,
  });

  final String? zoneSlug;

  @override
  ConsumerState<MarketplaceLandingPage> createState() => _LandingPageState();
}

class _LandingPageState extends ConsumerState<MarketplaceLandingPage> {
  // Inline preview caps matching the other home sections: the full-width card
  // lists ("Live Now" zones, "Featured providers") cap at 3; the 2-column
  // "Browse by category" grid caps at 8.
  static const int _listPreviewCount = 3;
  static const int _gridPreviewCount = 8;

  final _searchController = TextEditingController();
  String? _selectedCategory;

  String get _locationLabel => 'Your area';

  @override
  void dispose() {
    _searchController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(marketplaceProvidersProvider(_selectedCategory));
    final categoriesAsync = ref.watch(_categoriesProvider(null));
    final zonesAsync = ref.watch(_zonesProvider(null));

    final providerList = providersAsync.asData?.value ?? <MarketplaceProvider>[];
    final categories = categoriesAsync.asData?.value ?? <Map<String, dynamic>>[];
    final zones = zonesAsync.asData?.value ?? <Map<String, dynamic>>[];

    final searchQuery = _searchController.text.trim().toLowerCase();
    final filteredProviders = searchQuery.isEmpty
        ? providerList
        : providerList.where((p) {
            final q = searchQuery;
            return p.name.toLowerCase().contains(q) ||
                p.bio.toLowerCase().contains(q) ||
                p.services.any((s) => s.toLowerCase().contains(q));
          }).toList();

    final hasActiveFilter = _selectedCategory != null || searchQuery.isNotEmpty;
    final showEmptyState = filteredProviders.isEmpty && hasActiveFilter;
    final showHeroActions = filteredProviders.isEmpty && !hasActiveFilter;

    final liveZones = zones.where((z) => z['status'] == 'live' || z['status'] == null).toList();
    final comingZones = zones.where((z) => z['status'] == 'coming_soon').toList();

    return ServiqScaffold(
      body: SafeArea(
        child: CustomScrollView(
          slivers: [
            _buildHeader(),
            _buildHero(showHeroActions, categories),
            _buildCategoryGrid(categories),
            if (liveZones.isNotEmpty) _buildZoneSection('Live Now', liveZones, Icons.auto_awesome_rounded),
            if (comingZones.isNotEmpty) _buildZoneSection('Coming Soon', comingZones, Icons.schedule_rounded),
            _buildProviderSection(filteredProviders, providersAsync, hasActiveFilter, showEmptyState, searchQuery.isNotEmpty),
            _buildBusinessCta(),
            _buildFooter(),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pageInset, vertical: AppSpacing.sm),
        child: Row(
          mainAxisAlignment: MainAxisAlignment.spaceBetween,
          children: [
            Flexible(
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Container(
                    width: 34,
                    height: 34,
                    decoration: BoxDecoration(
                      gradient: AppGradients.premiumDark,
                      borderRadius: BorderRadius.circular(AppRadii.sm),
                    ),
                    child: const Center(
                      child: Text('S', style: TextStyle(color: Colors.white, fontWeight: FontWeight.w900, fontSize: 18)),
                    ),
                  ),
                  const SizedBox(width: AppSpacing.xs),
                  Text('ServiQ', style: TextStyle(fontWeight: FontWeight.bold, fontSize: 18, color: Theme.of(context).colorScheme.onSurface)),
                ],
              ),
            ),
            Row(
              children: [
                Semantics(
                  label: 'Search providers',
                  child: IconButton(
                    onPressed: () => context.push(AppRoutes.publicSearch),
                    icon: Icon(Icons.search_rounded, size: 20, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                  ),
                ),
                FilledButton.tonalIcon(
                  onPressed: () => context.push(AppRoutes.signIn),
                  label: const Text('Sign In'),
                  icon: Icon(Icons.login_rounded, size: 16),
                  style: FilledButton.styleFrom(
                    visualDensity: VisualDensity.compact,
                  ),
                ),
              ],
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHero(bool showActions, List<Map<String, dynamic>> categories) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.pageInset, AppSpacing.md, AppSpacing.pageInset, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('Find Help Nearby',
                style: Theme.of(context).textTheme.headlineMedium?.copyWith(fontWeight: FontWeight.w800)),
            const SizedBox(height: AppSpacing.xxs),
            Text('Find trusted providers and services in your local area.',
                style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
            const SizedBox(height: AppSpacing.md),
            Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadii.pill),
              ),
              child: Row(
                mainAxisSize: MainAxisSize.min,
                children: [
                  Icon(Icons.location_on_rounded, size: 14, color: AppColors.primaryDeep),
                  const SizedBox(width: 4),
                  Text(_locationLabel,
                      style: const TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primaryDeep)),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            AiPromptBar(
              placeholder: 'Try "AC repair", "electrician", "plumber nearby"...',
              enableDebounce: true,
              onResult: (result) {
                final query = result.response.trim().toLowerCase();
                setState(() => _searchController.text = query);
              },
            ),
            if (showActions) ...[
              const SizedBox(height: AppSpacing.md),
              Row(
                children: [
                  Expanded(
                    child: PrimaryButton(
                      label: 'Explore',
                      icon: const Icon(Icons.explore_rounded, size: 18),
                      onPressed: () => context.go(AppRoutes.discovery),
                    ),
                  ),
                  const SizedBox(width: 12),
                  Expanded(
                    child: SecondaryButton(
                      label: 'Browse All',
                      icon: const Icon(Icons.store_rounded, size: 18),
                      onPressed: () => context.push(AppRoutes.publicBrowse),
                    ),
                  ),
                ],
              ),
            ],
          ],
        ),
      ),
    );
  }

  Widget _buildCategoryGrid(List<Map<String, dynamic>> categories) {
    final items = categories.isNotEmpty ? categories : _defaultCategories();
    if (items.isEmpty) return const SliverToBoxAdapter(child: SizedBox.shrink());

    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.pageInset, AppSpacing.md, AppSpacing.pageInset, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: SectionHeader(
                title: 'Browse by category',
                actionLabel: 'View all',
                onAction: () => context.go(AppRoutes.discovery),
              ),
            ),
            GridView.builder(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 2,
                childAspectRatio: 1.5,
                crossAxisSpacing: AppSpacing.sm,
                mainAxisSpacing: AppSpacing.sm,
              ),
              itemCount: items.length > _gridPreviewCount ? _gridPreviewCount : items.length,
              itemBuilder: (context, index) {
                final cat = items[index];
                final name = (cat['name'] as String? ?? '');
                final icon = (cat['icon'] as String? ?? '');
                final priceRange = (cat['priceRange'] as String? ?? '');
                final providerCount = (cat['providerCount'] as int? ?? 0);
                final selected = _selectedCategory == name;
                return _CategoryCard(
                  name: name,
                  icon: icon,
                  priceRange: priceRange,
                  providerCount: providerCount,
                  selected: selected,
                  onTap: () {
                    setState(() => _selectedCategory = selected ? null : name);
                  },
                );
              },
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildZoneSection(String title, List<Map<String, dynamic>> zones, IconData icon) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.pageInset, AppSpacing.lg, AppSpacing.pageInset, 0),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: SectionHeader(
                title: title,
                actionLabel: 'View all',
                onAction: () => context.go(AppRoutes.discovery),
              ),
            ),
            ...zones.take(_listPreviewCount).map((zone) => Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: _ZoneCard(
                name: zone['name'] as String? ?? '',
                city: zone['city'] as String? ?? '',
                status: zone['status'] as String? ?? 'live',
                societyCount: zone['societyCount'] as int? ?? 0,
                marketCount: zone['marketCount'] as int? ?? 0,
                onTap: () => context.go(AppRoutes.discovery),
              ),
            )),
          ],
        ),
      ),
    );
  }

  Widget _buildProviderSection(
    List<MarketplaceProvider> filtered,
    AsyncValue<List<MarketplaceProvider>> asyncValue,
    bool hasActiveFilter,
    bool showEmptyState,
    bool hasSearch,
  ) {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: AppSpacing.pageInset),
        child: ServiqAsyncBody<List<MarketplaceProvider>>(
          value: asyncValue,
          onRetry: () => ref.invalidate(marketplaceProvidersProvider(_selectedCategory)),
          loadingBuilder: () => _ProviderListShimmer(),
          errorBuilder: (error, stack) {
            return ErrorStateView(
              title: 'Could not load providers',
              message: error.toString(),
              onRetry: () => ref.invalidate(marketplaceProvidersProvider(_selectedCategory)),
            );
          },
          data: (providers) {
            if (showEmptyState) {
              return Padding(
                padding: const EdgeInsets.only(top: AppSpacing.md),
                child: EmptyStateView(
                  icon: Icons.search_off_rounded,
                  title: 'No providers found nearby',
                  message: hasActiveFilter
                      ? 'Try a different search term.'
                      : 'Try adjusting your filters or browse all providers.',
                ),
              );
            }

            if (filtered.isEmpty && !hasActiveFilter) return const SizedBox.shrink();

            // Unfiltered landing renders a small "Featured providers" preview;
            // "Browse all" opens the full provider listing. Filtered views
            // (category or search) are results lists and show every match.
            final isPreview = !hasActiveFilter;
            final previewProviders =
                isPreview ? filtered.take(_listPreviewCount).toList() : filtered;

            final sectionTitle = _selectedCategory != null
                ? '$_selectedCategory providers'
                : hasSearch
                    ? 'Results'
                    : 'Featured providers';

            return Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                if (isPreview)
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.lg, bottom: AppSpacing.sm),
                    child: SectionHeader(
                      title: sectionTitle,
                      actionLabel: 'Browse all',
                      onAction: _openBrowseAll,
                    ),
                  )
                else
                  Padding(
                    padding: const EdgeInsets.only(top: AppSpacing.lg, bottom: AppSpacing.sm),
                    child: Text(sectionTitle, style: Theme.of(context).textTheme.titleLarge),
                  ),
                for (final provider in previewProviders) ...[
                  MarketplaceProviderCard(
                    name: provider.name,
                    location: provider.location.isNotEmpty ? provider.location : null,
                    avatarUrl: provider.avatarUrl.isNotEmpty ? provider.avatarUrl : null,
                    bio: provider.bio,
                    avgRating: provider.avgRating,
                    reviewCount: provider.reviewCount,
                    completedJobs: provider.completedJobs,
                    responseMinutes: provider.responseMinutes,
                    priceMin: provider.priceMin,
                    priceMax: provider.priceMax,
                    verified: provider.verified,
                    featured: provider.featured,
                    onTap: () => _showProviderDetail(context, provider),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                ],
              ],
            );
          },
        ),
      ),
    );
  }

  Widget _buildBusinessCta() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.pageInset, AppSpacing.xxxl, AppSpacing.pageInset, AppSpacing.lg),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.lg),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primarySoft.withValues(alpha: 0.5),
                    AppColors.accentSoft.withValues(alpha: 0.3),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppRadii.xl),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.12)),
              ),
              child: Column(
                children: [
                  Container(
                    padding: const EdgeInsets.all(10),
                    decoration: BoxDecoration(
                      gradient: AppGradients.premiumAccent,
                      borderRadius: BorderRadius.circular(AppRadii.md),
                    ),
                    child: const Icon(Icons.store_rounded, size: 28, color: Colors.white),
                  ),
                  const SizedBox(height: AppSpacing.sm),
                  Text('Are you a service provider?',
                      style: Theme.of(context).textTheme.titleMedium?.copyWith(fontWeight: FontWeight.w700)),
                  const SizedBox(height: AppSpacing.xxs),
                  Text('List your business on ServiQ and get more customers from your neighborhood.',
                      style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                      textAlign: TextAlign.center),
                  const SizedBox(height: AppSpacing.md),
                  PrimaryButton(
                    label: 'List Your Business',
                    icon: const Icon(Icons.store_rounded, size: 18),
                    onPressed: () => context.push(AppRoutes.signIn),
                  ),
                ],
              ),
            ),
          ),
        ),
      ),
    );
  }

  Widget _buildFooter() {
    return SliverToBoxAdapter(
      child: Padding(
        padding: const EdgeInsets.fromLTRB(AppSpacing.pageInset, AppSpacing.lg, AppSpacing.pageInset, AppSpacing.xxxl),
        child: Text(
          'ServiQ — Local marketplace · Built for the community',
          style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
          textAlign: TextAlign.center,
        ),
      ),
    );
  }

  List<Map<String, dynamic>> _defaultCategories() {
    return [
      {'name': 'Electrician', 'icon': '⚡', 'priceRange': '₹150-500'},
      {'name': 'Plumber', 'icon': '🔧', 'priceRange': '₹200-600'},
      {'name': 'AC Repair', 'icon': '❄️', 'priceRange': '₹300-1500'},
      {'name': 'RO Repair', 'icon': '💧', 'priceRange': '₹200-800'},
      {'name': 'Carpenter', 'icon': '🪚', 'priceRange': '₹300-1000'},
      {'name': 'Appliance Repair', 'icon': '🔌', 'priceRange': '₹250-1200'},
      {'name': 'Mobile Repair', 'icon': '📱', 'priceRange': '₹200-1500'},
      {'name': 'Bike Repair', 'icon': '🏍️', 'priceRange': '₹100-800'},
    ];
  }

  void _openBrowseAll() {
    context.push(AppRoutes.publicBrowse);
  }

  void _showProviderDetail(BuildContext context, MarketplaceProvider provider) {
    showModalBottomSheet(
      context: context,
      isScrollControlled: true,
      backgroundColor: Colors.transparent,
      builder: (sheetContext) => DraggableScrollableSheet(
        expand: false,
        initialChildSize: 0.65,
        maxChildSize: 0.85,
        minChildSize: 0.3,
        builder: (_, scrollController) => ClipRRect(
          borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 20, sigmaY: 20),
            child: Container(
              decoration: BoxDecoration(
                color: Theme.of(context).scaffoldBackgroundColor.withValues(alpha: 0.96),
                borderRadius: const BorderRadius.vertical(top: Radius.circular(AppRadii.xl)),
              ),
              child: SingleChildScrollView(
                controller: scrollController,
                padding: const EdgeInsets.all(AppSpacing.pageInset),
                child: _ProviderDetailSheet(provider: provider, onContact: () {
                  Navigator.of(sheetContext).pop();
                  context.push(AppRoutes.signIn);
                }),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _CategoryCard extends StatelessWidget {
  const _CategoryCard({
    required this.name,
    required this.icon,
    this.priceRange,
    this.providerCount = 0,
    this.selected = false,
    required this.onTap,
  });

  final String name;
  final String icon;
  final String? priceRange;
  final int providerCount;
  final bool selected;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isDark = Theme.of(context).brightness == Brightness.dark;
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.sm),
            decoration: BoxDecoration(
              gradient: selected
                  ? LinearGradient(
                      colors: [
                        AppColors.primarySoft.withValues(alpha: 0.6),
                        AppColors.primarySoft.withValues(alpha: 0.3),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    )
                  : LinearGradient(
                      colors: [
                        isDark ? AppColors.darkSurface.withValues(alpha: 0.6) : Colors.white.withValues(alpha: 0.7),
                        isDark ? AppColors.darkSurfaceAlt.withValues(alpha: 0.4) : Colors.white.withValues(alpha: 0.4),
                      ],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
              borderRadius: BorderRadius.circular(AppRadii.xl),
              border: Border.all(
                color: selected
                    ? AppColors.primary.withValues(alpha: 0.3)
                    : Theme.of(context).colorScheme.outline.withValues(alpha: 0.2),
              ),
            ),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(icon, style: const TextStyle(fontSize: 22)),
                const SizedBox(height: AppSpacing.xs),
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                if (priceRange != null && priceRange!.isNotEmpty)
                  Text(priceRange!,
                      style: TextStyle(
                        fontSize: 11,
                        color: selected ? AppColors.primaryDeep : Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5),
                        fontWeight: FontWeight.w600,
                      )),
                if (providerCount > 0)
                  Container(
                    margin: const EdgeInsets.only(top: 2),
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                    decoration: BoxDecoration(
                      color: AppColors.primarySoft,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                    child: Text('$providerCount providers',
                        style: TextStyle(fontSize: 9, fontWeight: FontWeight.w600, color: AppColors.primaryDeep)),
                  ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ZoneCard extends StatelessWidget {
  const _ZoneCard({
    required this.name,
    required this.city,
    this.status = 'live',
    this.societyCount = 0,
    this.marketCount = 0,
    required this.onTap,
  });

  final String name;
  final String city;
  final String status;
  final int societyCount;
  final int marketCount;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    final isLive = status == 'live';
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
          child: Container(
            padding: const EdgeInsets.all(AppSpacing.md),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primarySoft.withValues(alpha: 0.4),
                  AppColors.surface.withValues(alpha: 0.3),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.xl),
              border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.15)),
            ),
            child: Row(
              children: [
                Container(
                  width: 44,
                  height: 44,
                  decoration: BoxDecoration(
                    gradient: AppGradients.premiumAccent,
                    borderRadius: BorderRadius.circular(AppRadii.md),
                  ),
                  child: const Icon(Icons.map_rounded, size: 22, color: Colors.white),
                ),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                      const SizedBox(height: 2),
                      Text(city,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.5))),
                      const SizedBox(height: AppSpacing.xxs),
                      Row(
                        children: [
                          if (societyCount > 0)
                            Text('$societyCount societies', style: TextStyle(fontSize: 11, color: AppColors.primaryDeep)),
                          if (societyCount > 0 && marketCount > 0)
                            Text(' · ', style: TextStyle(fontSize: 11, color: AppColors.primaryDeep)),
                          if (marketCount > 0)
                            Text('$marketCount markets', style: TextStyle(fontSize: 11, color: AppColors.primaryDeep)),
                        ],
                      ),
                    ],
                  ),
                ),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.end,
                  children: [
                    Container(
                      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                      decoration: BoxDecoration(
                        color: isLive ? AppColors.success.withValues(alpha: 0.1) : AppColors.warning.withValues(alpha: 0.1),
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      child: Text(isLive ? 'Live' : 'Soon',
                          style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: isLive ? AppColors.success : AppColors.warning)),
                    ),
                    const SizedBox(height: AppSpacing.xxs),
                    Icon(Icons.chevron_right_rounded, size: 16, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.4)),
                  ],
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _ProviderDetailSheet extends StatelessWidget {
  const _ProviderDetailSheet({required this.provider, required this.onContact});

  final MarketplaceProvider provider;
  final VoidCallback onContact;

  @override
  Widget build(BuildContext context) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: Container(
            width: 36,
            height: 4,
            decoration: BoxDecoration(
              color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.4),
              borderRadius: BorderRadius.circular(AppRadii.pill),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.lg),
        Row(
          children: [
            CircleAvatar(
              radius: 32,
              backgroundColor: AppColors.primarySoft,
              child: Text(
                provider.name.isNotEmpty ? provider.name[0].toUpperCase() : '?',
                style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 24, color: AppColors.primaryDeep),
              ),
            ),
            const SizedBox(width: AppSpacing.md),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Expanded(
                        child: Text(provider.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: Theme.of(context).textTheme.titleLarge),
                      ),
                      if (provider.verified) ...[
                        const SizedBox(width: AppSpacing.xxs),
                        Container(
                          padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                          decoration: BoxDecoration(
                            color: AppColors.verifiedSoft,
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                          ),
                          child: const Text('Verified',
                              style: TextStyle(fontSize: 10, fontWeight: FontWeight.bold, color: AppColors.verified)),
                        ),
                      ],
                    ],
                  ),
                  Text(provider.location.isNotEmpty ? provider.location : 'Location not set',
                      style: TextStyle(fontSize: 13, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
                ],
              ),
            ),
          ],
        ),
        const SizedBox(height: AppSpacing.md),
        Wrap(
          spacing: AppSpacing.sm,
          runSpacing: AppSpacing.xs,
          children: [
            if (provider.avgRating != null)
              _DetailStat(icon: Icons.star_rounded, value: provider.avgRating?.toStringAsFixed(1) ?? '—', label: '${provider.reviewCount} reviews'),
            if (provider.completedJobs > 0)
              _DetailStat(icon: Icons.check_circle_outline_rounded, value: provider.completedJobs.toString(), label: 'jobs done'),
            if (provider.responseMinutes != null)
              _DetailStat(icon: Icons.bolt_rounded, value: '${provider.responseMinutes} min', label: 'response'),
          ],
        ),
        if (provider.bio.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('About',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
          const SizedBox(height: AppSpacing.xxs),
          Text(provider.bio, style: TextStyle(fontSize: 14, color: Theme.of(context).colorScheme.onSurface, height: 1.5)),
        ],
        if (provider.services.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('Services',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
          const SizedBox(height: AppSpacing.xs),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: provider.services.map((s) => Container(
              padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 4),
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadii.pill),
                border: Border.all(color: AppColors.primary.withValues(alpha: 0.2)),
              ),
              child: Text(s, style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600, color: AppColors.primaryDeep)),
            )).toList(),
          ),
        ],
        if (provider.listings.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Text('Available Listings',
              style: TextStyle(fontSize: 11, fontWeight: FontWeight.w700, letterSpacing: 1, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
          const SizedBox(height: AppSpacing.xs),
          ...provider.listings.map((l) => Container(
            margin: const EdgeInsets.only(bottom: AppSpacing.xxs),
            padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
            decoration: BoxDecoration(
              color: AppColors.surfaceAlt.withValues(alpha: 0.5),
              borderRadius: BorderRadius.circular(AppRadii.lg),
              border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3)),
            ),
            child: Row(
              children: [
                Expanded(child: Text(l.title, style: TextStyle(fontSize: 13, fontWeight: FontWeight.w600, color: Theme.of(context).colorScheme.onSurface))),
                if (l.price != null)
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      gradient: AppGradients.premiumAccent,
                      borderRadius: BorderRadius.circular(AppRadii.pill),
                    ),
                    child: Text('₹${l.price}',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12, color: Colors.white)),
                  ),
              ],
            ),
          )),
        ],
        const SizedBox(height: AppSpacing.lg),
        SizedBox(
          width: double.infinity,
          child: PrimaryButton(
            label: 'Contact',
            icon: const Icon(Icons.phone_rounded, size: 18),
            onPressed: onContact,
          ),
        ),
      ],
    );
  }
}

class _DetailStat extends StatelessWidget {
  const _DetailStat({required this.icon, required this.value, required this.label});

  final IconData icon;
  final String value;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(right: AppSpacing.xs),
      padding: const EdgeInsets.symmetric(horizontal: AppSpacing.sm, vertical: AppSpacing.sm),
      decoration: BoxDecoration(
        color: AppColors.surfaceAlt.withValues(alpha: 0.5),
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.3)),
      ),
      child: Column(
        children: [
          Icon(icon, size: 16, color: AppColors.primary),
          const SizedBox(height: AppSpacing.xxs),
          Text(value, style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w600)),
          Text(label, style: TextStyle(fontSize: 10, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45))),
        ],
      ),
    );
  }
}

class _ProviderListShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Column(
      children: List.generate(4, (_) => Padding(
        padding: const EdgeInsets.only(bottom: AppSpacing.sm),
        child: ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.5),
                borderRadius: BorderRadius.circular(AppRadii.xl),
                border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.1)),
              ),
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  const LoadingShimmer(width: 44, height: 44, borderRadius: 22),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const LoadingShimmer(width: 140, height: 14),
                        const SizedBox(height: 4),
                        const LoadingShimmer(width: 100, height: 11),
                        const SizedBox(height: 8),
                        Row(
                          children: [
                            LoadingShimmer(width: 60, height: 20, borderRadius: 10),
                            const SizedBox(width: 8),
                            LoadingShimmer(width: 60, height: 20, borderRadius: 10),
                          ],
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
      )),
    );
  }
}
