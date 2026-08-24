import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';
import 'package:latlong2/latlong.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/services/user_location.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/lat_lng_sanitizer.dart';
import '../../../shared/components/safe_flutter_map.dart';
import '../../../shared/components/section_header.dart';
import '../data/search_repository.dart';
import '../domain/search_models.dart';

final _mapProvidersProvider = FutureProvider.autoDispose<SearchResponse>((
  ref,
) async {
  final location = await ref.watch(userLocationProvider.future);
  return ref
      .watch(searchRepositoryProvider)
      .search(
        limit: 100,
        sortBy: 'distance',
        lat: location?.latitude,
        lng: location?.longitude,
        // Keep the map scoped to the pilot area instead of pulling providers
        // whose coordinates are hundreds of kilometres away.
        radiusKm: location != null ? 25 : null,
      );
});

class MapDiscoveryPage extends ConsumerWidget {
  const MapDiscoveryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_mapProvidersProvider);
    final userLocation = ref.watch(userLocationProvider).asData?.value;

    return ServiqScaffold(
      appBar: ServiqTopBar(
        title: 'Discover nearby',
        actions: [
          IconButton(
            icon: Icon(Icons.search),
            onPressed: () => context.push(AppRoutes.search),
          ),
        ],
      ),
      body: async.when(
        loading: () => const _MapLoadingState(),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                Icons.cloud_off,
                size: 40,
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.45),
              ),
              const SizedBox(height: 12),
              Text(
                'Unable to load nearby providers',
                style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                  color: Theme.of(
                    context,
                  ).colorScheme.onSurface.withValues(alpha: 0.6),
                ),
              ),
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: () => ref.invalidate(_mapProvidersProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (response) => _MapWithList(
          providers: response.providers,
          userLocation: userLocation,
        ),
      ),
    );
  }
}

class _MapWithList extends StatelessWidget {
  const _MapWithList({required this.providers, this.userLocation});
  final List<SearchResult> providers;
  final LatLng? userLocation;

  @override
  Widget build(BuildContext context) {
    final located = <SearchResult>[];
    final locatedCoords = <LatLng>[];
    for (final provider in providers) {
      final coord = sanitizeLatLng(provider.lat, provider.lng);
      if (coord != null) {
        located.add(provider);
        locatedCoords.add(coord);
      } else {
        warnDroppedCoordinate(
          'map discovery',
          provider.id,
          provider.lat,
          provider.lng,
        );
      }
    }
    final safeUser = sanitizeLatLngPoint(userLocation);
    final canRenderMap = located.isNotEmpty || safeUser != null;

    // Camera priority: user location, then the centroid of the providers.
    // Never `located.first` - one far-away or out-of-area provider could
    // otherwise drag the whole map off the cluster.
    LatLng mapCenter = safeUser ?? kServiQDefaultCenter;
    if (safeUser == null && locatedCoords.isNotEmpty) {
      var sumLat = 0.0;
      var sumLng = 0.0;
      for (final c in locatedCoords) {
        sumLat += c.latitude;
        sumLng += c.longitude;
      }
      final centroid = sanitizeLatLng(
        sumLat / locatedCoords.length,
        sumLng / locatedCoords.length,
      );
      if (centroid != null) mapCenter = centroid;
    }

    return Column(
      children: [
        ClipRRect(
          borderRadius: const BorderRadius.vertical(
            bottom: Radius.circular(AppRadii.xxl),
          ),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 16, sigmaY: 16),
            child: Container(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.primarySoft.withValues(alpha: 0.4),
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
              child: SizedBox(
                height: 280,
                child: !canRenderMap
                    ? Center(
                        child: Text(
                          'No location data available',
                          style: TextStyle(
                            color: Theme.of(
                              context,
                            ).colorScheme.onSurface.withValues(alpha: 0.5),
                          ),
                        ),
                      )
                    : Stack(
                        children: [
                          SafeFlutterMap(
                            center: mapCenter,
                            zoom: 11,
                            minZoom: 8,
                            maxZoom: 16,
                            markers: [
                              for (final p in located)
                                providerMapMarker(
                                  point: sanitizeLatLng(p.lat, p.lng)!,
                                  name: p.name,
                                  avatarUrl: p.avatarUrl,
                                  onTap: () =>
                                      context.push(AppRoutes.provider(p.id)),
                                ),
                            ],
                          ),
                          if (located.isEmpty)
                            Align(
                              alignment: Alignment.topCenter,
                              child: SafeArea(
                                child: Padding(
                                  padding: const EdgeInsets.all(AppSpacing.sm),
                                  child: Container(
                                    padding: const EdgeInsets.symmetric(
                                      horizontal: AppSpacing.md,
                                      vertical: AppSpacing.xs,
                                    ),
                                    decoration: BoxDecoration(
                                      color: AppColors.surface.withValues(
                                        alpha: 0.9,
                                      ),
                                      borderRadius: BorderRadius.circular(
                                        AppRadii.pill,
                                      ),
                                      border: Border.all(
                                        color: AppColors.primary.withValues(
                                          alpha: 0.2,
                                        ),
                                      ),
                                    ),
                                    child: Text(
                                      'No provider locations yet - you are here',
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            fontWeight: FontWeight.w600,
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
          ),
        ),
        Expanded(child: _MapContent(providers: providers)),
      ],
    );
  }
}

class _MapContent extends StatelessWidget {
  final List<SearchResult> providers;

  const _MapContent({required this.providers});

  @override
  Widget build(BuildContext context) {
    if (providers.isEmpty) {
      return const Center(
        child: EmptyStateView(
          title: 'No providers nearby',
          message: 'Check back later as more local providers join.',
        ),
      );
    }

    final withLocation = <SearchResult>[];
    final withoutLocation = <SearchResult>[];
    for (final p in providers) {
      if (sanitizeLatLng(p.lat, p.lng) != null) {
        withLocation.add(p);
      } else {
        withoutLocation.add(p);
      }
    }

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        ClipRRect(
          borderRadius: BorderRadius.circular(AppRadii.xl),
          child: BackdropFilter(
            filter: ImageFilter.blur(sigmaX: 12, sigmaY: 12),
            child: Container(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.md,
                vertical: AppSpacing.sm,
              ),
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [
                    AppColors.accentSoft.withValues(alpha: 0.5),
                    AppColors.surface.withValues(alpha: 0.3),
                  ],
                  begin: Alignment.topLeft,
                  end: Alignment.bottomRight,
                ),
                borderRadius: BorderRadius.circular(AppRadii.xl),
                border: Border.all(
                  color: AppColors.primary.withValues(alpha: 0.1),
                ),
              ),
              child: Row(
                children: [
                  Icon(
                    Icons.location_on_rounded,
                    size: 18,
                    color: AppColors.primary,
                  ),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          '${providers.length} providers nearby',
                          style: Theme.of(context).textTheme.titleSmall?.copyWith(
                            fontWeight: FontWeight.w700,
                          ),
                        ),
                        const SizedBox(height: 2),
                        Text(
                          withLocation.length == providers.length
                              ? 'All mapped and visible'
                              : '${withLocation.length} on map${withoutLocation.isNotEmpty ? ' · ${withoutLocation.length} without location' : ''}',
                          style: Theme.of(context).textTheme.bodySmall?.copyWith(
                            color: Theme.of(context).colorScheme.onSurface
                                .withValues(alpha: 0.55),
                          ),
                        ),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        if (withLocation.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: SectionHeader(
              title: 'Nearby',
              subtitle: '${withLocation.length} providers with location',
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...withLocation.take(20).map((p) => _GlassMapTile(provider: p)),
        ],
        if (withoutLocation.isNotEmpty) ...[
          const SizedBox(height: AppSpacing.md),
          Padding(
            padding: const EdgeInsets.only(bottom: AppSpacing.xs),
            child: SectionHeader(
              title: 'Other providers',
              subtitle: '${withoutLocation.length} providers nearby',
            ),
          ),
          const SizedBox(height: AppSpacing.xs),
          ...withoutLocation.take(20).map((p) => _GlassMapTile(provider: p)),
        ],
        if (providers.length > 40)
          Padding(
            padding: const EdgeInsets.only(top: AppSpacing.md),
            child: Center(
              child: FilledButton.tonal(
                onPressed: () => context.push(AppRoutes.search),
                child: const Text('View all in search'),
              ),
            ),
          ),
      ],
    );
  }
}

class _MapLoadingState extends StatelessWidget {
  const _MapLoadingState();

  @override
  Widget build(BuildContext context) {
    return Column(
      children: [
        Container(
          height: 280,
          margin: const EdgeInsets.fromLTRB(16, 8, 16, 0),
          decoration: BoxDecoration(
            color: AppColors.surfaceAlt,
            borderRadius: BorderRadius.circular(AppRadii.xl),
          ),
          child: const Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                LoadingShimmer(height: 48, width: 48, borderRadius: 24),
                SizedBox(height: AppSpacing.sm),
                LoadingShimmer(height: 14, width: 140),
              ],
            ),
          ),
        ),
        const SizedBox(height: AppSpacing.md),
        Padding(
          padding: const EdgeInsets.symmetric(horizontal: 16),
          child: Column(
            children: List.generate(
              4,
              (i) => Padding(
                padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                child: Row(
                  children: [
                    const LoadingShimmer(height: 36, width: 36, borderRadius: 18),
                    const SizedBox(width: AppSpacing.sm),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: const [
                          LoadingShimmer(height: 14, width: 120),
                          SizedBox(height: 4),
                          LoadingShimmer(height: 11, width: 80),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ],
    );
  }
}

class _GlassMapTile extends StatelessWidget {
  final SearchResult provider;

  const _GlassMapTile({required this.provider});

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textSecondary = theme.colorScheme.onSurface.withValues(alpha: 0.55);

    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.xs),
      child: ClipRRect(
        borderRadius: BorderRadius.circular(AppRadii.xl),
        child: BackdropFilter(
          filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
          child: Container(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [
                  AppColors.primarySoft.withValues(alpha: 0.2),
                  AppColors.surface.withValues(alpha: 0.4),
                ],
                begin: Alignment.topLeft,
                end: Alignment.bottomRight,
              ),
              borderRadius: BorderRadius.circular(AppRadii.xl),
              border: Border.all(
                color: Theme.of(
                  context,
                ).colorScheme.outline.withValues(alpha: 0.1),
              ),
            ),
            child: Material(
              color: Colors.transparent,
              child: InkWell(
                onTap: () => context.push(AppRoutes.provider(provider.id)),
                borderRadius: BorderRadius.circular(AppRadii.xl),
                child: Padding(
                  padding: const EdgeInsets.symmetric(
                    horizontal: AppSpacing.sm,
                    vertical: AppSpacing.sm,
                  ),
                  child: Row(
                    children: [
                      AppAvatar(
                        name: provider.name,
                        avatarUrl: provider.avatarUrl,
                        radius: 20,
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
                                    style: TextStyle(
                                      fontWeight: FontWeight.w700,
                                      fontSize: 13,
                                      color: Theme.of(
                                        context,
                                      ).colorScheme.onSurface,
                                    ),
                                  ),
                                ),
                                if (provider.verified)
                                  const Padding(
                                    padding: EdgeInsets.only(left: 4),
                                    child: Icon(
                                      Icons.verified_rounded,
                                      size: 13,
                                      color: AppColors.verified,
                                    ),
                                  ),
                              ],
                            ),
                            if (provider.location.isNotEmpty)
                              Text(
                                provider.location,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 11,
                                  color: textSecondary,
                                ),
                              ),
                            if (provider.listings.isNotEmpty)
                              Text(
                                provider.listings.first.title,
                                maxLines: 1,
                                overflow: TextOverflow.ellipsis,
                                style: TextStyle(
                                  fontSize: 10,
                                  color: Theme.of(context).colorScheme.onSurface
                                      .withValues(alpha: 0.45),
                                ),
                              ),
                          ],
                        ),
                      ),
                      if (provider.distanceKm != null)
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 8,
                            vertical: 3,
                          ),
                          decoration: BoxDecoration(
                            gradient: LinearGradient(
                              colors: [
                                AppColors.primarySoft.withValues(alpha: 0.6),
                                AppColors.accentSoft.withValues(alpha: 0.3),
                              ],
                              begin: Alignment.topLeft,
                              end: Alignment.bottomRight,
                            ),
                            borderRadius: BorderRadius.circular(AppRadii.pill),
                            border: Border.all(
                              color: AppColors.primary.withValues(alpha: 0.15),
                            ),
                          ),
                          child: Text(
                            '${provider.distanceKm!.toStringAsFixed(1)} km',
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w700,
                              color: AppColors.primaryDeep,
                            ),
                          ),
                        ),
                    ],
                  ),
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}
