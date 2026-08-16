import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:flutter_map/flutter_map.dart';
import 'package:go_router/go_router.dart';

import '../../../core/api/mobile_api_provider.dart';
import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/services/user_location.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/lat_lng_sanitizer.dart';
import '../../../l10n/l10n.dart';
import '../../../models/locality.dart';
import '../../../screens/locality_providers_screen.dart';
import '../../../shared/components/safe_flutter_map.dart';
import '../../../shared/components/section_header.dart';
import '../../../shared/widgets/ai_prompt_bar.dart';
import '../../search/data/search_repository.dart';
import '../../search/domain/search_models.dart';

final _discoveryProvidersProvider = FutureProvider.autoDispose<SearchResponse>((
  ref,
) async {
  final location = await ref.watch(userLocationProvider.future);
  return ref
      .read(searchRepositoryProvider)
      .search(
        limit: 50,
        lat: location?.latitude,
        lng: location?.longitude,
        sortBy: 'distance',
      );
});

final _discoveryLocalitiesProvider = FutureProvider.autoDispose<List<Locality>>(
  (ref) async {
    final client = ref.watch(mobileApiClientProvider);
    final raw = await client.getLocalities(phase: 1);
    return raw.map((json) => Locality.fromJson(json)).toList();
  },
);

final _discoveryCategoriesProvider =
    FutureProvider.autoDispose<List<Map<String, dynamic>>>((ref) async {
      final client = ref.watch(mobileApiClientProvider);
      return client.getServiceCategories();
    });

class DiscoveryPage extends ConsumerStatefulWidget {
  const DiscoveryPage({super.key});

  @override
  ConsumerState<DiscoveryPage> createState() => _DiscoveryPageState();
}

class _DiscoveryPageState extends ConsumerState<DiscoveryPage> {
  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(_discoveryProvidersProvider);
    final localitiesAsync = ref.watch(_discoveryLocalitiesProvider);
    final categoriesAsync = ref.watch(_discoveryCategoriesProvider);
    final l10n = AppLocalizations.of(context);

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
              300,
            ),
            children: [
              _buildTitle(context),
              const SizedBox(height: AppSpacing.sm),
              AiPromptBar(
                placeholder: l10n.discoverySearchHint,
                enableDebounce: true,
                onResult: (result, query) {
                  if (result.redirect != null) {
                    context.push(AppRoutes.resolveAiRedirect(result.redirect!));
                  } else if (query.trim().isNotEmpty) {
                    context.push(
                      Uri(
                        path: AppRoutes.search,
                        queryParameters: {'q': query.trim()},
                      ).toString(),
                    );
                  }
                },
              ),
              const SizedBox(height: AppSpacing.lg),
              _buildCategories(context, categoriesAsync),
              const SizedBox(height: AppSpacing.lg),
              SectionHeader(
                title: l10n.discoveryNearbyProviders,
                subtitle: l10n.discoveryNearbySubtitle,
                actionLabel: l10n.discoveryOpenMap,
                onAction: () => context.push(AppRoutes.mapDiscovery),
              ),
              const SizedBox(height: AppSpacing.sm),
              providersAsync.when(
                loading: () => const _NearbyLoading(),
                error: (err, _) => _NearbyError(
                  message: l10n.discoveryLoadError,
                  onRetry: () => ref.invalidate(_discoveryProvidersProvider),
                ),
                data: (response) => _NearbySection(
                  providers: response.providers,
                  total: response.total,
                ),
              ),
              const SizedBox(height: AppSpacing.lg),
              SectionHeader(
                title: l10n.discoveryExploreMarkets,
                subtitle: l10n.discoveryZonesSubtitle,
              ),
              const SizedBox(height: AppSpacing.sm),
              localitiesAsync.when(
                loading: () => const _ZonesLoading(),
                error: (err, _) => _NearbyError(
                  message: l10n.discoveryLoadError,
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
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                    fontWeight: FontWeight.w800,
                  ),
                ),
                const SizedBox(height: AppSpacing.xxs),
                Text(
                  AppLocalizations.of(context).discoveryFindLocalServices,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.6),
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
    final l10n = AppLocalizations.of(context);

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        SectionHeader(
          title: l10n.discoveryPopularServices,
          subtitle: l10n.discoveryServicesSubtitle,
        ),
        const SizedBox(height: AppSpacing.sm),
        SizedBox(
          height: 88,
          child: categories.isEmpty
              ? _defaultCategoryChips(context)
              : ListView.separated(
                  scrollDirection: Axis.horizontal,
                  itemCount: categories.length,
                  separatorBuilder: (_, _) =>
                      const SizedBox(width: AppSpacing.sm),
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
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.7),
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
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          child: const SizedBox(
            height: 200,
            width: double.infinity,
            child: LoadingShimmer(height: 200, borderRadius: 0),
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        ServiqSurface(
          variant: ServiqSurfaceVariant.glass,
          padding: const EdgeInsets.all(AppSpacing.xs),
          child: Column(
            children: [
              for (var i = 0; i < 4; i++) ...[
                if (i > 0) const SizedBox(height: AppSpacing.xs),
                const _NearbyTileSkeleton(),
              ],
            ],
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        const Center(child: LoadingShimmer(height: 40, width: 220)),
      ],
    );
  }
}

class _NearbyTileSkeleton extends StatelessWidget {
  const _NearbyTileSkeleton();

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.xs,
        vertical: AppSpacing.xxs,
      ),
      child: Row(
        children: [
          const LoadingShimmer(height: 36, width: 36, borderRadius: 18),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: const [
                LoadingShimmer(height: 13, width: 120),
                SizedBox(height: AppSpacing.xxs),
                LoadingShimmer(height: 11, width: 90),
              ],
            ),
          ),
          const SizedBox(width: AppSpacing.sm),
          const LoadingShimmer(height: 22, width: 48, borderRadius: 11),
        ],
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
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.6),
            ),
          ),
          const SizedBox(height: AppSpacing.sm),
          FilledButton.tonal(
            onPressed: onRetry,
            child: Text(AppLocalizations.of(context).retry),
          ),
        ],
      ),
    );
  }
}

class _NearbySection extends StatelessWidget {
  const _NearbySection({required this.providers, required this.total});

  final List<SearchResult> providers;
  final int total;

  @override
  Widget build(BuildContext context) {
    if (providers.isEmpty) {
      final l10n = AppLocalizations.of(context);
      return EmptyStateView(
        icon: Icons.explore_rounded,
        title: l10n.discoveryNoProvidersTitle,
        message: l10n.discoveryNoProvidersMessage,
      );
    }

    final located = <SearchResult>[];
    for (final provider in providers) {
      final coord = sanitizeLatLng(provider.lat, provider.lng);
      if (coord != null) {
        located.add(provider);
      } else {
        warnDroppedCoordinate(
          'discovery map',
          provider.id,
          provider.lat,
          provider.lng,
        );
      }
    }
    final shown = providers.take(10).toList();

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Padding(
          padding: const EdgeInsets.only(bottom: AppSpacing.xs),
          child: Text(
            AppLocalizations.of(context).discoveryProvidersNearYou(total),
            style: Theme.of(context).textTheme.bodySmall?.copyWith(
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.55),
              fontWeight: FontWeight.w600,
            ),
          ),
        ),
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          child: SizedBox(
            height: 200,
            child: located.isEmpty
                ? Container(
                    color: AppColors.surface,
                    alignment: Alignment.center,
                    child: Text(
                      AppLocalizations.of(context).discoveryNoLocation,
                      style: TextStyle(
                        color: Theme.of(
                          context,
                        ).colorScheme.onSurface.withValues(alpha: 0.5),
                      ),
                    ),
                  )
                : SafeFlutterMap(
                    center: sanitizeLatLng(
                      located.first.lat,
                      located.first.lng,
                    ),
                    zoom: 11,
                    minZoom: 8,
                    maxZoom: 16,
                    markers: [
                      for (final p in located.take(30))
                        Marker(
                          point: sanitizeLatLng(p.lat, p.lng)!,
                          width: 36,
                          height: 36,
                          child: GestureDetector(
                            onTap: () => context.push(AppRoutes.provider(p.id)),
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
                                  p.name.isNotEmpty
                                      ? p.name[0].toUpperCase()
                                      : '?',
                                  style: const TextStyle(
                                    color: Colors.white,
                                    fontWeight: FontWeight.bold,
                                    fontSize: 13,
                                  ),
                                ),
                              ),
                            ),
                          ),
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
              for (final provider in shown)
                _NearbyProviderTile(provider: provider),
            ],
          ),
        ),
        if (total > shown.length) ...[
          const SizedBox(height: AppSpacing.sm),
          Center(
            child: PrimaryButton(
              label: AppLocalizations.of(
                context,
              ).discoveryViewAllProviders(total),
              onPressed: () => context.push(
                Uri(
                  path: AppRoutes.search,
                  queryParameters: const {'browse': '1'},
                ).toString(),
              ),
              expanded: false,
            ),
          ),
        ],
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
            AppAvatar(
              name: provider.name,
              avatarUrl: provider.avatarUrl,
              radius: 18,
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Row(
                    children: [
                      Flexible(
                        child: Text(
                          provider.name,
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis,
                          style: const TextStyle(
                            fontWeight: FontWeight.w600,
                            fontSize: 13,
                          ),
                        ),
                      ),
                      if (provider.verified) ...[
                        const SizedBox(width: 4),
                        Icon(
                          Icons.verified_rounded,
                          size: 13,
                          color: AppColors.primary,
                        ),
                      ],
                    ],
                  ),
                  if (provider.avgRating != null ||
                      provider.services.isNotEmpty) ...[
                    const SizedBox(height: 2),
                    Row(
                      children: [
                        if (provider.avgRating != null) ...[
                          const Icon(
                            Icons.star_rounded,
                            size: 12,
                            color: AppColors.marigold,
                          ),
                          const SizedBox(width: 2),
                          Text(
                            provider.avgRating!.toStringAsFixed(1),
                            style: TextStyle(
                              fontSize: 11,
                              fontWeight: FontWeight.w700,
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurface.withValues(alpha: 0.75),
                            ),
                          ),
                          const SizedBox(width: 6),
                        ],
                        Expanded(
                          child: Text(
                            provider.services.isNotEmpty
                                ? provider.services.first
                                : provider.location,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 11,
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurface.withValues(alpha: 0.6),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ],
              ),
            ),
            if (provider.distanceKm != null)
              AppPill(
                label: '${provider.distanceKm!.toStringAsFixed(1)} km',
                icon: Icons.location_on,
                backgroundColor: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.045),
                foregroundColor: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.6),
                size: AppPillSize.mini,
              ),
            const SizedBox(width: AppSpacing.xxs),
            Icon(Icons.chevron_right, size: 16, color: AppColors.primary),
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
    return Column(
      children: [
        for (var i = 0; i < 3; i++) ...[
          if (i > 0) const SizedBox(height: AppSpacing.sm),
          ServiqSurface(
            variant: ServiqSurfaceVariant.glass,
            padding: const EdgeInsets.all(AppSpacing.md),
            child: Row(
              children: [
                const LoadingShimmer(height: 44, width: 44, borderRadius: 12),
                const SizedBox(width: AppSpacing.sm),
                Expanded(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: const [
                      LoadingShimmer(height: 14, width: 140),
                      SizedBox(height: AppSpacing.xxs),
                      LoadingShimmer(height: 11, width: 100),
                    ],
                  ),
                ),
                const SizedBox(width: AppSpacing.sm),
                const LoadingShimmer(height: 16, width: 16, borderRadius: 8),
              ],
            ),
          ),
        ],
      ],
    );
  }
}

class _ZonesSection extends StatelessWidget {
  const _ZonesSection({required this.localities});

  final List<Locality> localities;

  @override
  Widget build(BuildContext context) {
    if (localities.isEmpty) {
      final l10n = AppLocalizations.of(context);
      return EmptyStateView(
        icon: Icons.map_outlined,
        title: l10n.discoveryNoZonesTitle,
        message: l10n.discoveryNoZonesMessage,
      );
    }

    final l10n = AppLocalizations.of(context);
    final live = localities
        .where((locality) => locality.zoneTypeEnum != ZoneType.expansion)
        .toList();
    final upcoming = localities
        .where((locality) => locality.zoneTypeEnum == ZoneType.expansion)
        .toList();
    final societies = localities
        .where((locality) => locality.zoneTypeEnum == ZoneType.society)
        .length;
    final markets = localities
        .where((locality) => locality.zoneTypeEnum == ZoneType.market)
        .length;

    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Center(
          child: AppPill(
            label: l10n.discoveryMarketsSummary(societies, markets),
            icon: Icons.storefront_rounded,
            backgroundColor: AppColors.primary.withValues(alpha: 0.08),
            foregroundColor: AppColors.primaryDeep,
            size: AppPillSize.mini,
          ),
        ),
        const SizedBox(height: AppSpacing.sm),
        _groupLabel(context, l10n.discoveryLiveNow),
        const SizedBox(height: AppSpacing.xs),
        for (final locality in live)
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.sm),
            child: _DiscoveryZoneCard(locality: locality),
          ),
        if (upcoming.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.sm),
          _groupLabel(context, l10n.discoveryBrowseLocalZones),
          const SizedBox(height: AppSpacing.xs),
          for (final locality in upcoming)
            Padding(
              padding: const EdgeInsets.only(bottom: AppSpacing.sm),
              child: _DiscoveryZoneCard(locality: locality),
            ),
        ],
      ],
    );
  }

  Widget _groupLabel(BuildContext context, String label) {
    return Text(
      label,
      style: Theme.of(context).textTheme.labelLarge?.copyWith(
        fontWeight: FontWeight.w800,
        letterSpacing: 0.4,
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
      ),
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
    final l10n = AppLocalizations.of(context);

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
            border: Border.all(color: zoneColor.withValues(alpha: 0.12)),
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
                                  ? Theme.of(context).colorScheme.onSurface
                                        .withValues(alpha: 0.6)
                                  : null,
                            ),
                          ),
                          const SizedBox(height: AppSpacing.xxs),
                          Text(
                            _zoneSubtitle(context),
                            style: TextStyle(
                              fontSize: 11,
                              color: Theme.of(
                                context,
                              ).colorScheme.onSurface.withValues(alpha: 0.55),
                            ),
                          ),
                        ],
                      ),
                    ),
                    if (isExpansion)
                      AppPill(
                        label: l10n.discoveryUpcoming,
                        backgroundColor: zoneColor.withValues(alpha: 0.12),
                        foregroundColor: zoneColor,
                        size: AppPillSize.mini,
                      )
                    else ...[
                      AppPill(
                        label: l10n.discoveryLive,
                        backgroundColor: AppColors.success.withValues(
                          alpha: 0.12,
                        ),
                        foregroundColor: AppColors.success,
                        size: AppPillSize.mini,
                      ),
                      const SizedBox(width: AppSpacing.xs),
                      Icon(Icons.chevron_right, size: 16, color: zoneColor),
                    ],
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }

  String _zoneSubtitle(BuildContext context) {
    final l10n = AppLocalizations.of(context);
    final zoneLabel = switch (locality.zoneTypeEnum) {
      ZoneType.society => l10n.zoneSociety,
      ZoneType.market => l10n.zoneMarket,
      ZoneType.supplyArea => l10n.zoneSupplyArea,
      ZoneType.expansion => l10n.zoneComingSoon,
    };
    final count = locality.providerCount;
    if (count != null && count > 0) {
      return '$zoneLabel · ${l10n.discoveryZoneProviderCount(count)}';
    }
    return zoneLabel;
  }
}
