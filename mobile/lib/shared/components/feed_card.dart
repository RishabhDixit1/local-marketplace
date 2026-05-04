import 'package:flutter/material.dart';

import '../../core/design_system/serviq_pills.dart';
import '../../core/theme/app_theme.dart';
import '../../core/widgets/section_card.dart';
import '../../features/feed/domain/feed_snapshot.dart';
import 'app_buttons.dart';

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

    return SectionCard(
      padding: const EdgeInsets.all(14),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      maxLines: 2,
                      overflow: TextOverflow.ellipsis,
                      style: Theme.of(context).textTheme.titleLarge,
                    ),
                    const SizedBox(height: 8),
                    Wrap(
                      spacing: 8,
                      runSpacing: 6,
                      children: [
                        _MetaPill(
                          icon: Icons.person_outline_rounded,
                          label: item.creatorName,
                        ),
                        _MetaPill(
                          icon: Icons.place_outlined,
                          label: item.distanceLabel,
                        ),
                      ],
                    ),
                  ],
                ),
              ),
              const SizedBox(width: 10),
              Column(
                crossAxisAlignment: CrossAxisAlignment.end,
                children: [
                  ServiqStatusPill(label: statusLabel, urgent: item.urgent),
                  if (onSaveTap != null || onMoreTap != null) ...[
                    const SizedBox(height: 6),
                    Row(
                      mainAxisSize: MainAxisSize.min,
                      children: [
                        if (onSaveTap != null)
                          IconButton.outlined(
                            tooltip: isSaved ? 'Saved' : 'Save',
                            onPressed: onSaveTap,
                            icon: Icon(
                              isSaved
                                  ? Icons.bookmark_rounded
                                  : Icons.bookmark_border_rounded,
                            ),
                          ),
                        if (onMoreTap != null) ...[
                          if (onSaveTap != null) const SizedBox(width: 4),
                          IconButton.outlined(
                            tooltip: 'More actions',
                            onPressed: onMoreTap,
                            icon: const Icon(Icons.more_horiz_rounded),
                          ),
                        ],
                      ],
                    ),
                  ],
                ],
              ),
            ],
          ),
          const SizedBox(height: 12),
          Text(
            item.description,
            maxLines: 2,
            overflow: TextOverflow.ellipsis,
            style: Theme.of(context).textTheme.bodyMedium,
          ),
          const SizedBox(height: 10),
          Wrap(
            spacing: 8,
            runSpacing: 6,
            children: [
              _InfoPill(label: item.ratingLabel),
              _InfoPill(label: item.socialProofLabel),
            ],
          ),
          const SizedBox(height: 12),
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _InfoPill(label: item.type.label),
              _InfoPill(label: item.category),
              _InfoPill(label: item.priceLabel),
              _InfoPill(label: item.timeLabel),
            ],
          ),
          if ((reason ?? '').trim().isNotEmpty) ...[
            const SizedBox(height: 12),
            Container(
              width: double.infinity,
              padding: const EdgeInsets.all(12),
              decoration: BoxDecoration(
                color: reasonBackgroundColor,
                borderRadius: BorderRadius.circular(AppRadii.md),
              ),
              child: Text(
                reason!.trim(),
                style: Theme.of(
                  context,
                ).textTheme.bodySmall?.copyWith(color: reasonForegroundColor),
              ),
            ),
          ],
          if (onPrimaryTap != null || onSecondaryTap != null) ...[
            const SizedBox(height: 14),
            Row(
              children: [
                if (onPrimaryTap != null)
                  Expanded(
                    child: PrimaryButton(
                      label: primaryLabel,
                      onPressed: onPrimaryTap,
                    ),
                  ),
                if (onSecondaryTap != null) ...[
                  const SizedBox(width: 10),
                  Tooltip(
                    message: secondaryLabel,
                    child: IconButton.outlined(
                      onPressed: onSecondaryTap,
                      icon: Icon(secondaryIcon),
                    ),
                  ),
                ],
              ],
            ),
          ],
        ],
      ),
    );
  }
}

class _MetaPill extends StatelessWidget {
  const _MetaPill({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 180),
      child: Row(
        mainAxisSize: MainAxisSize.min,
        children: [
          Icon(icon, size: 14, color: AppColors.inkMuted),
          const SizedBox(width: 5),
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
    );
  }
}

class _InfoPill extends StatelessWidget {
  const _InfoPill({required this.label});

  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 180),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 7),
        decoration: BoxDecoration(
          color: AppColors.surfaceMuted,
          borderRadius: BorderRadius.circular(AppRadii.pill),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(context).textTheme.labelMedium,
        ),
      ),
    );
  }
}
