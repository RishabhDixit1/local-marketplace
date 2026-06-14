import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter_riverpod/flutter_riverpod.dart';
import 'package:go_router/go_router.dart';

import '../../../core/constants/app_routes.dart';
import '../../../core/design_system/design_system.dart';
import '../../../core/error/app_error_mapper.dart';
import '../../../core/theme/app_theme.dart';
import '../../../core/widgets/section_card.dart';
import '../../../shared/components/empty_state_view.dart';
import '../../../shared/components/loading_shimmer.dart';
import '../../../shared/components/profile_avatar_tile.dart';
import '../../../shared/components/trust_badge.dart';
import '../../feed/data/feed_repository.dart';
import '../../feed/domain/feed_snapshot.dart';

class ListingDetailPage extends ConsumerWidget {
  const ListingDetailPage({
    super.key,
    required this.itemId,
    this.source,
    this.snapshotOverride,
  });

  final String itemId;
  final String? source;
  final AsyncValue<MobileFeedSnapshot>? snapshotOverride;

  @override
  Widget build(BuildContext context, WidgetRef ref) {
    final AsyncValue<MobileFeedSnapshot> snapshot =
        snapshotOverride ??
        ref.watch(feedSnapshotProvider(MobileFeedScope.all));
    final resolvedItem = _listingFromSnapshot(snapshot.asData?.value);

    return Scaffold(
      appBar: AppBar(
        title: const Text('Listing detail'),
        actions: [
          if (resolvedItem != null)
            IconButton(
              tooltip: 'Open seller profile',
              onPressed: resolvedItem.providerId.trim().isEmpty
                  ? null
                  : () => context.push(
                      AppRoutes.provider(resolvedItem.providerId),
                    ),
              icon: const Icon(Icons.storefront_outlined),
            ),
        ],
      ),
      bottomNavigationBar: resolvedItem == null
          ? null
          : _ListingStickyActions(
              item: resolvedItem,
              currentUserId: snapshot.asData?.value.currentUserId ?? '',
            ),
      body: SafeArea(
        child: ServiqAsyncBody<MobileFeedSnapshot>(
          value: snapshot,
          errorTitle: 'Unable to load listing',
          errorMessageFor: (error, _) => AppErrorMapper.toMessage(error),
          onRetry: () =>
              ref.invalidate(feedSnapshotProvider(MobileFeedScope.all)),
          loadingBuilder: () => const _ListingDetailLoading(),
          data: (data) {
            final item = _listingFromSnapshot(data);
            if (item == null) {
              return const Padding(
                padding: EdgeInsets.all(AppSpacing.md),
                child: SectionCard(
                  child: EmptyStateView(
                    icon: Icons.inventory_2_outlined,
                    title: 'Listing not available',
                    message:
                        'This listing may have been removed, sold, or moved out of the current marketplace view.',
                  ),
                ),
              );
            }

            return ListView(
              padding: const EdgeInsets.fromLTRB(
                AppSpacing.md,
                AppSpacing.sm,
                AppSpacing.md,
                132,
              ),
              children: [
                _ListingHeroGallery(item: item),
                const SizedBox(height: AppSpacing.md),
                _ListingSummaryCard(item: item),
                const SizedBox(height: AppSpacing.md),
                _SellerTrustCard(item: item),
                const SizedBox(height: AppSpacing.md),
                _FulfillmentCard(item: item),
                const SizedBox(height: AppSpacing.md),
                _BuyerConfidenceCard(item: item),
              ],
            );
          },
        ),
      ),
    );
  }

  MobileFeedItem? _listingFromSnapshot(MobileFeedSnapshot? snapshot) {
    if (snapshot == null || itemId.trim().isEmpty) {
      return null;
    }

    final normalizedSource = source?.trim().toLowerCase();
    final listings = snapshot.items.where(
      (item) =>
          item.type == MobileFeedItemType.service ||
          item.type == MobileFeedItemType.product,
    );

    for (final item in listings) {
      if (item.id != itemId) {
        continue;
      }
      if (normalizedSource == null || normalizedSource.isEmpty) {
        return item;
      }
      if (item.source.apiValue == normalizedSource ||
          item.source.name == normalizedSource) {
        return item;
      }
    }

    return null;
  }
}

class _ListingHeroGallery extends StatelessWidget {
  const _ListingHeroGallery({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    final tint = _listingTint(item.type);

    return Container(
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: tint.background,
        borderRadius: BorderRadius.circular(AppRadii.lg),
        border: Border.all(color: AppColors.border),
      ),
      child: AspectRatio(
        aspectRatio: 1.35,
        child: Stack(
          fit: StackFit.expand,
          children: [
            if (item.hasPreviewImage)
              CachedNetworkImage(
                imageUrl: item.thumbnailUrl,
                fit: BoxFit.cover,
                errorWidget: (context, url, error) =>
                    _ListingMediaFallback(item: item),
                placeholder: (context, url) =>
                    _ListingMediaFallback(item: item),
              )
            else
              _ListingMediaFallback(item: item),
            const DecoratedBox(
              decoration: BoxDecoration(
                gradient: LinearGradient(
                  colors: [Colors.transparent, Color(0xB0090F17)],
                  begin: Alignment.topCenter,
                  end: Alignment.bottomCenter,
                ),
              ),
            ),
            Positioned(
              left: AppSpacing.md,
              right: AppSpacing.md,
              top: AppSpacing.md,
              child: Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: [
                  _HeroPill(
                    icon: _listingIcon(item.type),
                    label: item.type.label,
                  ),
                  _HeroPill(
                    icon: Icons.category_outlined,
                    label: item.category,
                  ),
                  if (item.mediaCount > 1)
                    _HeroPill(
                      icon: Icons.photo_library_outlined,
                      label: '${item.mediaCount} photos',
                    ),
                ],
              ),
            ),
            Positioned(
              left: AppSpacing.md,
              right: AppSpacing.md,
              bottom: AppSpacing.md,
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisSize: MainAxisSize.min,
                children: [
                  Text(
                    item.priceLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.headlineSmall?.copyWith(
                      color: Colors.white,
                      fontWeight: FontWeight.w800,
                    ),
                  ),
                  const SizedBox(height: AppSpacing.xxs),
                  Text(
                    item.distanceLabel,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodyMedium?.copyWith(
                      color: Colors.white.withValues(alpha: 0.86),
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ListingMediaFallback extends StatelessWidget {
  const _ListingMediaFallback({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    final tint = _listingTint(item.type);
    return Container(
      decoration: BoxDecoration(
        gradient: LinearGradient(
          colors: [tint.background, AppColors.surface],
          begin: Alignment.topLeft,
          end: Alignment.bottomRight,
        ),
      ),
      child: Center(
        child: Column(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(_listingIcon(item.type), size: 46, color: tint.foreground),
            const SizedBox(height: AppSpacing.xs),
            Text(
              item.category,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              textAlign: TextAlign.center,
              style: Theme.of(context).textTheme.titleMedium?.copyWith(
                color: tint.foreground,
                fontWeight: FontWeight.w800,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _HeroPill extends StatelessWidget {
  const _HeroPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: Colors.white.withValues(alpha: 0.94),
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 15, color: AppColors.ink),
          const SizedBox(width: AppSpacing.xs),
          Flexible(
            child: Text(
              label,
              maxLines: 1,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.labelMedium,
            ),
          ),
        ],
      ),
    );
  }
}

class _ListingSummaryCard extends StatelessWidget {
  const _ListingSummaryCard({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              ServiqStatusPill(
                label: item.urgent ? 'Urgent' : item.statusLabel,
                urgent: item.urgent,
                maxWidth: 160,
              ),
              TrustBadge(
                label: item.sourceTypeLabel,
                icon: Icons.explore_outlined,
                backgroundColor: AppColors.surfaceMuted,
                foregroundColor: AppColors.ink,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          Text(item.title, style: Theme.of(context).textTheme.headlineSmall),
          const SizedBox(height: AppSpacing.xs),
          Text(item.description, style: Theme.of(context).textTheme.bodyLarge),
          const SizedBox(height: AppSpacing.md),
          TrustSnapshot(
            dense: true,
            items: [
              TrustSnapshotItem(
                icon: Icons.payments_outlined,
                label: 'Price',
                value: item.priceLabel,
                tone: TrustSnapshotTone.success,
              ),
              TrustSnapshotItem(
                icon: Icons.place_outlined,
                label: 'Distance',
                value: item.distanceLabel,
              ),
              TrustSnapshotItem(
                icon: Icons.schedule_rounded,
                label: 'Response',
                value: item.responseLabel,
                tone: TrustSnapshotTone.trust,
              ),
              TrustSnapshotItem(
                icon: Icons.inventory_2_outlined,
                label: 'Category',
                value: item.category,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _SellerTrustCard extends StatelessWidget {
  const _SellerTrustCard({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          ProfileAvatarTile(
            name: item.creatorName,
            subtitle: '${item.locationLabel} - ${item.trustLabel}',
            avatarUrl: item.avatarUrl,
            trailing: IconButton.outlined(
              tooltip: 'View seller',
              onPressed: item.providerId.trim().isEmpty
                  ? null
                  : () => context.push(AppRoutes.provider(item.providerId)),
              icon: const Icon(Icons.chevron_right_rounded),
            ),
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              TrustBadge(
                label: item.trustLabel,
                icon: item.isVerified
                    ? Icons.verified_rounded
                    : Icons.workspace_premium_outlined,
                backgroundColor: item.isVerified
                    ? AppColors.verifiedSoft
                    : AppColors.successSoft,
                foregroundColor: item.isVerified
                    ? AppColors.verified
                    : AppColors.success,
              ),
              TrustBadge(
                label: item.ratingLabel,
                icon: Icons.star_rate_rounded,
                backgroundColor: AppColors.warningSoft,
                foregroundColor: AppColors.warning,
              ),
              TrustBadge(
                label: item.socialProofLabel,
                icon: Icons.handshake_outlined,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.md),
          TrustSnapshot(
            items: [
              TrustSnapshotItem(
                icon: Icons.done_all_rounded,
                label: 'Completed work',
                value: item.completedJobs > 0
                    ? '${item.completedJobs} jobs'
                    : 'Building history',
                tone: item.completedJobs > 0
                    ? TrustSnapshotTone.success
                    : TrustSnapshotTone.neutral,
              ),
              TrustSnapshotItem(
                icon: Icons.timer_outlined,
                label: 'Reply pace',
                value: item.responseLabel,
                tone: TrustSnapshotTone.trust,
              ),
              TrustSnapshotItem(
                icon: Icons.assignment_ind_outlined,
                label: 'Profile',
                value: '${item.profileCompletion}% complete',
                tone: item.profileCompletion >= 80
                    ? TrustSnapshotTone.success
                    : TrustSnapshotTone.warning,
              ),
              TrustSnapshotItem(
                icon: Icons.storefront_outlined,
                label: 'Live listings',
                value: item.listingCount > 0
                    ? '${item.listingCount} listings'
                    : 'Listing started',
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _FulfillmentCard extends StatelessWidget {
  const _FulfillmentCard({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    final isProduct = item.type == MobileFeedItemType.product;
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text(
            'Pickup and delivery',
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            isProduct
                ? 'Confirm stock, pickup or delivery timing, and handover details before placing the order.'
                : 'Confirm visit timing, access notes, and scope before reserving this service.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          _DetailRow(
            icon: isProduct
                ? Icons.local_shipping_outlined
                : Icons.home_repair_service_outlined,
            title: isProduct ? 'Pickup or delivery' : 'On-site service',
            subtitle: isProduct
                ? 'Seller can confirm the best handoff method in chat.'
                : 'Provider visits the service location after timing is agreed.',
          ),
          _DetailRow(
            icon: Icons.payments_outlined,
            title: item.price > 0 ? 'Checkout ready' : 'Price confirmation',
            subtitle: item.price > 0
                ? 'Use order checkout when you are ready to lock this in.'
                : 'Ask for final pricing before moving to checkout.',
          ),
          _DetailRow(
            icon: Icons.chat_bubble_outline_rounded,
            title: 'Conversation linked',
            subtitle:
                'Chat starts with this listing context so availability and terms stay traceable.',
          ),
        ],
      ),
    );
  }
}

class _BuyerConfidenceCard extends StatelessWidget {
  const _BuyerConfidenceCard({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('Before you pay', style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: AppSpacing.xs),
          Text(
            'Keep availability, timing, price changes, and delivery notes inside ServiQ before confirming the order.',
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.md),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              TrustBadge(
                label: item.isVerified ? 'Verified seller' : 'Trust building',
                icon: Icons.verified_user_outlined,
                backgroundColor: AppColors.verifiedSoft,
                foregroundColor: AppColors.verified,
              ),
              TrustBadge(
                label: item.responseLabel,
                icon: Icons.schedule_rounded,
                backgroundColor: AppColors.primarySoft,
                foregroundColor: AppColors.primary,
              ),
              TrustBadge(
                label: item.type == MobileFeedItemType.product
                    ? 'Order protected'
                    : 'Reservation flow',
                icon: Icons.receipt_long_outlined,
                backgroundColor: AppColors.accentSoft,
                foregroundColor: AppColors.accent,
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _DetailRow extends StatelessWidget {
  const _DetailRow({
    required this.icon,
    required this.title,
    required this.subtitle,
  });

  final IconData icon;
  final String title;
  final String subtitle;

  @override
  Widget build(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.only(bottom: AppSpacing.sm),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Container(
            width: 38,
            height: 38,
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadii.sm),
            ),
            child: Icon(icon, color: AppColors.primary, size: 19),
          ),
          const SizedBox(width: AppSpacing.sm),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(title, style: Theme.of(context).textTheme.titleSmall),
                const SizedBox(height: AppSpacing.xxxs),
                Text(subtitle, style: Theme.of(context).textTheme.bodySmall),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _ListingStickyActions extends StatelessWidget {
  const _ListingStickyActions({
    required this.item,
    required this.currentUserId,
  });

  final MobileFeedItem item;
  final String currentUserId;

  bool get _isOwnListing =>
      currentUserId.trim().isNotEmpty && item.providerId == currentUserId;

  @override
  Widget build(BuildContext context) {
    final canContact = item.providerId.trim().isNotEmpty;
    final primaryLabel = item.type == MobileFeedItemType.product
        ? 'Order'
        : 'Reserve';

    return Container(
      padding: EdgeInsets.fromLTRB(
        AppSpacing.md,
        AppSpacing.sm,
        AppSpacing.md,
        AppSpacing.sm + MediaQuery.paddingOf(context).bottom,
      ),
      decoration: const BoxDecoration(
        color: AppColors.surface,
        border: Border(top: BorderSide(color: AppColors.border)),
        boxShadow: AppShadows.floating,
      ),
      child: Row(
        children: [
          Expanded(
            flex: 9,
            child: OutlinedButton.icon(
              onPressed: canContact ? () => _openChat(context) : null,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, AppTouchTargets.buttonHeight),
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
              ),
              icon: const Icon(Icons.chat_bubble_outline_rounded),
              label: const Text(
                'Chat',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            flex: 14,
            child: OutlinedButton.icon(
              onPressed: canContact ? () => _makeOffer(context) : null,
              style: OutlinedButton.styleFrom(
                minimumSize: const Size(0, AppTouchTargets.buttonHeight),
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
              ),
              icon: const Icon(Icons.local_offer_outlined),
              label: const Text(
                'Make offer',
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
          const SizedBox(width: AppSpacing.xs),
          Expanded(
            flex: 11,
            child: FilledButton.icon(
              onPressed: canContact ? () => _openCheckout(context) : null,
              style: FilledButton.styleFrom(
                minimumSize: const Size(0, AppTouchTargets.buttonHeight),
                padding: const EdgeInsets.symmetric(horizontal: AppSpacing.xs),
              ),
              icon: Icon(
                item.type == MobileFeedItemType.product
                    ? Icons.shopping_bag_outlined
                    : Icons.event_available_outlined,
              ),
              label: Text(
                primaryLabel,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
              ),
            ),
          ),
        ],
      ),
    );
  }

  void _openChat(BuildContext context) {
    if (_guardOwnListing(context)) {
      return;
    }
    context.push(
      AppRoutes.chatDirect(
        recipientId: item.providerId,
        contextTitle: item.title,
        contextTaskId: item.id,
        contextStatus: item.statusLabel,
        source: 'listing_detail_chat',
      ),
    );
  }

  void _makeOffer(BuildContext context) {
    if (_guardOwnListing(context)) {
      return;
    }
    context.push(
      AppRoutes.chatDirect(
        recipientId: item.providerId,
        draft: _offerDraftFor(item),
        contextTitle: item.title,
        contextTaskId: item.id,
        contextStatus: item.statusLabel,
        source: 'listing_detail_offer',
      ),
    );
  }

  void _openCheckout(BuildContext context) {
    if (_guardOwnListing(context)) {
      return;
    }
    context.push(
      AppRoutes.checkoutItem(
        providerId: item.providerId,
        itemType: item.type == MobileFeedItemType.product
            ? 'product'
            : 'service',
        itemId: item.id,
        title: item.title,
        price: item.price,
      ),
    );
  }

  bool _guardOwnListing(BuildContext context) {
    if (!_isOwnListing) {
      return false;
    }
    ServiqToast.show(
      context,
      message: 'This is your own listing.',
      tone: ServiqToastTone.warning,
    );
    return true;
  }
}

class _ListingDetailLoading extends StatelessWidget {
  const _ListingDetailLoading();

  @override
  Widget build(BuildContext context) {
    return ListView(
      padding: const EdgeInsets.all(AppSpacing.md),
      children: const [
        LoadingShimmer(height: 260),
        SizedBox(height: AppSpacing.md),
        SectionCard(
          child: Column(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              LoadingShimmer(height: 18, width: 120),
              SizedBox(height: AppSpacing.sm),
              LoadingShimmer(height: 26),
              SizedBox(height: AppSpacing.xs),
              LoadingShimmer(height: 16),
              SizedBox(height: AppSpacing.xs),
              LoadingShimmer(height: 16, width: 220),
            ],
          ),
        ),
      ],
    );
  }
}

String _offerDraftFor(MobileFeedItem item) {
  final noun = item.type == MobileFeedItemType.product ? 'product' : 'service';
  return 'Hi ${item.creatorName}, is "${item.title}" still available? I would like to make an offer for this $noun.';
}

IconData _listingIcon(MobileFeedItemType type) {
  return type == MobileFeedItemType.product
      ? Icons.inventory_2_outlined
      : Icons.design_services_outlined;
}

({Color background, Color foreground}) _listingTint(MobileFeedItemType type) {
  return type == MobileFeedItemType.product
      ? (
          background: AppRoleColors.productBg,
          foreground: AppRoleColors.productFg,
        )
      : (
          background: AppRoleColors.serviceBg,
          foreground: AppRoleColors.serviceFg,
        );
}
