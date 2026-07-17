import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';

import '../core/api/mobile_api_provider.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/design_tokens.dart';
import '../shared/components/loading_shimmer.dart';
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

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(_title),
        backgroundColor: AppColors.surface,
        bottom: PreferredSize(
          preferredSize: const Size.fromHeight(100),
          child: Column(
            children: [
              TabBar(
                controller: _tabController,
                isScrollable: true,
                labelColor: AppColors.primaryDeep,
                unselectedLabelColor: AppColors.inkSubtle,
                indicatorColor: AppColors.primaryDeep,
                tabs: _tabs,
              ),
              Padding(
                padding: const EdgeInsets.fromLTRB(
                  AppSpacing.pageInset,
                  AppSpacing.xs,
                  AppSpacing.pageInset,
                  AppSpacing.sm,
                ),
                child: TextField(
                  onChanged: (v) => setState(() => _searchQuery = v.toLowerCase().trim()),
                  decoration: InputDecoration(
                    hintText: 'Search ${_tabController.index == 0 ? 'societies' : _tabController.index == 1 ? 'markets' : 'areas'}...',
                    prefixIcon: const Icon(Icons.search_rounded, size: 20),
                    filled: true,
                    fillColor: AppColors.surface,
                    border: OutlineInputBorder(
                      borderRadius: BorderRadius.circular(AppRadii.xl),
                      borderSide: BorderSide.none,
                    ),
                    contentPadding: const EdgeInsets.symmetric(vertical: 10),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
      body: RefreshIndicator(
        onRefresh: _refresh,
        child: localitiesAsync.when(
        loading: () => ListView.builder(
          physics: const AlwaysScrollableScrollPhysics(),
          padding: const EdgeInsets.all(AppSpacing.pageInset),
          itemCount: 4,
          itemBuilder: (context, index) => Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: Container(
              padding: const EdgeInsets.all(AppSpacing.md),
              decoration: BoxDecoration(
                color: AppColors.surface,
                borderRadius: BorderRadius.circular(AppRadii.lg),
              ),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  LoadingShimmer(
                    height: 14,
                    width: MediaQuery.of(context).size.width * 0.5,
                    borderRadius: AppRadii.xs,
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  LoadingShimmer(
                    height: 12,
                    width: MediaQuery.of(context).size.width * 0.7,
                    borderRadius: AppRadii.xs,
                  ),
                ],
              ),
            ),
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
                  const SizedBox(height: 16),
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
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.search_off_rounded, size: 48,
                        color: AppColors.inkFaint),
                    const SizedBox(height: AppSpacing.sm),
                    Text(
                      _searchQuery.isNotEmpty
                          ? 'No matches'
                          : 'No zones available',
                      style: Theme.of(context).textTheme.titleMedium,
                    ),
                  ],
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
      padding: const EdgeInsets.only(bottom: 12),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Text('Popular Services',
              style: TextStyle(fontWeight: FontWeight.bold, fontSize: 13, color: AppColors.inkSubtle)),
          const SizedBox(height: 8),
          SizedBox(
            height: 72,
            child: categories.isEmpty
                ? _defaultCategoryIcons()
                : ListView.separated(
                    scrollDirection: Axis.horizontal,
                    itemCount: categories.length,
                    separatorBuilder: (_, _) => const SizedBox(width: 8),
                    itemBuilder: (ctx, ci) {
                      final cat = categories[ci];
                      final name = (cat['name'] as String?) ?? '';
                      return Column(
                        children: [
                          Container(
                            width: 44,
                            height: 44,
                            decoration: BoxDecoration(
                              color: AppColors.primarySoft,
                              borderRadius: BorderRadius.circular(AppRadii.lg),
                            ),
                            child: Icon(
                              _categoryIcon(name),
                              color: AppColors.primaryDeep, size: 22,
                            ),
                          ),
                          const SizedBox(height: 4),
                          Text(name,
                              style: const TextStyle(fontSize: 10, color: AppColors.inkSubtle)),
                        ],
                      );
                    },
                  ),
          ),
        ],
      ),
    );
  }

  Widget _defaultCategoryIcons() {
    const fallback = [
      (Icons.electrical_services_rounded, 'Electrician'),
      (Icons.plumbing_rounded, 'Plumber'),
      (Icons.ac_unit_rounded, 'AC Repair'),
      (Icons.water_drop_rounded, 'RO Repair'),
      (Icons.local_fire_department_rounded, 'Geyser Repair'),
      (Icons.build_rounded, 'Appliance Repair'),
      (Icons.handyman_rounded, 'Carpenter'),
    ];
    return ListView.separated(
      scrollDirection: Axis.horizontal,
      itemCount: fallback.length,
      separatorBuilder: (_, _) => const SizedBox(width: 8),
      itemBuilder: (ctx, ci) {
        final (icon, label) = fallback[ci];
        return Column(
          children: [
            Container(
              width: 44, height: 44,
              decoration: BoxDecoration(
                color: AppColors.primarySoft,
                borderRadius: BorderRadius.circular(AppRadii.lg),
              ),
              child: Icon(icon, color: AppColors.primaryDeep, size: 22),
            ),
            const SizedBox(height: 4),
            Text(label,
                style: const TextStyle(fontSize: 10, color: AppColors.inkSubtle)),
          ],
        );
      },
    );
  }

  IconData _categoryIcon(String name) {
    const iconMap = {
      'Electrician': Icons.electrical_services_rounded,
      'Plumber': Icons.plumbing_rounded,
      'AC Repair': Icons.ac_unit_rounded,
      'RO Repair': Icons.water_drop_rounded,
      'Geyser Repair': Icons.local_fire_department_rounded,
      'Appliance Repair': Icons.build_rounded,
      'Carpenter': Icons.handyman_rounded,
    };
    return iconMap[name] ?? Icons.build_rounded;
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
    return Card(
      margin: EdgeInsets.zero,
      elevation: 0,
      shape: RoundedRectangleBorder(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        side: BorderSide(color: AppColors.border),
      ),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.xl),
          onTap: () {
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
          padding: const EdgeInsets.all(AppSpacing.sm),
          child: Row(
            children: [
              Container(
                width: 44,
                height: 44,
                decoration: BoxDecoration(
                  color: _zoneColor().withValues(alpha: 0.1),
                  borderRadius: BorderRadius.circular(AppRadii.lg),
                ),
                child: Icon(_zoneIcon(), color: _zoneColor(), size: 22),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(locality.name,
                        style: const TextStyle(
                            fontWeight: FontWeight.bold, fontSize: 14,
                            color: AppColors.inkStrong)),
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        Container(
                          padding: const EdgeInsets.symmetric(
                              horizontal: 6, vertical: 1),
                          decoration: BoxDecoration(
                            color: _zoneColor().withValues(alpha: 0.1),
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
                                        : 'Upcoming',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.bold,
                              color: _zoneColor(),
                            ),
                          ),
                        ),
                        if (locality.providerCount != null &&
                            locality.providerCount! > 0) ...[
                          const SizedBox(width: AppSpacing.xs),
                          Icon(Icons.people_rounded, size: 12,
                              color: AppColors.inkFaint),
                          const SizedBox(width: 2),
                          Text(
                            '${locality.providerCount}',
                            style: const TextStyle(
                                fontSize: 11, color: AppColors.inkSubtle),
                          ),
                        ],
                      ],
                    ),
                  ],
                ),
              ),
              const Icon(Icons.chevron_right_rounded,
                  color: AppColors.inkFaint),
            ],
          ),
        ),
      ),
    );
  }
}
