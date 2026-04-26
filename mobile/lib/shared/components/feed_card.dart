import 'package:flutter/material.dart';

import '../../core/theme/app_theme.dart';
import '../../core/widgets/section_card.dart';
import '../../features/feed/domain/feed_snapshot.dart';
import 'app_buttons.dart';
import 'trust_badge.dart';

class FeedCard extends StatelessWidget {
  const FeedCard({
    super.key,
    required this.item,
    this.onPrimaryTap,
    this.onSecondaryTap,
    this.primaryLabel = 'Open',
    this.secondaryLabel = 'Message',
  });

  final MobileFeedItem item;
  final VoidCallback? onPrimaryTap;
  final VoidCallback? onSecondaryTap;
  final String primaryLabel;
  final String secondaryLabel;

  @override
  Widget build(BuildContext context) {
    final isDemand = item.type == MobileFeedItemType.demand;
    final reason = _decisionReason(item);

    return SectionCard(
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Wrap(
            spacing: 8,
            runSpacing: 8,
            children: [
              _Tag(label: item.type.label),
              _Tag(label: item.category),
              if (item.urgent)
                const _Tag(
                  label: 'Urgent',
                  backgroundColor: AppColors.dangerSoft,
                  foregroundColor: AppColors.danger,
                ),
              if (item.hasMedia) _Tag(label: '${item.mediaCount} media'),
            ],
          ),
          const SizedBox(height: 14),
          Text(item.title, style: Theme.of(context).textTheme.titleLarge),
          const SizedBox(height: 8),
          Text(item.description, style: Theme.of(context).textTheme.bodyMedium),
          const SizedBox(height: 12),
          _DecisionReason(reason: reason),
          const SizedBox(height: 16),
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Wrap(
                  spacing: 8,
                  runSpacing: 8,
                  children: [
                    TrustBadge(
                      label: item.trustLabel,
                      icon: item.isVerified
                          ? Icons.verified_rounded
                          : Icons.shield_outlined,
                    ),
                    TrustBadge(
                      label: item.responseLabel,
                      icon: Icons.schedule_rounded,
                      backgroundColor: AppColors.accentSoft,
                      foregroundColor: AppColors.accent,
                    ),
                    TrustBadge(
                      label: item.ratingLabel,
                      icon: Icons.star_rounded,
                      backgroundColor: AppColors.warningSoft,
                      foregroundColor: AppColors.warning,
                    ),
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: 16),
          Wrap(
            spacing: 12,
            runSpacing: 12,
            children: [
              _MetaItem(
                icon: Icons.person_outline_rounded,
                label: item.creatorName,
              ),
              _MetaItem(icon: Icons.place_outlined, label: item.distanceLabel),
              _MetaItem(icon: Icons.payments_outlined, label: item.priceLabel),
              _MetaItem(icon: Icons.history_rounded, label: item.timeLabel),
              if (item.completedJobs > 0)
                _MetaItem(
                  icon: Icons.task_alt_rounded,
                  label: '${item.completedJobs} completed',
                ),
            ],
          ),
          const SizedBox(height: 16),
          Container(
            width: double.infinity,
            padding: const EdgeInsets.all(12),
            decoration: BoxDecoration(
              color: AppColors.surfaceMuted,
              borderRadius: BorderRadius.circular(AppRadii.md),
              border: Border.all(color: AppColors.border),
            ),
            child: Text(
              isDemand
                  ? 'Nearby people can act on this quickly. Status: ${item.statusLabel}'
                  : 'Built for local discovery. Status: ${item.statusLabel}',
              style: Theme.of(
                context,
              ).textTheme.bodySmall?.copyWith(color: AppColors.ink),
            ),
          ),
          if (onPrimaryTap != null || onSecondaryTap != null) ...[
            const SizedBox(height: 16),
            Row(
              children: [
                if (onSecondaryTap != null) ...[
                  Expanded(
                    child: SecondaryButton(
                      label: secondaryLabel,
                      onPressed: onSecondaryTap,
                    ),
                  ),
                  const SizedBox(width: 12),
                ],
                if (onPrimaryTap != null)
                  Expanded(
                    child: PrimaryButton(
                      label: primaryLabel,
                      onPressed: onPrimaryTap,
                    ),
                  ),
              ],
            ),
          ],
        ],
      ),
    );
  }
}

String _decisionReason(MobileFeedItem item) {
  if (item.whyThisCard.trim().isNotEmpty) {
    return item.whyThisCard.trim();
  }
  if (item.feedReason.trim().isNotEmpty) {
    return item.feedReason.trim();
  }
  if (item.sourceType == 'accepted_connection') {
    return 'Shown first because this comes from your trusted network.';
  }
  if (item.urgent) {
    return 'Urgent nearby request with stronger response intent.';
  }
  if (item.type == MobileFeedItemType.demand) {
    return 'Ranked by local relevance, urgency, trust, and distance.';
  }
  return 'Ranked by trust signals, response speed, and nearby fit.';
}

class _DecisionReason extends StatelessWidget {
  const _DecisionReason({required this.reason});

  final String reason;

  @override
  Widget build(BuildContext context) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(12),
      decoration: BoxDecoration(
        color: AppColors.primarySoft,
        borderRadius: BorderRadius.circular(AppRadii.md),
        border: Border.all(color: AppColors.border),
      ),
      child: Row(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const Icon(
            Icons.auto_awesome_outlined,
            size: 16,
            color: AppColors.primary,
          ),
          const SizedBox(width: 8),
          Expanded(
            child: Text(
              reason,
              style: Theme.of(context).textTheme.bodySmall?.copyWith(
                color: AppColors.primaryDeep,
                fontWeight: FontWeight.w700,
              ),
            ),
          ),
        ],
      ),
    );
  }
}

class _Tag extends StatelessWidget {
  const _Tag({
    required this.label,
    this.backgroundColor = AppColors.surfaceMuted,
    this.foregroundColor = AppColors.ink,
  });

  final String label;
  final Color backgroundColor;
  final Color foregroundColor;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 240),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: backgroundColor,
          borderRadius: BorderRadius.circular(AppRadii.md),
        ),
        child: Text(
          label,
          maxLines: 1,
          overflow: TextOverflow.ellipsis,
          style: Theme.of(
            context,
          ).textTheme.labelMedium?.copyWith(color: foregroundColor),
        ),
      ),
    );
  }
}

class _MetaItem extends StatelessWidget {
  const _MetaItem({required this.icon, required this.label});

  final IconData icon;
  final String label;

  @override
  Widget build(BuildContext context) {
    return ConstrainedBox(
      constraints: const BoxConstraints(maxWidth: 220),
      child: Container(
        padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 8),
        decoration: BoxDecoration(
          color: Colors.white,
          borderRadius: BorderRadius.circular(AppRadii.md),
          border: Border.all(color: AppColors.border),
        ),
        child: Row(
          mainAxisSize: MainAxisSize.min,
          children: [
            Icon(icon, size: 14, color: AppColors.inkMuted),
            const SizedBox(width: 6),
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
