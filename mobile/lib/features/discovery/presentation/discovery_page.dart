import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/api/mobile_api_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../l10n/l10n.dart';
import '../../../models/locality.dart';
import '../../../screens/locality_providers_screen.dart';
import '../../../shared/components/section_header.dart';
import '../../../shared/widgets/ai_prompt_bar.dart';
import '../../search/data/search_repository.dart';
import '../../search/domain/search_models.dart';

final _discoveryProvidersProvider =
    FutureProvider.autoDispose<SearchResponse>((ref) {
  return ref
      .watch(searchRepositoryProvider)
      .search(limit: 50, sortBy: 'distance');
});

final _discoveryLocalitiesProvider =
    FutureProvider.autoDispose<List<Locality>>((ref) async {
  final client = ref.watch(mobileApiClientProvider);
  final raw = await client.getLocalities(phase: 1);
  return raw.map((json) => Locality.fromJson(json)).toList();
});

final _discoveryCategoriesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
  final client = ref.watch(mobileApiClientProvider);
  return client.getServiceCategories();
});

class DiscoveryPage extends ConsumerWidget {
  const DiscoveryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final providersAsync = ref.watch(_discoveryProvidersProvider);
    final localitiesAsync = ref.watch(_discoveryLocalitiesProvider);
    final categoriesAsync = ref.watch(_discoveryCategoriesProvider);

    return ServiqScaffold(
      body: SafeArea(
        child: RefreshIndicator(
          onRefresh: () async {
            ref.invalidate(_discoveryProvidersProvider);
            ref.invalidate(_discoveryLocalitiesProvider);
            ref.invalidate(_discoveryCategoriesProvider);
            await ref.read(_discoveryProvidersProvider.future);
          },
          child: ListView(
            physics: const AlwaysScrollableScrollPhysics(),
            padding: const EdgeInsets.fromLTRB(
              AppSpacing.pageInset,
              AppSpacing.xs,
              AppSpacing.pageInset,
              AppSpacing.xxl,
            ),
            children: [
              _buildTitle(context),
              const SizedBox(height: AppSpacing.sm),
              AiPromptBar(
                enableDebounce: true,
                onResult: (result) {
                  if (result.redirect != null) {
                    context.push(result.redirect!);
                  } else if (result.response.isNotEmpty) {
                    context.push(
                      Uri(
                        path: AppRoutes.search,
                        queryParameters: {'q': result.response},
                      ).toString(),
                    );
                  }
                },
              ),
              const SizedBox(height: AppSpacing.sm),
              _SearchEntry(
                onTap: () => context.push(AppRoutes.search),
              ),
              const SizedBox(height: AppSpacing.lg),
              _buildCategories(context, categoriesAsync),
              const SizedBox(height: AppSpacing.lg),
              SectionHeader(
                title: 'Nearby providers',
                subtitle: 'Tap a marker or a provider to see their work',
                actionLabel: 'Open map',
                onAction: () => context.push(AppRoutes.mapDiscovery),
              ),
              const SizedBox(height: AppSpacing.sm),
              providersAsync.when(
                loading: () => const _NearbyLoading(),
                error: (err, _) => _NearbyError(
                  message: '$err',
                  onRetry: () => ref.invalidate(_discoveryProvidersProvider),
                ),
                data: (response) => _NearbySection(providers: response.providers),
              ),
              const SizedBox(height: AppSpacing.lg),
              SectionHeader(
                title: 'Explore zones',
                subtitle: 'Societies, markets and supply areas near you',
                actionLabel: 'All zones',
                onAction: () => context.push(AppRoutes.marketZones),
              ),
              const SizedBox(height: AppSpacing.sm),
              localitiesAsync.when(
                loading: () => const _ZonesLoading(),
                error: (err, _) => _NearbyError(
                  message: '$err',
                  onRetry: () => ref.invalidate(_discoveryLocalitiesProvider),
                ),
                data: (localities) => _ZonesSection(localities: localities),
              ),
            ],
          ),
        ),
      ),
    );
  }

  Widget _buildTitle(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(top: AppSpacing.xs),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(
                  AppLocalizations.of(context).discovery,
                  style: Theme.of(context)
                      .textTheme
                      .headlineSmall
                      ?.copyWith(fontWeight: FontWeight.w800),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  'Find local services, shops and providers near you',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.6),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildCategories(
    BuildContext context,
    AsyncValue<List<Map<String, dynamic>>> categoriesAsync,
  ) {
    final categories = categoriesAsync.asData?.value ?? [];

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: 'Popular Services',
          subtitle: 'Jump straight to a service',
        ),
        const SizedBox(height: AppSpacing.sm),
        SizedBox(
          height: 88,
          child: categories.isEmpty
              ? _defaultCategoryChips(context)
              : ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: categories.length,
                  separatorBuilder: (_, _) => const SizedBox(width: AppSpacing.sm),
                  itemBuilder: (ctx, index) {
                    final cat = categories[index];
                    final name = (cat['name'] as String?) ?? '';
                    final icon = (cat['icon'] as String?) ?? '';
                    return _DiscoveryCategoryChip(
                      name: name,
                      icon: icon,
                      onTap: () {
                        if (name.isEmpty) return;
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
    );
  }

  Widget _defaultCategoryChips(BuildContext context) {
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
      itemBuilder: (ctx, index) {
        final (icon, label) = fallback[index];
        return _DiscoveryCategoryChip(
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

class _SearchEntry extends StatelessWidget {
  const _SearchEntry({required this.onTap});

  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Material(
      color: Colors.transparent,
      child: InkWell(
        onTap: onTap,
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.md,
            vertical: AppSpacing.sm,
          ),
          decoration: BoxDecoration(
            color: AppColors.surface,
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(color: Theme.of(context).colorScheme.outline),
            boxShadow: AppShadows.soft,
          ),
          child: Row(
            children: [
              Icon(
                Icons.search_rounded,
                size: 18,
                color: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.45),
              ),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Text(
                  'Search providers by name or service',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.45),
                  ),
                ),
              ),
              Icon(
                Icons.arrow_forward_rounded,
                size: 16,
                color: AppColors.primary,
              ),
            ],
          ),
        ),
      ),
    );
  }
}

class _DiscoveryCategoryChip extends StatelessWidget {
  const _DiscoveryCategoryChip({
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
            padding: const EdgeInsets.symmetric(
              vertical: AppSpacing.sm,
              horizontal: AppSpacing.xs,
            ),
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
                Text(
                  name,
                  maxLines: 1,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 10,
                    fontWeight: FontWeight.w600,
                    color: Theme.of(context)
                        .colorScheme
                        .onSurface
                        .withValues(alpha: 0.7),
                  ),
                ),
              ],
            ),
          ),
        ),
      ),
    );
  }
}

class _NearbyLoading extends StatelessWidget {
  const _NearbyLoading();

  @override
  Widget build(BuildContext context) {
    return ServiqSurface(
      variant: ServiqSurfaceVariant.glass,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }
}

class _NearbyError extends StatelessWidget {
  const _NearbyError({required this.message, required this.onRetry});

  final String message;
  final VoidCallback onRetry;

  @override
  Widget build(BuildContext context) {
    return ServiqSurface(
      variant: ServiqSurfaceVariant.glass,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(Icons.cloud_off_rounded, size: 32, color: AppColors.danger),
          const SizedBox(height: AppSpacing.sm),
          Text(
            message,
            textAlign: TextAlign.center,
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(context)
                  .colorScheme
                  .onSurface
                  .withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton.tonal(
            onPressed: onRetry,
            child: const Text('Retry'),
          ),
        ],
      ),
    );
  }
}

class _NearbySection extends StatelessWidget {
  const _NearbySection({required this.providers});

  final List<SearchResult> providers;

  @override
  Widget build(BuildContext context) {
    if (providers.isEmpty) {
      return const EmptyStateView(
        icon: Icons.explore_rounded,
        title: 'No providers nearby',
        message: 'Check back later as more local providers join.',
      );
    }

    final withLocation =
        providers.where((p) => p.lat != null && p.lng != null).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          child: SizedBox(
            height: 200,
            child: withLocation.isEmpty
                ? Container(
                    color: AppColors.surface,
                    alignment: Alignment.center,
                    child: Text(
                      'No location data available',
                      style: TextStyle(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.5),
                      ),
                    ),
                  )
                : FlutterMap(
                    options: MapOptions(
                      initialCenter: LatLng(
                        withLocation.first.lat!,
                        withLocation.first.lng!,
                      ),
                      initialZoom: 11,
                      minZoom: 8,
                      maxZoom: 16,
                    ),
                    children: [
                      TileLayer(
                        urlTemplate:
                            'https://tile.openstreetmap.org/{z}/{x}/{y}.png',
                        userAgentPackageName: 'com.serviq.app',
                      ),
                      MarkerLayer(
                        markers: withLocation.take(30).map((p) {
                          return Marker(
                            point: LatLng(p.lat!, p.lng!),
                            width: 36,
                            height: 36,
                            child: GestureDetector(
                              onTap: () =>
                                  context.push(AppRoutes.provider(p.id)),
                              child: Container(
                                decoration: BoxDecoration(
                                  gradient: AppGradients.premiumAccent,
                                  shape: BoxShape.circle,
                                  border: Border.all(
                                    color: Colors.white,
                                    width: 2,
                                  ),
                                  boxShadow: [
                                    BoxShadow(
                                      color: Colors.black.withValues(alpha: 0.25),
                                      blurRadius: 6,
                                      offset: const Offset(0, 2),
                                    ),
                                  ],
                                ),
                                child: Center(
                                  child: Text(
                                    p.name.isNotEmpty ? p.name[0].toUpperCase() : '?',
                                    style: const TextStyle(
                                      color: Colors.white,
                                      fontWeight: FontWeight.bold,
                                      fontSize: 13,
                                    ),
                                  ),
                                ),
                              ),
                            ),
                          );
                        }).toList(),
                      ),
                    ],
                  ),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        ServiqSurface(
          variant: ServiqSurfaceVariant.glass,
          padding: const EdgeInsets.all(AppSpacing.xs),
          child: Column(
            children: [
              for (final provider in providers.take(4))
                _NearbyProviderTile(provider: provider),
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        Center(
          child: PrimaryButton(
            label: 'View all ${providers.length} providers',
            onPressed: () => context.push(AppRoutes.search),
            expanded: false,
          ),
        ),
      ],
    );
  }
}

class _NearbyProviderTile extends StatelessWidget {
  const _NearbyProviderTile({required this.provider});

  final SearchResult provider;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      onTap: () => context.push(AppRoutes.provider(provider.id)),
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: Padding(
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.xs,
          vertical: AppSpacing.xxs,
        ),
        child: Row(
          children: [
            CircleAvatar(
              radius: 18,
              backgroundImage: provider.avatarUrl.isNotEmpty
                  ? NetworkImage(provider.avatarUrl)
                  : null,
              child: provider.avatarUrl.isEmpty
                  ? Text(
                      provider.name.isNotEmpty
                          ? provider.name[0].toUpperCase()
                          : '?',
                      style: const TextStyle(fontWeight: FontWeight.bold),
                    )
                  : null,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    provider.name,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  if (provider.services.isNotEmpty)
                    Text(
                      provider.services.first,
                      maxLines: 1,
                      overflow: TextOverflow.ellipsis,
                      style: TextStyle(
                        fontSize: 11,
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.6),
                      ),
                    ),
                ],
              ),
            ),
            if (provider.distanceKm != null)
              AppPill(
                label: '${provider.distanceKm!.toStringAsFixed(1)} km',
                icon: Icons.location_on,
                backgroundColor: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.045),
                foregroundColor: Theme.of(context)
                    .colorScheme
                    .onSurface
                    .withValues(alpha: 0.6),
                size: AppPillSize.mini,
              ),
            const SizedBox(width: AppSpacing.xxs),
            Icon(
              Icons.chevron_right,
              size: 16,
              color: AppColors.primary,
            ),
          ],
        ),
      ),
    );
  }
}

class _ZonesLoading extends StatelessWidget {
  const _ZonesLoading();

  @override
  Widget build(BuildContext context) {
    return ServiqSurface(
      variant: ServiqSurfaceVariant.glass,
      padding: const EdgeInsets.all(AppSpacing.lg),
      child: const Center(
        child: CircularProgressIndicator(strokeWidth: 2),
      ),
    );
  }
}

class _ZonesSection extends StatelessWidget {
  const _ZonesSection({required this.localities});

  final List<Locality> localities;

  @override
  Widget build(BuildContext context) {
    if (localities.isEmpty) {
      return const EmptyStateView(
        icon: Icons.map_outlined,
        title: 'No zones available',
        message: 'New zones are being added regularly. Check back soon.',
      );
    }

    return Column(
      children: [
        for (final locality in localities.take(5))
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: _DiscoveryZoneCard(locality: locality),
          ),
      ],
    );
  }
}

class _DiscoveryZoneCard extends StatelessWidget {
  const _DiscoveryZoneCard({required this.locality});

  final Locality locality;

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
                      width: 44,
                      height: 44,
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
                          Text(
                            locality.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                              color: isExpansion
                                  ? Theme.of(context)
                                      .colorScheme
                                      .onSurface
                                      .withValues(alpha: 0.6)
                                  : null,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            _zoneSubtitle(),
                            style: TextStyle(
                              fontSize: 11,
                              color: Theme.of(context)
                                  .colorScheme
                                  .onSurface
                                  .withValues(alpha: 0.55),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (isExpansion)
                      AppPill(
                        label: 'Upcoming',
                        backgroundColor:
                            zoneColor.withValues(alpha: 0.12),
                        foregroundColor: zoneColor,
                        size: AppPillSize.mini,
                      )
                    else
                      Icon(
                        Icons.chevron_right,
                        size: 16,
                        color: zoneColor,
                      ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _zoneSubtitle() {
    final zoneLabel = switch (locality.zoneTypeEnum) {
      ZoneType.society => 'Society',
      ZoneType.market => 'Market',
      ZoneType.supplyArea => 'Supply area',
      ZoneType.expansion => 'Coming soon',
    };
    final count = locality.providerCount;
    if (count != null && count > 0) {
      return '$zoneLabel · $count providers';
    }
    return zoneLabel;
  }
}
