import 'package:flutter/material.dart';

import '../../core/design_system/design_system.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/section_card.dart';
import '../../features/feed/domain/feed_snapshot.dart';

class FeedCard extends StatelessWidget {
  const FeedCard({
    super.key,
    required this.item,
    this.onPrimaryTap,
    this.onSecondaryTap,
    this.primaryLabel = 'Open',
    this.secondaryLabel = 'Message',
    this.secondaryIcon = Icons.chat_bubble_outline_rounded,
    this.reason,
    this.reasonBackgroundColor = AppColors.primarySoft,
    this.reasonForegroundColor = AppColors.primary,
    this.isSaved = false,
    this.onSaveTap,
    this.onMoreTap,
  });

  final MobileFeedItem item;
  final VoidCallback? onPrimaryTap;
  final VoidCallback? onSecondaryTap;
  final String primaryLabel;
  final String secondaryLabel;
  final IconData secondaryIcon;
  final String? reason;
  final Color reasonBackgroundColor;
  final Color reasonForegroundColor;
  final bool isSaved;
  final VoidCallback? onSaveTap;
  final VoidCallback? onMoreTap;

  @override
  Widget build(BuildContext context) {
    final statusLabel = item.urgent ? 'Urgent' : item.statusLabel;
    final reasonText = reason?.trim() ?? '';

    return SectionCard(
      padding: const EdgeInsets.all(AppSpacing.sm),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          if (item.hasPreviewImage) ...[
            _FeedPreview(item: item),
            const SizedBox(height: AppSpacing.sm),
          ],
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: AppSpacing.xs,
                  runSpacing: AppSpacing.xs,
                  children: [
                    _TypePill(type: item.type),
                    ServiqStatusPill(
                      label: statusLabel,
                      urgent: item.urgent,
                      maxWidth: 150,
                    ),
                    if (item.mediaCount > 0 && !item.hasPreviewImage)
                      _InlinePill(
                        icon: Icons.photo_library_outlined,
                        label: '${item.mediaCount} photos',
                      ),
                  ],
                ),
              ),
              if (onSaveTap != null || onMoreTap != null) ...[
                const SizedBox(width: AppSpacing.xs),
                _CardActions(
                  isSaved: isSaved,
                  onSaveTap: onSaveTap,
                  onMoreTap: onMoreTap,
                ),
              ],
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          Text(
            item.title,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.titleLarge,
          ),
          const SizedBox(height: AppSpacing.xs),
          Text(
            item.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: AppSpacing.sm),
          Wrap(
            spacing: AppSpacing.xs,
            runSpacing: AppSpacing.xs,
            children: [
              _InlinePill(
                icon: Icons.person_outline_rounded,
                label: item.creatorName,
              ),
              _InlinePill(icon: Icons.category_outlined, label: item.category),
              _InlinePill(icon: Icons.history_rounded, label: item.timeLabel),
            ],
          ),
          const SizedBox(height: AppSpacing.sm),
          TrustSnapshot(
            dense: true,
            items: [
              TrustSnapshotItem(
                icon: item.type == MobileFeedItemType.demand
                    ? Icons.account_balance_wallet_outlined
                    : Icons.payments_outlined,
                label: item.type == MobileFeedItemType.demand
                    ? 'Budget'
                    : 'Price',
                value: item.priceLabel,
                tone: item.type == MobileFeedItemType.demand
                    ? TrustSnapshotTone.warning
                    : TrustSnapshotTone.success,
              ),
              TrustSnapshotItem(
                icon: Icons.place_outlined,
                label: 'Distance',
                value: item.distanceLabel,
              ),
              TrustSnapshotItem(
                icon: Icons.verified_user_outlined,
                label: 'Trust',
                value: item.socialProofLabel,
                tone: item.isVerified
                    ? TrustSnapshotTone.trust
                    : TrustSnapshotTone.neutral,
              ),
              TrustSnapshotItem(
                icon: Icons.schedule_rounded,
                label: 'Response',
                value: item.responseLabel,
                tone: item.activeNow
                    ? TrustSnapshotTone.success
                    : TrustSnapshotTone.neutral,
              ),
            ],
          ),
          if (reasonText.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.sm),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(AppSpacing.sm),
              decoration: BoxDecoration(
                color: reasonBackgroundColor,
                borderRadius: BorderRadius.circular(AppRadii.md),
                border: Border.all(color: AppColors.border),
              ),
              child: Text(
                reasonText,
                maxLines: 3,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: reasonForegroundColor),
              ),
            ),
          ],
          if (onPrimaryTap != null || onSecondaryTap != null) ...[
            const SizedBox(height: AppSpacing.sm),
            ServiqActionBar(
              primaryLabel: primaryLabel,
              primaryIcon: _primaryIconFor(item),
              onPrimary: onPrimaryTap,
              secondaryActions: [
                ServiqCompactAction(
                  icon: secondaryIcon,
                  tooltip: secondaryLabel,
                  onPressed: onSecondaryTap,
                ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _FeedPreview extends StatelessWidget {
  const _FeedPreview({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    return Container(
      height: 132,
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: _typeTint(item.type).background,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          Image.network(
            item.thumbnailUrl,
            fit: BoxFit.cover,
            errorBuilder: (context, _, _) => _PreviewFallback(item: item),
          ),
          Positioned(
            left: AppSpacing.sm,
            right: AppSpacing.sm,
            bottom: AppSpacing.sm,
            child: Wrap(
              spacing: AppSpacing.xs,
              runSpacing: AppSpacing.xs,
              children: [
                _OverlayPill(label: item.category),
                if (item.mediaCount > 1)
                  _OverlayPill(label: '${item.mediaCount} photos'),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _PreviewFallback extends StatelessWidget {
  const _PreviewFallback({required this.item});

  final MobileFeedItem item;

  @override
  Widget build(BuildContext context) {
    final tint = _typeTint(item.type);
    return Container(
      color: tint.background,
      alignment: Alignment.center,
      padding: const EdgeInsets.all(AppSpacing.md),
      child: Column(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_iconForType(item.type), color: tint.foreground),
          const SizedBox(height: AppSpacing.xs),
          Text(
            item.category,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            textAlign: TextAlign.center,
            style: Theme.of(
              context,
            ).textTheme.labelLarge?.copyWith(color: tint.foreground),
          ),
        ],
      ),
    );
  }
}

class _TypePill extends StatelessWidget {
  const _TypePill({required this.type});

  final MobileFeedItemType type;

  @override
  Widget build(BuildContext context) {
    final tint = _typeTint(type);
    return Container(
      constraints: const BoxConstraints(minHeight: AppTouchTargets.minimum),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xs,
      ),
      decoration: BoxDecoration(
        color: tint.background,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_iconForType(type), size: 16, color: tint.foreground),
          const SizedBox(width: AppSpacing.xs),
          Text(
            type.label,
            style: Theme.of(
              context,
            ).textTheme.labelMedium?.copyWith(color: tint.foreground),
          ),
        ],
      ),
    );
  }
}

class _InlinePill extends StatelessWidget {
  const _InlinePill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 210),
      child: Container(
        constraints: const BoxConstraints(minHeight: AppTouchTargets.minimum),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xs,
        ),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 15, color: AppColors.inkMuted),
            const SizedBox(width: AppSpacing.xs),
            Flexible(
              child: Text(
                label,
                maxLines: 1,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall,
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _OverlayPill extends StatelessWidget {
  const _OverlayPill({required this.label});

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
        borderRadius: BorderRadius.circular(AppRadii.md),
      ),
      child: Text(
        label,
        maxLines: 1,
        overflow: TextOverflow.ellipsis,
        style: Theme.of(context).textTheme.labelMedium,
      ),
    );
  }
}

class _CardActions extends StatelessWidget {
  const _CardActions({required this.isSaved, this.onSaveTap, this.onMoreTap});

  final bool isSaved;
  final VoidCallback? onSaveTap;
  final VoidCallback? onMoreTap;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        if (onSaveTap != null)
          Tooltip(
            message: isSaved ? 'Saved' : 'Save',
            child: SizedBox.square(
              dimension: AppTouchTargets.minimum,
              child: IconButton.outlined(
                onPressed: onSaveTap,
                icon: Icon(
                  isSaved
                      ? Icons.bookmark_rounded
                      : Icons.bookmark_border_rounded,
                ),
              ),
            ),
          ),
        if (onMoreTap != null)
          Tooltip(
            message: 'More actions',
            child: SizedBox.square(
              dimension: AppTouchTargets.minimum,
              child: IconButton.outlined(
                onPressed: onMoreTap,
                icon: const Icon(Icons.more_horiz_rounded),
              ),
            ),
          ),
      ],
    );
  }
}

IconData _primaryIconFor(MobileFeedItem item) {
  if (item.helpRequestId != null) {
    return item.viewerHasExpressedInterest
        ? Icons.undo_rounded
        : Icons.handshake_outlined;
  }
  if (item.type == MobileFeedItemType.product) {
    return Icons.shopping_bag_outlined;
  }
  if (item.type == MobileFeedItemType.service) {
    return Icons.event_available_outlined;
  }
  return Icons.person_outline_rounded;
}

IconData _iconForType(MobileFeedItemType type) {
  switch (type) {
    case MobileFeedItemType.demand:
      return Icons.volunteer_activism_outlined;
    case MobileFeedItemType.service:
      return Icons.design_services_outlined;
    case MobileFeedItemType.product:
      return Icons.inventory_2_outlined;
  }
}

({Color background, Color foreground}) _typeTint(MobileFeedItemType type) {
  switch (type) {
    case MobileFeedItemType.demand:
      return (
        background: AppRoleColors.helpRequestBg,
        foreground: AppRoleColors.helpRequestFg,
      );
    case MobileFeedItemType.service:
      return (
        background: AppRoleColors.serviceBg,
        foreground: AppRoleColors.serviceFg,
      );
    case MobileFeedItemType.product:
      return (
        background: AppRoleColors.productBg,
        foreground: AppRoleColors.productFg,
      );
  }
}
