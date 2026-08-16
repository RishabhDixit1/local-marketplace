import 'dart:ui';

import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../core/api/mobile_api_provider.dart';
import '../core/constants/app_routes.dart';
import '../core/design_system/design_system.dart';
import '../core/theme/app_theme.dart';
import '../core/theme/design_tokens.dart';
import '../core/utils/app_formatters.dart';

import '../shared/widgets/ai_prompt_bar.dart';
import '../features/cart/application/cart_notifier.dart';
import '../features/orders/domain/order_models.dart';

final _localityProvidersProvider = FutureProvider.autoDispose
    .family<List<Map<String, dynamic>>, String>((ref, localityId) async {
  final client = ref.watch(mobileApiClientProvider);
  return client.getLocalityProviders(localityId);
});

class LocalityProvidersScreen extends ConsumerStatefulWidget {
  const LocalityProvidersScreen({
    required this.localityId,
    required this.localityName,
    super.key,
  });

  final String localityId;
  final String localityName;

  @override
  ConsumerState<LocalityProvidersScreen> createState() => _LocalityProvidersScreenState();
}

class _LocalityProvidersScreenState extends ConsumerState<LocalityProvidersScreen> {
  @override
  Widget build(BuildContext context) {
    final providersAsync = ref.watch(_localityProvidersProvider(widget.localityId));

    return ServiqScaffold(
      appBar: ServiqTopBar(
        title: widget.localityName,
        subtitle: 'Local providers',
        leading: IconButton(
          icon: const Icon(Icons.arrow_back_rounded),
          onPressed: () => Navigator.of(context).pop(),
        ),
      ),
      body: SafeArea(
        child: Column(
          children: [
            Padding(
              padding: const EdgeInsets.fromLTRB(AppSpacing.md, AppSpacing.xs, AppSpacing.md, AppSpacing.xxs),
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.xl),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
                  child: Container(
                    decoration: BoxDecoration(
                      color: AppColors.surface.withValues(alpha: 0.6),
                      borderRadius: BorderRadius.circular(AppRadii.xl),
                      border: Border.all(color: AppColors.primary.withValues(alpha: 0.08)),
                    ),
                    child: AiPromptBar(
                      placeholder: 'Ask about services in ${widget.localityName}...',
                    ),
                  ),
                ),
              ),
            ),
            Expanded(
              child: ServiqAsyncBody<List<Map<String, dynamic>>>(
                value: providersAsync,
                onRetry: () => ref.invalidate(_localityProvidersProvider(widget.localityId)),
                loadingBuilder: () => ListView.builder(
                  padding: const EdgeInsets.all(AppSpacing.pageInset),
                  itemCount: 3,
                  itemBuilder: (_, i) => Padding(
                    padding: const EdgeInsets.only(bottom: AppSpacing.sm),
                    child: _GlassProviderShimmer(),
                  ),
                ),
                errorBuilder: (error, _) => Padding(
                  padding: const EdgeInsets.all(AppSpacing.pageInset),
                  child: ErrorStateView(
                    title: 'Could not load providers',
                    message: error.toString(),
                    onRetry: () => ref.invalidate(_localityProvidersProvider(widget.localityId)),
                  ),
                ),
                data: (providers) {
                  if (providers.isEmpty) {
                    return Center(
                      child: Padding(
                        padding: const EdgeInsets.all(AppSpacing.xxl),
                        child: EmptyStateView(
                          icon: Icons.store_rounded,
                          title: 'No providers yet',
                          message: 'Be the first to offer services in this area.',
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
                      final cleanedName = AppFormatters.cleanPersonName(p['name'] as String? ?? p['full_name'] as String?);
                      final name = cleanedName.isEmpty ? 'Unknown Provider' : cleanedName;
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

                      final listings = (p['listings'] as List<dynamic>?) ?? [];
                      final pricedListings = listings
                          .whereType<Map<String, dynamic>>()
                          .where((l) => l['price'] != null && (l['price'] as num) > 0)
                          .toList();

                      return _GlassProviderCard(
                        name: name,
                        location: location,
                        avatarUrl: avatarUrl,
                        bio: bio,
                        avgRating: rating,
                        completedJobs: jobs,
                        responseMinutes: respMin,
                        verified: false,
                        listings: pricedListings,
                        providerId: providerId,
                        onTap: providerId.isNotEmpty
                            ? () => context.push(AppRoutes.provider(providerId))
                            : null,
                        onAddToCart: (listing) async {
                          final listingId = (listing['id'] as String?) ?? '';
                          final title = (listing['title'] as String?) ?? name;
                          final price = (listing['price'] as num).toDouble();
                          if (listingId.isEmpty) return;
                          final line = MobileCheckoutItem(
                            providerId: providerId,
                            itemType: 'service',
                            itemId: listingId,
                            title: title,
                            price: price,
                            quantity: 1,
                            providerName: name,
                          );
                          await ref
                              .read(cartProvider.notifier)
                              .addListing(line, providerName: name);
                          if (!mounted) return;
                          WidgetsBinding.instance.addPostFrameCallback((_) {
                            if (!mounted) return;
                            ServiqToast.show(context, message: 'Added "$title" to cart', tone: ServiqToastTone.success);
                          });
                        },
                      );
                    },
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

class _GlassProviderCard extends StatelessWidget {
  const _GlassProviderCard({
    required this.name,
    required this.location,
    this.avatarUrl,
    this.bio,
    this.avgRating,
    this.completedJobs = 0,
    this.responseMinutes,
    this.verified = false,
    required this.listings,
    required this.providerId,
    this.onTap,
    required this.onAddToCart,
  });

  final String name;
  final String location;
  final String? avatarUrl;
  final String? bio;
  final double? avgRating;
  final int completedJobs;
  final int? responseMinutes;
  final bool verified;
  final List<Map<String, dynamic>> listings;
  final String providerId;
  final VoidCallback? onTap;
  final void Function(Map<String, dynamic> listing) onAddToCart;

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textSecondary = theme.colorScheme.onSurface.withValues(alpha: 0.55);

    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.xl),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 10, sigmaY: 10),
        child: Container(
          decoration: BoxDecoration(
            gradient: LinearGradient(
              colors: [
                AppColors.primarySoft.withValues(alpha: 0.25),
                AppColors.surface.withValues(alpha: 0.4),
              ],
              begin: Alignment.topLeft,
              end: Alignment.bottomRight,
            ),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(
              color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.12),
            ),
          ),
          child: Material(
            color: Colors.transparent,
            child: InkWell(
              borderRadius: BorderRadius.circular(AppRadii.xl),
              onTap: onTap,
              child: Padding(
                padding: const EdgeInsets.all(AppSpacing.md),
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        AppAvatar(
                          name: name,
                          avatarUrl: avatarUrl ?? '',
                          radius: 23,
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        Expanded(
                          child: Column(
                            crossAxisAlignment: CrossAxisAlignment.start,
                            children: [
                              Row(
                                children: [
                                  Expanded(
                                    child: Text(name,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: theme.textTheme.titleSmall?.copyWith(fontWeight: FontWeight.w700)),
                                  ),
                                  if (verified) ...[
                                    const SizedBox(width: AppSpacing.xxs),
                                    Container(
                                      padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 1),
                                      decoration: BoxDecoration(
                                        color: AppColors.successSoft,
                                        borderRadius: BorderRadius.circular(AppRadii.pill),
                                        border: Border.all(color: AppColors.success.withValues(alpha: 0.2)),
                                      ),
                                      child: Text('Verified',
                                          style: TextStyle(fontSize: 9, fontWeight: FontWeight.w800, color: AppColors.success)),
                                    ),
                                  ],
                                  if (avgRating != null) ...[
                                    const SizedBox(width: AppSpacing.xs),
                                    Row(
                                      mainAxisSize: MainAxisSize.min,
                                      children: [
                                        Icon(Icons.star_rounded, size: 14, color: AppColors.marigold),
                                        const SizedBox(width: 2),
                                        Text(avgRating!.toStringAsFixed(1),
                                            style: TextStyle(fontSize: 12, fontWeight: FontWeight.w700, color: textSecondary)),
                                      ],
                                    ),
                                  ],
                                ],
                              ),
                              if (location.isNotEmpty) ...[
                                const SizedBox(height: AppSpacing.xxxs),
                                Row(
                                  children: [
                                    Icon(Icons.location_on_rounded, size: 12,
                                        color: theme.colorScheme.onSurface.withValues(alpha: 0.45)),
                                    const SizedBox(width: AppSpacing.xxxs),
                                    Expanded(
                                      child: Text(location,
                                          maxLines: 1,
                                          overflow: TextOverflow.ellipsis,
                                          style: TextStyle(fontSize: 11, color: textSecondary)),
                                    ),
                                  ],
                                ),
                              ],
                            ],
                          ),
                        ),
                      ],
                    ),
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        if (responseMinutes != null)
                          _SignalPill(
                            icon: Icons.bolt_rounded,
                            color: AppColors.primary,
                            label: '~$responseMinutes min',
                          ),
                        if (completedJobs > 0) ...[
                          const SizedBox(width: AppSpacing.sm),
                          _SignalPill(
                            icon: Icons.check_circle_outline_rounded,
                            color: AppColors.sage,
                            label: '$completedJobs jobs',
                          ),
                        ],
                      ],
                    ),
                    if (bio != null && bio!.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xs),
                      Text(bio!,
                          maxLines: 2,
                          overflow: TextOverflow.ellipsis,
                          style: TextStyle(fontSize: 12, color: textSecondary, height: 1.4)),
                    ],
                    if (listings.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.sm),
                      Container(
                        padding: const EdgeInsets.only(top: AppSpacing.sm),
                        decoration: BoxDecoration(
                          border: Border(
                            top: BorderSide(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.15)),
                          ),
                        ),
                        child: Column(
                          children: listings.take(3).map((listing) {
                            final title = (listing['title'] as String?) ?? '';
                            final price = (listing['price'] as num?) ?? 0;
                            return Padding(
                              padding: const EdgeInsets.only(bottom: AppSpacing.xs),
                              child: Row(
                                children: [
                                  Expanded(
                                    child: Text(title,
                                        maxLines: 1,
                                        overflow: TextOverflow.ellipsis,
                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w600,
                                            color: Theme.of(context).colorScheme.onSurface)),
                                  ),
                                  if (price > 0) ...[
                                    const SizedBox(width: AppSpacing.xs),
                                    Text('₹${price.toInt()}',
                                        style: TextStyle(fontSize: 12, fontWeight: FontWeight.w800,
                                            color: AppColors.primaryDeep)),
                                    const SizedBox(width: AppSpacing.xs),
                                    GestureDetector(
                                      onTap: () => onAddToCart(listing),
                                      child: Container(
                                        padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                                        decoration: BoxDecoration(
                                          gradient: AppGradients.premiumAccent,
                                          borderRadius: BorderRadius.circular(AppRadii.pill),
                                        ),
                                        child: Row(
                                          mainAxisSize: MainAxisSize.min,
                                          children: [
                                            Icon(Icons.shopping_cart_rounded, size: 10, color: Colors.white),
                                            const SizedBox(width: 3),
                                            Text('Add',
                                                style: TextStyle(fontSize: 10, fontWeight: FontWeight.w700, color: Colors.white)),
                                          ],
                                        ),
                                      ),
                                    ),
                                  ],
                                ],
                              ),
                            );
                          }).toList(),
                        ),
                      ),
                    ],
                    const SizedBox(height: AppSpacing.sm),
                    Row(
                      children: [
                        Expanded(
                          child: SizedBox(
                            height: 36,
                            child: OutlinedButton.icon(
                              onPressed: onTap,
                              icon: const Icon(Icons.person_rounded, size: 14),
                              label: const Text('View Profile', style: TextStyle(fontSize: 11)),
                              style: OutlinedButton.styleFrom(
                                foregroundColor: AppColors.primaryDeep,
                                side: BorderSide(color: AppColors.primary.withValues(alpha: 0.2)),
                                padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 6),
                                tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
                              ),
                            ),
                          ),
                        ),
                        const SizedBox(width: AppSpacing.sm),
                        SizedBox(
                          height: 36,
                          child: FilledButton.icon(
                            onPressed: onTap,
                            icon: const Icon(Icons.phone_rounded, size: 14),
                            label: const Text('Contact', style: TextStyle(fontSize: 11)),
                            style: FilledButton.styleFrom(
                              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 6),
                              tapTargetSize: MaterialTapTargetSize.shrinkWrap,
                              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(AppRadii.md)),
                            ),
                          ),
                        ),
                      ],
                    ),
                  ],
                ),
              ),
            ),
          ),
        ),
      ),
    );
  }
}

class _SignalPill extends StatelessWidget {
  const _SignalPill({required this.icon, required this.color, required this.label});

  final IconData icon;
  final Color color;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 12, color: color),
          const SizedBox(width: AppSpacing.xxs),
          Text(label,
              style: TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: color)),
        ],
      ),
    );
  }
}

class _GlassProviderShimmer extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.xl),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 8, sigmaY: 8),
        child: Container(
          padding: const EdgeInsets.all(AppSpacing.md),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.5),
            borderRadius: BorderRadius.circular(AppRadii.xl),
            border: Border.all(color: Theme.of(context).colorScheme.outline.withValues(alpha: 0.1)),
          ),
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Row(
                children: [
                  const LoadingShimmer(width: 46, height: 46, borderRadius: 12),
                  const SizedBox(width: AppSpacing.sm),
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const LoadingShimmer(width: 140, height: 14),
                        const SizedBox(height: 4),
                        const LoadingShimmer(width: 100, height: 11),
                      ],
                    ),
                  ),
                ],
              ),
              const SizedBox(height: AppSpacing.sm),
              Row(
                children: [
                  LoadingShimmer(width: 60, height: 20, borderRadius: 10),
                  const SizedBox(width: 8),
                  LoadingShimmer(width: 60, height: 20, borderRadius: 10),
                ],
              ),
            ],
          ),
        ),
      ),
    );
  }
}
