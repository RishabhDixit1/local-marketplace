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
            style: const TextStyle(
                fontWeight: FontWeight.bold,
                fontSize: 18,
                color: AppColors.inkStrong)),
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
                const Text('Could not load providers',
                    style: TextStyle(
                        fontWeight: FontWeight.bold,
                        color: AppColors.inkStrong)),
                const SizedBox(height: 8),
                Text('$err',
                    style: const TextStyle(
                        fontSize: 13, color: AppColors.inkSubtle),
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
                        size: 48, color: AppColors.inkFaint),
                    const SizedBox(height: 16),
                    const Text('No providers yet',
                        style: TextStyle(
                            fontWeight: FontWeight.bold,
                            color: AppColors.inkStrong)),
                    const SizedBox(height: 8),
                    const Text(
                        'Be the first to offer services in this area.',
                        style: TextStyle(
                            fontSize: 13, color: AppColors.inkSubtle),
                        textAlign: TextAlign.center),
                  ],
                ),
              ),
            );
          }

          return ListView.separated(
            padding: const EdgeInsets.all(16),
            itemCount: providers.length,
            separatorBuilder: (_, __) => const SizedBox(height: 8),
            itemBuilder: (context, index) {
              final p = providers[index];
              final providerId = p['id'] as String? ?? '';
              final name = p['name'] as String? ?? 'Unknown Provider';
              final bio = p['bio'] as String? ?? '';
              final trustScore = p['trust_score'];
              final score = trustScore is num ? trustScore.toDouble() : null;

              return Card(
                elevation: 0,
                shape: RoundedRectangleBorder(
                  borderRadius: BorderRadius.circular(AppRadii.xl),
                  side: BorderSide(color: AppColors.border),
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
                            style: const TextStyle(
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
                                  style: const TextStyle(
                                      fontWeight: FontWeight.bold,
                                      fontSize: 14,
                                      color: AppColors.inkStrong)),
                              if (bio.isNotEmpty) ...[
                                const SizedBox(height: 2),
                                Text(bio,
                                    maxLines: 1,
                                    overflow: TextOverflow.ellipsis,
                                    style: const TextStyle(
                                        fontSize: 12,
                                        color: AppColors.inkSubtle)),
                              ],
                              if (score != null) ...[
                                const SizedBox(height: 4),
                                Row(
                                  children: [
                                    Icon(Icons.star_rounded,
                                        size: 14,
                                        color: AppColors.warning),
                                    const SizedBox(width: 4),
                                    Text(score.toStringAsFixed(1),
                                        style: const TextStyle(
                                            fontSize: 12,
                                            fontWeight: FontWeight.bold,
                                            color: AppColors.inkSubtle)),
                                  ],
                                ),
                              ],
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
            },
          );
        },
      ),
    );
  }
}
