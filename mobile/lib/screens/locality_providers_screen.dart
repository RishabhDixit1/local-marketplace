import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api/mobile_api_provider.dart';
import '../core/constants/app_routes.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/design_tokens.dart';
import '../shared/components/loading_shimmer.dart';
import '../shared/components/marketplace_provider_card.dart';

final _localityProvidersProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, localityId) async {
  final client = ref.watch(mobileApiClientProvider);
  return client.getLocalityProviders(localityId);
});

class LocalityProvidersScreen extends ConsumerWidget {
  const LocalityProvidersScreen({
    required this.localityId,
    required this.localityName,
    super.key,
  });

  final String localityId;
  final String localityName;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final providersAsync = ref.watch(_localityProvidersProvider(localityId));

    return Scaffold(
      backgroundColor: AppColors.background,
      appBar: AppBar(
        title: Text(
          localityName,
          style: Theme.of(context).textTheme.headlineSmall,
        ),
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: providersAsync.when(
        loading: () => const Center(child: LoadingShimmer()),
        error: (err, _) => Center(
          child: Padding(
            padding: const EdgeInsets.all(32),
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Icon(Icons.error_outline_rounded,
                    size: 48, color: AppColors.danger),
                const SizedBox(height: 16),
                Text('Could not load providers',
                    style: Theme.of(context).textTheme.titleMedium),
                const SizedBox(height: 8),
                Text('$err',
                    style: Theme.of(context).textTheme.bodySmall,
                    textAlign: TextAlign.center),
              ],
            ),
          ),
        ),
        data: (providers) {
          if (providers.isEmpty) {
            return Center(
              child: Padding(
                padding: const EdgeInsets.all(32),
                child: Column(
                  mainAxisSize: MainAxisSize.min,
                  children: [
                    Icon(Icons.store_rounded,
                        size: 48, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                    const SizedBox(height: 16),
                    Text('No providers yet',
                        style: Theme.of(context).textTheme.titleMedium),
                    const SizedBox(height: 8),
                    Text(
                        'Be the first to offer services in this area.',
                        style: Theme.of(context).textTheme.bodySmall,
                        textAlign: TextAlign.center),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(AppSpacing.pageInset),
            itemCount: providers.length,
            separatorBuilder: (_, _) => const SizedBox(height: AppSpacing.sm),
            itemBuilder: (context, index) {
              final p = providers[index];
              final providerId = p['id'] as String? ?? '';
              // Support both old (full_name) and new (name) field names
              final name = (p['name'] as String? ?? p['full_name'] as String?) ?? 'Unknown Provider';
              final location = (p['location'] as String? ?? p['locality_name'] as String?) ?? '';
              final avatarUrl = p['avatar_url'] as String?;
              final bio = p['bio'] as String?;
              final completedJobs = p['completed_jobs'];
              final jobs = completedJobs is num ? completedJobs.toInt() : 0;
              final responseMinutes = p['response_minutes'] ?? p['response_time_minutes'];
              final respMin = responseMinutes is num ? responseMinutes.toInt() : null;
              final trustScore = p['trust_score'];
              final score = trustScore is num ? trustScore.toDouble() : null;
              final avgRating = p['avg_rating'];
              final rating = avgRating is num ? avgRating.toDouble() : score;

              return MarketplaceProviderCard(
                name: name,
                location: location.isNotEmpty ? location : null,
                avatarUrl: avatarUrl,
                bio: bio,
                avgRating: rating,
                completedJobs: jobs,
                responseMinutes: respMin,
                verified: false,
                onTap: providerId.isNotEmpty
                    ? () => context.push(AppRoutes.provider(providerId))
                    : null,
              );
            },
          );
        },
      ),
    );
  }
}
