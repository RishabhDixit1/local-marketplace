import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api/mobile_api_provider.dart';
import '../core/constants/app_routes.dart';
import '../core/design_system/design_system.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/design_tokens.dart';
import '../shared/components/section_header.dart';
import '../shared/widgets/ai_prompt_bar.dart';
import '../models/locality.dart';
import 'locality_providers_screen.dart';

final _localitiesProvider = FutureProvider.autoDispose
    .family<List<Locality>, String?>((ref, zoneType) async {
  final client = ref.watch(mobileApiClientProvider);
  final raw = await client.getLocalities(zoneType: zoneType, phase: 1);
  return raw.map((json) => Locality.fromJson(json)).toList();
});

final _categoriesProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, void>((ref, _) async {
  final client = ref.watch(mobileApiClientProvider);
  return client.getServiceCategories();
});

class MarketZonesScreen extends ConsumerStatefulWidget {
  const MarketZonesScreen({
    super.key,
    this.zoneSlug,
    this.zoneName,
  });

  final String? zoneSlug;
  final String? zoneName;

  @override
  ConsumerState<MarketZonesScreen> createState() => _MarketZonesScreenState();
}

class _MarketZonesScreenState extends ConsumerState<MarketZonesScreen>
    with SingleTickerProviderStateMixin {
  late final TabController _tabController;
  String _searchQuery = '';

  String get _title =>
      widget.zoneName ?? 'My Area — Crossing Republik';

  Future<void> _refresh() async {
    final zoneType = _zoneTypeKeys[_tabController.index];
    ref.invalidate(_localitiesProvider(zoneType));
    ref.invalidate(_categoriesProvider(null));
    await ref.read(_localitiesProvider(zoneType).future);
  }

  static const _tabs = [
    Tab(text: 'Societies', icon: Icon(Icons.apartment_rounded)),
    Tab(text: 'Markets', icon: Icon(Icons.store_rounded)),
    Tab(text: 'Supply Areas', icon: Icon(Icons.forest_rounded)),
    Tab(text: 'Upcoming', icon: Icon(Icons.explore_rounded)),
  ];

  static const _zoneTypeKeys = [
    'society',
    'market',
    'supply_area',
    'expansion',
  ];

  @override
  void initState() {
    super.initState();
    _tabController = TabController(length: _tabs.length, vsync: this);
  }

  @override
  void dispose() {
    _tabController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final zoneType = _zoneTypeKeys[_tabController.index];
    final localitiesAsync = ref.watch(_localitiesProvider(zoneType));
    final categoriesAsync = ref.watch(_categoriesProvider(null));

    return ServiqScaffold(
      body: SafeArea(
        child: Column(
          children: [
            _buildHeader(),
            Expanded(
              child: RefreshIndicator(
                onRefresh: _refresh,
                child: localitiesAsync.when(
                  loading: () => ListView.builder(
                    physics: const AlwaysScrollableScrollPhysics(),
                    padding: const EdgeInsets.all(AppSpacing.pageInset),
                    itemCount: 4,
                    itemBuilder: (context, index) => Padding(
                      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                      child: _GlassShimmer(),
                    ),
                  ),
                  error: (err, _) => SingleChildScrollView(
                    physics: const AlwaysScrollableScrollPhysics(),
                    child: Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.pageInset),
                        child: Column(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(Icons.cloud_off_rounded, size: 48, color: AppColors.danger),
                            const SizedBox(height: AppSpacing.sm),
                            Text('Could not load zones',
                                style: Theme.of(context).textTheme.titleMedium),
                            const SizedBox(height: AppSpacing.xxs),
                            Text('$err',
                                style: Theme.of(context).textTheme.bodySmall,
                                textAlign: TextAlign.center),
                            const SizedBox(height: AppSpacing.md),
                            FilledButton.tonal(
                              onPressed: _refresh,
                              child: const Text('Retry'),
                            ),
                          ],
                        ),
                      ),
                    ),
                  ),
                  data: (localities) {
                    final filtered = _searchQuery.isEmpty
                        ? localities
                        : localities
                            .where((l) => l.name.toLowerCase().contains(_searchQuery))
                            .toList();

                    if (filtered.isEmpty) {
                      return Center(
                        child: Padding(
                          padding: const EdgeInsets.all(AppSpacing.pageInset),
                          child: EmptyStateView(
                            icon: _searchQuery.isNotEmpty
                                ? Icons.search_off_rounded
                                : Icons.explore_rounded,
                            title: _searchQuery.isNotEmpty
                                ? 'No matches'
                                : 'No zones available',
                            message: _searchQuery.isNotEmpty
                                ? 'Try a different search term or tab.'
                                : 'New zones are being added regularly. Check back soon.',
                          ),
                        ),
                      );
                    }

                    return ListView.separated(
                      padding: const EdgeInsets.all(AppSpacing.pageInset),
                      itemCount: filtered.length + 1,
                      separatorBuilder: (_, i) =>
                          i > 0 ? const SizedBox(height: AppSpacing.sm) : const SizedBox(height: 0),
                      itemBuilder: (context, index) {
                        if (index == 0) {
                          return _CategoryStrip(categoriesAsync: categoriesAsync);
                        }
                        final loc = filtered[index - 1];
                        return _LocalityCard(locality: loc, zoneSlug: widget.zoneSlug);
                      },
                    );
                  },
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildHeader() {
    return ClipRRect(
      borderRadius: const BorderRadius.vertical(
        bottom: Radius.circular(AppRadii.xxl),
      ),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppColors.primarySoft.withValues(alpha: 0.5),
                AppColors.surface.withValues(alpha: 0.3),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            border: Border(
              bottom: BorderSide(
                color: AppColors.primary.withValues(alpha: 0.08),
              ),
            ),
          ),
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.md,
                  AppSpacing.sm,
                  AppSpacing.md,
                  0,
                ),
                child: Row(
                  children: [
                    IconButton(
                      icon: const Icon(Icons.arrow_back_rounded),
                      onPressed: () => Navigator.of(context).pop(),
                    ),
                    const SizedBox(width: AppSpacing.xs),
                    Expanded(
                      child: Text(
                        _title,
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                    ),
                    Semantics(
                      label: 'Search providers',
                      child: IconButton(
                        onPressed: () => context.push(AppRoutes.search),
                        icon: Icon(Icons.search_rounded, size: 20,
                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                      ),
                    ),
                  ],
                ),
              ),
              TabBar(
                controller: _tabController,
                isScrollable: true,
                labelColor: AppColors.primaryDeep,
                unselectedLabelColor: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                indicatorColor: AppColors.primaryDeep,
                tabs: _tabs,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.pageInset,
                  AppSpacing.xs,
                  AppSpacing.pageInset,
                  AppSpacing.xs,
                ),
                child: ClipRRect(
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                  child: BackdropFilter(
                    filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                    child: Container(
                      decoration: BoxDecoration(
                        color: AppColors.surface.withValues(alpha: 0.7),
                        borderRadius: BorderRadius.circular(AppRadii.xl),
                        border: Border.all(
                          color: AppColors.primary.withValues(alpha: 0.1),
                        ),
                      ),
                      child: TextField(
                        onChanged: (v) => setState(() => _searchQuery = v.toLowerCase().trim()),
                        decoration: InputDecoration(
                          hintText: 'Search ${_tabController.index == 0 ? 'societies' : _tabController.index == 1 ? 'markets' : 'areas'}...',
                          prefixIcon: const Icon(Icons.search_rounded, size: 20),
                          filled: false,
                          border: InputBorder.none,
                          contentPadding: const EdgeInsets.symmetric(vertical: 10),
                        ),
                      ),
                    ),
                  ),
                ),
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.pageInset,
                  0,
                  AppSpacing.pageInset,
                  AppSpacing.sm,
                ),
                child: AiPromptBar(
                  placeholder: 'Ask about services in this zone...',
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _CategoryStrip extends StatelessWidget {
  const _CategoryStrip({required this.categoriesAsync});

  final AsyncValue<List<Map<String, dynamic>>> categoriesAsync;

  @override
  Widget build(BuildContext context) {
    final categories = categoriesAsync.asData?.value ?? [];

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          SectionHeader(
            title: 'Popular Services',
            actionLabel: 'View all',
            onAction: () => context.go(AppRoutes.marketZones),
          ),
          const SizedBox(height: AppSpacing.sm),
          SizedBox(
            height: 88,
            child: categories.isEmpty
                ? _defaultCategoryIcons(context)
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: categories.length,
                    separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
                    itemBuilder: (ctx, ci) {
                      final cat = categories[ci];
                      final name = (cat['name'] as String?) ?? '';
                      final iconEmoji = (cat['icon'] as String?) ?? '';
                      return _GlassCategoryChip(
                        name: name,
                        icon: iconEmoji,
                        onTap: () {
                          context.push(
                            Uri(
                              path: AppRoutes.search,
                              queryParameters: {'category': name},
                            ).toString(),
                          );
                        },
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _defaultCategoryIcons(BuildContext context) {
    const fallback = [
      ('⚡', 'Electrician'),
      ('🔧', 'Plumber'),
      ('❄️', 'AC Repair'),
      ('💧', 'RO Repair'),
      ('🔥', 'Geyser Repair'),
      ('🔌', 'Appliance Repair'),
      ('🪚', 'Carpenter'),
    ];
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: fallback.length,
      separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
      itemBuilder: (ctx, ci) {
        final (icon, label) = fallback[ci];
        return _GlassCategoryChip(
          name: label,
          icon: icon,
          onTap: () {
            context.push(
              Uri(
                path: AppRoutes.search,
                queryParameters: {'category': label},
              ).toString(),
            );
          },
        );
      },
    );
  }
}

class _GlassCategoryChip extends StatelessWidget {
  const _GlassCategoryChip({
    required this.name,
    required this.icon,
    required this.onTap,
  });

  final String name;
  final String icon;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            width: 80,
            padding: const EdgeInsets.symmetric(vertical: AppSpacing.sm, horizontal: AppSpacing.xs),
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primarySoft.withValues(alpha: 0.4),
                  AppColors.surface.withValues(alpha: 0.2),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.xl),
              border: Border.all(
                color: AppColors.primary.withValues(alpha: 0.1),
              ),
            ),
            child: Column(
              mainAxisAlignment: MainAxisAlignment.center,
              children: [
                Text(icon, style: const TextStyle(fontSize: 22)),
                const SizedBox(height: AppSpacing.xxs),
                Text(name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: TextStyle(
                      fontSize: 10,
                      fontWeight: FontWeight.w600,
                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.7),
                    )),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _LocalityCard extends StatelessWidget {
  const _LocalityCard({required this.locality, this.zoneSlug});

  final Locality locality;
  final String? zoneSlug;

  IconData _zoneIcon() {
    switch (locality.zoneTypeEnum) {
      case ZoneType.society:
        return Icons.apartment_rounded;
      case ZoneType.market:
        return Icons.store_rounded;
      case ZoneType.supplyArea:
        return Icons.forest_rounded;
      case ZoneType.expansion:
        return Icons.explore_rounded;
    }
  }

  Color _zoneColor() {
    switch (locality.zoneTypeEnum) {
      case ZoneType.society:
        return AppColors.accent;
      case ZoneType.market:
        return AppColors.primary;
      case ZoneType.supplyArea:
        return AppColors.warm;
      case ZoneType.expansion:
        return AppColors.premium;
    }
  }

  @override
  Widget build(BuildContext context) {
    final isExpansion = locality.zoneTypeEnum == ZoneType.expansion;
    final zoneColor = _zoneColor();

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.xl),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                zoneColor.withValues(alpha: 0.08),
                AppColors.surface.withValues(alpha: 0.4),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(
              color: zoneColor.withValues(alpha: 0.12),
            ),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(AppRadii.xl),
              onTap: isExpansion
                  ? null
                  : () {
                      Navigator.of(context).push(
                        MaterialPageRoute(
                          builder: (_) => LocalityProvidersScreen(
                            localityId: locality.id,
                            localityName: locality.name,
                          ),
                        ),
                      );
                    },
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Row(
                  children: [
                    Container(
                      width: 46,
                      height: 46,
                      decoration: BoxDecoration(
                        gradient: LinearGradient(
                          colors: [
                            zoneColor.withValues(alpha: 0.2),
                            zoneColor.withValues(alpha: 0.05),
                          ],
                          begin: Alignment.topLeft,
                          end: Alignment.bottomRight,
                        ),
                        borderRadius: BorderRadius.circular(AppRadii.lg),
                        border: Border.all(
                          color: zoneColor.withValues(alpha: 0.2),
                        ),
                      ),
                      child: Icon(_zoneIcon(), color: zoneColor, size: 22),
                    ),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(locality.name,
                              style: TextStyle(
                                  fontWeight: FontWeight.w700, fontSize: 14,
                                  color: isExpansion
                                      ? Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)
                                      : Theme.of(context).colorScheme.onSurface)),
                          const SizedBox(height: AppSpacing.xxs),
                          Row(
                            children: [
                              Container(
                                padding: const EdgeInsets.symmetric(
                                    horizontal: 8, vertical: 2),
                                decoration: BoxDecoration(
                                  color: isExpansion
                                      ? AppColors.sageSoft
                                      : zoneColor.withValues(alpha: 0.12),
                                  borderRadius:
                                      BorderRadius.circular(AppRadii.pill),
                                ),
                                child: Text(
                                  locality.zoneTypeEnum == ZoneType.society
                                      ? 'Society'
                                      : locality.zoneTypeEnum == ZoneType.market
                                          ? 'Market'
                                          : locality.zoneTypeEnum == ZoneType.supplyArea
                                              ? 'Supply Area'
                                              : 'Soon',
                                  style: TextStyle(
                                    fontSize: 10,
                                    fontWeight: FontWeight.w700,
                                    color: isExpansion
                                        ? AppColors.sage
                                        : zoneColor,
                                  ),
                                ),
                              ),
                              if (locality.providerCount != null &&
                                  locality.providerCount! > 0) ...[
                                const SizedBox(width: AppSpacing.xs),
                                Icon(Icons.people_rounded, size: 12,
                                    color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                                const SizedBox(width: AppSpacing.xxs),
                                Text(
                                  '${locality.providerCount}',
                                  style: TextStyle(
                                      fontSize: 11,
                                      fontWeight: FontWeight.w600,
                                      color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                                ),
                              ],
                            ],
                          ),
                        ],
                      ),
                    ),
                    if (!isExpansion)
                      Icon(Icons.chevron_right_rounded,
                          color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _GlassShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
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
            children: [
              const LoadingShimmer(width: 46, height: 46, borderRadius: 12),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const LoadingShimmer(width: 140, height: 14),
                    const SizedBox(height: AppSpacing.xs),
                    const LoadingShimmer(width: 100, height: 11),
                  ],
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
