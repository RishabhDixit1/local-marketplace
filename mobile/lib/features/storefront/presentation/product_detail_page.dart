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

final _productDetailProvider =
    FutureProvider.autoDispose.family<StorefrontProduct?, String>((ref, id) async {
  final response = await ref
      .read(storefrontRepositoryProvider)
      .fetchAllProducts(limit: 100);
  try {
    return response.products.firstWhere((p) => p.id == id);
  } catch (_) {
    return null;
  }
});

class ProductDetailPage extends ConsumerWidget {
  const ProductDetailPage({
    super.key,
    required this.productId,
    this.storefrontId,
  });

  final String productId;
  final String? storefrontId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final productAsync = ref.watch(_productDetailProvider(productId));
    final l10n = AppLocalizations.of(context);

    return ServiqScaffold(
      body: productAsync.when(
        loading: () => const _ProductDetailSkeleton(),
        error: (e, _) => _ProductMessageView(
          message: l10n.discoveryLoadError,
          actionLabel: l10n.retry,
          onAction: () => ref.invalidate(_productDetailProvider(productId)),
        ),
        data: (product) {
          if (product == null) {
            return _ProductMessageView(message: l10n.noProductsMessage);
          }
          return _ProductBody(product: product);
        },
      ),
    );
  }
}

class _ProductDetailSkeleton extends StatelessWidget {
  const _ProductDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 300,
          pinned: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.pageInset),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                LoadingShimmer(height: 26, width: 240, borderRadius: 6),
                const SizedBox(height: AppSpacing.sm),
                LoadingShimmer(height: 22, width: 120, borderRadius: 6),
                const SizedBox(height: AppSpacing.md),
                Row(
                  children: [
                    LoadingShimmer(height: 20, width: 90, borderRadius: 10),
                    const SizedBox(width: AppSpacing.xs),
                    LoadingShimmer(height: 20, width: 90, borderRadius: 10),
                  ],
                ),
                const SizedBox(height: AppSpacing.lg),
                LoadingShimmer(height: 14, width: 130, borderRadius: 6),
                const SizedBox(height: AppSpacing.xs),
                for (var i = 0; i < 3; i++) ...[
                  LoadingShimmer(height: 12, borderRadius: 6),
                  const SizedBox(height: AppSpacing.xs),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ProductMessageView extends StatelessWidget {
  const _ProductMessageView({
    required this.message,
    this.actionLabel,
    this.onAction,
  });

  final String message;
  final String? actionLabel;
  final VoidCallback? onAction;

  @override
  Widget build(BuildContext context) {
    return CustomScrollView(
      slivers: [
        SliverAppBar(
          pinned: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
        ),
        SliverFillRemaining(
          hasScrollBody: false,
          child: Center(
            child: Column(
              mainAxisSize: MainAxisSize.min,
              children: [
                Text(
                  message,
                  textAlign: TextAlign.center,
                  style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                        color: Theme.of(context)
                            .colorScheme
                            .onSurface
                            .withValues(alpha: 0.7),
                      ),
                ),
                if (actionLabel != null && onAction != null) ...[
                  const SizedBox(height: AppSpacing.sm),
                  TextButton.icon(
                    onPressed: onAction,
                    icon: const Icon(Icons.refresh_rounded, size: 18),
                    label: Text(actionLabel!),
                  ),
                ],
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _ProductBody extends StatelessWidget {
  const _ProductBody({required this.product});

  final StorefrontProduct product;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 300,
          pinned: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          flexibleSpace: FlexibleSpaceBar(
            title: Text(
              product.title,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            background: _ProductHeroImage(
              imageUrl: product.imageUrl,
              category: product.category,
              title: product.title,
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.pageInset),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Title and price
                Text(
                  product.title,
                  style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                        fontWeight: FontWeight.w800,
                      ),
                ),
                const SizedBox(height: AppSpacing.xs),
                if (product.priceLabel.isNotEmpty)
                  Text(
                    product.priceLabel,
                    style: Theme.of(context).textTheme.titleLarge?.copyWith(
                          fontWeight: FontWeight.w800,
                          color: AppColors.primary,
                        ),
                  ),
                const SizedBox(height: AppSpacing.md),

                // Category + availability row
                Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    if (product.category != null)
                      AppPill(
                        label: product.category!,
                        icon: Icons.category_rounded,
                        backgroundColor:
                            AppColors.primary.withValues(alpha: 0.08),
                        foregroundColor: AppColors.primaryDeep,
                        size: AppPillSize.mini,
                      ),
                    AppPill(
                      label: product.isActive
                          ? l10n.productInStock
                          : l10n.productOutOfStock,
                      icon: product.isActive
                          ? Icons.check_circle_outline
                          : Icons.cancel_outlined,
                      backgroundColor: product.isActive
                          ? AppColors.success.withValues(alpha: 0.1)
                          : AppColors.danger.withValues(alpha: 0.1),
                      foregroundColor: product.isActive
                          ? AppColors.success
                          : AppColors.danger,
                      size: AppPillSize.mini,
                    ),
                    if (product.deliveryMethod == 'delivery' ||
                        product.deliveryMethod == 'both')
                      AppPill(
                        label: l10n.productDeliveryInfo,
                        icon: Icons.local_shipping_outlined,
                        backgroundColor:
                            AppColors.warmSoft.withValues(alpha: 0.5),
                        foregroundColor: AppColors.warmDeep,
                        size: AppPillSize.mini,
                      ),
                  ],
                ),
                const SizedBox(height: AppSpacing.md),

                // Description
                if (product.description != null &&
                    product.description!.isNotEmpty) ...[
                  Text(
                    l10n.storefrontDescriptionLabel,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    product.description!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                          color: Theme.of(context)
                              .colorScheme
                              .onSurface
                              .withValues(alpha: 0.7),
                          height: 1.5,
                        ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],

                // Storefront link
                if (product.storefrontName != null &&
                    product.storefrontId != null) ...[
                  Text(
                    l10n.productFromStorefront,
                    style: Theme.of(context).textTheme.titleSmall?.copyWith(
                          fontWeight: FontWeight.w700,
                        ),
                  ),
                  const SizedBox(height: AppSpacing.xs),
                  InkWell(
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    onTap: () => context.push(
                        AppRoutes.storefront(product.storefrontId!)),
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
                          Icon(Icons.storefront_rounded,
                              size: 20, color: AppColors.primary),
                          const SizedBox(width: AppSpacing.sm),
                          Expanded(
                            child: Text(
                              product.storefrontName!,
                              style: const TextStyle(
                                fontWeight: FontWeight.w600,
                                fontSize: 13,
                              ),
                            ),
                          ),
                          if (product.storefrontVerified == true)
                            Icon(Icons.verified_rounded,
                                size: 14, color: AppColors.accent),
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
                  const SizedBox(height: AppSpacing.xxl),
                ],

                // Stock info
                if (product.stock > 0)
                  Container(
                    padding: const EdgeInsets.all(AppSpacing.sm),
                    decoration: BoxDecoration(
                      color: AppColors.success.withValues(alpha: 0.06),
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                    ),
                    child: Row(
                      children: [
                        Icon(Icons.inventory_2_outlined,
                            size: 18, color: AppColors.success),
                        const SizedBox(width: AppSpacing.sm),
                        Text(
                          '${product.stock} units available',
                          style: TextStyle(
                            fontSize: 13,
                            fontWeight: FontWeight.w600,
                            color: AppColors.success,
                          ),
                        ),
                      ],
                    ),
                  ),
              ],
            ),
          ),
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 200)),
      ],
    );
  }
}

class _ProductHeroImage extends StatelessWidget {
  const _ProductHeroImage({this.imageUrl, this.category, this.title});

  final String? imageUrl;
  final String? category;
  final String? title;

  @override
  Widget build(BuildContext context) {
    if (imageUrl == null || imageUrl!.isEmpty) {
      return CategoryIllustration(
        category: category ?? '',
        title: title,
        height: null,
        borderRadius: BorderRadius.zero,
      );
    }
    return CachedNetworkImage(
      imageUrl: imageUrl!,
      fit: BoxFit.cover,
      width: double.infinity,
      placeholder: (_, _) => Container(
        color: AppColors.surface,
        child: const Center(child: CircularProgressIndicator()),
      ),
      errorWidget: (_, _, _) => CategoryIllustration(
        category: category ?? '',
        title: title,
        height: null,
        borderRadius: BorderRadius.zero,
      ),
    );
  }
}
