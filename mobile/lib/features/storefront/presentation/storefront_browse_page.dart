import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../l10n/l10n.dart';
import '../data/storefront_repository.dart';
import '../domain/storefront_models.dart';

final _browseStorefrontsProvider =
    FutureProvider.autoDispose<StorefrontListResponse>((ref) async {
  return ref
      .read(storefrontRepositoryProvider)
      .fetchStorefronts(limit: 50);
});

class StorefrontBrowsePage extends ConsumerWidget {
  const StorefrontBrowsePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncValue = ref.watch(_browseStorefrontsProvider);
    final l10n = AppLocalizations.of(context);

    return ServiqScaffold(
      body: SafeArea(
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.pageInset,
                AppSpacing.xs,
                AppSpacing.pageInset,
                0,
              ),
              child: Row(
                children: [
                  IconButton(
                    icon: const Icon(Icons.arrow_back_ios_new_rounded,
                        size: 20),
                    onPressed: () => Navigator.of(context).maybePop(),
                  ),
                  Expanded(
                    child: Text(
                      l10n.browseStorefrontsTitle,
                      style: Theme.of(context)
                          .textTheme
                          .titleLarge
                          ?.copyWith(fontWeight: FontWeight.w800),
                    ),
                  ),
                ],
              ),
            ),
            const SizedBox(height: AppSpacing.sm),
            Expanded(
              child: asyncValue.when(
                loading: () => const Center(child: CircularProgressIndicator()),
                error: (e, _) => Center(
                  child: Text(l10n.discoveryLoadError),
                ),
                data: (response) {
                  if (response.storefronts.isEmpty) {
                    return Center(
                      child: EmptyStateView(
                        icon: Icons.storefront_outlined,
                        title: l10n.noStorefrontsTitle,
                        message: l10n.noStorefrontsMessage,
                      ),
                    );
                  }
                  return ListView.builder(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.pageInset),
                    itemCount: response.storefronts.length,
                    itemBuilder: (ctx, i) => _StorefrontTile(
                      storefront: response.storefronts[i],
                      onTap: () => context.push(
                          AppRoutes.storefront(response.storefronts[i].id)),
                    ),
                  );
                },
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _StorefrontTile extends StatelessWidget {
  const _StorefrontTile({required this.storefront, required this.onTap});

  final Storefront storefront;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: InkWell(
        borderRadius: BorderRadius.circular(AppRadii.lg),
        onTap: onTap,
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.sm),
          decoration: BoxDecoration(
            color: Theme.of(context)
                .colorScheme
                .onSurface
                .withValues(alpha: 0.04),
            borderRadius: BorderRadius.circular(AppRadii.lg),
          ),
          child: Row(
            children: [
              Container(
                width: 48,
                height: 48,
                decoration: BoxDecoration(
                  gradient: LinearGradient(
                    colors: resolveCategoryTheme(
                      storefront.category ?? '',
                      storefront.name,
                    ).colors,
                    begin: Alignment.topLeft,
                    end: Alignment.bottomRight,
                  ),
                  borderRadius: BorderRadius.circular(AppRadii.md),
                ),
                child: Icon(
                  resolveCategoryTheme(
                    storefront.category ?? '',
                    storefront.name,
                  ).icon,
                  color: Colors.white,
                  size: 24,
                ),
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
                            storefront.name,
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                            style: const TextStyle(
                              fontWeight: FontWeight.w700,
                              fontSize: 14,
                            ),
                          ),
                        ),
                        if (storefront.isVerified) ...[
                          const SizedBox(width: 4),
                          Icon(Icons.verified_rounded,
                              size: 14, color: AppColors.accent),
                        ],
                      ],
                    ),
                    if (storefront.category != null) ...[
                      const SizedBox(height: 2),
                      Text(
                        storefront.category!,
                        maxLines: 1,
                        overflow: TextOverflow.ellipsis,
                        style: TextStyle(
                          fontSize: 11,
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.55),
                        ),
                      ),
                    ],
                  ],
                ),
              ),
              if (storefront.productCount != null &&
                  storefront.productCount! > 0)
                AppPill(
                  label:
                      '${storefront.productCount} items',
                  backgroundColor:
                      AppColors.warmSoft.withValues(alpha: 0.5),
                  foregroundColor: AppColors.warmDeep,
                  size: AppPillSize.mini,
                ),
              const SizedBox(width: AppSpacing.xxs),
              Icon(Icons.chevron_right,
                  size: 16,
                  color: Theme.of(context)
                      .colorScheme
                      .onSurface
                      .withValues(alpha: 0.4)),
            ],
          ),
        ),
      ),
    );
  }
}
