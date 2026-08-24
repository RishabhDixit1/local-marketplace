import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../l10n/l10n.dart';
import '../data/storefront_repository.dart';
import '../domain/storefront_models.dart';

final _browseProductsProvider =
    FutureProvider.autoDispose<StorefrontProductListResponse>((ref) async {
  return ref
      .read(storefrontRepositoryProvider)
      .fetchAllProducts(limit: 50);
});

class ProductBrowsePage extends ConsumerWidget {
  const ProductBrowsePage({super.key});

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final asyncValue = ref.watch(_browseProductsProvider);
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
                      l10n.browseProductsTitle,
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
                loading: () => GridView.builder(
                  padding: const EdgeInsets.symmetric(
                      horizontal: AppSpacing.pageInset),
                  gridDelegate:
                      const SliverGridDelegateWithFixedCrossAxisCount(
                    crossAxisCount: 2,
                    mainAxisSpacing: AppSpacing.sm,
                    crossAxisSpacing: AppSpacing.sm,
                    childAspectRatio: 0.75,
                  ),
                  itemCount: 6,
                  itemBuilder: (ctx, i) => Container(
                    decoration: BoxDecoration(
                      color: Theme.of(context)
                          .colorScheme
                          .onSurface
                          .withValues(alpha: 0.04),
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                    ),
                    padding: const EdgeInsets.all(AppSpacing.xs),
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Expanded(
                          flex: 3,
                          child: LoadingShimmer(
                            height: double.infinity,
                            borderRadius: AppRadii.md,
                          ),
                        ),
                        const SizedBox(height: AppSpacing.xs),
                        Expanded(
                          flex: 2,
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              LoadingShimmer(height: 12, width: 120),
                              const Spacer(),
                              LoadingShimmer(height: 13, width: 60),
                            ],
                          ),
                        ),
                      ],
                    ),
                  ),
                ),
                error: (e, _) => Center(
                  child: Text(l10n.discoveryLoadError),
                ),
                data: (response) {
                  if (response.products.isEmpty) {
                    return Center(
                      child: EmptyStateView(
                        icon: Icons.inventory_2_outlined,
                        title: l10n.noProductsTitle,
                        message: l10n.noProductsMessage,
                      ),
                    );
                  }
                  return GridView.builder(
                    padding: const EdgeInsets.symmetric(
                        horizontal: AppSpacing.pageInset),
                    gridDelegate:
                        const SliverGridDelegateWithFixedCrossAxisCount(
                      crossAxisCount: 2,
                      mainAxisSpacing: AppSpacing.sm,
                      crossAxisSpacing: AppSpacing.sm,
                      childAspectRatio: 0.75,
                    ),
                    itemCount: response.products.length,
                    itemBuilder: (ctx, i) => _ProductGridCard(
                      product: response.products[i],
                      onTap: () => context.push(
                        AppRoutes.productDetail(
                          response.products[i].id,
                          storefrontId: response.products[i].storefrontId,
                        ),
                      ),
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

class _ProductGridCard extends StatelessWidget {
  const _ProductGridCard({required this.product, required this.onTap});

  final StorefrontProduct product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(context)
              .colorScheme
              .onSurface
              .withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
            color: Theme.of(context)
                .colorScheme
                .onSurface
                .withValues(alpha: 0.06),
          ),
        ),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Expanded(
              flex: 3,
              child: product.imageUrl != null
                  ? ClipRRect(
                      borderRadius: const BorderRadius.vertical(
                          top: Radius.circular(AppRadii.lg)),
                      child: CachedNetworkImage(
                        imageUrl: product.imageUrl!,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => Container(
                          color: AppColors.surface,
                          child: const Center(
                              child: CircularProgressIndicator()),
                        ),
                        errorWidget: (_, _, _) => CategoryIllustration(
                          category: product.category ?? '',
                          title: product.title,
                          height: null,
                          borderRadius: BorderRadius.zero,
                        ),
                      ),
                    )
                  : CategoryIllustration(
                      category: product.category ?? '',
                      title: product.title,
                      height: null,
                      borderRadius: BorderRadius.zero,
                    ),
            ),
            Expanded(
              flex: 2,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.xs),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      product.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: const TextStyle(
                        fontWeight: FontWeight.w600,
                        fontSize: 12,
                      ),
                    ),
                    const Spacer(),
                    Row(
                      children: [
                        if (product.priceLabel.isNotEmpty)
                          Text(
                            product.priceLabel,
                            style: TextStyle(
                              fontWeight: FontWeight.w800,
                              fontSize: 13,
                              color: AppColors.primary,
                            ),
                          ),
                        const Spacer(),
                        if (product.storefrontName != null)
                          Flexible(
                            child: Text(
                              product.storefrontName!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(
                                fontSize: 9,
                                color: Theme.of(context)
                                    .colorScheme
                                    .onSurface
                                    .withValues(alpha: 0.45),
                              ),
                            ),
                          ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}
