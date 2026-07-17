import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api/mobile_api_provider.dart';
import '../core/constants/app_routes.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/design_tokens.dart';
import '../shared/components/loading_shimmer.dart';

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
        title: Text(localityName,
            style: TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: Theme.of(context).colorScheme.onSurface)),
        backgroundColor: AppColors.background,
        surfaceTintColor: Colors.transparent,
        elevation: 0,
        leading: IconButton(
          icon: Icon(Icons.arrow_back_rounded),
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
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: Theme.of(context).colorScheme.onSurface)),
                const SizedBox(height: 8),
                Text('$err',
                    style: TextStyle(
                        fontSize: 13, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
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
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: Theme.of(context).colorScheme.onSurface)),
                    const SizedBox(height: 8),
                    Text(
                        'Be the first to offer services in this area.',
                        style: TextStyle(
                            fontSize: 13, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
                        textAlign: TextAlign.center),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: providers.length,
            separatorBuilder: (_, _) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final p = providers[index];
              final providerId = p['id'] as String? ?? '';
              final name = (p['full_name'] as String? ?? p['name'] as String?) ?? 'Unknown Provider';
              final trustScore = p['trust_score'];
              final score = trustScore is num ? trustScore.toDouble() : null;
              final localityName = p['locality_name'] as String? ?? '';
              final completedJobs = p['completed_jobs'];
              final jobs = completedJobs is num ? completedJobs.toInt() : 0;

              return Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                  side: BorderSide(color: Theme.of(context).colorScheme.outline),
                ),
                child: InkWell(
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                  onTap: providerId.isNotEmpty
                      ? () => context.push(AppRoutes.provider(providerId))
                      : null,
                  child: Padding(
                    padding: const EdgeInsets.all(12),
                    child: Row(
                      children: [
                        CircleAvatar(
                          radius: 22,
                          backgroundColor: AppColors.primarySoft,
                          child: Text(
                            name.isNotEmpty ? name[0].toUpperCase() : '?',
                            style: TextStyle(
                                fontWeight: FontWeight.bold,
                                color: AppColors.primaryDeep),
                          ),
                        ),
                        const SizedBox(width: 12),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Text(name,
                                  style: TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: Theme.of(context).colorScheme.onSurface)),
                          if (localityName.isNotEmpty) ...[
                            const SizedBox(height: 2),
                            Row(
                              children: [
                                Icon(Icons.location_on_rounded, size: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                                const SizedBox(width: 4),
                                Flexible(
                                  child: Text(localityName,
                                      maxLines: 1,
                                      overflow: TextOverflow.ellipsis,
                                      style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
                                ),
                              ],
                            ),
                          ],
                          const SizedBox(height: 4),
                          Row(
                            children: [
                              if (score != null) ...[
                                Icon(Icons.star_rounded, size: 14, color: AppColors.warning),
                                const SizedBox(width: 4),
                                Text(score.toStringAsFixed(1),
                                    style: TextStyle(fontSize: 12, fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
                                const SizedBox(width: 12),
                              ],
                              if (jobs > 0) ...[
                                Icon(Icons.work_history_rounded, size: 12, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                                const SizedBox(width: 4),
                                Text('$jobs job${jobs == 1 ? '' : 's'}',
                                    style: TextStyle(fontSize: 11, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6))),
                              ],
                            ],
                          ),
                            ],
                          ),
                        ),
                        Icon(Icons.chevron_right_rounded,
                            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.45)),
                      ],
                    ),
                  ),
                ),
              );
            },
          );
        },
      ),
    );
  }
}
