import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../shared/components/empty_state_view.dart';
import '../data/search_repository.dart';
import '../domain/search_models.dart';

final _mapProvidersProvider = FutureProvider.autoDispose<SearchResponse>((ref) {
  return ref.watch(searchRepositoryProvider).search(
    limit: 100,
    sortBy: 'distance',
  );
});

class MapDiscoveryPage extends ConsumerWidget {
  const MapDiscoveryPage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final async = ref.watch(_mapProvidersProvider);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Discover nearby'),
        actions: [
          IconButton(
            icon: const Icon(Icons.search),
            onPressed: () => context.push(AppRoutes.search),
          ),
        ],
      ),
      body: async.when(
        loading: () => const Center(child: CircularProgressIndicator(strokeWidth: 2)),
        error: (e, _) => Center(
          child: Column(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(Icons.cloud_off, size: 40, color: AppColors.inkFaint),
              const SizedBox(height: 12),
              Text('Unable to load nearby providers',
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(color: AppColors.inkSubtle)),
              const SizedBox(height: 12),
              FilledButton.tonal(
                onPressed: () => ref.invalidate(_mapProvidersProvider),
                child: const Text('Retry'),
              ),
            ],
          ),
        ),
        data: (response) => _MapContent(providers: response.providers),
      ),
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

    // Group providers by whether they have location data
    final withLocation = providers.where((p) => p.lat != null && p.lng != null).toList();
    final withoutLocation = providers.where((p) => p.lat == null || p.lng == null).toList();

    return ListView(
      padding: const EdgeInsets.fromLTRB(16, 8, 16, 24),
      children: [
        // Summary header
        Container(
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            color: AppColors.surfaceAlt,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            children: [
              const Icon(Icons.explore, size: 20, color: AppColors.primary),
              const SizedBox(width: 10),
              Expanded(
                child: Text(
                  '${providers.length} providers available ${withLocation.length} with location data',
                  style: const TextStyle(fontSize: 12, color: AppColors.inkSubtle),
                ),
              ),
            ],
          ),
        ),
        const SizedBox(height: 16),

        // Section: Nearby (closest first)
        if (withLocation.isNotEmpty) ...[
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text('Nearby',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          ),
          ...withLocation.take(20).map((p) => _MapProviderTile(provider: p)),
        ],

        if (withoutLocation.isNotEmpty) ...[
          const SizedBox(height: 16),
          Padding(
            padding: const EdgeInsets.only(bottom: 8),
            child: Text('Other providers',
                style: Theme.of(context).textTheme.titleSmall?.copyWith(fontWeight: FontWeight.bold)),
          ),
          ...withoutLocation.take(20).map((p) => _MapProviderTile(provider: p)),
        ],

        if (providers.length > 40)
          Padding(
            padding: const EdgeInsets.only(top: 12),
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

class _MapProviderTile extends StatelessWidget {
  final SearchResult provider;

  const _MapProviderTile({required this.provider});

  @override
  Widget build(BuildContext context) {
    return Card(
      margin: const EdgeInsets.only(bottom: 6),
      child: InkWell(
        onTap: () => context.push(AppRoutes.provider(provider.id)),
        borderRadius: BorderRadius.circular(10),
        child: Padding(
          padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
          child: Row(
            children: [
              CircleAvatar(
                radius: 18,
                backgroundImage: provider.avatarUrl.isNotEmpty
                    ? NetworkImage(provider.avatarUrl)
                    : null,
                child: provider.avatarUrl.isEmpty
                    ? Text(provider.name.isNotEmpty ? provider.name[0].toUpperCase() : '?',
                        style: const TextStyle(fontWeight: FontWeight.bold, fontSize: 12))
                    : null,
              ),
              const SizedBox(width: 10),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Flexible(
                          child: Text(provider.name,
                              style: const TextStyle(fontWeight: FontWeight.w600, fontSize: 13)),
                        ),
                        if (provider.verified)
                          const Padding(
                            padding: EdgeInsets.only(left: 4),
                            child: Icon(Icons.verified, size: 12, color: AppColors.primary),
                          ),
                      ],
                    ),
                    if (provider.location.isNotEmpty)
                      Text(provider.location,
                          style: const TextStyle(fontSize: 11, color: AppColors.inkSubtle),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                    if (provider.listings.isNotEmpty)
                      Text(provider.listings.first.title,
                          style: const TextStyle(fontSize: 10, color: AppColors.inkFaint),
                          maxLines: 1,
                          overflow: TextOverflow.ellipsis),
                  ],
                ),
              ),
              if (provider.distanceKm != null)
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                  decoration: BoxDecoration(
                    color: AppColors.primarySoft,
                    borderRadius: BorderRadius.circular(6),
                  ),
                  child: Text('${provider.distanceKm!.toStringAsFixed(1)} km',
                      style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: AppColors.primary)),
                ),
            ],
          ),
        ),
      ),
    );
  }
}
