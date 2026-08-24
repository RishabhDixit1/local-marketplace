import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/theme/design_tokens.dart';
import '../../../core/utils/lat_lng_sanitizer.dart';
import '../../../l10n/l10n.dart';
import '../../../shared/components/safe_flutter_map.dart';
import '../../../shared/components/section_header.dart';
import '../data/storefront_repository.dart';
import '../domain/storefront_models.dart';

final _storefrontDetailProvider = FutureProvider.autoDispose
    .family<Storefront?, String>((ref, id) async {
      return ref.read(storefrontRepositoryProvider).fetchStorefrontDetail(id);
    });

final _storefrontProductsProvider = FutureProvider.autoDispose
    .family<StorefrontProductListResponse, String>((ref, id) async {
      return ref
          .read(storefrontRepositoryProvider)
          .fetchStorefrontProducts(id, limit: 50);
    });

class StorefrontDetailPage extends ConsumerWidget {
  const StorefrontDetailPage({super.key, required this.storefrontId});

  final String storefrontId;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final storefrontAsync = ref.watch(_storefrontDetailProvider(storefrontId));
    final productsAsync = ref.watch(_storefrontProductsProvider(storefrontId));
    final l10n = AppLocalizations.of(context);

    return ServiqScaffold(
      body: storefrontAsync.when(
        loading: () => const _StorefrontDetailSkeleton(),
        error: (e, _) => _StorefrontMessageView(
          message: l10n.discoveryLoadError,
          actionLabel: l10n.retry,
          onAction: () =>
              ref.invalidate(_storefrontDetailProvider(storefrontId)),
        ),
        data: (storefront) {
          if (storefront == null) {
            return _StorefrontMessageView(message: l10n.noStorefrontsMessage);
          }
          return _StorefrontBody(
            storefront: storefront,
            productsAsync: productsAsync,
          );
        },
      ),
    );
  }
}

class _StorefrontDetailSkeleton extends StatelessWidget {
  const _StorefrontDetailSkeleton();

  @override
  Widget build(BuildContext context) {
    final muted = Theme.of(
      context,
    ).colorScheme.onSurface.withValues(alpha: 0.04);

    Widget block(double height, {double? width, double radius = 8}) {
      return LoadingShimmer(
        height: height,
        width: width ?? double.infinity,
        borderRadius: radius,
      );
    }

    Widget card({required Widget child, double radius = 12}) {
      return Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: muted,
          borderRadius: BorderRadius.circular(radius),
        ),
        child: child,
      );
    }

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 220,
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
                block(220, radius: 16),
                const SizedBox(height: AppSpacing.md),
                block(24, width: 220, radius: 6),
                const SizedBox(height: AppSpacing.sm),
                block(20, width: 110, radius: 10),
                const SizedBox(height: AppSpacing.md),
                card(
                  child: Row(
                    children: [
                      block(40, width: 40, radius: 20),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(
                        child: Column(
                          crossAxisAlignment: CrossAxisAlignment.start,
                          children: [
                            block(13, width: 140, radius: 6),
                            const SizedBox(height: AppSpacing.xxs),
                            block(11, width: 100, radius: 6),
                          ],
                        ),
                      ),
                    ],
                  ),
                ),
                const SizedBox(height: AppSpacing.md),
                block(14, width: 120, radius: 6),
                const SizedBox(height: AppSpacing.xs),
                for (var i = 0; i < 3; i++) ...[
                  block(12, radius: 6),
                  const SizedBox(height: AppSpacing.xs),
                ],
                const SizedBox(height: AppSpacing.md),
                block(14, width: 150, radius: 6),
                const SizedBox(height: AppSpacing.sm),
                SizedBox(
                  height: 160,
                  child: Row(
                    children: [
                      Expanded(child: block(160, radius: 12)),
                      const SizedBox(width: AppSpacing.sm),
                      Expanded(child: block(160, radius: 12)),
                    ],
                  ),
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }
}

class _StorefrontMessageView extends StatelessWidget {
  const _StorefrontMessageView({
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
                    color: Theme.of(
                      context,
                    ).colorScheme.onSurface.withValues(alpha: 0.7),
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

class _StorefrontBody extends StatelessWidget {
  const _StorefrontBody({
    required this.storefront,
    required this.productsAsync,
  });

  final Storefront storefront;
  final AsyncValue<StorefrontProductListResponse> productsAsync;

  @override
  Widget build(BuildContext context) {
    final l10n = AppLocalizations.of(context);

    return CustomScrollView(
      slivers: [
        SliverAppBar(
          expandedHeight: 220,
          pinned: true,
          leading: IconButton(
            icon: const Icon(Icons.arrow_back_ios_new_rounded, size: 20),
            onPressed: () => Navigator.of(context).maybePop(),
          ),
          flexibleSpace: FlexibleSpaceBar(
            title: Text(
              storefront.name,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: const TextStyle(fontSize: 16, fontWeight: FontWeight.w700),
            ),
            background: _CoverPhoto(
              url: storefront.coverUrl,
              category: storefront.category,
              name: storefront.name,
            ),
          ),
        ),
        SliverToBoxAdapter(
          child: Padding(
            padding: const EdgeInsets.all(AppSpacing.pageInset),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Row(
                  children: [
                    Expanded(
                      child: Text(
                        storefront.name,
                        style: Theme.of(context).textTheme.headlineSmall
                            ?.copyWith(fontWeight: FontWeight.w800),
                      ),
                    ),
                    if (storefront.isVerified)
                      Container(
                        padding: const EdgeInsets.symmetric(
                          horizontal: 8,
                          vertical: 4,
                        ),
                        decoration: BoxDecoration(
                          color: AppColors.accent.withValues(alpha: 0.1),
                          borderRadius: BorderRadius.circular(AppRadii.pill),
                        ),
                        child: Row(
                          mainAxisSize: MainAxisSize.min,
                          children: [
                            Icon(
                              Icons.verified_rounded,
                              size: 14,
                              color: AppColors.accent,
                            ),
                            const SizedBox(width: 4),
                            Text(
                              'Verified',
                              style: TextStyle(
                                fontSize: 11,
                                fontWeight: FontWeight.w700,
                                color: AppColors.accent,
                              ),
                            ),
                          ],
                        ),
                      ),
                  ],
                ),
                if (storefront.category != null) ...[
                  const SizedBox(height: AppSpacing.xs),
                  AppPill(
                    label: storefront.category!,
                    icon: Icons.category_rounded,
                    backgroundColor: AppColors.primary.withValues(alpha: 0.08),
                    foregroundColor: AppColors.primaryDeep,
                    size: AppPillSize.mini,
                  ),
                ],
                const SizedBox(height: AppSpacing.md),

                // Owner info
                if (storefront.owner != null)
                  _OwnerTile(owner: storefront.owner!),

                const SizedBox(height: AppSpacing.md),

                // Description
                if (storefront.description != null &&
                    storefront.description!.isNotEmpty) ...[
                  SectionHeader(title: l10n.storefrontDescriptionLabel),
                  const SizedBox(height: AppSpacing.xs),
                  Text(
                    storefront.description!,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Theme.of(
                        context,
                      ).colorScheme.onSurface.withValues(alpha: 0.7),
                      height: 1.5,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],

                // Operating hours
                if (storefront.operatingHours.isNotEmpty) ...[
                  SectionHeader(title: l10n.storefrontHoursLabel),
                  const SizedBox(height: AppSpacing.xs),
                  _OperatingHours(hours: storefront.operatingHours),
                  const SizedBox(height: AppSpacing.md),
                ],

                // Location map
                if (storefront.latitude != null &&
                    storefront.longitude != null) ...[
                  SectionHeader(title: 'Location'),
                  const SizedBox(height: AppSpacing.xs),
                  ClipRRect(
                    borderRadius: BorderRadius.circular(AppRadii.lg),
                    child: SizedBox(
                      height: 150,
                      child: SafeFlutterMap(
                        center: sanitizeLatLng(
                          storefront.latitude!,
                          storefront.longitude!,
                        ),
                        zoom: 14,
                        minZoom: 10,
                        maxZoom: 16,
                        markers: [
                          providerMapMarker(
                            point: sanitizeLatLng(
                              storefront.latitude!,
                              storefront.longitude!,
                            )!,
                            name: storefront.name,
                            avatarUrl: storefront.coverUrl ?? '',
                          ),
                        ],
                      ),
                    ),
                  ),
                  const SizedBox(height: AppSpacing.md),
                ],

                // Products grid
                SectionHeader(
                  title: l10n.storefrontProductsLabel,
                  subtitle: l10n.storefrontProductCount(
                    productsAsync.value?.total ?? 0,
                  ),
                ),
                const SizedBox(height: AppSpacing.sm),
              ],
            ),
          ),
        ),
        productsAsync.when(
          loading: () => const SliverToBoxAdapter(
            child: Center(
              child: Padding(
                padding: EdgeInsets.all(AppSpacing.xl),
                child: CircularProgressIndicator(),
              ),
            ),
          ),
          error: (e, _) => SliverToBoxAdapter(
            child: Center(child: Text(l10n.discoveryLoadError)),
          ),
          data: (response) {
            if (response.products.isEmpty) {
              return SliverToBoxAdapter(
                child: Padding(
                  padding: const EdgeInsets.symmetric(vertical: AppSpacing.xxl),
                  child: EmptyStateView(
                    icon: Icons.inventory_2_outlined,
                    title: l10n.noProductsTitle,
                    message: l10n.noProductsMessage,
                  ),
                ),
              );
            }
            return SliverPadding(
              padding: const EdgeInsets.symmetric(
                horizontal: AppSpacing.pageInset,
              ),
              sliver: SliverGrid(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 2,
                  mainAxisSpacing: AppSpacing.sm,
                  crossAxisSpacing: AppSpacing.sm,
                  childAspectRatio: 0.75,
                ),
                delegate: SliverChildBuilderDelegate(
                  (ctx, i) => _ProductCard(
                    product: response.products[i],
                    onTap: () => context.push(
                      AppRoutes.productDetail(
                        response.products[i].id,
                        storefrontId: storefront.id,
                      ),
                    ),
                  ),
                  childCount: response.products.length,
                ),
              ),
            );
          },
        ),
        const SliverToBoxAdapter(child: SizedBox(height: 200)),
      ],
    );
  }
}

class _CoverPhoto extends StatelessWidget {
  const _CoverPhoto({this.url, this.category, this.name});

  final String? url;
  final String? category;
  final String? name;

  @override
  Widget build(BuildContext context) {
    if (url == null || url!.isEmpty) {
      final theme = resolveCategoryTheme(category ?? '', name);
      return Container(
        decoration: BoxDecoration(
          gradient: LinearGradient(
            colors: theme.colors,
            begin: Alignment.topLeft,
            end: Alignment.bottomRight,
          ),
        ),
        child: Stack(
          fit: StackFit.expand,
          children: [
            Positioned(
              right: -16,
              bottom: -16,
              child: Icon(
                theme.icon,
                size: 120,
                color: Colors.white.withValues(alpha: 0.14),
              ),
            ),
          ],
        ),
      );
    }
    return CachedNetworkImage(
      imageUrl: url!,
      fit: BoxFit.cover,
      width: double.infinity,
      placeholder: (_, _) => Container(
        color: AppColors.surface,
        child: const Center(child: CircularProgressIndicator()),
      ),
      errorWidget: (_, _, _) =>
          _CoverPhoto(url: null, category: category, name: name),
    );
  }
}

class _OwnerTile extends StatelessWidget {
  const _OwnerTile({required this.owner});

  final StorefrontOwner owner;

  @override
  Widget build(BuildContext context) {
    return InkWell(
      borderRadius: BorderRadius.circular(AppRadii.lg),
      onTap: () => context.push(AppRoutes.provider(owner.id)),
      child: Container(
        padding: const EdgeInsets.all(AppSpacing.sm),
        decoration: BoxDecoration(
          color: Theme.of(
            context,
          ).colorScheme.onSurface.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(AppRadii.lg),
        ),
        child: Row(
          children: [
            AppAvatar(
              name: owner.fullName ?? '',
              avatarUrl: owner.avatarUrl ?? '',
              radius: 20,
              showVerifiedBadge: owner.verificationStatus == 'verified',
            ),
            const SizedBox(width: AppSpacing.sm),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    owner.fullName ?? '',
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: const TextStyle(
                      fontWeight: FontWeight.w600,
                      fontSize: 13,
                    ),
                  ),
                  if (owner.trustScore != null)
                    Text(
                      'Trust score: ${owner.trustScore!.toStringAsFixed(0)}',
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
            Icon(
              Icons.chevron_right,
              size: 16,
              color: Theme.of(
                context,
              ).colorScheme.onSurface.withValues(alpha: 0.4),
            ),
          ],
        ),
      ),
    );
  }
}

class _OperatingHours extends StatelessWidget {
  const _OperatingHours({required this.hours});

  final Map<String, dynamic> hours;

  @override
  Widget build(BuildContext context) {
    if (hours.isEmpty) return const SizedBox.shrink();

    final days = [
      'monday',
      'tuesday',
      'wednesday',
      'thursday',
      'friday',
      'saturday',
      'sunday',
    ];
    final now = DateTime.now();
    final currentDay = days[now.weekday - 1];

    return Container(
      padding: const EdgeInsets.all(AppSpacing.sm),
      decoration: BoxDecoration(
        color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.04),
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Column(
        children: [
          for (final day in days) ...[
            if (day != days.first)
              Divider(
                height: 1,
                color: Theme.of(
                  context,
                ).colorScheme.onSurface.withValues(alpha: 0.06),
              ),
            Padding(
              padding: const EdgeInsets.symmetric(vertical: 6, horizontal: 4),
              child: Row(
                children: [
                  SizedBox(
                    width: 90,
                    child: Text(
                      day[0].toUpperCase() + day.substring(1),
                      style: TextStyle(
                        fontSize: 12,
                        fontWeight: day == currentDay
                            ? FontWeight.w700
                            : FontWeight.w500,
                        color: day == currentDay ? AppColors.accent : null,
                      ),
                    ),
                  ),
                  Expanded(
                    child: Text(
                      hours[day]?.toString() ?? 'Closed',
                      style: TextStyle(
                        fontSize: 12,
                        color: Theme.of(
                          context,
                        ).colorScheme.onSurface.withValues(alpha: 0.6),
                      ),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ],
      ),
    );
  }
}

class _ProductCard extends StatelessWidget {
  const _ProductCard({required this.product, required this.onTap});

  final StorefrontProduct product;
  final VoidCallback onTap;

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: Container(
        decoration: BoxDecoration(
          color: Theme.of(
            context,
          ).colorScheme.onSurface.withValues(alpha: 0.04),
          borderRadius: BorderRadius.circular(AppRadii.lg),
          border: Border.all(
            color: Theme.of(
              context,
            ).colorScheme.onSurface.withValues(alpha: 0.06),
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
                        top: Radius.circular(AppRadii.lg),
                      ),
                      child: CachedNetworkImage(
                        imageUrl: product.imageUrl!,
                        width: double.infinity,
                        fit: BoxFit.cover,
                        placeholder: (_, _) => Container(
                          color: AppColors.surface,
                          child: const Center(
                            child: CircularProgressIndicator(),
                          ),
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
                        if (product.isActive)
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 4,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.success.withValues(alpha: 0.1),
                              borderRadius: BorderRadius.circular(AppRadii.xs),
                            ),
                            child: const Text(
                              'In stock',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w600,
                                color: AppColors.success,
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
