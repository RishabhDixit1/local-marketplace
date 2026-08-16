import 'package:flutter/material.dart';

import '../../core/design_system/design_system.dart';
import '../../core/theme/design_tokens.dart';
import 'nameplate_card.dart';

/// A provider card for marketplace contexts (zone detail, market detail).
/// Shows avatar, name, location, rating, response time, jobs, and verified badge.
class MarketplaceProviderCard extends StatelessWidget {
  const MarketplaceProviderCard({
    required this.name,
    this.location,
    this.avatarUrl,
    this.bio,
    this.avgRating,
    this.reviewCount = 0,
    this.completedJobs = 0,
    this.responseMinutes,
    this.verified = false,
    this.featured = false,
    this.priceMin,
    this.priceMax,
    this.onTap,
    this.trailing,
    super.key,
  });

  final String name;
  final String? location;
  final String? avatarUrl;
  final String? bio;
  final double? avgRating;
  final int reviewCount;
  final int completedJobs;
  final int? responseMinutes;
  final bool verified;
  final bool featured;
  final num? priceMin;
  final num? priceMax;
  final VoidCallback? onTap;
  final Widget? trailing;

  String? get _priceLabel {
    if (priceMin == null) return null;
    if (priceMax != null && priceMax! > priceMin!) {
      return '₹$priceMin – ₹$priceMax';
    }
    return 'From ₹$priceMin';
  }

  @override
  Widget build(BuildContext context) {
    final theme = Theme.of(context);
    final textSecondary = theme.colorScheme.onSurface.withValues(alpha: 0.55);
    final textTertiary = theme.colorScheme.onSurface.withValues(alpha: 0.45);

    return NameplateCard(
      onTap: onTap,
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              AppAvatar(name: name, avatarUrl: avatarUrl ?? '', radius: 22),
              const SizedBox(width: AppSpacing.sm),
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Row(
                      children: [
                        Expanded(
                          child: Text(
                            name,
                            style: theme.textTheme.titleSmall?.copyWith(
                              fontWeight: FontWeight.w700,
                            ),
                            maxLines: 1,
                            overflow: TextOverflow.ellipsis,
                          ),
                        ),
                        if (featured) ...[
                          const SizedBox(width: AppSpacing.xxs),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.marigold.withValues(alpha: 0.12),
                              borderRadius: BorderRadius.circular(AppRadii.pill),
                              border: Border.all(
                                color: AppColors.marigold.withValues(alpha: 0.3),
                              ),
                            ),
                            child: Row(
                              mainAxisSize: MainAxisSize.min,
                              children: [
                                Icon(
                                  Icons.auto_awesome_rounded,
                                  size: 9,
                                  color: AppColors.marigold,
                                ),
                                const SizedBox(width: 2),
                                Text(
                                  'Featured',
                                  style: TextStyle(
                                    fontSize: 9,
                                    fontWeight: FontWeight.w800,
                                    color: AppColors.marigold,
                                  ),
                                ),
                              ],
                            ),
                          ),
                        ],
                        if (verified) ...[
                          const SizedBox(width: AppSpacing.xxs),
                          Container(
                            padding: const EdgeInsets.symmetric(
                              horizontal: 6,
                              vertical: 1,
                            ),
                            decoration: BoxDecoration(
                              color: AppColors.verifiedSoft,
                              borderRadius: BorderRadius.circular(AppRadii.pill),
                              border: Border.all(
                                color: AppColors.verified.withValues(alpha: 0.25),
                              ),
                            ),
                            child: Text(
                              'Verified',
                              style: TextStyle(
                                fontSize: 9,
                                fontWeight: FontWeight.w800,
                                color: AppColors.verified,
                              ),
                            ),
                          ),
                        ],
                      ],
                    ),
                    if (location != null && location!.isNotEmpty) ...[
                      const SizedBox(height: AppSpacing.xxxs),
                      Row(
                        children: [
                          Icon(Icons.location_on_rounded, size: 12, color: textTertiary),
                          const SizedBox(width: AppSpacing.xxxs),
                          Expanded(
                            child: Text(
                              location!,
                              maxLines: 1,
                              overflow: TextOverflow.ellipsis,
                              style: TextStyle(fontSize: 11, color: textSecondary),
                            ),
                          ),
                        ],
                      ),
                    ],
                  ],
                ),
              ),
            ],
          ),
          const SizedBox(height: AppSpacing.xs),
          // Signal chips
          Wrap(
            spacing: AppSpacing.sm,
            runSpacing: AppSpacing.xxs,
            children: [
              if (avgRating != null)
                _SignalChip(
                  icon: Icons.star_rounded,
                  iconColor: AppColors.marigold,
                  label: '${avgRating!.toStringAsFixed(1)} ($reviewCount)',
                ),
              if (responseMinutes != null)
                _SignalChip(
                  icon: Icons.bolt_rounded,
                  iconColor: AppColors.primary,
                  label: '~$responseMinutes min',
                ),
              if (completedJobs > 0)
                _SignalChip(
                  icon: Icons.check_circle_outline_rounded,
                  iconColor: textTertiary,
                  label: '$completedJobs jobs',
                ),
            ],
          ),
          if (bio != null && bio!.isNotEmpty) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              bio!,
              maxLines: 2,
              overflow: TextOverflow.ellipsis,
              style: TextStyle(fontSize: 12, color: textSecondary, height: 1.4),
            ),
          ],
          if (_priceLabel != null) ...[
            const SizedBox(height: AppSpacing.xs),
            Text(
              _priceLabel!,
              style: TextStyle(
                fontSize: 14,
                fontWeight: FontWeight.w800,
                color: AppColors.primaryDeep,
              ),
            ),
          ],
          if (trailing != null) ...[
            const SizedBox(height: AppSpacing.xs),
            trailing!,
          ],
        ],
      ),
    );
  }

}

class _SignalChip extends StatelessWidget {
  const _SignalChip({
    required this.icon,
    required this.iconColor,
    required this.label,
  });

  final IconData icon;
  final Color iconColor;
  final String label;

  @override
  Widget build(BuildContext context) {
    return Row(
      mainAxisSize: MainAxisSize.min,
      children: [
        Icon(icon, size: 12, color: iconColor),
        const SizedBox(width: AppSpacing.xxxs),
        Text(
          label,
          style: TextStyle(
            fontSize: 11,
            fontWeight: FontWeight.w600,
            color: Theme.of(context).colorScheme.onSurface.withValues(alpha: 0.55),
          ),
        ),
      ],
    );
  }
}
