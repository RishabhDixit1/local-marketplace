import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/api/mobile_api_client.dart';
import '../../../core/design_system/serviq_async_state.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/app_buttons.dart';
import '../data/launchpad_repository.dart';
import '../data/provider_listing_repository.dart';
import '../domain/launchpad_models.dart';

class ProviderLaunchpadReviewPage extends ConsumerStatefulWidget {
  const ProviderLaunchpadReviewPage({super.key});

  @override
  ConsumerState<ProviderLaunchpadReviewPage> createState() =>
      _ProviderLaunchpadReviewPageState();
}

class _ProviderLaunchpadReviewPageState
    extends ConsumerState<ProviderLaunchpadReviewPage> {
  bool _publishing = false;

  Future<void> _refresh() async {
    ref.invalidate(launchpadWorkspaceProvider);
    await ref.read(launchpadWorkspaceProvider.future);
  }

  Future<void> _publish() async {
    final workspace = ref.read(launchpadWorkspaceProvider).asData?.value;
    final draftId = workspace?.draft?.id;
    if (draftId == null || draftId.isEmpty) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Save a draft before publishing.')),
      );
      return;
    }

    setState(() => _publishing = true);
    try {
      final result = await ref
          .read(launchpadRepositoryProvider)
          .publish(draftId: draftId);
      ref.invalidate(launchpadWorkspaceProvider);
      ref.invalidate(providerListingsProvider);
      if (!mounted) return;
      ScaffoldMessenger.of(context).showSnackBar(
        SnackBar(
          content: Text(
            'Published ${result.publishedServices} services and ${result.publishedProducts} products.',
          ),
        ),
      );
    } on ApiException catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(error.message)),
        );
      }
    } catch (error) {
      if (mounted) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text(AppErrorMapper.toMessage(error))),
        );
      }
    } finally {
      if (mounted) setState(() => _publishing = false);
    }
  }

  @override
  Widget build(BuildContext context) {
    final workspace = ref.watch(launchpadWorkspaceProvider);

    return Scaffold(
      appBar: AppBar(title: const Text('Publish readiness')),
      body: SafeArea(
        child: ServiqAsyncBody<MobileLaunchpadWorkspace>(
          value: workspace,
          errorTitle: 'Unable to load launchpad',
          errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
          onRetry: _refresh,
          loadingBuilder: () =>
              const Center(child: CircularProgressIndicator()),
          data: (data) {
            final draft = data.draft;
            final answers =
                draft?.answers ?? MobileLaunchpadAnswers.empty();
            final readiness = LaunchpadReadiness.fromAnswers(answers);
            final ratio = readiness.totalCount == 0
                ? 0.0
                : readiness.completedCount / readiness.totalCount;
            final generatedServices = draft?.generatedServices ?? const [];
            final generatedProducts = draft?.generatedProducts ?? const [];
            final allGenerated = [
              ...generatedServices,
              ...generatedProducts,
            ];
            final hasGenerated = allGenerated.isNotEmpty;

            return ListView(
              padding: const EdgeInsets.fromLTRB(16, 12, 16, 28),
              children: [
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Workspace snapshot',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 8),
                      Text(
                        data.summary.profileExists
                            ? 'Public profile linked.'
                            : 'Public profile not linked yet.',
                        style: Theme.of(context).textTheme.bodyMedium,
                      ),
                      const SizedBox(height: 6),
                      Text(
                        'Live inventory · ${data.summary.totalServices} services / ${data.summary.totalProducts} products',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.inkMuted,
                        ),
                      ),
                      if ((data.summary.profilePath ?? '').trim().isNotEmpty)
                        Padding(
                          padding: const EdgeInsets.only(top: 8),
                          child: Text(
                            data.summary.profilePath!.trim(),
                            style: Theme.of(context).textTheme.labelMedium,
                          ),
                        ),
                    ],
                  ),
                ),
                const SizedBox(height: 16),
                SectionCard(
                  child: Column(
                    crossAxisAlignment: CrossAxisAlignment.start,
                    children: [
                      Text(
                        'Checklist',
                        style: Theme.of(context).textTheme.titleLarge,
                      ),
                      const SizedBox(height: 12),
                      LinearProgressIndicator(
                        value: ratio.clamp(0.0, 1.0),
                        minHeight: 8,
                        borderRadius: BorderRadius.circular(AppRadii.pill),
                      ),
                      const SizedBox(height: 6),
                      Text(
                        '${readiness.completedCount} of ${readiness.totalCount} complete',
                        style: Theme.of(context).textTheme.bodySmall?.copyWith(
                          color: AppColors.inkMuted,
                        ),
                      ),
                      const SizedBox(height: 12),
                      for (final item in readiness.items)
                        Padding(
                          padding: const EdgeInsets.only(bottom: 10),
                          child: Row(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Icon(
                                item.done
                                    ? Icons.check_circle_rounded
                                    : Icons.circle_outlined,
                                color: item.done
                                    ? AppColors.success
                                    : AppColors.inkMuted,
                                size: 22,
                              ),
                              const SizedBox(width: 10),
                              Expanded(
                                child: Column(
                                  crossAxisAlignment:
                                      CrossAxisAlignment.start,
                                  children: [
                                    Text(
                                      item.title,
                                      style: Theme.of(context)
                                          .textTheme
                                          .titleSmall,
                                    ),
                                    const SizedBox(height: 4),
                                    Text(
                                      item.description,
                                      style: Theme.of(context)
                                          .textTheme
                                          .bodySmall
                                          ?.copyWith(
                                            color: AppColors.inkMuted,
                                          ),
                                    ),
                                  ],
                                ),
                              ),
                            ],
                          ),
                        ),
                    ],
                  ),
                ),
                if (hasGenerated) ...[
                  const SizedBox(height: 16),
                  SectionCard(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text(
                          'Generated content',
                          style: Theme.of(context).textTheme.titleLarge,
                        ),
                        const SizedBox(height: 12),
                        if (generatedServices.isNotEmpty) ...[
                          Text(
                            'Services (${generatedServices.length})',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: 8),
                          ...generatedServices.map(
                            (s) => _GeneratedItemTile(offering: s),
                          ),
                        ],
                        if (generatedProducts.isNotEmpty) ...[
                          const SizedBox(height: 12),
                          Text(
                            'Products (${generatedProducts.length})',
                            style: Theme.of(context).textTheme.titleSmall,
                          ),
                          const SizedBox(height: 8),
                          ...generatedProducts.map(
                            (p) => _GeneratedItemTile(offering: p),
                          ),
                        ],
                      ],
                    ),
                  ),
                ],
                const SizedBox(height: 16),
                PrimaryButton(
                  label: _publishing ? 'Publishing...' : 'Publish profile',
                  icon: _publishing
                      ? const SizedBox(
                          width: 16,
                          height: 16,
                          child: CircularProgressIndicator(strokeWidth: 2),
                        )
                      : const Icon(Icons.rocket_launch_outlined),
                  onPressed: _publishing ? null : _publish,
                ),
                const SizedBox(height: 10),
                SecondaryButton(
                  label: 'Open Business AI Launchpad',
                  icon: const Icon(Icons.edit_outlined),
                  onPressed: () =>
                      context.push(AppRoutes.providerLaunchpad),
                ),
              ],
            );
          },
        ),
      ),
    );
  }
}

class _GeneratedItemTile extends StatelessWidget {
  const _GeneratedItemTile({required this.offering});

  final MobileLaunchpadGeneratedOffering offering;

  @override
  Widget build(BuildContext context) {
    final price = offering.price;
    return Container(
      width: double.infinity,
      margin: const EdgeInsets.only(bottom: 8),
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.surface,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(offering.title,
              style: Theme.of(context).textTheme.titleMedium),
          const SizedBox(height: 4),
          Text(
            [
              if (offering.category.isNotEmpty) offering.category,
              if (price != null && price > 0) 'INR ${price.round()}',
            ].join(' / '),
            style: Theme.of(context).textTheme.bodySmall,
          ),
          if (offering.description.isNotEmpty) ...[
            const SizedBox(height: 6),
            Text(
              offering.description,
              maxLines: 3,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.bodyMedium,
            ),
          ],
        ],
      ),
    );
  }
}

class LaunchpadReadiness {
  LaunchpadReadiness({required this.items});

  factory LaunchpadReadiness.fromAnswers(MobileLaunchpadAnswers answers) {
    final items = [
      LaunchpadReadinessItem(
        title: 'Business basics',
        description:
            'Public name, category, and base location are ready for publishing.',
        done: answers.businessName.isNotEmpty &&
            answers.primaryCategory.isNotEmpty &&
            answers.location.isNotEmpty,
      ),
      LaunchpadReadinessItem(
        title: 'Offer catalog',
        description: 'At least one service or product outline exists.',
        done: answers.coreOfferings.isNotEmpty,
      ),
      LaunchpadReadinessItem(
        title: 'Customer-facing copy',
        description: 'Profile summary or AI-ready outline is present.',
        done: answers.shortDescription.isNotEmpty ||
            (answers.businessName.isNotEmpty &&
                answers.coreOfferings.isNotEmpty),
      ),
      LaunchpadReadinessItem(
        title: 'Contact or availability',
        description: 'Phone or hours gives customers a path to reach you.',
        done: answers.phone.isNotEmpty || answers.hours.isNotEmpty,
      ),
    ];
    return LaunchpadReadiness(items: items);
  }

  final List<LaunchpadReadinessItem> items;

  int get totalCount => items.length;
  int get completedCount => items.where((item) => item.done).length;
}

class LaunchpadReadinessItem {
  const LaunchpadReadinessItem({
    required this.title,
    required this.description,
    required this.done,
  });

  final String title;
  final String description;
  final bool done;
}
