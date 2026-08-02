import 'dart:ui';

import 'package:cached_network_image/cached_network_image.dart';
import 'package:flutter/material.dart';
import 'package:flutter/services.dart';

import '../../core/design_system/design_system.dart';
import '../../core/theme/app_theme.dart';
import '../../features/feed/domain/feed_snapshot.dart';

class FeedCard extends StatelessWidget {
  const FeedCard({
    super.key,
    required this.item,
    this.onPrimaryTap,
    this.onSecondaryTap,
    this.primaryLabel,
    this.secondaryLabel = 'Message',
    this.secondaryIcon = Icons.chat_bubble_outline_rounded,
    this.reason,
    this.isSaved = false,
    this.onSaveTap,
    this.onMoreTap,
    this.onReport,
  });

  final MobileFeedItem item;
  final VoidCallback? onPrimaryTap;
  final VoidCallback? onSecondaryTap;
  final String? primaryLabel;
  final String secondaryLabel;
  final IconData secondaryIcon;
  final String? reason;
  final bool isSaved;
  final VoidCallback? onSaveTap;
  final VoidCallback? onMoreTap;
  final VoidCallback? onReport;

  String get _effectivePrimaryLabel {
    if (primaryLabel != null) return primaryLabel!;
    if (item.loopType == 'requirement_post') {
      if (item.viewerHasExpressedInterest) return 'View Responses';
      return 'Respond';
    }
    if (item.statusKey == 'booked' || item.statusKey == 'in_progress') {
      return 'Track';
    }
    if (item.statusKey == 'completed') return 'View Order';
    return 'Book Now';
  }

  @override
  Widget build(BuildContext context) {
    final statusLabel = item.urgent ? 'Urgent' : item.statusLabel;
    final meta = _compactMetaFor(item);
    final isDirectBooking = item.loopType == 'direct_booking';

    return Container(
      decoration: BoxDecoration(
        border: Border(
          left: BorderSide(
            color: isDirectBooking ? AppColors.accent : AppColors.warm,
            width: 3,
          ),
        ),
      ),
      child: ServiqSurface(
        variant: ServiqSurfaceVariant.glass,
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
                      ServiqLoopLabelPill(
                        label: item.loopLabel,
                        loopType: item.loopType,
                      ),
                      _TypePill(type: item.type),
                      ServiqLoopStatusPill(
                        label: statusLabel,
                        statusKey: item.statusKey,
                      ),
                      if (item.mediaCount > 0 && !item.hasPreviewImage)
                        _InlinePill(
                          icon: Icons.photo_library_outlined,
                          label: '${item.mediaCount} photos',
                        ),
                    ],
                  ),
                ),
                if (onSaveTap != null || onMoreTap != null || onReport != null) ...[
                  const SizedBox(width: AppSpacing.xs),
                  _CardActions(
                    isSaved: isSaved,
                    onSaveTap: onSaveTap,
                    onMoreTap: onMoreTap,
                    onReport: onReport,
                  ),
                ],
              ],
            ),
            const SizedBox(height: AppSpacing.sm),
            Text(
              item.title,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: Theme.of(context).textTheme.titleMedium,
            ),
            if (item.description.trim().isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xxs),
              Text(
                item.description,
                maxLines: 2,
                overflow: TextOverflow.ellipsis,
                style: Theme.of(context).textTheme.bodySmall?.copyWith(
                  color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6),
                  height: 1.35,
                ),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            Row(
              children: [
                CircleAvatar(
                  radius: 12,
                  backgroundColor: AppColors.surfaceAlt,
                  child: Text(
                    item.creatorName.isNotEmpty
                        ? item.creatorName[0].toUpperCase()
                        : '?',
                    style: Theme.of(context).textTheme.labelSmall?.copyWith(
                      color: AppColors.primary,
                    ),
                  ),
                ),
                const SizedBox(width: AppSpacing.xs),
                Expanded(
                  child: Text(
                    item.creatorName,
                    maxLines: 1,
                    overflow: TextOverflow.ellipsis,
                    style: Theme.of(context).textTheme.bodySmall?.copyWith(
                      fontWeight: FontWeight.w600,
                    ),
                  ),
                ),
              ],
            ),
            if (meta.isNotEmpty) ...[
              const SizedBox(height: AppSpacing.xs),
              Wrap(
                spacing: AppSpacing.xs,
                runSpacing: AppSpacing.xs,
                children: meta
                    .map(
                      (signal) =>
                          _InlinePill(icon: signal.icon, label: signal.label),
                    )
                    .toList(),
              ),
            ],
            const SizedBox(height: AppSpacing.sm),
            TrustSnapshot(
              dense: true,
              items: [
                TrustSnapshotItem(
                  icon: Icons.verified_outlined,
                  value: item.trustLabel,
                  tone: item.isVerified
                      ? TrustSnapshotTone.trust
                      : TrustSnapshotTone.neutral,
                ),
                TrustSnapshotItem(
                  icon: Icons.star_outline_rounded,
                  value: item.ratingLabel,
                  tone: item.averageRating != null && item.averageRating! >= 4
                      ? TrustSnapshotTone.success
                      : TrustSnapshotTone.neutral,
                ),
                TrustSnapshotItem(
                  icon: Icons.schedule_rounded,
                  value: item.responseLabel,
                ),
                TrustSnapshotItem(
                  icon: Icons.work_outline_rounded,
                  value: item.socialProofLabel,
                  tone: item.completedJobs > 10
                      ? TrustSnapshotTone.trust
                      : TrustSnapshotTone.neutral,
                ),
              ],
            ),
            if (onPrimaryTap != null || onSecondaryTap != null) ...[
              const SizedBox(height: AppSpacing.sm),
              ServiqActionBar(
                primaryLabel: _effectivePrimaryLabel,
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
      ),
    );
  }
}

List<({IconData icon, String label})> _compactMetaFor(MobileFeedItem item) {
  final signals = <({IconData icon, String label})>[];
  if (_hasRealMoneySignal(item)) {
    signals.add((icon: Icons.payments_outlined, label: item.priceLabel));
  }
  if (item.distanceLabel.trim().isNotEmpty) {
    signals.add((icon: Icons.place_outlined, label: item.distanceLabel));
  }
  return signals.take(2).toList();
}

bool _hasRealMoneySignal(MobileFeedItem item) {
  if (item.price > 0) {
    return true;
  }
  final label = item.priceLabel.trim().toLowerCase();
  return label.startsWith('inr ') || label.startsWith('₹');
}

class _FeedPreview extends StatefulWidget {
  const _FeedPreview({required this.item});

  final MobileFeedItem item;

  @override
  State<_FeedPreview> createState() => _FeedPreviewState();
}

class _FeedPreviewState extends State<_FeedPreview> {
  int _currentPage = 0;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final urls = item.mediaUrls.where((u) => u.isNotEmpty).toList();
    final hasCarousel = urls.length > 1;

    return Container(
      height: 96,
      width: double.infinity,
      clipBehavior: Clip.antiAlias,
      decoration: BoxDecoration(
        color: _typeTint(item.type).background,
        borderRadius: BorderRadius.circular(AppRadii.lg),
      ),
      child: Stack(
        fit: StackFit.expand,
        children: [
          if (hasCarousel)
            PageView.builder(
              itemCount: urls.length,
              onPageChanged: (i) => setState(() => _currentPage = i),
              itemBuilder: (context, index) => Semantics(
                label: 'Feed preview image ${index + 1} of ${urls.length}',
                child: CachedNetworkImage(
                  imageUrl: urls[index],
                  fit: BoxFit.cover,
                  errorWidget: (context, url, error) => _PreviewFallback(item: item),
                  placeholder: (context, url) => _PreviewFallback(item: item),
                ),
              ),
            )
          else
            Semantics(
              label: 'Feed preview image',
              child: CachedNetworkImage(
                imageUrl: item.thumbnailUrl,
                fit: BoxFit.cover,
                errorWidget: (context, url, error) => _PreviewFallback(item: item),
                placeholder: (context, url) => _PreviewFallback(item: item),
              ),
            ),
          const DecoratedBox(
            decoration: BoxDecoration(
              gradient: LinearGradient(
                colors: [Colors.transparent, AppColors.heroOverlay],
                begin: Alignment.topCenter,
                end: Alignment.bottomCenter,
              ),
            ),
          ),
          if (hasCarousel)
            Positioned(
              right: AppSpacing.sm,
              bottom: AppSpacing.sm,
              child: ClipRRect(
                borderRadius: BorderRadius.circular(AppRadii.xs),
                child: BackdropFilter(
                  filter: ImageFilter.blur(sigmaX: 4, sigmaY: 4),
                  child: Container(
                    padding: const EdgeInsets.symmetric(horizontal: 6, vertical: 2),
                    decoration: BoxDecoration(
                      color: Colors.black.withValues(alpha: 0.4),
                    ),
                    child: Text(
                      '${_currentPage + 1}/${urls.length}',
                      style: const TextStyle(
                        color: Colors.white,
                        fontSize: 10,
                        fontWeight: FontWeight.w600,
                      ),
                    ),
                  ),
                ),
              ),
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
                if (item.mediaCount > 1 && !hasCarousel)
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
      constraints: const BoxConstraints(minHeight: 32),
      padding: const EdgeInsets.symmetric(
        horizontal: AppSpacing.sm,
        vertical: AppSpacing.xxs,
      ),
      decoration: BoxDecoration(
        color: tint.background,
        borderRadius: BorderRadius.circular(AppRadii.pill),
      ),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(_iconForType(type), size: 14, color: tint.foreground),
          const SizedBox(width: AppSpacing.xxs),
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
      constraints: BoxConstraints(maxWidth: 210),
      child: Container(
        constraints: BoxConstraints(minHeight: 32),
        padding: const EdgeInsets.symmetric(
          horizontal: AppSpacing.sm,
          vertical: AppSpacing.xxs,
        ),
        decoration: BoxDecoration(
          color: Theme.of(context).colorScheme.surfaceContainerHighest.withValues(alpha: 0.5),
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.6)),
            const SizedBox(width: AppSpacing.xxs),
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
    return ClipRRect(
      borderRadius: BorderRadius.circular(AppRadii.md),
      child: BackdropFilter(
        filter: ImageFilter.blur(sigmaX: 6, sigmaY: 6),
        child: Container(
          padding: const EdgeInsets.symmetric(
            horizontal: AppSpacing.sm,
            vertical: AppSpacing.xxs,
          ),
          decoration: BoxDecoration(
            color: Theme.of(context).colorScheme.surface.withValues(alpha: 0.9),
          ),
          child: Text(
            label,
            maxLines: 1,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.labelMedium,
          ),
        ),
      ),
    );
  }
}

class _CardActions extends StatelessWidget {
  const _CardActions({
    required this.isSaved,
    this.onSaveTap,
    this.onMoreTap,
    this.onReport,
  });

  final bool isSaved;
  final VoidCallback? onSaveTap;
  final VoidCallback? onMoreTap;
  final VoidCallback? onReport;

  @override
  Widget build(BuildContext context) {
    return Wrap(
      spacing: AppSpacing.xs,
      runSpacing: AppSpacing.xs,
      children: [
        if (onSaveTap != null)
          Semantics(
            label: isSaved ? 'Remove from saved' : 'Save this item',
            hint: isSaved
                ? 'Removes this item from your saved list'
                : 'Saves this item for later',
            child: Tooltip(
              message: isSaved ? 'Saved' : 'Save',
              child: SizedBox.square(
                dimension: AppTouchTargets.minimum,
                child: IconButton.outlined(
                  onPressed: onSaveTap != null
                      ? () {
                          HapticFeedback.lightImpact();
                          onSaveTap!.call();
                        }
                      : null,
                  icon: Icon(
                    isSaved
                        ? Icons.bookmark_rounded
                        : Icons.bookmark_border_rounded,
                  ),
                  style: IconButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                    ),
                  ),
                ),
              ),
            ),
          ),
        if (onMoreTap != null)
          Semantics(
            label: 'More actions',
            hint: 'Shows additional options for this item',
            child: Tooltip(
              message: 'More actions',
              child: SizedBox.square(
                dimension: AppTouchTargets.minimum,
                child: IconButton.outlined(
                  onPressed: onMoreTap,
                  icon: const Icon(Icons.more_horiz_rounded),
                  style: IconButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                    ),
                  ),
                ),
              ),
            ),
          ),
        if (onReport != null)
          Semantics(
            label: 'Report this item',
            hint: 'Opens report options for this item',
            child: Tooltip(
              message: 'Report',
              child: SizedBox.square(
                dimension: AppTouchTargets.minimum,
                child: IconButton.outlined(
                  onPressed: onReport,
                  icon: const Icon(Icons.outlined_flag_rounded),
                  style: IconButton.styleFrom(
                    shape: RoundedRectangleBorder(
                      borderRadius: BorderRadius.circular(AppRadii.lg),
                    ),
                  ),
                ),
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
